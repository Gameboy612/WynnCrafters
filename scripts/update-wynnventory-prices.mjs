import { mkdir, readFile, writeFile } from "node:fs/promises";

const cacheFile = new URL("../public/data/wynncraft-cache.json", import.meta.url);
const outFile = new URL("../public/data/wynnventory-prices.json", import.meta.url);
const apiBase = "https://www.wynnventory.com/api/trademarket/history";
const concurrency = 20;

const cache = JSON.parse(await readFile(cacheFile, "utf8"));
let existingPriceCache = null;
try {
  existingPriceCache = JSON.parse(await readFile(outFile, "utf8"));
} catch {
  existingPriceCache = null;
}

const marketPriceKey = (name, tier) => (tier ? `${name}|tier=${tier}` : name);
const materialNames = Array.from(
  new Set(cache.recipes.flatMap((recipe) => recipe.materials.map((material) => material.item)))
);
const marketItems = [
  ...cache.ingredients.map((ingredient) => ({
    cacheKey: ingredient.displayName,
    name: ingredient.displayName
  })),
  ...materialNames.flatMap((materialName) => {
    const marketName = materialName.replace(/^Refined\s+/, "");
    return [1, 2, 3].map((tier) => ({
      cacheKey: marketPriceKey(marketName, tier),
      name: marketName,
      tier
    }));
  })
].sort((left, right) => left.cacheKey.localeCompare(right.cacheKey));
const previousPrices = existingPriceCache?.prices ?? {};
const legacyMaterialNames = new Set(materialNames);
const namesToFetch =
  process.env.WYNNVENTORY_ONLY_MISSING === "true"
    ? marketItems.filter((item) => !previousPrices[item.cacheKey])
    : marketItems;

const formatDate = (date) => date.toISOString().slice(0, 10);
const endDate = new Date();
endDate.setUTCDate(endDate.getUTCDate() - 1);
const startDate = new Date(endDate);
startDate.setUTCDate(startDate.getUTCDate() - 7);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchHistory = async (item, attempt = 0) => {
  const url = new URL(`${apiBase}/${encodeURIComponent(item.name)}`);
  url.searchParams.set("start_date", formatDate(startDate));
  url.searchParams.set("end_date", formatDate(endDate));
  if (item.tier) url.searchParams.set("tier", String(item.tier));

  const response = await fetch(url);
  if (response.ok) return response.json();

  if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
    await sleep(750 * (attempt + 1));
    return fetchHistory(item, attempt + 1);
  }

  throw new Error(`${response.status} ${response.statusText}`);
};

const priceForHistory = (history) => {
  const latestMedian = history
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .reverse()
    .find((entry) => typeof entry.p50_price === "number" && Number.isFinite(entry.p50_price));

  if (!latestMedian) return null;

  return {
    price: latestMedian.p50_price,
    sampledAt: latestMedian.timestamp
  };
};

const prices = { ...previousPrices };
const unavailable = new Set(
  (existingPriceCache?.unavailable ?? []).filter((name) => !legacyMaterialNames.has(name))
);
const failures = [];
let nextIndex = 0;

const worker = async () => {
  while (nextIndex < namesToFetch.length) {
    const index = nextIndex;
    nextIndex += 1;
    const item = namesToFetch[index];

    try {
      const price = priceForHistory(await fetchHistory(item));
      if (price) {
        prices[item.cacheKey] = price;
        unavailable.delete(item.cacheKey);
      } else {
        if (!prices[item.cacheKey]) unavailable.add(item.cacheKey);
      }
    } catch (error) {
      failures.push(item.cacheKey);
      if (!prices[item.cacheKey]) unavailable.add(item.cacheKey);
      console.warn(
        `Unable to cache ${item.cacheKey}: ${error instanceof Error ? error.message : error}`
      );
    }

    if ((index + 1) % 50 === 0 || index + 1 === namesToFetch.length) {
      console.log(`Processed ${index + 1}/${namesToFetch.length} market items`);
    }
  }
};

await Promise.all(Array.from({ length: concurrency }, worker));

const priceCache = {
  generatedAt: new Date().toISOString(),
  source: apiBase,
  range: {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  },
  pricing: "most recent p50_price in the requested history window",
  prices,
  unavailable: Array.from(unavailable).sort(),
  failures
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(outFile, `${JSON.stringify(priceCache)}\n`, "utf8");

console.log(
  `Cached ${Object.keys(prices).length}/${marketItems.length} market prices at ${outFile.pathname} (${concurrency} concurrent requests; fetched ${namesToFetch.length})`
);
