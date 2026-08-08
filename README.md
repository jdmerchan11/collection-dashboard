# Collection Dashboard

A static GitHub Pages site for tracking three collections from one homepage:

1. **Pikachu cards** — English priced Pikachu TCG checklist
2. **Vintage games** — mainline Pokémon games from Game Boy onward (including remakes)
3. **Vintage consoles** — Nintendo home, hybrid, and handheld systems sold in the US

Ownership for each section is read from its own CSV. Those owned files are initialized empty — nothing is marked collected yet.

## Enable GitHub Pages

1. Push this repo to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch `main` (or your default) and folder `/ (root)`.
5. Save, then open the published site URL (usually `https://<user>.github.io/<repo>/`).

## Site map

| Path | Section |
| --- | --- |
| `/` | Homepage with links into each checklist |
| `/pikachu/` | Pikachu card dashboard |
| `/games/` | Mainline Pokémon games dashboard |
| `/consoles/` | US Nintendo consoles dashboard |

## Mark items as owned

Browse a section, note the item `id`, then add a row to that section’s owned CSV:

```csv
id,notes
pk-0001,Binder page 1
```

```csv
id,notes
gm-0001,CIB
```

```csv
id,notes
nc-0012,Original DMG
```

Commit and push. After Pages rebuilds, those items show as **Owned**.

## Data files

| File | Purpose |
| --- | --- |
| `data/pikachu/checklist.csv` | Priced English Pikachu card checklist |
| `data/pikachu/owned.csv` | Owned Pikachu card ids (empty to start) |
| `data/games/checklist.csv` | Mainline Pokémon games checklist (with box art URLs) |
| `data/games/owned.csv` | Owned game ids (empty to start) |
| `data/consoles/checklist.csv` | US Nintendo consoles checklist (with photo URLs) |
| `data/consoles/owned.csv` | Owned console ids (empty to start) |

Pikachu checklist source: [Ultimate English Pikachu Checklist (Elite Fourum)](https://www.elitefourum.com/t/ultimate-english-pikachu-checklist-w-pictures-prices-free-to-use/61249).

Game box art images are loaded from [Bulbagarden Archives](https://archives.bulbagarden.net/). Console photos are loaded from [Wikimedia Commons](https://commons.wikimedia.org/).

## Local preview

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
