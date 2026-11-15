#!/usr/bin/env bash
# Assembles build/modelscope/ : a self-contained folder to push to a ModelScope Studio repo.
#   Gradio SDK Studio  -> push the whole folder (game + Lux3D backend). Add AHOLO_API_KEY as a Studio secret.
#   Static SDK Studio  -> push only build/modelscope/dist/* (game only; use "Import a Lux3D .glb").
set -euo pipefail
cd "$(dirname "$0")/.."
(cd web && npm ci && npm run build)
rm -rf build/modelscope && mkdir -p build/modelscope
cp -r web/dist build/modelscope/dist
cp server/app.py build/modelscope/server_app.py
cp modelscope/app.py build/modelscope/app.py
{ cat server/requirements.txt; echo "gradio>=4.44"; } > build/modelscope/requirements.txt
echo "Built build/modelscope (static-only files are in build/modelscope/dist)"
