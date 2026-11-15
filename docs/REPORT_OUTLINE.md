# Project report outline: Naija Market Rush
(Required: PDF or PPT. Must cover concept, development process, iterations of key assets, final results. Replace every [PLACEHOLDER]; do not claim anything you have not actually done.)

## 1. Title slide
- Naija Market Rush · a Lux3D-powered market game
- Joseph Bassey John (solo) · Akure, Nigeria · Gaming Application Award
- Demo link: https://naija-market-rush.vercel.app · Video: https://youtu.be/vcnjE9VIMbM · Code: https://github.com/Josephjbassey/naija-market-rush · X post: https://x.com/JosephJBassey/status/2122005022258942365

## 2. Concept (1 slide)
- Hook: Nigerian markets are loud, fast and funny. You run a stall and race to serve shouting customers.
- Twist: anyone can **stock the shelf with real objects**: snap a photo or type a prompt, Aholo Lux3D turns it into a 3D item that customers start asking for.
- Who it is for: casual players; Nigerians at home and in the diaspora; anyone curious about West African markets.

## 3. How Lux3D is used (the 30% criterion, make this slide strong)
- In-game: photo → Lux3D image-to-3D; prompt → Lux3D text-to-3D (G1-Turbo, GLB, ~30k faces) via `server/app.py`, new item drops on the shelf and sells at a 1.5x "fresh" premium.
- Content pipeline: all 12 shelf items [PLACEHOLDER: N of 12 actually generated] and [PLACEHOLDER: N] market props generated with Lux3D from [PLACEHOLDER: real photos from ___ market / prompts].
- Diagram: photo/prompt → Lux3D API → GLB → manifest → Three.js shelf.

## 4. Development process (1–2 slides)
- Day-by-day log [PLACEHOLDER: dates]: idea → playable prototype with placeholder meshes → Lux3D asset generation → in-game Lux3D generation → polish.
- Screenshot: placeholder version (`docs/screenshots/03-serving.png`).
- Tools disclosed (rules II.2 require disclosing principal tools and purposes): Aholo Lux3D (3D assets, API), Three.js (rendering), Vite (build), FastAPI (backend), Gradio/ModelScope (hosting), [PLACEHOLDER: AI coding assistant used for code, if applicable, state it honestly], [PLACEHOLDER: any other tool].

## 5. Key asset comparisons (2–3 slides)
For 4–6 items, one row each: **input photo or prompt → placeholder mesh → Lux3D result (→ second iteration if you re-generated)**.
| Item | Input | Placeholder | Lux3D v1 | Lux3D v2 / notes |
|---|---|---|---|---|
| Yam | [PLACEHOLDER photo] | [screenshot] | [PLACEHOLDER render] | [PLACEHOLDER: what you changed and why] |
| Agbada | … | … | … | … |
| Jollof pot | … | … | … | … |
| Danfo | … | … | … | … |
- Real numbers only: generation time per item [PLACEHOLDER], face count [PLACEHOLDER], file size before/after [PLACEHOLDER], credits used [PLACEHOLDER].

## 6. Gameplay & fun (25% criterion)
- Loop: customers arrive with pidgin requests → tap item → it flies over → cash, combo, tips. Alhaji Big Spender pays x2. Rush hour in the last 20 s. 3 vexed customers too many → shift ends.
- Screenshots: [PLACEHOLDER: final gameplay with Lux3D assets], results screen, mobile.

## 7. Final results
- What works now, verified: [PLACEHOLDER list]. Live demo link + video.
- Optional, only if real: playtest quotes / scores from friends [PLACEHOLDER].

## 8. What's next
- Multiplayer market day, haggling mini-game, more markets (Kano, Onitsha, Balogun), Lux3D articulation for animated items.

## 9. Links & credits
- Demo, video, repo, X post (#Manycorehackathon). Third-party licences.
