# WynnDB

WynnDB is a static Next.js recipe finder for Wynncraft crafting. It is designed for GitHub Pages: the app shell is exported at build time, and recipe/ingredient data is fetched from the Wynncraft API directly in the browser.

## Features

- Uses Wynncraft API v3 recipe and item data.
- Filters by profession, crafted item type, level range, ingredient name, and target/avoid identification IDs.
- Scores compatible ingredients and tests 2x3 crafting layouts with ingredient position modifiers.
- Shows base materials, durability shifts, duration/charge changes, ID gains, penalties, and skill requirements.
- Exports to static HTML in `out/` for GitHub Pages.

## Local Development

```bash
npm install
npm run dev
```

## Static Build

```bash
npm run build
```

The GitHub Actions workflow in `.github/workflows/pages.yml` builds the static export and deploys `out/` to GitHub Pages on pushes to `master` or `main`.

## Weekly Market Prices

The workbench reads a static cache of ingredient median prices from
`public/data/wynnventory-prices.json`. The `Refresh Wynncraft data cache` workflow updates it
every Monday at 03:29 UTC and commits the refreshed snapshot.

The cache uses Wynnventory's public historical trade-market endpoint, so no browser or GitHub
Actions API key is required.

## GitHub Pages

In the repository settings, set Pages to deploy from **GitHub Actions**. The build automatically uses `/<repo-name>/` as the base path for project Pages repositories, and no base path for `<username>.github.io` repositories.
