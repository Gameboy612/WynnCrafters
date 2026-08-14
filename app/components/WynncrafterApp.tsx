"use client";

import {
  AlertCircle,
  ArrowDownUp,
  Bookmark,
  ChevronRight,
  FlaskConical,
  Gem,
  Hammer,
  Loader2,
  Minus,
  Share2,
  Trash2,
  Plus,
  Search,
  Shield,
  Shirt,
  ScrollText,
  Utensils,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  FRIENDLY_ID_NAMES,
  MAX_INGREDIENT_POOL_SIZE,
  NumericRange,
  PROFESSIONS,
  Profession,
  SolvedCraft,
  SolverPreferences,
  WynncraftIngredient,
  WynncraftRecipe,
  fetchIngredientData,
  fetchRecipes,
  idLabel,
  identificationRange,
  rangeMidpoint,
  scaleRange,
  solveRecipe,
  tierLabel,
  titleCase
} from "../lib/wynncraft";

const professionIcons: Record<Profession, typeof Hammer> = {
  armouring: Shield,
  tailoring: Shirt,
  weaponsmithing: Hammer,
  woodworking: Wand2,
  jeweling: Gem,
  cooking: Utensils,
  alchemism: FlaskConical,
  scribing: ScrollText
};

const defaultTargets: string[] = [];
const defaultAvoids: string[] = [];

const defaultPreferences: SolverPreferences = {
  targetIds: defaultTargets,
  avoidIds: defaultAvoids,
  maxIngredients: MAX_INGREDIENT_POOL_SIZE,
  includeTradeoffs: true,
  ingredientQuery: "",
  bannedIngredients: "",
  minDurability: 30,
  minDuration: 60,
  minCharges: 0
};

const professionCodes: Record<Profession, string> = {
  armouring: "a",
  tailoring: "t",
  weaponsmithing: "w",
  woodworking: "o",
  jeweling: "j",
  cooking: "c",
  alchemism: "l",
  scribing: "s"
};

const professionsByCode = Object.fromEntries(
  Object.entries(professionCodes).map(([profession, code]) => [code, profession])
) as Record<string, Profession>;

type SharedSearchState = {
  profession: Profession;
  craftedType: string;
  minLevel: number;
  maxLevel: number;
  preferences: SolverPreferences;
};

type SavedRecipe = {
  id: string;
  url: string;
  title: string;
  ingredients: string;
  targetStats?: SavedRecipeStat[];
  utilityStats?: SavedRecipeStat[];
};

type SavedRecipeStat = {
  label: string;
  value: string;
  negative?: boolean;
};

const savedRecipesStorageKey = "wyndb.saved-recipes.v1";

const normalizeSavedRecipeStats = (value: unknown): SavedRecipeStat[] =>
  Array.isArray(value)
    ? value.flatMap((stat) => {
        if (
          !stat ||
          typeof stat !== "object" ||
          typeof (stat as SavedRecipeStat).label !== "string" ||
          typeof (stat as SavedRecipeStat).value !== "string"
        ) {
          return [];
        }

        return [
          {
            label: (stat as SavedRecipeStat).label,
            value: (stat as SavedRecipeStat).value,
            negative: Boolean((stat as SavedRecipeStat).negative)
          }
        ];
      })
    : [];

const encodeBase64Url = (value: string) =>
  btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const decodeBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  return decodeURIComponent(escape(atob(padded)));
};

const normalizePreferences = (value: Partial<SolverPreferences> = {}): SolverPreferences => ({
  ...defaultPreferences,
  ...value,
  targetIds: Array.isArray(value.targetIds) ? value.targetIds : defaultTargets,
  avoidIds: Array.isArray(value.avoidIds) ? value.avoidIds : defaultAvoids,
  maxIngredients: MAX_INGREDIENT_POOL_SIZE,
  minDurability: Number(value.minDurability ?? defaultPreferences.minDurability),
  minDuration: Number(value.minDuration ?? defaultPreferences.minDuration),
  minCharges: Number(value.minCharges ?? defaultPreferences.minCharges)
});

const compactStateFields = (state: SharedSearchState) => {
  const { preferences } = state;
  const fields = [
    professionCodes[state.profession],
    state.craftedType,
    state.minLevel === 1 ? "" : String(state.minLevel),
    state.maxLevel === 120 ? "" : String(state.maxLevel),
    preferences.targetIds.join(","),
    preferences.avoidIds.join(","),
    preferences.includeTradeoffs ? "" : "0",
    preferences.ingredientQuery,
    preferences.bannedIngredients,
    preferences.minDurability === defaultPreferences.minDurability
      ? ""
      : String(preferences.minDurability),
    preferences.minDuration === defaultPreferences.minDuration
      ? ""
      : String(preferences.minDuration),
    preferences.minCharges === defaultPreferences.minCharges
      ? ""
      : String(preferences.minCharges)
  ];

  while (fields.length > 0 && fields[fields.length - 1] === "") {
    fields.pop();
  }

  return fields.map((field) => encodeURIComponent(field));
};

const encodeSharedState = (state: SharedSearchState) =>
  encodeBase64Url(`1~${compactStateFields(state).join("~")}`);

const numberOrDefault = (value: string | undefined, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const splitIds = (value: string | undefined) =>
  value ? value.split(",").filter(Boolean) : [];

const decodeCompactSharedState = (value: string): SharedSearchState | null => {
  const [version, ...encodedFields] = value.split("~");
  if (version !== "1") return null;

  const fields = encodedFields.map((field) => decodeURIComponent(field));
  const profession = professionsByCode[fields[0] ?? ""];
  if (!profession) return null;

  return {
    profession,
    craftedType: fields[1] ?? "",
    minLevel: numberOrDefault(fields[2], 1),
    maxLevel: numberOrDefault(fields[3], 120),
    preferences: normalizePreferences({
      targetIds: splitIds(fields[4]),
      avoidIds: splitIds(fields[5]),
      includeTradeoffs: fields[6] !== "0",
      ingredientQuery: fields[7] ?? "",
      bannedIngredients: fields[8] ?? "",
      minDurability: numberOrDefault(
        fields[9],
        defaultPreferences.minDurability
      ),
      minDuration: numberOrDefault(fields[10], defaultPreferences.minDuration),
      minCharges: numberOrDefault(fields[11], defaultPreferences.minCharges)
    })
  };
};

const decodeSharedState = (value: string): SharedSearchState | null => {
  try {
    const decoded = decodeBase64Url(value);
    if (decoded.startsWith("1~")) return decodeCompactSharedState(decoded);

    const parsed = JSON.parse(decoded) as Partial<SharedSearchState>;
    if (!parsed.profession || !PROFESSIONS.includes(parsed.profession)) return null;
    return {
      profession: parsed.profession,
      craftedType: parsed.craftedType ?? "",
      minLevel: Number(parsed.minLevel ?? 1),
      maxLevel: Number(parsed.maxLevel ?? 120),
      preferences: normalizePreferences(parsed.preferences)
    };
  } catch {
    return null;
  }
};

const selectedHashFromKey = (key: string) => `craft=${encodeBase64Url(key)}`;

const selectedKeyFromHash = (hash: string) => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const value = params.get("craft");
  return value ? decodeBase64Url(value) : null;
};

const formatNumber = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  }).format(value);

const getRecipeTypes = (recipes: WynncraftRecipe[], profession: Profession) =>
  Array.from(
    new Set(recipes.filter((recipe) => recipe.skill === profession).map((recipe) => recipe.type))
  ).sort();

const getKnownIds = (ingredients: WynncraftIngredient[]) =>
  Array.from(
    new Set(
      ingredients.flatMap((ingredient) =>
        Object.keys(ingredient.identifications ?? {})
      )
    )
  ).sort((a, b) => idLabel(a).localeCompare(idLabel(b)));

const scoreTone = (score: number) => {
  if (score > 500) return "excellent";
  if (score > 150) return "good";
  return "steady";
};

const signedNumber = (value: number, digits = 0) =>
  `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;

const signedRange = (range: NumericRange, digits = 0) => {
  const min = signedNumber(range.min, digits);
  const max = signedNumber(range.max, digits);
  return min === max ? min : `${min} to ${max}`;
};

const plainRange = (range: NumericRange, digits = 0) => {
  const min = formatNumber(range.min, digits);
  const max = formatNumber(range.max, digits);
  return min === max ? min : `${min} to ${max}`;
};

const durabilityScale = 1000;

const durabilityDisplayRange = (range: NumericRange): NumericRange => ({
  min: range.min / durabilityScale,
  max: range.max / durabilityScale
});

const durabilityDisplayValue = (value: number) => value / durabilityScale;

const durabilityFilterValue = (value: number) => value * durabilityScale;

const consumableCraftTypes = new Set(["food", "potion", "scroll"]);

const materialTierBoosts: Record<string, number[]> = {
  // Wiki material tables: one-star contributes +0%, two-star +25%, three-star +40%,
  // weighted by that material's amount in the recipe.
  default: [0, 25, 40]
};

const supportsDurability = (recipe: WynncraftRecipe) => Boolean(recipe.durability);

const supportsDuration = (recipe: WynncraftRecipe) => Boolean(recipe.duration);

const supportsConsumableStats = (recipe: WynncraftRecipe) =>
  supportsDuration(recipe) || consumableCraftTypes.has(recipe.type);

const professionSupportsDurability = (recipes: WynncraftRecipe[], profession: Profession) =>
  recipes.some((recipe) => recipe.skill === profession && supportsDurability(recipe));

const professionSupportsDuration = (recipes: WynncraftRecipe[], profession: Profession) =>
  recipes.some((recipe) => recipe.skill === profession && supportsDuration(recipe));

const professionSupportsConsumableStats = (recipes: WynncraftRecipe[], profession: Profession) =>
  recipes.some((recipe) => recipe.skill === profession && supportsConsumableStats(recipe));

const formatDuration = (seconds: number) => {
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;

  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
};

const recipeRange = (range?: { minimum?: number; maximum?: number; min?: number; max?: number; raw?: number }) => {
  const min = range?.minimum ?? range?.min ?? range?.raw ?? 0;
  const max = range?.maximum ?? range?.max ?? range?.raw ?? min;
  return min <= max ? { min, max } : { min: max, max: min };
};

const estimatedRecipeDurabilityRange = (recipe: WynncraftRecipe) => {
  return recipeRange(recipe.durability);
};

const baseChargesForLevel = (level: number) => {
  if (level <= 30) return 1;
  if (level <= 70) return 2;
  return 3;
};

const materialTierBoost = (recipe: WynncraftRecipe, tier: 1 | 2 | 3) => {
  const totalAmount = recipe.materials.reduce((total, material) => total + material.amount, 0);
  if (totalAmount === 0) return 0;
  const boosts = materialTierBoosts.default;
  const boost = boosts[tier - 1] ?? 0;
  return recipe.materials.reduce(
    (total, material) => total + (material.amount / totalAmount) * boost,
    0
  );
};

const boostRange = (range: NumericRange, boostPercent: number): NumericRange => ({
  min: range.min * (1 + boostPercent / 100),
  max: range.max * (1 + boostPercent / 100)
});

const applyMaterialPlanToRecipe = (
  recipe: WynncraftRecipe,
  plan?: SolvedCraft["materialPlan"]
): WynncraftRecipe => {
  if (!plan) return recipe;
  const nextRecipe: WynncraftRecipe = {
    ...recipe,
    internalName: plan.sourceRecipeInternalName,
    level: plan.sourceLevel,
    materials: plan.tiers.map(({ item, amount }) => ({ item, amount }))
  };

  if (recipe.durability) {
    const boosted = boostRange(estimatedRecipeDurabilityRange(recipe), plan.utilityBoostPercent);
    nextRecipe.durability = { minimum: boosted.min, maximum: boosted.max };
  }

  if (recipe.duration) {
    const boosted = boostRange(recipeRange(recipe.duration), plan.utilityBoostPercent);
    nextRecipe.duration = { minimum: boosted.min, maximum: boosted.max };
  }

  return nextRecipe;
};

const withMaterialPlan = (
  craft: SolvedCraft,
  matchingRecipes: WynncraftRecipe[],
  preferences: SolverPreferences
): SolvedCraft | null => {
  const requiredIngredientLevel = Math.max(
    1,
    ...craft.grid.map((ingredient) => ingredient?.requirements?.level ?? 1)
  );
  const sourceRecipes = matchingRecipes
    .filter(
      (recipe) =>
        recipe.skill === craft.recipe.skill &&
        recipe.type === craft.recipe.type &&
        recipe.level.maximum >= requiredIngredientLevel
    )
    .sort((a, b) => a.level.minimum - b.level.minimum);

  const candidates = sourceRecipes.length ? sourceRecipes : [craft.recipe];
  const tierOptions: Array<1 | 2 | 3> = [1, 2, 3];

  const meetsWith = (recipe: WynncraftRecipe, tier: 1 | 2 | 3) => {
    const boostPercent = materialTierBoost(recipe, tier);
    const durability = clampRangeMin(
      addFlatToRange(
        boostRange(estimatedRecipeDurabilityRange(recipe), boostPercent),
        craft.durabilityDelta
      )
    );
    const duration =
      rangeAverageLike(boostRange(recipeRange(recipe.duration), boostPercent)) +
      craft.durationDelta;
    const charges =
      (supportsConsumableStats(recipe) ? baseChargesForLevel(recipe.level.minimum) : 0) +
      craft.chargesDelta;

    return (
      (!supportsDurability(recipe) ||
        durability.max >= durabilityFilterValue(preferences.minDurability)) &&
      (!supportsDuration(recipe) || duration >= preferences.minDuration) &&
      (!supportsConsumableStats(recipe) || charges >= preferences.minCharges)
    );
  };

  for (const tier of tierOptions) {
    let low = 0;
    let high = candidates.length - 1;
    let best: WynncraftRecipe | null = null;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const recipe = candidates[mid];

      if (meetsWith(recipe, tier)) {
        best = recipe;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    if (best) {
      const boostPercent = materialTierBoost(best, tier);
      return {
        ...craft,
        recipe: applyMaterialPlanToRecipe(best, {
          sourceRecipeInternalName: best.internalName,
          sourceLevel: best.level,
          utilityBoostPercent: boostPercent,
          upgradedByLevel: best.internalName !== craft.recipe.internalName,
          upgradedByTier: tier > 1,
          tiers: best.materials.map((material) => ({
            ...material,
            tier
          }))
        }),
        materialPlan: {
          sourceRecipeInternalName: best.internalName,
          sourceLevel: best.level,
          utilityBoostPercent: boostPercent,
          upgradedByLevel: best.internalName !== craft.recipe.internalName,
          upgradedByTier: tier > 1,
          tiers: best.materials.map((material) => ({
            ...material,
            tier
          }))
        }
      };
    }
  }

  return null;
};

const addFlatToRange = (range: NumericRange, amount: number): NumericRange => ({
  min: range.min + amount,
  max: range.max + amount
});

const clampRangeMin = (range: NumericRange, floor = 0): NumericRange => ({
  min: Math.max(floor, range.min),
  max: Math.max(floor, range.max)
});

const craftResultKey = (craft: SolvedCraft) =>
  [
    craft.recipe.internalName,
    craft.grid.map((ingredient) => ingredient?.internalName ?? "empty").join("|"),
    Object.entries(craft.ids)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => `${id}:${value.min}:${value.max}`)
      .join(";"),
    craft.durabilityDelta,
    craft.durationDelta,
    craft.chargesDelta
  ].join("|");

const craftSelectionKey = (craft: SolvedCraft) => {
  const ingredientIndexes = new Map<string, number>();
  const ingredientNames: string[] = [];
  const slots = craft.grid
    .map((ingredient) => {
      if (!ingredient) return ".";
      let index = ingredientIndexes.get(ingredient.internalName);
      if (index === undefined) {
        index = ingredientNames.length;
        ingredientIndexes.set(ingredient.internalName, index);
        ingredientNames.push(ingredient.internalName);
      }
      return String.fromCharCode(65 + index);
    })
    .join("");

  return [craft.recipe.internalName, slots, ...ingredientNames].join("|");
};

const craftDedupeKey = (craft: SolvedCraft) =>
  [
    craft.recipe.type,
    craft.grid
      .map((ingredient) => ingredient?.internalName ?? "empty")
      .sort()
      .join("|"),
    Object.entries(craft.ids)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => `${id}:${value.min}:${value.max}`)
      .join(";"),
    craft.durabilityDelta,
    craft.durationDelta,
    craft.chargesDelta
  ].join("|");

const buildCraftBaselines = (crafts: SolvedCraft[], ids: string[]) =>
  Object.fromEntries(
    ids.map((id) => [
      id,
      Math.max(
        1,
        ...crafts.map((craft) => Math.abs(rangeMidpoint(craft.ids[id])))
      )
    ])
  );

const targetScore = (
  craft: SolvedCraft,
  targetIds: string[],
  baselines: Record<string, number>
) =>
  targetIds.reduce(
    (total, id) =>
      total + Math.max(0, rangeMidpoint(craft.ids[id])) / (baselines[id] || 1),
    0
  );

const avoidScore = (
  craft: SolvedCraft,
  avoidIds: string[],
  baselines: Record<string, number>
) =>
  avoidIds.reduce(
    (total, id) =>
      total + Math.abs(rangeMidpoint(craft.ids[id])) / (baselines[id] || 1),
    0
  );

const hasSelectedTarget = (craft: SolvedCraft, targetIds: string[]) =>
  targetIds.length === 0 ||
  targetIds.every((id) => rangeMidpoint(craft.ids[id]) > 0);

const dedupeByLayoutKeepingLowestLevel = (crafts: SolvedCraft[]) => {
  const byLayout = new Map<string, SolvedCraft>();

  crafts.forEach((craft) => {
    const key = craftDedupeKey(craft);
    const existing = byLayout.get(key);
    if (!existing || craft.recipe.level.minimum < existing.recipe.level.minimum) {
      byLayout.set(key, craft);
    }
  });

  return Array.from(byLayout.values());
};

const rangeAverageLike = (range: NumericRange) => (range.min + range.max) / 2;

const finalDurabilityRange = (craft: SolvedCraft) =>
  clampRangeMin(
    addFlatToRange(estimatedRecipeDurabilityRange(craft.recipe), craft.durabilityDelta)
  );

const finalDuration = (craft: SolvedCraft) =>
  rangeAverageLike(recipeRange(craft.recipe.duration)) + craft.durationDelta;

const finalCharges = (craft: SolvedCraft) =>
  (supportsConsumableStats(craft.recipe)
    ? baseChargesForLevel(craft.recipe.level.minimum)
    : rangeAverageLike(recipeRange(craft.recipe.charges))) + craft.chargesDelta;

const meetsMinimums = (craft: SolvedCraft, preferences: SolverPreferences) => {
  const durability = finalDurabilityRange(craft);
  return (
    (!supportsDurability(craft.recipe) ||
      durability.max >= durabilityFilterValue(preferences.minDurability)) &&
    (!supportsDuration(craft.recipe) || finalDuration(craft) >= preferences.minDuration) &&
    (!supportsConsumableStats(craft.recipe) || finalCharges(craft) >= preferences.minCharges)
  );
};

function Metric({
  label,
  value,
  accent,
  negative
}: {
  label: string;
  value: string;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={clsx("metric", accent && "metricAccent")}>
      <span>{label}</span>
      <strong className={clsx(negative && "negativeText")}>{value}</strong>
    </div>
  );
}

const isNegativeRange = (range: NumericRange) => rangeMidpoint(range) < 0;

function SelectablePill({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx("pill", selected && "pillSelected")}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CollapsibleSection({
  label,
  itemCount,
  open,
  onToggle,
  children
}: {
  label: string;
  itemCount?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="idPicker">
      <button
        type="button"
        className="collapsibleToggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          {label}
          {itemCount ? ` (${itemCount})` : ""}
        </span>
        <ChevronRight
          size={16}
          className={clsx("collapsibleChevron", open && "collapsibleChevronOpen")}
        />
      </button>
      {open && <div className="collapsibleContent">{children}</div>}
    </div>
  );
}

function StepperControl({
  label,
  value,
  step,
  quickSteps = [],
  formatValue = formatNumber,
  formatQuickValue,
  onChange
}: {
  label: string;
  value: number;
  step: number;
  quickSteps?: number[];
  formatValue?: (value: number) => string;
  formatQuickValue?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const nextValue = (direction: -1 | 1) => Math.max(0, value + step * direction);
  const quickValue = (amount: number) => Math.max(0, value + amount);
  const quickLabel = (amount: number) =>
    formatQuickValue
      ? formatQuickValue(amount)
      : `${amount > 0 ? "+" : ""}${formatNumber(amount)}`;

  return (
    <div className="stepperControl">
      <span>{label}</span>
      {quickSteps.length > 0 ? (
        <div className="quickStepRow">
          {quickSteps
            .filter((amount) => amount < 0)
            .map((amount) => (
              <button
                type="button"
                key={amount}
                className="quickStepButton"
                onClick={() => onChange(quickValue(amount))}
                disabled={value + amount < 0}
              >
                {quickLabel(amount)}
              </button>
            ))}
          <strong className="stepperValue">{formatValue(value)}</strong>
          {quickSteps
            .filter((amount) => amount > 0)
            .map((amount) => (
              <button
                type="button"
                key={amount}
                className="quickStepButton"
                onClick={() => onChange(quickValue(amount))}
              >
                {quickLabel(amount)}
              </button>
            ))}
        </div>
      ) : (
        <div className="stepperRow">
          <button
            type="button"
            className="stepperButton"
            title={`Decrease ${label}`}
            onClick={() => onChange(nextValue(-1))}
            disabled={value <= 0}
          >
            <Minus size={15} />
          </button>
          <strong>{formatValue(value)}</strong>
          <button
            type="button"
            className="stepperButton"
            title={`Increase ${label}`}
            onClick={() => onChange(nextValue(1))}
          >
            <Plus size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function FinalStatsPreview({ craft }: { craft: SolvedCraft }) {
  const durability = finalDurabilityRange(craft);
  const duration = finalDuration(craft);
  const charges = finalCharges(craft);
  const healthOrDamage = recipeRange(craft.recipe.healthOrDamage);
  const targetIds = craft.positives.map((item) => [item.id, item.value] as const);
  const otherIds = Object.entries(craft.ids)
    .filter(([, value]) => rangeMidpoint(value) !== 0)
    .filter(([id]) => !craft.positives.some((item) => item.id === id))
    .sort(([, a], [, b]) => Math.abs(rangeMidpoint(b)) - Math.abs(rangeMidpoint(a)))
    .slice(0, Math.max(0, 4 - targetIds.length));
  const standoutIds = [...targetIds, ...otherIds];

  return (
    <div className="resultStats">
      {supportsDurability(craft.recipe) && (
        <span>Dur {plainRange(durabilityDisplayRange(durability))}</span>
      )}
      {supportsDuration(craft.recipe) && <span>Duration {formatDuration(duration)}</span>}
      {supportsConsumableStats(craft.recipe) && charges !== 0 && (
        <span className={clsx(charges < 0 && "negativePill")}>
          Charges {formatNumber(charges, 1)}
        </span>
      )}
      <span>Power {plainRange(healthOrDamage)}</span>
      {standoutIds.map(([id, value]) => (
        <span
          key={id}
          className={clsx(
            craft.positives.some((item) => item.id === id) && "targetPill",
            isNegativeRange(value) && "negativePill"
          )}
        >
          {idLabel(id)} {signedRange(value, 1)}
        </span>
      ))}
    </div>
  );
}

const savedRecipeSummary = (craft: SolvedCraft) => {
  const targetStats = craft.positives
    .filter((item) => rangeMidpoint(item.value) !== 0)
    .map((item) => ({
      label: idLabel(item.id),
      value: signedRange(item.value, 1),
      negative: isNegativeRange(item.value)
    }));
  const utilityStats: SavedRecipeStat[] = [];

  if (supportsDurability(craft.recipe)) {
    utilityStats.push({
      label: "Dur",
      value: plainRange(durabilityDisplayRange(finalDurabilityRange(craft)))
    });
  }
  if (supportsDuration(craft.recipe)) {
    utilityStats.push({ label: "Duration", value: formatDuration(finalDuration(craft)) });
  }
  if (supportsConsumableStats(craft.recipe)) {
    const charges = finalCharges(craft);
    utilityStats.push({
      label: "Charges",
      value: formatNumber(charges, 1),
      negative: charges < 0
    });
  }

  return { targetStats, utilityStats };
};

function ResultsList({
  results,
  selected,
  onSelect
}: {
  results: SolvedCraft[];
  selected: string | null;
  onSelect: (internalName: string) => void;
}) {
  if (!results.length) {
    return (
      <div className="emptyState">
        <AlertCircle size={22} />
        <p>No matching base recipes. Widen the level range or change the crafted item.</p>
      </div>
    );
  }

  return (
    <div className="resultList">
      {results.map((result) => (
        <button
          type="button"
          key={craftSelectionKey(result)}
          className={clsx(
            "resultCard",
            selected === craftSelectionKey(result) && "resultCardSelected"
          )}
          onClick={() => onSelect(craftSelectionKey(result))}
        >
          <div>
            <span className="resultType">{titleCase(result.recipe.type)}</span>
            <strong>
              Level {result.recipe.level.minimum}-{result.recipe.level.maximum}
            </strong>
            <FinalStatsPreview craft={result} />
          </div>
          <div className={clsx("scoreBadge", scoreTone(result.score))}>
            {formatNumber(result.score)}
          </div>
        </button>
      ))}
    </div>
  );
}

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
        window.prompt("Share link", url);
      });
  };

  return (
    <button
      type="button"
      className="shareButton"
      onClick={copyUrl}
      title={copied ? "Share link copied" : "Copy share link"}
      aria-label={copied ? "Share link copied" : "Copy share link"}
    >
      <Share2 size={15} />
    </button>
  );
}

function SaveRecipeButton({
  saved,
  onClick
}: {
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx("shareButton", saved && "saveButtonActive")}
      onClick={onClick}
      title={saved ? "Recipe saved in this browser" : "Save recipe in this browser"}
      aria-label={saved ? "Recipe saved in this browser" : "Save recipe in this browser"}
    >
      <Bookmark size={15} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

function SavedRecipeList({
  recipes,
  onOpen,
  onRemove
}: {
  recipes: SavedRecipe[];
  onOpen: (url: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="savedRecipeList">
      {recipes.length ? (
        recipes.map((recipe) => (
          <div className="savedRecipeRow" key={recipe.id}>
            <button
              type="button"
              className="savedRecipeOpen"
              onClick={() => onOpen(recipe.url)}
              title={`Open ${recipe.title}`}
            >
              <strong>{recipe.title}</strong>
              <span className="savedRecipeIngredients">{recipe.ingredients}</span>
              {(recipe.targetStats?.length || recipe.utilityStats?.length) && (
                <span className="savedRecipeSummary">
                  {recipe.targetStats?.map((stat) => (
                    <span
                      key={`target-${stat.label}`}
                      className={clsx(
                        "savedRecipeStat",
                        "savedRecipeTarget",
                        stat.negative && "negativePill"
                      )}
                    >
                      {stat.label} {stat.value}
                    </span>
                  ))}
                  {recipe.utilityStats?.map((stat) => (
                    <span
                      key={`utility-${stat.label}`}
                      className={clsx(
                        "savedRecipeStat",
                        stat.negative && "negativePill"
                      )}
                    >
                      {stat.label} {stat.value}
                    </span>
                  ))}
                </span>
              )}
            </button>
            <button
              type="button"
              className="savedRecipeRemove"
              onClick={() => onRemove(recipe.id)}
              title={`Remove ${recipe.title}`}
              aria-label={`Remove ${recipe.title}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))
      ) : (
        <span className="savedRecipeEmpty">Save a selected recipe to keep it here.</span>
      )}
    </div>
  );
}

function SavedRecipesMenu({
  recipes,
  onOpen,
  onRemove
}: {
  recipes: SavedRecipe[];
  onOpen: (url: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="savedRecipesMenu">
      <button
        type="button"
        className={clsx("savedRecipesTrigger", open && "savedRecipesTriggerOpen")}
        onClick={() => setOpen((value) => !value)}
        title="Saved recipes"
        aria-label="Saved recipes"
        aria-expanded={open}
      >
        <Bookmark size={17} fill={recipes.length ? "currentColor" : "none"} />
        {recipes.length > 0 && <span className="savedRecipesCount">{recipes.length}</span>}
      </button>
      {open && (
        <div className="savedRecipesPopover">
          <strong>Saved recipes</strong>
          <SavedRecipeList recipes={recipes} onOpen={onOpen} onRemove={onRemove} />
        </div>
      )}
    </div>
  );
}

function IngredientStats({
  ingredient,
  effectiveness,
  recipe,
  targetIds
}: {
  ingredient: WynncraftIngredient;
  effectiveness: number;
  recipe: WynncraftRecipe;
  targetIds: string[];
}) {
  const multiplier = effectiveness / 100;
  const idStats = Object.entries(ingredient.identifications ?? {})
    .map(([id, value]) => ({
      id,
      label: idLabel(id),
      value: scaleRange(identificationRange(value), multiplier)
    }))
    .filter((stat) => rangeMidpoint(stat.value) !== 0)
    .sort((a, b) => Math.abs(rangeMidpoint(b.value)) - Math.abs(rangeMidpoint(a.value)));

  const utilityStats = [
    ...(supportsDurability(recipe)
      ? [
          {
            id: "durability",
            label: "Durability",
            value: durabilityDisplayValue(
              (ingredient.itemOnlyIDs?.durabilityModifier ?? 0) * multiplier
            ),
            digits: 0
          }
        ]
      : []),
    ...(supportsConsumableStats(recipe)
      ? [
          {
            id: "charges",
            label: "Charges",
            value: (ingredient.consumableOnlyIDs?.charges ?? 0) * multiplier,
            digits: 1
          },
          {
            id: "duration",
            label: "Duration",
            value: (ingredient.consumableOnlyIDs?.duration ?? 0) * multiplier,
            digits: 1
          }
        ]
      : [])
  ].filter((stat) => stat.value !== 0);

  const visibleStats = [...idStats, ...utilityStats].slice(0, 5);
  const hiddenCount = idStats.length + utilityStats.length - visibleStats.length;

  if (!visibleStats.length) {
    return <span className="ingredientNoStats">No direct stat modifiers</span>;
  }

  return (
    <div className="ingredientStats">
      {visibleStats.map((stat) => (
        <div
          className={clsx(
            "ingredientStat",
            targetIds.includes(stat.id) && "targetStat",
            (typeof stat.value === "number"
              ? stat.value < 0
              : isNegativeRange(stat.value)) && "negativeStat"
          )}
          key={stat.id}
        >
          <span>{stat.label}</span>
          <strong>
            {typeof stat.value === "number"
              ? signedNumber(stat.value, "digits" in stat ? stat.digits : 1)
              : signedRange(stat.value, 1)}
          </strong>
        </div>
      ))}
      {hiddenCount > 0 && (
        <span className="ingredientMore">
          +{hiddenCount} more stat{hiddenCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function Workbench({
  craft,
  shareUrl,
  saved,
  onSave
}: {
  craft: SolvedCraft;
  shareUrl: string;
  saved: boolean;
  onSave: () => void;
}) {
  const baseDurability = estimatedRecipeDurabilityRange(craft.recipe);
  const finalDurability = clampRangeMin(addFlatToRange(baseDurability, craft.durabilityDelta));
  const baseDuration = recipeRange(craft.recipe.duration);
  const finalDurationValue = finalDuration(craft);
  const baseHealthOrDamage = recipeRange(craft.recipe.healthOrDamage);

  return (
    <section className="workbench">
      <div className="sectionHeading">
        <div>
          <span>Algorithmic layout</span>
          <h2>{titleCase(craft.recipe.type)} workbench</h2>
        </div>
        <div className="workbenchActions">
          <div className="recipeChip">
            {craft.recipe.skill} {craft.recipe.level.minimum}-{craft.recipe.level.maximum}
            {craft.materialPlan?.upgradedByTier ? ` - Tier ${craft.materialPlan.tiers[0]?.tier}` : ""}
          </div>
          {shareUrl && (
            <div className="resultActions">
              <SaveRecipeButton saved={saved} onClick={onSave} />
              <ShareButton url={shareUrl} />
            </div>
          )}
        </div>
      </div>

      <div className="gridAndStats">
        <div className="craftGrid" aria-label="2 by 3 crafting grid">
          {craft.grid.map((ingredient, index) => (
            <div className="ingredientSlot" key={`${ingredient?.internalName ?? "empty"}-${index}`}>
              <span className="slotIndex">{index + 1}</span>
              {ingredient ? (
                <>
                  <strong>{ingredient.displayName}</strong>
                  <small className="ingredientMeta">
                    Level {ingredient.requirements?.level ?? 1} - {tierLabel(ingredient.tier)} -{" "}
                    {formatNumber(craft.effectiveness[index])}% effective
                  </small>
                  <IngredientStats
                    ingredient={ingredient}
                    effectiveness={craft.effectiveness[index]}
                    recipe={craft.recipe}
                    targetIds={craft.positives.map((item) => item.id)}
                  />
                </>
              ) : (
                <em>Open slot</em>
              )}
            </div>
          ))}
        </div>

        <div className="statsPanel">
          <Metric label="Score" value={formatNumber(craft.score)} accent />
          {supportsDurability(craft.recipe) && (
            <>
              <Metric
                label="Base durability"
                value={plainRange(durabilityDisplayRange(baseDurability))}
              />
              <Metric
                label="Final durability"
                value={plainRange(durabilityDisplayRange(finalDurability))}
              />
              <Metric
                label="Durability shift"
                value={signedNumber(durabilityDisplayValue(craft.durabilityDelta))}
                negative={craft.durabilityDelta < 0}
              />
            </>
          )}
          <Metric
            label="Damage / health"
            value={plainRange(baseHealthOrDamage)}
          />
          {supportsDuration(craft.recipe) && (
            <>
              <Metric
                label="Base duration"
                value={`${formatDuration(baseDuration.min)}${
                  baseDuration.min === baseDuration.max
                    ? ""
                    : ` to ${formatDuration(baseDuration.max)}`
                }`}
              />
              <Metric
                label="Final duration"
                value={formatDuration(finalDurationValue)}
                negative={finalDurationValue < 0}
              />
              <Metric
                label="Duration shift"
                value={`${signedNumber(craft.durationDelta, 1)}s`}
                negative={craft.durationDelta < 0}
              />
            </>
          )}
          {supportsConsumableStats(craft.recipe) && (
            <Metric
              label="Charges shift"
              value={signedNumber(craft.chargesDelta, 1)}
              negative={craft.chargesDelta < 0}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function DetailPanel({ craft }: { craft: SolvedCraft }) {
  const requirements = Object.entries(craft.requirements).filter(([, value]) => value !== 0);

  return (
    <section className="details">
      <div className="detailColumn">
        <h3>Target gains</h3>
        {craft.positives.length ? (
          <div className="statList">
            {craft.positives.map((item) => (
              <div key={item.id} className="statRow targetStatRow">
                <span>{idLabel(item.id)}</span>
                <strong>{signedRange(item.value, 1)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>No selected target IDs are present in this layout.</p>
        )}
      </div>

      <div className="detailColumn">
        <h3>Watch list</h3>
        {craft.penalties.length ? (
          <div className="statList">
            {craft.penalties.map((item) => (
              <div key={item.id} className="statRow mutedRow">
                <span>{idLabel(item.id)}</span>
                <strong>{signedRange(item.value, 1)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p>No avoided IDs were introduced by the selected ingredients.</p>
        )}
      </div>

      <div className="detailColumn">
        <h3>Materials</h3>
        <div className="statList">
          {craft.recipe.materials.map((material) => (
            <div key={material.item} className="statRow">
              <span>{material.item}</span>
              <strong>
                x{material.amount}
                {craft.materialPlan
                  ? ` T${craft.materialPlan.tiers.find((item) => item.item === material.item)?.tier ?? 1}`
                  : ""}
              </strong>
            </div>
          ))}
        </div>
        {craft.materialPlan && (
          <div className="requirements">
            {craft.materialPlan.upgradedByLevel && (
              <span>Material level matches ingredients</span>
            )}
            {craft.materialPlan.upgradedByTier && (
              <span>
                Base durability/duration +{formatNumber(craft.materialPlan.utilityBoostPercent, 1)}%
              </span>
            )}
          </div>
        )}
        {requirements.length > 0 && (
          <div className="requirements">
            {requirements.map(([skill, value]) => (
              <span key={skill} className={clsx(value < 0 && "negativePill")}>
                {titleCase(skill)} {value >= 0 ? "+" : ""}
                {formatNumber(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SidebarFilters({
  recipes,
  ingredients,
  profession,
  setProfession,
  craftedType,
  setCraftedType,
  minLevel,
  setMinLevel,
  maxLevel,
  setMaxLevel,
  preferences,
  setPreferences,
  onSearch,
  hasPendingChanges
}: {
  recipes: WynncraftRecipe[];
  ingredients: WynncraftIngredient[];
  profession: Profession;
  setProfession: (profession: Profession) => void;
  craftedType: string;
  setCraftedType: (type: string) => void;
  minLevel: number;
  setMinLevel: (level: number) => void;
  maxLevel: number;
  setMaxLevel: (level: number) => void;
  preferences: SolverPreferences;
  setPreferences: (preferences: SolverPreferences) => void;
  onSearch: () => void;
  hasPendingChanges: boolean;
}) {
  const recipeTypes = getRecipeTypes(recipes, profession);
  const knownIds = getKnownIds(ingredients);
  const showDurabilityMinimum = professionSupportsDurability(recipes, profession);
  const showDurationMinimum = professionSupportsDuration(recipes, profession);
  const showChargesMinimum = professionSupportsConsumableStats(recipes, profession);
  const [targetIdQuery, setTargetIdQuery] = useState("");
  const [avoidIdQuery, setAvoidIdQuery] = useState("");
  const [avoidIdsOpen, setAvoidIdsOpen] = useState(false);

  const matchingIds = (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return knownIds;
    return knownIds.filter((id) => {
      const label = idLabel(id).toLowerCase();
      return label.includes(normalizedQuery) || id.toLowerCase().includes(normalizedQuery);
    });
  };

  const targetIdOptions = matchingIds(targetIdQuery);
  const avoidIdOptions = matchingIds(avoidIdQuery);

  const toggleId = (kind: "targetIds" | "avoidIds", id: string) => {
    const values = preferences[kind];
    setPreferences({
      ...preferences,
      [kind]: values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id]
    });
  };

  return (
    <aside className="filters">
      <div className="brandBlock">
        <img src="./wyndb-mark.png" alt="" />
        <div>
          <span>WynnDB</span>
          <strong>Recipe finder</strong>
        </div>
      </div>

      <div className="controlGroup">
        <label>Profession</label>
        <div className="professionGrid">
          {PROFESSIONS.map((item) => {
            const Icon = professionIcons[item];
            return (
              <button
                key={item}
                type="button"
                className={clsx("iconButton", item === profession && "iconButtonSelected")}
                title={titleCase(item)}
                onClick={() => {
                  setProfession(item);
                  setCraftedType(getRecipeTypes(recipes, item)[0] ?? "");
                }}
              >
                <Icon size={19} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="controlGroup">
        <label htmlFor="crafted-type">Crafted item</label>
        <select
          id="crafted-type"
          value={craftedType}
          onChange={(event) => setCraftedType(event.target.value)}
        >
          {recipeTypes.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="levelPair">
        <div className="controlGroup">
          <label htmlFor="min-level">Min level</label>
          <input
            id="min-level"
            type="number"
            min={1}
            max={120}
            value={minLevel}
            onChange={(event) => setMinLevel(Number(event.target.value))}
          />
        </div>
        <div className="controlGroup">
          <label htmlFor="max-level">Max level</label>
          <input
            id="max-level"
            type="number"
            min={1}
            max={120}
            value={maxLevel}
            onChange={(event) => setMaxLevel(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="controlGroup">
        <label htmlFor="ingredient-query">Ingredient search</label>
        <div className="inputWithIcon">
          <Search size={16} />
          <input
            id="ingredient-query"
            value={preferences.ingredientQuery}
            onChange={(event) =>
              setPreferences({ ...preferences, ingredientQuery: event.target.value })
            }
            placeholder="Name contains..."
          />
        </div>
      </div>

      <div className="controlGroup">
        <label htmlFor="banned-ingredients">Banned ingredients</label>
        <textarea
          id="banned-ingredients"
          value={preferences.bannedIngredients}
          onChange={(event) =>
            setPreferences({ ...preferences, bannedIngredients: event.target.value })
          }
          placeholder={"One per line, or comma separated"}
          rows={4}
        />
      </div>

      {(showDurabilityMinimum || showDurationMinimum || showChargesMinimum) && (
        <div className="minimumGrid">
          {showDurabilityMinimum && (
            <StepperControl
              label="Min durability"
              value={preferences.minDurability}
              step={10}
              quickSteps={[-200, -50, -10, 10, 50, 200]}
              onChange={(value) => setPreferences({ ...preferences, minDurability: value })}
            />
          )}
          {showDurationMinimum && (
            <StepperControl
              label="Min duration"
              value={preferences.minDuration}
              step={10}
              quickSteps={[-60, -30, -10, 10, 30, 60]}
              formatValue={formatDuration}
              formatQuickValue={(amount) => `${amount > 0 ? "+" : ""}${amount}s`}
              onChange={(value) => setPreferences({ ...preferences, minDuration: value })}
            />
          )}
          {showChargesMinimum && (
            <StepperControl
              label="Min charges"
              value={preferences.minCharges}
              step={1}
              onChange={(value) => setPreferences({ ...preferences, minCharges: value })}
            />
          )}
        </div>
      )}

      <label className="toggleRow">
        <input
          type="checkbox"
          checked={preferences.includeTradeoffs}
          onChange={(event) =>
            setPreferences({ ...preferences, includeTradeoffs: event.target.checked })
          }
        />
        <span>Let recipe utility stats break close target-ID scores</span>
      </label>

      <div className="idPicker">
        <div className="idPickerHeader">
          <span>Target IDs</span>
          <ArrowDownUp size={15} />
        </div>
        <div className="inputWithIcon">
          <Search size={15} />
          <input
            value={targetIdQuery}
            onChange={(event) => setTargetIdQuery(event.target.value)}
            placeholder="Search IDs..."
            aria-label="Search target IDs"
          />
        </div>
        <div className="pillWrap">
          {targetIdOptions
            .filter((id) => defaultTargets.includes(id) || FRIENDLY_ID_NAMES[id])
            .slice(0, targetIdQuery.trim() ? undefined : 34)
            .map((id) => (
              <SelectablePill
                key={id}
                label={idLabel(id)}
                selected={preferences.targetIds.includes(id)}
                onClick={() => toggleId("targetIds", id)}
              />
            ))}
        </div>
      </div>

      <CollapsibleSection
        label="Avoid IDs"
        itemCount={preferences.avoidIds.length}
        open={avoidIdsOpen}
        onToggle={() => setAvoidIdsOpen((open) => !open)}
      >
        <div className="idPickerContent">
          {avoidIdsOpen && (
          <>
            <div className="inputWithIcon">
              <Search size={15} />
              <input
                value={avoidIdQuery}
                onChange={(event) => setAvoidIdQuery(event.target.value)}
                placeholder="Search IDs..."
                aria-label="Search avoid IDs"
              />
            </div>
            <div className="pillWrap compact">
              {avoidIdOptions
                .filter((id) => defaultAvoids.includes(id) || FRIENDLY_ID_NAMES[id])
                .slice(0, avoidIdQuery.trim() ? undefined : 26)
                .map((id) => (
                  <SelectablePill
                    key={id}
                    label={idLabel(id)}
                    selected={preferences.avoidIds.includes(id)}
                    onClick={() => toggleId("avoidIds", id)}
                  />
                ))}
            </div>
          </>
          )}
        </div>
      </CollapsibleSection>

      <button
        type="button"
        className={clsx("searchButton", hasPendingChanges && "searchButtonPending")}
        onClick={onSearch}
      >
        <Search size={17} />
        Search recipes
      </button>
    </aside>
  );
}

export default function WynncrafterApp() {
  const [recipes, setRecipes] = useState<WynncraftRecipe[]>([]);
  const [ingredients, setIngredients] = useState<WynncraftIngredient[]>([]);
  const [utilityIngredients, setUtilityIngredients] = useState<WynncraftIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftProfession, setDraftProfession] = useState<Profession>("armouring");
  const [draftCraftedType, setDraftCraftedType] = useState("helmet");
  const [draftMinLevel, setDraftMinLevel] = useState(1);
  const [draftMaxLevel, setDraftMaxLevel] = useState(120);
  const [searchedProfession, setSearchedProfession] = useState<Profession>("armouring");
  const [searchedCraftedType, setSearchedCraftedType] = useState("helmet");
  const [searchedMinLevel, setSearchedMinLevel] = useState(1);
  const [searchedMaxLevel, setSearchedMaxLevel] = useState(120);
  const [selectedRecipe, setSelectedRecipe] = useState<string | null>(null);
  const [draftPreferences, setDraftPreferences] =
    useState<SolverPreferences>(defaultPreferences);
  const [searchedPreferences, setSearchedPreferences] = useState<SolverPreferences>(draftPreferences);
  const [shareUrl, setShareUrl] = useState("");
  const [urlHydrated, setUrlHydrated] = useState(false);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [savedRecipesLoaded, setSavedRecipesLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(savedRecipesStorageKey);
      const parsed = stored ? (JSON.parse(stored) as SavedRecipe[]) : [];
      setSavedRecipes(
        Array.isArray(parsed)
          ? parsed.flatMap((recipe) =>
              typeof recipe?.id === "string" &&
              typeof recipe?.url === "string" &&
              typeof recipe?.title === "string" &&
              typeof recipe?.ingredients === "string"
                ? [
                    {
                      ...recipe,
                      targetStats: normalizeSavedRecipeStats(recipe.targetStats),
                      utilityStats: normalizeSavedRecipeStats(recipe.utilityStats)
                    }
                  ]
                : []
            )
          : []
      );
    } catch {
      setSavedRecipes([]);
    } finally {
      setSavedRecipesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!savedRecipesLoaded) return;
    window.localStorage.setItem(savedRecipesStorageKey, JSON.stringify(savedRecipes));
  }, [savedRecipes, savedRecipesLoaded]);

  useEffect(() => {
    const sharedState =
      typeof window === "undefined"
        ? null
        : decodeSharedState(new URLSearchParams(window.location.search).get("s") ?? "");
    const sharedSelectedKey =
      typeof window === "undefined" ? null : selectedKeyFromHash(window.location.hash);

    if (sharedState) {
      setDraftProfession(sharedState.profession);
      setSearchedProfession(sharedState.profession);
      setDraftCraftedType(sharedState.craftedType);
      setSearchedCraftedType(sharedState.craftedType);
      setDraftMinLevel(sharedState.minLevel);
      setSearchedMinLevel(sharedState.minLevel);
      setDraftMaxLevel(sharedState.maxLevel);
      setSearchedMaxLevel(sharedState.maxLevel);
      setDraftPreferences(sharedState.preferences);
      setSearchedPreferences(sharedState.preferences);
      setSelectedRecipe(sharedSelectedKey);
    }
    setUrlHydrated(true);

    let mounted = true;
    Promise.all([fetchRecipes(), fetchIngredientData()])
      .then(([recipeData, ingredientData]) => {
        if (!mounted) return;
        setRecipes(recipeData);
        setIngredients(ingredientData.ingredients);
        setUtilityIngredients(ingredientData.utilityIngredients);
        const initialType = getRecipeTypes(recipeData, "armouring")[0] ?? "helmet";
        if (!sharedState) {
          setDraftCraftedType(initialType);
          setSearchedCraftedType(initialType);
          setSelectedRecipe(null);
        }
      })
      .catch((requestError: Error) => {
        if (!mounted) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const hasPendingChanges = useMemo(
    () =>
      draftProfession !== searchedProfession ||
      draftCraftedType !== searchedCraftedType ||
      draftMinLevel !== searchedMinLevel ||
      draftMaxLevel !== searchedMaxLevel ||
      JSON.stringify(draftPreferences) !== JSON.stringify(searchedPreferences),
    [
      draftCraftedType,
      draftMaxLevel,
      draftMinLevel,
      draftPreferences,
      draftProfession,
      searchedCraftedType,
      searchedMaxLevel,
      searchedMinLevel,
      searchedPreferences,
      searchedProfession
    ]
  );

  const applySearch = () => {
    setSearchedProfession(draftProfession);
    setSearchedCraftedType(draftCraftedType);
    setSearchedMinLevel(draftMinLevel);
    setSearchedMaxLevel(draftMaxLevel);
    setSearchedPreferences(draftPreferences);
    setSelectedRecipe(null);
  };

  const matchingRecipes = useMemo(
    () =>
      recipes
        .filter(
          (recipe) =>
            recipe.skill === searchedProfession &&
            recipe.type === searchedCraftedType &&
            recipe.level.maximum >= searchedMinLevel &&
            recipe.level.minimum <= searchedMaxLevel
        )
        .sort((a, b) => b.level.maximum - a.level.maximum),
    [searchedCraftedType, searchedMaxLevel, searchedMinLevel, searchedProfession, recipes]
  );

  const solvedRecipes = useMemo(
    () => {
      const solverPreferences = searchedPreferences;
      const solved = matchingRecipes
        .flatMap((recipe) =>
          solveRecipe(recipe, ingredients, solverPreferences, utilityIngredients)
        )
        .map((craft) => withMaterialPlan(craft, matchingRecipes, searchedPreferences))
        .filter((craft): craft is SolvedCraft => Boolean(craft));
      const deduped = dedupeByLayoutKeepingLowestLevel(solved).filter((craft) =>
        hasSelectedTarget(craft, searchedPreferences.targetIds)
      );
      const baselines = buildCraftBaselines(deduped, [
        ...searchedPreferences.targetIds,
        ...searchedPreferences.avoidIds
      ]);

      return deduped
        .sort((a, b) => {
          const targetDelta =
            targetScore(b, searchedPreferences.targetIds, baselines) -
            targetScore(a, searchedPreferences.targetIds, baselines);
          if (Math.abs(targetDelta) > 0.0001) return targetDelta;

          const avoidDelta =
            avoidScore(a, searchedPreferences.avoidIds, baselines) -
            avoidScore(b, searchedPreferences.avoidIds, baselines);
          if (Math.abs(avoidDelta) > 0.0001) return avoidDelta;

          const levelDelta = a.recipe.level.minimum - b.recipe.level.minimum;
          if (levelDelta !== 0) return levelDelta;

          return b.score - a.score;
        })
        .slice(0, 48);
    },
    [ingredients, matchingRecipes, searchedPreferences, searchedMaxLevel, utilityIngredients]
  );

  const selectedCraft = useMemo(() => {
    if (!solvedRecipes.length) return null;
    return (
      solvedRecipes.find(
        (result) =>
          craftSelectionKey(result) === selectedRecipe ||
          craftResultKey(result) === selectedRecipe
      ) ??
      solvedRecipes[0]
    );
  }, [selectedRecipe, solvedRecipes]);

  useEffect(() => {
    if (typeof window === "undefined" || !urlHydrated) return;
    const selectedKey = selectedCraft ? craftSelectionKey(selectedCraft) : selectedRecipe;
    const state: SharedSearchState = {
      profession: searchedProfession,
      craftedType: searchedCraftedType,
      minLevel: searchedMinLevel,
      maxLevel: searchedMaxLevel,
      preferences: searchedPreferences
    };
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("s", encodeSharedState(state));
    nextUrl.hash = selectedKey ? selectedHashFromKey(selectedKey) : "";
    setShareUrl(nextUrl.toString());
    window.history.replaceState(null, "", nextUrl);
  }, [
    urlHydrated,
    searchedCraftedType,
    searchedMaxLevel,
    searchedMinLevel,
    searchedPreferences,
    searchedProfession,
    selectedCraft,
    selectedRecipe
  ]);

  const dataStats = useMemo(
    () => ({
      recipes: recipes.length,
      ingredients: ingredients.length,
      ids: getKnownIds(ingredients).length
    }),
    [ingredients, recipes]
  );
  const selectedRecipeSaved = Boolean(
    shareUrl && savedRecipes.some((recipe) => recipe.id === shareUrl)
  );

  const saveSelectedRecipe = () => {
    if (!selectedCraft || !shareUrl) return;
    const ingredientNames = Array.from(
      new Set(
        selectedCraft.grid
          .filter((ingredient): ingredient is WynncraftIngredient => Boolean(ingredient))
          .map((ingredient) => ingredient.displayName)
      )
    );
    const recipe: SavedRecipe = {
      id: shareUrl,
      url: shareUrl,
      title: `${titleCase(selectedCraft.recipe.type)} ${selectedCraft.recipe.level.minimum}-${selectedCraft.recipe.level.maximum}`,
      ingredients: ingredientNames.join(" + "),
      ...savedRecipeSummary(selectedCraft)
    };

    setSavedRecipes((recipes) =>
      [recipe, ...recipes.filter((savedRecipe) => savedRecipe.id !== recipe.id)].slice(0, 30)
    );
  };

  const openSavedRecipe = (url: string) => {
    window.location.assign(url);
  };

  const removeSavedRecipe = (id: string) => {
    setSavedRecipes((recipes) => recipes.filter((recipe) => recipe.id !== id));
  };

  return (
    <main className="appShell">
      <SidebarFilters
        recipes={recipes}
        ingredients={ingredients}
        profession={draftProfession}
        setProfession={setDraftProfession}
        craftedType={draftCraftedType}
        setCraftedType={setDraftCraftedType}
        minLevel={draftMinLevel}
        setMinLevel={setDraftMinLevel}
        maxLevel={draftMaxLevel}
        setMaxLevel={setDraftMaxLevel}
        preferences={draftPreferences}
        setPreferences={setDraftPreferences}
        onSearch={applySearch}
        hasPendingChanges={hasPendingChanges}
      />
      <SavedRecipesMenu
        recipes={savedRecipes}
        onOpen={openSavedRecipe}
        onRemove={removeSavedRecipe}
      />

      <div className="mainPane">
        <header className="topBar">
          <div>
            <h1>Find craftable recipes from live Wynncraft data.</h1>
          </div>
          <div className="topActions">
            <div className="topMetrics">
              <Metric label="Recipes" value={loading ? "..." : formatNumber(dataStats.recipes)} />
              <Metric label="Ingredients" value={loading ? "..." : formatNumber(dataStats.ingredients)} />
              <Metric label="IDs" value={loading ? "..." : formatNumber(dataStats.ids)} />
            </div>
          </div>
        </header>

        {loading && (
          <div className="loadingPanel">
            <Loader2 className="spin" size={28} />
            <span>Loading Wynncraft recipes and ingredients...</span>
          </div>
        )}

        {error && (
          <div className="errorPanel">
            <AlertCircle size={24} />
            <div>
              <strong>Could not reach Wynncraft.</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="contentGrid">
            <section className="resultsPanel">
              <div className="sectionHeading">
                <div>
                  <span>Ranked recipes</span>
                  <h2>{solvedRecipes.length} matches</h2>
                </div>
              </div>
              <ResultsList
                results={solvedRecipes}
                selected={selectedCraft ? craftSelectionKey(selectedCraft) : null}
                onSelect={setSelectedRecipe}
              />
            </section>

            <div className="craftPane">
              {selectedCraft ? (
                <>
                  <Workbench
                    craft={selectedCraft}
                    shareUrl={shareUrl}
                    saved={selectedRecipeSaved}
                    onSave={saveSelectedRecipe}
                  />
                  <DetailPanel craft={selectedCraft} />
                  <p className="sourceNote">
                    Recipe bases and ingredient stats are fetched in the browser from the
                    Wynncraft API. Effectiveness is estimated from each ingredient&apos;s
                    left, right, above, under, touching, and not-touching modifiers on a
                    two-column by three-row crafting grid.
                  </p>
                </>
              ) : (
                <div className="emptyState">
                  <AlertCircle size={22} />
                  <p>Select filters to generate a recipe layout.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
