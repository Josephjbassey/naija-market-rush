# Report assets

Studio contact sheets of the 36 shipped Lux3D catalog GLBs, rendered in headless Chrome with Three.js (`tools/render_contact_sheet.html`). The `.png` files are the full-resolution sheets; the `.jpg` copies are what the report HTML embeds.

IBM Plex fonts in `fonts/` are Copyright IBM Corp. and licensed under the SIL Open Font License 1.1.

To reprint `docs/Naija_Market_Rush_Report.pdf` from the HTML source, serve the repo root and print the HTML to A4 with background graphics enabled:

```bash
cd /path/to/naija-market-rush
python3 -m http.server 8765
# then print http://127.0.0.1:8765/docs/Naija_Market_Rush_Report.html to PDF
```
