"""ModelScope Studio entry point (Gradio SDK type).

ModelScope Gradio Studios run `python app.py` and expect a web server on 0.0.0.0:7860.
This serves the built game + the Lux3D backend (FastAPI) and mounts a small Gradio page at /gradio.
Set AHOLO_API_KEY as a Studio *secret* (never commit it). Build this folder with scripts/build_modelscope.sh.
"""
import os

import gradio as gr
import uvicorn

os.environ.setdefault("WEB_DIST", os.path.join(os.path.dirname(__file__), "dist"))
os.environ["NMR_DEFER_STATIC"] = "1"
from server_app import app, mount_game  # noqa: E402  (copied from server/app.py by the build script)

with gr.Blocks(title="Naija Market Rush") as info:
    gr.Markdown("# Naija Market Rush\nThe game runs at the root URL `/`. 3D items are generated with Aholo Lux3D.")

app = gr.mount_gradio_app(app, info, path="/gradio")
mount_game(app)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
