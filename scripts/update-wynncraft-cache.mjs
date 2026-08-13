import { mkdir, writeFile } from "node:fs/promises";

const apiBase = "https://api.wynncraft.com/v3";
const outFile = new URL("../public/data/wynncraft-cache.json", import.meta.url);

async function fetchJson(path) {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

const [recipes, items] = await Promise.all([
  fetchJson("/item/recipe/database?full_result"),
  fetchJson("/item/database?fullResult")
]);

const ingredients = items.filter((item) => item.type === "ingredient");
const cache = {
  generatedAt: new Date().toISOString(),
  source: apiBase,
  recipes,
  ingredients
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(outFile, `${JSON.stringify(cache)}\n`, "utf8");

console.log(
  `Cached ${recipes.length} recipes and ${ingredients.length} ingredients at ${outFile.pathname}`
);
