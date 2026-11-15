#!/usr/bin/env python3
"""Round-2 Lux3D generator. Concurrency 2, long timeout, skip existing files.
Never prints the API key. Appends each result as a sidecar JSON, then merges the log."""
from __future__ import annotations

import io
import json
import os
import sys
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
from manycore.aholo_sdk_core import AholoClientConfig
from manycore.aholo_sdk_lux3d import create_lux3d_client
from manycore.aholo_sdk_lux3d._paths import lux3d_path

WAT = timezone(timedelta(hours=1), name="WAT")
ROOT = Path("/workspace/naija-market-rush")
OUT = ROOT / "web/public/assets/models"
LOG_PATH = ROOT / "docs/lux3d_generation_log.json"
SIDECAR_DIR = Path("/tmp/lux3d_results")
SIDECAR_DIR.mkdir(parents=True, exist_ok=True)

SUFFIX = ". Single object, game prop, clean shape, centered."
POLL_S = 10
TIMEOUT_S = 1200
CONCURRENCY = 2

ITEMS = [
    # Oja Oba
    {"id": "talking_drum", "level": "ojaoba", "prompt": "A Yoruba talking drum (gangan) with leather tension straps and a curved wooden body, cartoon game prop"},
    {"id": "beaded_crown", "level": "ojaoba", "prompt": "A Yoruba royal ade crown covered in colourful coral and glass beads with a beaded face veil, cartoon game prop"},
    {"id": "coral_beads", "level": "ojaoba", "prompt": "A heavy Nigerian coral bead necklace (ileke) in deep red-orange, several stacked strands, cartoon game prop"},
    {"id": "irukere", "level": "ojaoba", "prompt": "A royal horse-tail fly whisk (irukere) with a carved pale handle and a burst of white horsehair, cartoon game prop"},
    {"id": "calabash_wine", "level": "ojaoba", "prompt": "A round calabash gourd bowl filled with milky white palm wine, cartoon game prop"},
    {"id": "kola_bowl", "level": "ojaoba", "prompt": "A small carved wooden bowl of split brown kola nuts, cartoon game prop"},
    {"id": "ife_head", "level": "ojaoba", "prompt": "A bronze Ife head sculpture replica, serene face with delicate scarification, metallic brown, cartoon game prop"},
    {"id": "aso_oke", "level": "ojaoba", "prompt": "A folded stack of shimmering gold and burgundy aso-oke woven cloth, cartoon game prop"},
    {"id": "shea_pot", "level": "ojaoba", "prompt": "A clay pot of creamy yellow shea butter with a wooden lid slightly open, cartoon game prop"},
    {"id": "cowrie_purse", "level": "ojaoba", "prompt": "A small brown leather purse decorated with white cowrie shells, cartoon game prop"},
    {"id": "royal_staff", "level": "ojaoba", "prompt": "A carved Yoruba royal staff with a beaded top and a horsehair tassel, standing upright, cartoon game prop"},
    {"id": "carved_stool", "level": "ojaoba", "prompt": "A low carved wooden royal stool with geometric Yoruba patterns, cartoon game prop"},
    # Night
    {"id": "puff_puff", "level": "night", "prompt": "A small clear nylon bag heaped with golden-brown Nigerian puff-puff dough balls, cartoon game prop"},
    {"id": "akara_tray", "level": "night", "prompt": "A wide metal tray of freshly fried golden akara bean cakes, cartoon game prop"},
    {"id": "boli_plate", "level": "night", "prompt": "A plate of roasted plantain (boli) with a cob of roasted corn beside it, cartoon game prop"},
    {"id": "coal_brazier", "level": "night", "prompt": "A small metal coal pot brazier with glowing red charcoal, cartoon game prop"},
    {"id": "pepper_soup", "level": "night", "prompt": "A steaming enamel bowl of Nigerian goat pepper soup in a reddish broth, cartoon game prop"},
    {"id": "zobo_jug", "level": "night", "prompt": "A plastic jug of deep purple-red zobo hibiscus drink with a straw, cartoon game prop"},
    {"id": "groundnut_cone", "level": "night", "prompt": "A twisted paper cone overflowing with roasted groundnuts, cartoon game prop"},
    {"id": "mosquito_coil", "level": "night", "prompt": "A green spiral mosquito coil sitting on a small metal stand, cartoon game prop"},
    {"id": "recharge_lamp", "level": "night", "prompt": "A cheap boxy white rechargeable LED lamp with a small solar panel on top, cartoon game prop"},
    {"id": "agbo_bottle", "level": "night", "prompt": "A dark recycled glass bottle of Nigerian herbal mixture (agbo) with leaves visible inside, cartoon game prop"},
    {"id": "night_mask", "level": "night", "prompt": "A slightly spooky carved wooden Yoruba-style face mask, dark wood with white painted eyes, standalone, cartoon game prop"},
    {"id": "amulet_pouch", "level": "night", "prompt": "A small worn leather charm pouch tied with cowrie shells and red thread, cartoon game prop"},
]

KNOWN_TASKS = {
    "talking_drum": 8013931,
    "beaded_crown": 8013965,
    "coral_beads": 8013966,
    "irukere": 8014080,
    "calabash_wine": 8014109,
    "kola_bowl": 8014171,
    "ife_head": 8014317,
    "aso_oke": 8014438,
}

FATAL_MARKERS = (
    "INSUFFICIENT_CREDIT",
    "INSUFFICIENT_CREDITS",
    "CREDIT_NOT_ENOUGH",
    "UNAUTHORIZED",
    "AUTH",
    "FORBIDDEN",
    "INVALID_API_KEY",
    "API_KEY",
)


def now_iso():
    return datetime.now(WAT).isoformat()


def save_sidecar(rec: dict):
    path = SIDECAR_DIR / f"{rec['id']}.json"
    path.write_text(json.dumps(rec, indent=2) + "\n")
    return path


def extract_url(d: dict):
    outputs = d.get("outputs") or []
    urls = [
        o.get("content")
        for o in outputs
        if isinstance(o, dict) and isinstance(o.get("content"), str) and str(o.get("content")).startswith("http")
    ]
    if not urls:
        return None
    return next((u for u in urls if ".glb" in u.split("?")[0].lower()), urls[0])


def write_glb(dest: Path, body: bytes) -> int:
    if body[:4] == b"glTF":
        dest.write_bytes(body)
        return len(body)
    if body[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".glb")]
            data = z.read(names[0])
            dest.write_bytes(data)
            return len(data)
    raise ValueError(f"unexpected magic {body[:8]!r}")


def is_fatal(err: str) -> bool:
    u = (err or "").upper()
    return any(m in u for m in FATAL_MARKERS)


def get_task(client, tid):
    return client.tasks.retrieve(tid)


def create_task(client, prompt: str):
    tid = client.text_to_3d.create(
        prompt=prompt,
        version="G1-Turbo",
        style="cartoon",
        face_count=30000,
        output_format=["glb"],
        enable_pbr=True,
    )
    return int(tid), None


def generate_one(client, item):
    rec = {
        "id": item["id"],
        "file": f"{item['id']}.glb",
        "path": f"web/public/assets/models/{item['id']}.glb",
        "prompt": item["prompt"] + SUFFIX,
        "method": "text-to-3d",
        "version": "G1-Turbo",
        "style": "cartoon",
        "face_count": 30000,
        "level": item["level"],
        "round": 2,
        "started_at": now_iso(),
        "task_id": None,
        "status": None,
        "state": "running",
        "error": None,
        "bytes": None,
        "elapsed_s": None,
        "finished_at": None,
        "consumed_credits": None,
    }
    dest = OUT / rec["file"]
    t0 = time.time()
    print(f"[{item['id']}] start", flush=True)
    try:
        tid, raw = create_task(client, rec["prompt"])
        rec["task_id"] = tid
        rec["consumed_credits"] = 13  # charged at create for G1-Turbo
        print(f"[{item['id']}] task_id={tid}", flush=True)
        save_sidecar(rec)
        deadline = time.time() + TIMEOUT_S
        last = 0
        while time.time() < deadline:
            d = get_task(client, tid)
            st = d.get("status")
            rec["status"] = st
            if st != last:
                print(f"[{item['id']}] status={st} t+{time.time()-t0:.0f}s", flush=True)
                last = st
            if st == 3:
                url = extract_url(d)
                if not url:
                    raise RuntimeError("success but no output url")
                with httpx.Client(timeout=180, follow_redirects=True) as c:
                    r = c.get(url)
                    r.raise_for_status()
                    body = r.content
                rec["bytes"] = write_glb(dest, body)
                rec["state"] = "success"
                rec["finished_at"] = now_iso()
                rec["elapsed_s"] = round(time.time() - t0, 1)
                rec["error"] = None
                print(f"[{item['id']}] saved {rec['bytes']} bytes in {rec['elapsed_s']}s", flush=True)
                save_sidecar(rec)
                return rec
            if st in (4, 6):
                rec["state"] = "failed" if st == 4 else "canceled"
                rec["error"] = f"api status {st}"
                rec["finished_at"] = now_iso()
                rec["elapsed_s"] = round(time.time() - t0, 1)
                print(f"[{item['id']}] FAILED status={st}", flush=True)
                save_sidecar(rec)
                return rec
            time.sleep(POLL_S)
        rec["state"] = "timeout"
        rec["error"] = f"timeout after {TIMEOUT_S}s (task_id={tid}, last status={rec['status']})"
        rec["finished_at"] = now_iso()
        rec["elapsed_s"] = round(time.time() - t0, 1)
        print(f"[{item['id']}] TIMEOUT task_id={tid} last_status={rec['status']}", flush=True)
        save_sidecar(rec)
        return rec
    except Exception as e:
        rec["state"] = "failed"
        rec["error"] = str(e)
        rec["finished_at"] = now_iso()
        rec["elapsed_s"] = round(time.time() - t0, 1)
        print(f"[{item['id']}] ERROR {e}", flush=True)
        save_sidecar(rec)
        return rec


def main():
    key = os.environ.get("AHOLO_API_KEY", "").strip()
    if not key:
        print("AHOLO_API_KEY is not set", file=sys.stderr)
        sys.exit(2)
    only = sys.argv[1:] if len(sys.argv) > 1 else []
    todo = []
    for item in ITEMS:
        if only and item["id"] not in only:
            continue
        dest = OUT / f"{item['id']}.glb"
        if dest.exists() and dest.stat().st_size > 10_000:
            print(f"[{item['id']}] skip, file already exists ({dest.stat().st_size} bytes)", flush=True)
            continue
        todo.append(item)
    print(f"todo={len(todo)} { [t['id'] for t in todo] }", flush=True)
    if not todo:
        print("ALL DONE (nothing to generate)", flush=True)
        return
    client = create_lux3d_client(AholoClientConfig(api_key=key, region="com"))
    results = []
    fatal = None
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = {ex.submit(generate_one, client, it): it for it in todo}
        for fut in as_completed(futs):
            rec = fut.result()
            results.append(rec)
            if rec.get("error") and is_fatal(rec["error"]):
                fatal = rec
                print(f"FATAL credit/auth error on {rec['id']}: stopping further creates", flush=True)
                # cancel pending futures is best-effort; already-created tasks keep running
                break
    if fatal:
        print("STOPPED_EARLY", fatal["id"], fatal["error"], flush=True)
        sys.exit(3)
    ok = sum(1 for r in results if r["state"] == "success")
    print(f"ALL DONE attempted={len(results)} succeeded={ok}", flush=True)


if __name__ == "__main__":
    main()
