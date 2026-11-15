"""Naija Market Rush backend: turns a photo or a prompt into a 3D shelf item with Aholo Lux3D.

Endpoints
  GET  /api/health          -> {"lux3d": bool, "mock": bool}
  POST /api/make            -> form fields: photo (image file) and/or prompt (text) -> {"taskId": ...}
  GET  /api/task/{task_id}  -> {"state": "running"|"done"|"failed", "glbUrl": "/api/glb/<id>"}
  GET  /api/glb/{task_id}   -> the generated GLB (cached on disk)
  /                         -> serves the built game (web/dist) if present

Lux3D calls use the official SDK (pip install manycore-aholo-sdk-lux3d), Global region
(https://api.aholo.ai/global/lux3d/v1/...). The API key is read ONLY from the AHOLO_API_KEY
environment variable. Set LUX3D_MOCK=1 to test the whole flow without spending credits.
"""
from __future__ import annotations

import base64
import io
import os
import struct
import threading
import time
import zipfile
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DIST = Path(os.environ.get("WEB_DIST", ROOT.parent / "web" / "dist"))
CACHE = Path(os.environ.get("GENERATED_DIR", ROOT / "generated"))
CACHE.mkdir(parents=True, exist_ok=True)

API_KEY = os.environ.get("AHOLO_API_KEY", "").strip()
MOCK = os.environ.get("LUX3D_MOCK", "") == "1"
VERSION = os.environ.get("LUX3D_VERSION", "G1-Turbo")           # G1 or G1-Turbo
STYLE = os.environ.get("LUX3D_STYLE", "cartoon")                # text-to-3D style
FACES = int(os.environ.get("LUX3D_FACE_COUNT", "30000"))        # 10k-300k; low = fast to load in a browser
MAX_PER_HOUR = int(os.environ.get("MAX_GENERATIONS_PER_HOUR", "12"))  # protects hackathon credits on a public demo
MAX_UPLOAD = 10 * 1024 * 1024

app = FastAPI(title="Naija Market Rush · Lux3D backend")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
                   allow_methods=["GET", "POST"], allow_headers=["*"])

_tasks: dict[str, dict] = {}       # only tasks created by this server can be polled/downloaded
_recent: list[float] = []
_lock = threading.Lock()
_client = None


def lux3d():
    global _client
    if _client is None:
        from manycore.aholo_sdk_core import AholoClientConfig
        from manycore.aholo_sdk_lux3d import create_lux3d_client
        _client = create_lux3d_client(AholoClientConfig(api_key=API_KEY, region="com"))  # "com" = Global
    return _client


@app.get("/api/health")
def health():
    return {"lux3d": bool(API_KEY) or MOCK, "mock": MOCK, "version": VERSION}


def _rate_limit():
    now = time.time()
    with _lock:
        _recent[:] = [t for t in _recent if now - t < 3600]
        if len(_recent) >= MAX_PER_HOUR:
            raise HTTPException(429, "Market too busy: generation limit reached for this hour. Try 'Import a Lux3D .glb'.")
        _recent.append(now)


@app.post("/api/make")
async def make(photo: UploadFile | None = File(None), prompt: str = Form("")):
    if not (API_KEY or MOCK):
        raise HTTPException(503, "AHOLO_API_KEY is not set on the server")
    prompt = (prompt or "").strip()[:300]
    data = await photo.read() if photo is not None else b""
    if not data and not prompt:
        raise HTTPException(400, "Send a photo or a prompt")
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Photo too large (max 10 MB)")
    _rate_limit()
    if MOCK:
        tid = f"mock{int(time.time() * 1000)}"
        _tasks[tid] = {"created": time.time(), "mock": True}
        return {"taskId": tid}
    try:
        if data:
            mime = photo.content_type or "image/jpeg"
            img = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
            task_id = lux3d().img_to_3d.create(img=img, version=VERSION, face_count=FACES,
                                               output_format=["glb"] if VERSION == "G1-Turbo" else None,
                                               enable_pbr=True if VERSION == "G1-Turbo" else None)
        else:
            full = f"{prompt}. Single object, game prop, clean shape, centered."
            task_id = lux3d().text_to_3d.create(prompt=full, version=VERSION, style=STYLE, face_count=FACES,
                                                output_format=["glb"] if VERSION == "G1-Turbo" else None,
                                                enable_pbr=True if VERSION == "G1-Turbo" else None)
    except Exception as e:  # surface the Lux3D error message (e.g. GENERATION_CONCURRENCY_LIMIT_EXCEEDED)
        raise HTTPException(502, f"Lux3D create failed: {e}") from e
    tid = str(task_id)
    _tasks[tid] = {"created": time.time()}
    return {"taskId": tid}


def _pick_glb_url(outputs: list[dict]) -> str | None:
    urls = [o.get("content") for o in outputs if isinstance(o, dict) and isinstance(o.get("content"), str)]
    urls = [u for u in urls if u.startswith("http")]
    for u in urls:
        if ".glb" in u.split("?")[0].lower():
            return u
    return urls[0] if urls else None   # may be a ZIP; handled in _download


def _download(url: str, dest: Path):
    with httpx.Client(timeout=120, follow_redirects=True) as c:
        r = c.get(url)
        r.raise_for_status()
        body = r.content
    if body[:4] == b"glTF":
        dest.write_bytes(body)
        return
    if body[:2] == b"PK":   # ZIP package: take the first .glb inside
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".glb")]
            if names:
                dest.write_bytes(z.read(names[0]))
                return
    raise RuntimeError("Lux3D output did not contain a GLB")


@app.get("/api/task/{task_id}")
def task(task_id: str):
    meta = _tasks.get(task_id)
    if meta is None:
        raise HTTPException(404, "Unknown task")
    dest = CACHE / f"{task_id}.glb"
    if dest.exists():
        return {"state": "done", "glbUrl": f"/api/glb/{task_id}"}
    if meta.get("mock"):
        if time.time() - meta["created"] < 6:
            return {"state": "running"}
        dest.write_bytes(_mock_glb())
        return {"state": "done", "glbUrl": f"/api/glb/{task_id}"}
    try:
        res = lux3d().tasks.retrieve(task_id)
    except Exception as e:
        return {"state": "running", "detail": f"query error, retrying: {e}"}
    status = res.get("status")
    if status in (0, 1):
        return {"state": "running"}
    if status in (4, 6):
        return {"state": "failed", "detail": f"Lux3D status {status}"}
    url = _pick_glb_url(res.get("outputs") or [])
    if not url:
        return {"state": "failed", "detail": "No output URL"}
    try:
        _download(url, dest)   # Lux3D output URLs expire after ~2 hours, so cache locally
    except Exception as e:
        return {"state": "failed", "detail": str(e)}
    return {"state": "done", "glbUrl": f"/api/glb/{task_id}"}


@app.get("/api/glb/{task_id}")
def glb(task_id: str):
    if task_id not in _tasks:
        raise HTTPException(404, "Unknown task")
    p = CACHE / f"{task_id}.glb"
    if not p.exists():
        raise HTTPException(404, "Not ready")
    return FileResponse(p, media_type="model/gltf-binary", filename=f"lux3d_{task_id}.glb")


def _mock_glb() -> bytes:
    """A tiny purple cube GLB, used only when LUX3D_MOCK=1 (clearly not a Lux3D asset)."""
    import json
    v = [(-.5, 0, -.5), (.5, 0, -.5), (.5, 1, -.5), (-.5, 1, -.5), (-.5, 0, .5), (.5, 0, .5), (.5, 1, .5), (-.5, 1, .5)]
    idx = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5]
    pos = b"".join(struct.pack("<3f", *p) for p in v)
    ind = b"".join(struct.pack("<H", i) for i in idx)
    ind += b"\x00" * (-len(ind) % 4)
    bin_ = pos + ind
    gltf = {"asset": {"version": "2.0", "generator": "naija-market-rush mock"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
            "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [0.6, 0.3, 0.8, 1], "roughnessFactor": 0.6}}],
            "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
            "buffers": [{"byteLength": len(bin_)}],
            "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": len(pos)},
                            {"buffer": 0, "byteOffset": len(pos), "byteLength": len(idx) * 2}],
            "accessors": [{"bufferView": 0, "componentType": 5126, "count": 8, "type": "VEC3", "min": [-.5, 0, -.5], "max": [.5, 1, .5]},
                          {"bufferView": 1, "componentType": 5123, "count": len(idx), "type": "SCALAR"}]}
    js = json.dumps(gltf).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    return (struct.pack("<4sII", b"glTF", 2, total) + struct.pack("<I4s", len(js), b"JSON") + js
            + struct.pack("<I4s", len(bin_), b"BIN\x00") + bin_)


def mount_game(target=app):
    """Serve the built game at / (mounted last so /api/* and other mounts win)."""
    if DIST.exists():
        target.mount("/", StaticFiles(directory=DIST, html=True), name="game")


if os.environ.get("NMR_DEFER_STATIC") != "1":
    mount_game()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
