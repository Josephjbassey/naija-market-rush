# Lux3D asset list: what to generate

Generate in the Lux3D web app (https://3d.aholo.ai) or via the API. Save each GLB under `web/public/assets/` with the exact filename below.

General tips
- **Photo route (best, and most "real market"):** one item, plain background, good daylight, whole object in frame, slight 3/4 angle. A photo from a real Akure market stall is great evidence for the report.
- **Prompt route:** use the prompt below. Lux3D text-to-3D styles: `photorealistic`, `cartoon`, `anime`, `hand_painted`, `cyberpunk`, `fantasy`, `glass`. **`cartoon` or `hand_painted` match the game's look best**; pick one and use it for every item so the shelf looks consistent.
- Keep the download light: 20k–50k faces if the tool lets you choose. Save the **original photo/prompt + a screenshot of the Lux3D result** for each item; the report needs "key asset comparisons".

| # | File | Item | Prompt (text-to-3D) | Photo idea |
|---|---|---|---|---|
| 1 | `yam.glb` | Yam tuber | A single large West African yam tuber, rough brown bark-like skin, one end cut showing white flesh, game prop | A real yam on a table |
| 2 | `agbada.glb` | Agbada | A flowing Nigerian agbada robe in royal blue with gold embroidery around the neck, displayed on an invisible mannequin, with matching fila cap | Agbada on a hanger/mannequin |
| 3 | `gele.glb` | Gele | A tall folded Nigerian gele head-tie in shiny magenta aso-oke fabric, sculpted pleats fanning out, standalone | Tied gele on a head form |
| 4 | `jollof_pot.glb` | Pot of jollof | A dented aluminium cooking pot full of smoky orange Nigerian jollof rice with a few green peas and a bay leaf, two side handles | Pot of jollof, top-down 3/4 |
| 5 | `plantain.glb` | Plantain bunch | A bunch of five ripe yellow plantains with brown spots joined at the stem | Plantain bunch from a market |
| 6 | `palm_oil_keg.glb` | Palm oil keg | A translucent plastic jerrycan keg filled with deep red-orange palm oil, yellow screw cap, top handle | A 5-litre keg of palm oil |
| 7 | `ankara_roll.glb` | Ankara roll | A rolled bolt of colourful Ankara wax-print fabric with bold green, orange and blue geometric patterns, the loose end draped down | Folded/rolled ankara at a fabric stall |
| 8 | `torch_phone.glb` | Torchlight phone | A small cheap candy-bar feature phone with a physical keypad, tiny green screen and a torch LED on top | An old keypad phone |
| 9 | `lantern.glb` | Kerosene lantern | A classic red metal hurricane kerosene lantern with a glass globe and a wire carrying handle | A hurricane lantern |
| 10 | `danfo_toy.glb` | Danfo toy bus | A chunky toy model of a yellow Lagos danfo minibus with two black stripes along the sides, cartoon proportions | A danfo toy or a photo of a danfo |
| 11 | `egusi_basin.glb` | Basin of egusi | A blue plastic washing basin heaped with ground egusi melon seeds, creamy white | Egusi in a basin at a market |
| 12 | `suya_tray.glb` | Suya tray | A rectangular wooden tray of Nigerian suya skewers, dark spiced grilled beef on sticks, sliced onions and tomato on the side | A suya tray / newspaper wrap |

Scenery (optional, big score boost for "use of Aholo tools"), save under `web/public/assets/env/`:

| File | Prompt |
|---|---|
| `env/stall_umbrella.glb` | A small Nigerian market stall: wooden table under a big striped red and white umbrella, baskets of tomatoes and peppers on the table |
| `env/danfo_bus.glb` | A full-size yellow Lagos danfo minibus with black stripes, slightly worn, cartoon style |
| `env/fabric_rack.glb` | A wooden market rack hung with colourful ankara and aso-oke fabrics |
| `env/mama_put_stand.glb` | A Nigerian roadside food stand (mama put): wooden bench, coolers and pots, small canopy |

Credit cost reference (Lux3D pricing page, https://3d.aholo.ai/pricing, read 15 Nov 2026): the page shows limited-time discounted prices with the old price struck through, e.g. "Image to Mesh Turbo" appears as 5 → 1 credit/task, and other 3D generation features at roughly 10–30 credits/task. The API docs' task-list example shows `consumedCredits: 20`. Exactly which tier the API's G1 / G1-Turbo calls bill at is not stated, so check your credit history after the first generation before doing all 16.

## Round 2 — new markets (15 Nov 2026)

Same pipeline as the first 12: text-to-3D, `G1-Turbo`, style `cartoon`, target 30k faces, then `gltf-transform optimize --compress draco --texture-compress webp --texture-size 1024`. Logs: `docs/lux3d_generation_log.json` (items with `"round": 2`).

### Oja Oba (Akure king's market)

| # | File | Item | Prompt (text-to-3D) |
|---|---|---|---|
| 13 | `talking_drum.glb` | Talking drum | A Yoruba talking drum (gangan) with leather tension straps and a curved wooden body, cartoon game prop |
| 14 | `beaded_crown.glb` | Beaded crown | A Yoruba royal ade crown covered in colourful coral and glass beads with a beaded face veil, cartoon game prop |
| 15 | `coral_beads.glb` | Coral beads | A heavy Nigerian coral bead necklace (ileke) in deep red-orange, several stacked strands, cartoon game prop |
| 16 | `irukere.glb` | Irukere | A royal horse-tail fly whisk (irukere) with a carved pale handle and a burst of white horsehair, cartoon game prop |
| 17 | `calabash_wine.glb` | Palm wine calabash | A round calabash gourd bowl filled with milky white palm wine, cartoon game prop |
| 18 | `kola_bowl.glb` | Kolanut bowl | A small carved wooden bowl of split brown kola nuts, cartoon game prop |
| 19 | `ife_head.glb` | Ife head | A bronze Ife head sculpture replica, serene face with delicate scarification, metallic brown, cartoon game prop |
| 20 | `aso_oke.glb` | Aso-oke stack | A folded stack of shimmering gold and burgundy aso-oke woven cloth, cartoon game prop |
| 21 | `shea_pot.glb` | Shea butter pot | A clay pot of creamy yellow shea butter with a wooden lid slightly open, cartoon game prop |
| 22 | `cowrie_purse.glb` | Cowrie purse | A small brown leather purse decorated with white cowrie shells, cartoon game prop |
| 23 | `royal_staff.glb` | Royal staff | A carved Yoruba royal staff with a beaded top and a horsehair tassel, standing upright, cartoon game prop |
| 24 | `carved_stool.glb` | Royal stool | A low carved wooden royal stool with geometric Yoruba patterns, cartoon game prop |

### Night Market

| # | File | Item | Prompt (text-to-3D) |
|---|---|---|---|
| 25 | `puff_puff.glb` | Puff-puff | A small clear nylon bag heaped with golden-brown Nigerian puff-puff dough balls, cartoon game prop |
| 26 | `akara_tray.glb` | Akara tray | A wide metal tray of freshly fried golden akara bean cakes, cartoon game prop |
| 27 | `boli_plate.glb` | Boli and corn | A plate of roasted plantain (boli) with a cob of roasted corn beside it, cartoon game prop |
| 28 | `coal_brazier.glb` | Coal brazier | A small metal coal pot brazier with glowing red charcoal, cartoon game prop |
| 29 | `pepper_soup.glb` | Pepper soup | A steaming enamel bowl of Nigerian goat pepper soup in a reddish broth, cartoon game prop |
| 30 | `zobo_jug.glb` | Zobo jug | A plastic jug of deep purple-red zobo hibiscus drink with a straw, cartoon game prop |
| 31 | `groundnut_cone.glb` | Groundnut cone | A twisted paper cone overflowing with roasted groundnuts, cartoon game prop |
| 32 | `mosquito_coil.glb` | Mosquito coil | A green spiral mosquito coil sitting on a small metal stand, cartoon game prop |
| 33 | `recharge_lamp.glb` | Rechargeable lamp | A cheap boxy white rechargeable LED lamp with a small solar panel on top, cartoon game prop |
| 34 | `agbo_bottle.glb` | Agbo bottle | A dark recycled glass bottle of Nigerian herbal mixture (agbo) with leaves visible inside, cartoon game prop |
| 35 | `night_mask.glb` | Night mask | A slightly spooky carved wooden Yoruba-style face mask, dark wood with white painted eyes, standalone, cartoon game prop |
| 36 | `amulet_pouch.glb` | Amulet pouch | A small worn leather charm pouch tied with cowrie shells and red thread, cartoon game prop |
