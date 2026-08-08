# Pikachu Collection Dashboard

A static GitHub Pages dashboard for tracking English Pikachu TCG cards against the community **Priced Pikachu Checklist**.

Owned cards are read from `data/owned.csv`. That file is initialized and currently empty — no cards are marked owned yet.

## Enable GitHub Pages

1. Push this repo to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch `main` (or your default) and folder `/ (root)`.
5. Save, then open the published site URL (usually `https://<user>.github.io/<repo>/`).

## Mark cards as owned

1. Browse the dashboard and note the card `id` under each entry (for example `pk-0001`).
2. Edit `data/owned.csv` and add one row per owned card:

```csv
id,notes
pk-0001,Binder page 1
pk-0012,
```

3. Commit and push. After Pages rebuilds, those cards show as **Owned**.

`notes` is optional and appears on the card when present.

## Data files

| File | Purpose |
| --- | --- |
| `data/checklist.csv` | Full priced checklist (id, set, edition, year, remarks, rarity, artwork, price, image) |
| `data/owned.csv` | Collection ownership list (start empty; add `id` values as you collect) |

Checklist source: [Ultimate English Pikachu Checklist (Elite Fourum)](https://www.elitefourum.com/t/ultimate-english-pikachu-checklist-w-pictures-prices-free-to-use/61249).

## Local preview

Because the app loads CSV over `fetch`, open it through a local static server rather than a `file://` URL:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
