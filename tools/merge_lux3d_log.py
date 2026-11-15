#!/usr/bin/env python3
"""Merge sidecars + on-disk compressed sizes into docs/lux3d_generation_log.json."""
from __future__ import annotations
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

WAT = timezone(timedelta(hours=1), name="WAT")
ROOT = Path("/workspace/naija-market-rush")
LOG = ROOT / "docs/lux3d_generation_log.json"
MODELS = ROOT / "web/public/assets/models"
SIDECAR = Path("/tmp/lux3d_results")
COMPRESSION = "gltf-transform 4.5.1 optimize --compress draco --texture-compress webp --texture-size 1024"

# Known salvage facts (do not invent credits; 13 is the observed G1-Turbo charge)
SALVAGE = {
    "coral_beads": {
        "task_id": 8013966,
        "state": "success",
        "status": 3,
        "error": None,
        "bytes": 10565900,
        "consumed_credits": 13,
        "salvaged": True,
        "note": "Poll timed out at 600s while status was still 1; API later reached status 3. Downloaded by task id.",
    },
    "ife_head": {
        "task_id": 8014317,
        "state": "success",
        "status": 3,
        "error": None,
        "bytes": 8575360,
        "consumed_credits": 13,
        "salvaged": True,
        "note": "Generator was interrupted mid-poll; task later completed. Downloaded by task id.",
        "round": 2,
        "level": "ojaoba",
        "prompt": "A bronze Ife head sculpture replica, serene face with delicate scarification, metallic brown, cartoon game prop. Single object, game prop, clean shape, centered.",
        "method": "text-to-3d",
        "version": "G1-Turbo",
        "style": "cartoon",
        "face_count": 30000,
        "file": "ife_head.glb",
        "path": "web/public/assets/models/ife_head.glb",
    },
    "aso_oke": {
        "task_id": 8014438,
        "state": "success",
        "status": 3,
        "error": None,
        "bytes": 9604044,
        "consumed_credits": 13,
        "salvaged": True,
        "note": "Generator was interrupted mid-poll; task later completed. Downloaded by task id.",
        "round": 2,
        "level": "ojaoba",
        "prompt": "A folded stack of shimmering gold and burgundy aso-oke woven cloth, cartoon game prop. Single object, game prop, clean shape, centered.",
        "method": "text-to-3d",
        "version": "G1-Turbo",
        "style": "cartoon",
        "face_count": 30000,
        "file": "aso_oke.glb",
        "path": "web/public/assets/models/aso_oke.glb",
    },
}

R2_IDS = [
    "talking_drum","beaded_crown","coral_beads","irukere","calabash_wine","kola_bowl",
    "ife_head","aso_oke","shea_pot","cowrie_purse","royal_staff","carved_stool",
    "puff_puff","akara_tray","boli_plate","coal_brazier","pepper_soup","zobo_jug",
    "groundnut_cone","mosquito_coil","recharge_lamp","agbo_bottle","night_mask","amulet_pouch",
]


def main():
    data = json.loads(LOG.read_text())
    by_id = {it["id"]: it for it in data["items"]}

    # sidecars
    if SIDECAR.exists():
        for p in sorted(SIDECAR.glob("*.json")):
            rec = json.loads(p.read_text())
            iid = rec["id"]
            prev = by_id.get(iid, {})
            # prefer success over timeout/failed if both exist
            if prev.get("state") == "success" and rec.get("state") != "success":
                continue
            merged = {**prev, **rec}
            by_id[iid] = merged

    # salvage overlays (fill missing or repair failed)
    for iid, extra in SALVAGE.items():
        cur = by_id.get(iid, {"id": iid})
        if cur.get("state") != "success" or cur.get("bytes") is None or extra.get("salvaged"):
            # Don't downgrade a later success; overlay salvage fields when needed
            for k, v in extra.items():
                if k == "note":
                    cur[k] = v
                elif cur.get(k) in (None, "failed", "timeout", 1) or k in ("salvaged", "bytes", "consumed_credits", "task_id", "status", "state", "error"):
                    if cur.get("state") == "success" and k in ("state", "status", "error") and not extra.get("force"):
                        continue
                    if cur.get("bytes") and k == "bytes":
                        continue
                    cur[k] = v
            # always mark salvage if we used it
            if extra.get("salvaged") and cur.get("task_id") == extra.get("task_id"):
                cur["salvaged"] = True
                if extra.get("note"):
                    cur["note"] = extra["note"]
                if cur.get("bytes") is None:
                    cur["bytes"] = extra.get("bytes")
                if cur.get("consumed_credits") is None:
                    cur["consumed_credits"] = extra.get("consumed_credits")
                if cur.get("state") != "success" and extra.get("state") == "success":
                    cur["state"] = "success"
                    cur["status"] = 3
                    cur["error"] = None
        by_id[iid] = cur

    # compressed sizes from disk (post gltf-transform)
    for iid, rec in by_id.items():
        fp = MODELS / rec.get("file", f"{iid}.glb")
        if fp.exists():
            sz = fp.stat().st_size
            rec["compressed_bytes"] = sz
            rec["compression"] = COMPRESSION
            rec.setdefault("round", 2 if iid in R2_IDS else 1)
        by_id[iid] = rec

    # rebuild items list: original order for r1, then r2 in canonical order, then any extras
    r1 = []
    seen = set()
    for it in data["items"]:
        if it["id"] not in R2_IDS:
            r1.append(by_id[it["id"]])
            seen.add(it["id"])
    r2 = []
    for iid in R2_IDS:
        if iid in by_id:
            rec = by_id[iid]
            rec.setdefault("round", 2)
            r2.append(rec)
            seen.add(iid)
    extras = [by_id[k] for k in by_id if k not in seen]
    data["items"] = r1 + r2 + extras

    def credits(items):
        return sum(int(it.get("consumed_credits") or 0) for it in items)

    r1_items = [it for it in data["items"] if it.get("round") != 2]
    r2_items = [it for it in data["items"] if it.get("round") == 2]
    r2_ok = [it for it in r2_items if it.get("state") == "success"]
    r2_fail = [it for it in r2_items if it.get("state") not in ("success", None)]
    r1_ok = [it for it in r1_items if it.get("state") == "success"]

    in_game = data.get("in_game_generation") or {}
    in_game_credits = int(in_game.get("consumed_credits") or data.get("totals", {}).get("in_game_generations", 0) * 13 or 13)

    data["updated_at"] = datetime.now(WAT).isoformat()
    data["round2"] = {
        "description": "Oja Oba and Night Market catalog items, text-to-3D G1-Turbo cartoon.",
        "attempted": len(r2_items),
        "succeeded": len(r2_ok),
        "failed": len(r2_fail),
        "consumed_credits": credits(r2_items),
        "bytes_original": sum(int(it.get("bytes") or 0) for it in r2_ok),
        "bytes_compressed": sum(int(it.get("compressed_bytes") or 0) for it in r2_ok),
    }
    data["totals"] = data.get("totals") or {}
    data["totals"]["attempted"] = len(r1_items)
    data["totals"]["succeeded"] = len(r1_ok)
    data["totals"]["failed"] = len(r1_items) - len(r1_ok)
    data["totals"]["consumed_credits"] = credits(r1_items)
    data["totals"]["bytes_original"] = sum(int(it.get("bytes") or 0) for it in r1_ok)
    data["totals"]["bytes_compressed"] = sum(int(it.get("compressed_bytes") or 0) for it in r1_ok)
    data["totals"]["consumed_credits_including_in_game"] = credits(r1_items) + in_game_credits
    data["grand_totals"] = {
        "catalog_items_succeeded": len(r1_ok) + len(r2_ok),
        "catalog_items_attempted": len(r1_items) + len(r2_items),
        "consumed_credits_catalog": credits(r1_items) + credits(r2_items),
        "consumed_credits_including_in_game": credits(r1_items) + credits(r2_items) + in_game_credits,
        "bytes_original": sum(int(it.get("bytes") or 0) for it in r1_ok + r2_ok),
        "bytes_compressed": sum(int(it.get("compressed_bytes") or 0) for it in r1_ok + r2_ok),
    }
    LOG.write_text(json.dumps(data, indent=2) + "\n")
    g = data["grand_totals"]
    print("round2", data["round2"])
    print("grand", g)


if __name__ == "__main__":
    main()
