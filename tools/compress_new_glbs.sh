#!/bin/bash
# Compress any models/*.glb larger than 1.5MB and at least 8s old.
ROOT=/workspace/naija-market-rush/web/public/assets/models
GLTF=/tmp/gltf-tools
cd "$GLTF" || exit 1
while true; do
  now=$(date +%s)
  for src in "$ROOT"/*.glb; do
    [ -f "$src" ] || continue
    size=$(stat -c%s "$src")
    mtime=$(stat -c%Y "$src")
    age=$((now - mtime))
    if [ "$size" -gt 1500000 ] && [ "$age" -ge 8 ]; then
      base=$(basename "$src" .glb)
      tmp=/tmp/${base}_opt.glb
      echo "[compress] $base $size bytes age=${age}s"
      if npx --no-install gltf-transform optimize "$src" "$tmp" --compress draco --texture-compress webp --texture-size 1024; then
        mv "$tmp" "$src"
        echo "[compress] $base -> $(stat -c%s "$src") bytes"
      else
        echo "[compress] FAILED $base"
        rm -f "$tmp"
      fi
    fi
  done
  sleep 5
done
