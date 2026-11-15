# Naija Market Rush

A funny browser game set in a busy Nigerian market. You run a stall. Customers shout what they want ("Abeg, bring me yam!", "Where's my agbada?!") and you tap the right item before their patience runs out. Snap a photo or type a prompt, and **Aholo Lux3D** turns it into a 3D item that lands on your shelf, ready to sell.

Entry for the **Manycore Aholo Global 3D AI Hackathon** (Gaming).

![Gameplay](docs/screenshots/03-serving.png)

## Status (be honest about what is real)

| Part | Status |
|---|---|
| Playable game (Three.js, 75 s shift, combo, tips, VIP customer, reputation, rush hour, mobile tap controls, synth sounds) | ✅ Built and smoke-tested headless |
| Item pipeline: `web/public/assets/manifest.json` + `*.glb` files | ✅ Built. **All 12 shelf items are real Aholo Lux3D text-to-3D GLBs** (G1-Turbo, cartoon, target 30k faces), compressed with gltf-transform (Draco + WebP 1024px) under `web/public/assets/models/`. See `docs/lux3d_generation_log.json`. |
| "Make an item" → Lux3D API (photo → image-to-3D, prompt → text-to-3D) via `server/app.py` | ✅ Tested against the live Global API (not mock). In-game generation of a "Tomato basket" from a text prompt succeeded in 168.4 s and loaded on the shelf (task 8012442). |
| "Import a Lux3D .glb" (drag a GLB exported from the Lux3D web app) | ✅ Works on any static host, tested with a sample GLB |
| Market scenery from Lux3D (`scenery` in manifest) | ✅ Loader ready; procedural neighbour stalls are shown until GLBs exist |

## Run it

```bash
# game only (static)
cd web && npm install && npm run dev          # http://localhost:5173

# game + Lux3D backend
python -m venv .venv && . .venv/bin/activate
pip install -r server/requirements.txt
cd web && npm run build && cd ..
export AHOLO_API_KEY=...        # Global key from https://3d.aholo.ai (never commit it)
python server/app.py            # http://localhost:8000  (serves web/dist + /api/*)
# no key yet?  LUX3D_MOCK=1 python server/app.py   -> fake purple cube, no credits used
```

During `npm run dev`, Vite proxies `/api` to `localhost:8000`. If the frontend is hosted separately (e.g. Vercel), build it with `VITE_API_BASE=https://your-backend` and set `CORS_ORIGINS` on the server.

Tests: `python tests/smoke.py http://localhost:4173 docs/screenshots path/to/any.glb` (after `npm run build && npx vite preview`) and `LUX3D_MOCK=1 python server/app.py` + `python tests/mock_make.py http://localhost:8000`.

## Add Lux3D assets

1. Generate each item in Lux3D (web app at https://3d.aholo.ai, or the API). Prompts and photo tips: [docs/LUX3D_ASSETS.md](docs/LUX3D_ASSETS.md).
2. Download the **GLB**. Keep it light for the browser: aim for 20k–50k faces, under ~8 MB.
3. Save it as `web/public/assets/models/<filename from manifest.json>` (e.g. `models/yam.glb`). The game auto-scales and centres it; the "placeholder" tag disappears from that item's label.
4. Scenery props go in `web/public/assets/env/` (names in the `scenery` list). Each one found hides a procedural neighbour stall.
5. Reload. The start screen reports how many items are real Lux3D models vs placeholders.

To add a brand new item, add an entry to `items` in `manifest.json` (`id`, `name`, `price` in naira, `glb`, `requests` lines). The shelf holds 12; extras made in-game replace the oldest slot.

## Architecture

```
web/  (Vite + Three.js, static build)
  src/main.js         game loop, customers, serving, scoring, input (raycast + generous tap fallback)
  src/world.js        low-poly market: stall, tiered table, neighbours, buildings, bunting, crowd
  src/items.js        manifest loader, GLTFLoader (+Draco), auto-normalise, placeholder fallback
  src/placeholders.js procedural PLACEHOLDER meshes (12 items + generic)
  src/customers.js    procedural customers (gele / fila / Alhaji VIP), moods
  src/maker.js        "Make an item": Lux3D generate (backend) or GLB import
  src/audio.js        WebAudio synth sfx + talking-drum loop (no audio files)
  public/assets/      manifest.json + Lux3D GLBs
server/app.py         FastAPI: /api/make -> Lux3D create (official SDK, Global region "com"),
                      /api/task/{id} -> poll + download GLB (cached; output URLs expire ~2 h),
                      /api/glb/{id}, serves web/dist. Rate limit (MAX_GENERATIONS_PER_HOUR).
modelscope/app.py     ModelScope Studio (Gradio SDK) entry: same server on port 7860
scripts/build_modelscope.sh  assembles build/modelscope/
```

Lux3D API used: `POST https://api.aholo.ai/global/lux3d/v1/generate/img-to-3d/task/create` (photo sent as a data URL) and `.../text-to-3d/task/create`, then `GET .../generate/task/get?taskid=` until `status=3`. Header `Authorization: <key>` (no Bearer). Defaults: `version=G1-Turbo`, `outputFormat=["glb"]`, `faceCount=30000`, text style `cartoon`. Docs: https://lux3d.aholo.ai/docs

## Hosting

- **Vercel (static, simplest):** project root `web`, framework Vite, build `npm run build`, output `dist`. "Import a Lux3D .glb" works; "Generate with Lux3D" shows as offline unless you also host the backend.
- **ModelScope Studio (recommended by the organisers):** run `scripts/build_modelscope.sh`, create a **Gradio** Studio on modelscope.ai, push `build/modelscope/`, add `AHOLO_API_KEY` as a Studio secret. Or a **Static** Studio with just `build/modelscope/dist/`. (The ModelScope deploy itself has not been tested yet.)

## Credits & tools

Three.js, Vite, FastAPI, Aholo Lux3D (3D assets + API, `manycore-aholo-sdk-lux3d`), Gradio (ModelScope wrapper). Made by Joseph Bassey John.
