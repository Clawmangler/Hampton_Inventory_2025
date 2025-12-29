# Hotel Inventory (Post-Remodel 2025) — Inventory Web Page

This folder is a **static website** (works on GitHub Pages) + extracted data from `Install_Matrix.pdf`.

## What you get
- `index.html` + `app.js` + `styles.css` — searchable/filterable “interactive spreadsheet” inventory
- `data/items.json` — extracted rows (224 items from your current `Install_Matrix.pdf`)
- `data/items.csv` — same data as CSV for quick Excel viewing
- `scripts/extract_install_matrix.py` — re-run extraction any time the PDF changes

## How to run locally
Because the page loads JSON, you need a local web server (opening the HTML file directly will be blocked by the browser).

Option A (Python):
```bash
cd hotel_inventory_site
python -m http.server 8000
```
Then open: http://localhost:8000

Option B (Node):
```bash
npx serve .
```

## How to put it on GitHub Pages
1. Copy this folder into your repo (ex: `/docs` or `/site`)
2. In your repo settings → Pages:
   - Source: `main`
   - Folder: `/docs` (or whatever you used)
3. Browse to your Pages URL.

## Editing warranty / on-hand / etc
- You can edit cells directly in the table, or in the right-side details panel.
- Click **Save (local)** to store changes in your browser (localStorage).
- Click **Export updates** to download `inventory-updates.json`.
- Commit that JSON to your repo (recommended), and/or re-import it on another PC.

## Next step: adding the “spec sheet PDF with pictures”
When you upload/share the second PDF, we can:
- extract embedded images, or
- convert pages to JPG/PNG,
- link images to each item via `item_id` or `spec`,
- and show them inside the Details panel automatically.
