export const WYNNCRAFT_API = "https://api.wynncraft.com/v3";
export const WYNNCRAFT_CACHE = "./data/wynncraft-cache.json";

export const PROFESSIONS = [
  "armouring",
  "tailoring",
  "weaponsmithing",
  "woodworking",
  "jeweling",
  "cooking",
  "alchemism",
  "scribing"
] as const;

export type Profession = (typeof PROFESSIONS)[number];
export const MAX_INGREDIENT_POOL_SIZE = 18;

export type RangeValue = {
  minimum?: number;
  maximum?: number;
  min?: number;
  max?: number;
  raw?: number;
};

export type WynncraftRecipe = {
  internalName: string;
  type: string;
  skill: Profession | string;
  level: {
    minimum: number;
    maximum: number;
  };
  durability?: RangeValue;
  healthOrDamage?: RangeValue;
  duration?: RangeValue;
  charges?: RangeValue;
  materials: Array<{
    item: string;
    amount: number;
  }>;
  xp?: number;
};

export type IdentificationValue = {
  min?: number;
  raw?: number;
  max?: number;
};

export type NumericRange = {
  min: number;
  max: number;
};

export type WynncraftIngredient = {
  displayName: string;
  internalName: string;
  type: "ingredient" | string;
  tier?: string;
  requirements?: {
    level?: number;
    skills?: string[];
  };
  identifications?: Record<string, IdentificationValue>;
  consumableOnlyIDs?: {
    duration?: number;
    charges?: number;
  };
  ingredientPositionModifiers?: {
    left?: number;
    right?: number;
    above?: number;
    under?: number;
    touching?: number;
    notTouching?: number;
  };
  itemOnlyIDs?: {
    durabilityModifier?: number;
    strengthRequirement?: number;
    dexterityRequirement?: number;
    intelligenceRequirement?: number;
    defenceRequirement?: number;
    agilityRequirement?: number;
  };
  droppedBy?: Array<{ name: string; coords: unknown }>;
};

const consumableCraftTypes = new Set(["food", "potion", "scroll"]);

const supportsDurability = (recipe: WynncraftRecipe) => Boolean(recipe.durability);

const supportsDuration = (recipe: WynncraftRecipe) => Boolean(recipe.duration);

const supportsConsumableStats = (recipe: WynncraftRecipe) =>
  supportsDuration(recipe) || consumableCraftTypes.has(recipe.type);

type WynncraftCache = {
  generatedAt: string;
  source: string;
  recipes: WynncraftRecipe[];
  ingredients: WynncraftIngredient[];
  utilityIngredients?: WynncraftIngredient[];
};

let cachePromise: Promise<WynncraftCache | null> | null = null;

const fetchCache = () => {
  if (!cachePromise) {
    cachePromise = fetch(WYNNCRAFT_CACHE)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return cachePromise;
};

export type RecipeSearchInput = {
  profession: Profession;
  craftedType: string;
  minLevel: number;
  maxLevel: number;
};

export type WynncraftIngredientData = {
  ingredients: WynncraftIngredient[];
  utilityIngredients: WynncraftIngredient[];
};

export type SolverPreferences = {
  targetIds: string[];
  avoidIds: string[];
  maxIngredients: number;
  includeTradeoffs: boolean;
  ingredientQuery: string;
  bannedIngredients: string;
  minDurability: number;
  minDuration: number;
  minCharges: number;
  maxIngredientLevel?: number;
};

export type GridIngredient = WynncraftIngredient | null;

export type SolvedCraft = {
  recipe: WynncraftRecipe;
  grid: GridIngredient[];
  score: number;
  ids: Record<string, NumericRange>;
  positives: Array<{ id: string; value: NumericRange }>;
  penalties: Array<{ id: string; value: NumericRange }>;
  durabilityDelta: number;
  chargesDelta: number;
  durationDelta: number;
  requirements: Record<string, number>;
  effectiveness: number[];
  notes: string[];
  materialPlan?: {
    sourceRecipeInternalName: string;
    sourceLevel: {
      minimum: number;
      maximum: number;
    };
    utilityBoostPercent: number;
    upgradedByLevel: boolean;
    upgradedByTier: boolean;
    tiers: Array<{
      item: string;
      amount: number;
      tier: 1 | 2 | 3;
    }>;
  };
};

export const GRID_COORDS = [
  { row: 0, col: 0 },
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 2, col: 0 },
  { row: 2, col: 1 }
] as const;

export const FRIENDLY_ID_NAMES: Record<string, string> = {
  rawHealth: "Health",
  healthRegenRaw: "Health regen",
  healthRegen: "Health regen %",
  lifeSteal: "Life steal",
  manaRegen: "Mana regen",
  manaSteal: "Mana steal",
  spellDamage: "Spell damage %",
  rawSpellDamage: "Raw spell damage",
  elementalSpellDamage: "Elemental spell %",
  elementalDamage: "Elemental damage %",
  meleeDamage: "Melee damage %",
  rawMeleeDamage: "Raw melee damage",
  walkSpeed: "Walk speed",
  sprint: "Sprint",
  sprintRegen: "Sprint regen",
  lootBonus: "Loot bonus",
  lootQuality: "Loot quality",
  combatExperience: "Combat XP",
  gatherXpBonus: "Gather XP",
  gatherSpeed: "Gather speed",
  reflection: "Reflection",
  thorns: "Thorns",
  poison: "Poison",
  rawStrength: "Strength",
  rawDexterity: "Dexterity",
  rawIntelligence: "Intelligence",
  rawDefence: "Defence",
  rawAgility: "Agility",
  rawEarthDamage: "Earth damage",
  rawThunderDamage: "Thunder damage",
  rawWaterDamage: "Water damage",
  rawFireDamage: "Fire damage",
  rawAirDamage: "Air damage",
  earthDamage: "Earth damage %",
  thunderDamage: "Thunder damage %",
  waterDamage: "Water damage %",
  fireDamage: "Fire damage %",
  airDamage: "Air damage %",
  rawAttackSpeed: "Attack speed",
  healingEfficiency: "Healing"
};

export const tierLabel = (tier?: string) =>
  tier ? tier.replace("TIER_", "Tier ") : "Tier ?";

export const titleCase = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const idLabel = (id: string) => FRIENDLY_ID_NAMES[id] ?? titleCase(id);

export const rangeAverage = (range?: RangeValue) => {
  if (!range) return 0;
  const min = range.minimum ?? range.min ?? range.raw ?? 0;
  const max = range.maximum ?? range.max ?? range.raw ?? min;
  return (min + max) / 2;
};

const rangeMaximum = (range?: RangeValue) =>
  range?.maximum ?? range?.max ?? range?.raw ?? range?.minimum ?? range?.min ?? 0;

export const identificationRange = (value?: IdentificationValue): NumericRange => {
  if (!value) return { min: 0, max: 0 };
  const min = value.min ?? value.raw ?? value.max ?? 0;
  const max = value.max ?? value.raw ?? value.min ?? min;
  return min <= max ? { min, max } : { min: max, max: min };
};

export const scaleRange = (range: NumericRange, multiplier: number): NumericRange => {
  const min = range.min * multiplier;
  const max = range.max * multiplier;
  return min <= max ? { min, max } : { min: max, max: min };
};

export const addRanges = (left: NumericRange, right: NumericRange): NumericRange => ({
  min: left.min + right.min,
  max: left.max + right.max
});

export const rangeMidpoint = (range?: NumericRange) =>
  range ? (range.min + range.max) / 2 : 0;

const isUtilityIngredient = (ingredient: WynncraftIngredient) =>
  (ingredient.itemOnlyIDs?.durabilityModifier ?? 0) > 0 ||
  (ingredient.consumableOnlyIDs?.duration ?? 0) > 0 ||
  (ingredient.consumableOnlyIDs?.charges ?? 0) > 0;

export const gridRelations = (index: number) => {
  const source = GRID_COORDS[index];
  return GRID_COORDS.map((target, targetIndex) => {
    const dx = target.col - source.col;
    const dy = target.row - source.row;
    const adjacent = Math.abs(dx) + Math.abs(dy) === 1;

    return {
      targetIndex,
      isSelf: targetIndex === index,
      left: dy === 0 && dx === -1,
      right: dy === 0 && dx === 1,
      above: dx === 0 && dy < 0,
      under: dx === 0 && dy > 0,
      touching: adjacent,
      notTouching: !adjacent && targetIndex !== index
    };
  });
};

export const getEffectiveness = (grid: GridIngredient[]) =>
  grid.map((ingredient, index) => {
    if (!ingredient) return 0;

    const value = grid.reduce((total, sourceIngredient, sourceIndex) => {
      if (!sourceIngredient || sourceIndex === index) return total;

      const modifiers = sourceIngredient.ingredientPositionModifiers ?? {};
      const relation = gridRelations(sourceIndex).find(
        (item) => item.targetIndex === index
      );
      if (!relation) return total;

      let next = total;
      if (relation.left) next += modifiers.left ?? 0;
      if (relation.right) next += modifiers.right ?? 0;
      if (relation.above) next += modifiers.above ?? 0;
      if (relation.under) next += modifiers.under ?? 0;
      if (relation.touching) next += modifiers.touching ?? 0;
      if (relation.notTouching) next += modifiers.notTouching ?? 0;
      return next;
    }, 100);

    return Math.max(0, value);
  });

export const aggregateCraft = (grid: GridIngredient[]) => {
  const effectiveness = getEffectiveness(grid);
  const ids: Record<string, NumericRange> = {};
  const requirements: Record<string, number> = {};
  let durabilityDelta = 0;
  let chargesDelta = 0;
  let durationDelta = 0;

  grid.forEach((ingredient, index) => {
    if (!ingredient) return;
    const multiplier = effectiveness[index] / 100;

    Object.entries(ingredient.identifications ?? {}).forEach(([id, value]) => {
      const adjusted = scaleRange(identificationRange(value), multiplier);
      ids[id] = addRanges(ids[id] ?? { min: 0, max: 0 }, adjusted);
    });

    durabilityDelta +=
      (ingredient.itemOnlyIDs?.durabilityModifier ?? 0) * multiplier;
    chargesDelta += (ingredient.consumableOnlyIDs?.charges ?? 0) * multiplier;
    durationDelta += (ingredient.consumableOnlyIDs?.duration ?? 0) * multiplier;

    Object.entries(ingredient.itemOnlyIDs ?? {}).forEach(([key, value]) => {
      if (!key.endsWith("Requirement") || !value) return;
      const normalized = key.replace("Requirement", "");
      requirements[normalized] =
        (requirements[normalized] ?? 0) + value * multiplier;
    });
  });

  return {
    ids,
    requirements,
    durabilityDelta,
    chargesDelta,
    durationDelta,
    effectiveness
  };
};

const ingredientPower = (
  recipe: WynncraftRecipe,
  ingredient: WynncraftIngredient,
  targetIds: string[],
  avoidIds: string[],
  idBaselines: Record<string, number>
) => {
  const ids = ingredient.identifications ?? {};
  const positive = targetIds.reduce(
    (total, id) =>
      total +
      Math.max(0, rangeMidpoint(identificationRange(ids[id]))) /
        (idBaselines[id] || 1),
    0
  );
  const negative = avoidIds.reduce(
    (total, id) =>
      total +
      Math.abs(rangeMidpoint(identificationRange(ids[id]))) /
        (idBaselines[id] || 1),
    0
  );
  const utility =
    (supportsDurability(recipe)
      ? (ingredient.itemOnlyIDs?.durabilityModifier ?? 0) / 45000
      : 0) +
    (supportsConsumableStats(recipe)
      ? (ingredient.consumableOnlyIDs?.charges ?? 0) * 5
      : 0) +
    (supportsDuration(recipe)
      ? (ingredient.consumableOnlyIDs?.duration ?? 0) / 60
      : 0);

  return positive * 1000 - negative * 450 + utility;
};

const targetRangeScore = (ingredient: WynncraftIngredient, id: string, mode: "min" | "mean" | "max") => {
  const range = identificationRange(ingredient.identifications?.[id]);
  if (mode === "min") return range.min;
  if (mode === "max") return range.max;
  return rangeMidpoint(range);
};

const hasPositiveTargetId = (ingredient: WynncraftIngredient, targetIds: string[]) =>
  targetIds.length > 0 &&
  targetIds.some((id) => targetRangeScore(ingredient, id, "mean") > 0);

const targetIngredientScore = (
  ingredient: WynncraftIngredient,
  targetIds: string[],
  mode: "min" | "mean" | "max"
) =>
  targetIds.reduce(
    (total, id) => total + Math.max(0, targetRangeScore(ingredient, id, mode)),
    0
  );

const uniqueIngredients = (ingredients: WynncraftIngredient[]) => {
  const seen = new Set<string>();
  return ingredients.filter((ingredient) => {
    if (seen.has(ingredient.internalName)) return false;
    seen.add(ingredient.internalName);
    return true;
  });
};

const bannedIngredientTerms = (value?: string) =>
  (value ?? "")
    .split(/[\n,]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const isBannedIngredient = (ingredient: WynncraftIngredient, bannedTerms: string[]) => {
  if (!bannedTerms.length) return false;
  const displayName = ingredient.displayName.toLowerCase();
  const internalName = ingredient.internalName.toLowerCase();
  return bannedTerms.some((term) => displayName.includes(term) || internalName.includes(term));
};

const targetLeaders = (
  ingredients: WynncraftIngredient[],
  targetIds: string[]
) => {
  if (!targetIds.length) return [];

  return uniqueIngredients(
    targetIds.flatMap((id) =>
      (["min", "mean", "max"] as const)
        .map((mode) =>
          ingredients
            .filter((ingredient) => targetRangeScore(ingredient, id, mode) > 0)
            .sort(
              (a, b) =>
                targetRangeScore(b, id, mode) - targetRangeScore(a, id, mode) ||
                (a.requirements?.level ?? 1) - (b.requirements?.level ?? 1)
            )[0]
        )
        .filter(Boolean)
    )
  );
};

const modifierPower = (ingredient: WynncraftIngredient) => {
  const modifiers = ingredient.ingredientPositionModifiers ?? {};
  return Math.max(
    0,
    modifiers.left ?? 0,
    modifiers.right ?? 0,
    modifiers.above ?? 0,
    modifiers.under ?? 0,
    modifiers.touching ?? 0,
    modifiers.notTouching ?? 0
  );
};

const relationModifier = (
  ingredient: WynncraftIngredient,
  relation: ReturnType<typeof gridRelations>[number]
) => {
  const modifiers = ingredient.ingredientPositionModifiers ?? {};
  let value = 0;
  if (relation.left) value += modifiers.left ?? 0;
  if (relation.right) value += modifiers.right ?? 0;
  if (relation.above) value += modifiers.above ?? 0;
  if (relation.under) value += modifiers.under ?? 0;
  if (relation.touching) value += modifiers.touching ?? 0;
  if (relation.notTouching) value += modifiers.notTouching ?? 0;
  return value;
};

type BoosterMask = {
  boosterIndex: number;
  targetIndexes: number[];
  totalModifier: number;
};

const boosterMaskCache = new Map<string, BoosterMask[]>();

const boosterMasksForIngredient = (ingredient: WynncraftIngredient) => {
  const cached = boosterMaskCache.get(ingredient.internalName);
  if (cached) return cached;

  const masks = GRID_COORDS.map((_, boosterIndex) => {
    const boostedTargets = gridRelations(boosterIndex)
      .filter((relation) => !relation.isSelf)
      .map((relation) => ({
        index: relation.targetIndex,
        value: relationModifier(ingredient, relation)
      }))
      .filter((target) => target.value > 0);

    return {
      boosterIndex,
      targetIndexes: boostedTargets.map((target) => target.index),
      totalModifier: boostedTargets.reduce((total, target) => total + target.value, 0)
    };
  })
    .filter((mask) => mask.totalModifier > 0)
    .sort(
      (a, b) =>
        b.totalModifier - a.totalModifier ||
        b.targetIndexes.length - a.targetIndexes.length
    );

  boosterMaskCache.set(ingredient.internalName, masks);
  return masks;
};

const boosterLayoutScore = (
  grid: GridIngredient[],
  targetIds: string[],
  mode: "min" | "mean" | "max"
) => {
  const aggregate = aggregateCraft(grid);
  return targetIds.reduce((total, id) => {
    const range = aggregate.ids[id];
    if (!range) return total;
    if (mode === "min") return total + Math.max(0, range.min);
    if (mode === "max") return total + Math.max(0, range.max);
    return total + Math.max(0, rangeMidpoint(range));
  }, 0);
};

const bestBoosterLayouts = (
  booster: WynncraftIngredient,
  payload: WynncraftIngredient,
  targetIds: string[]
) => {
  const bestPureScore = boosterLayoutScore(Array(6).fill(payload), targetIds, "mean");
  const layouts = (["min", "mean", "max"] as const).flatMap((mode) => {
    const bestByCount = new Map<number, { grid: GridIngredient[]; score: number }>();

    GRID_COORDS.forEach((_, boosterIndex) => {
      const grid = Array(6).fill(payload);
      grid[boosterIndex] = booster;
      const payloadCount = grid.filter(
        (ingredient) => ingredient?.internalName === payload.internalName
      ).length;
      const score = boosterLayoutScore(grid, targetIds, mode);
      const existing = bestByCount.get(payloadCount);

      if (!existing || score > existing.score) {
        bestByCount.set(payloadCount, { grid, score });
      }
    });

    return Array.from(bestByCount.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((candidate) => candidate.grid);
  });

  return uniqueGrids(layouts)
    .filter((grid) => boosterLayoutScore(grid, targetIds, "mean") > bestPureScore)
    .slice(0, 3);
};

const strongestBoosterTotal = (ingredient: WynncraftIngredient) =>
  boosterMasksForIngredient(ingredient)[0]?.totalModifier ?? 0;

const buildIdBaselines = (
  ingredients: WynncraftIngredient[],
  ids: string[]
): Record<string, number> =>
  Object.fromEntries(
    ids.map((id) => {
      const strongestSingle = Math.max(
        1,
        ...ingredients.map((ingredient) =>
          Math.abs(rangeMidpoint(identificationRange(ingredient.identifications?.[id])))
        )
      );
      return [id, strongestSingle * 6];
    })
  );

const gridKey = (grid: GridIngredient[]) =>
  grid.map((ingredient) => ingredient?.internalName ?? "empty").join("|");

const uniqueGrids = (grids: GridIngredient[][]) => {
  const seen = new Set<string>();
  return grids.filter((grid) => {
    const key = gridKey(grid);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const uniqueByGrid = <T extends { grid: GridIngredient[] }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = gridKey(item.grid);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isSingleTargetIngredientLayout = (
  grid: GridIngredient[],
  targetIds: string[]
) => {
  const firstIngredient = grid[0];
  return Boolean(
    firstIngredient &&
      hasPositiveTargetId(firstIngredient, targetIds) &&
      grid.every((ingredient) => ingredient?.internalName === firstIngredient.internalName)
  );
};

const scoreAggregate = (
  recipe: WynncraftRecipe,
  aggregate: ReturnType<typeof aggregateCraft>,
  preferences: SolverPreferences,
  idBaselines: Record<string, number>
) => {
  const positiveScore = preferences.targetIds.reduce(
    (total, id) =>
      total +
      (Math.max(0, rangeMidpoint(aggregate.ids[id])) / (idBaselines[id] || 1)) *
        100000,
    0
  );
  const penaltyScore = preferences.avoidIds.reduce(
    (total, id) =>
      total +
      (Math.abs(rangeMidpoint(aggregate.ids[id])) / (idBaselines[id] || 1)) *
        35000,
    0
  );
  const durabilityScore = supportsDurability(recipe)
    ? aggregate.durabilityDelta / 36000
    : 0;
  const chargesScore = supportsConsumableStats(recipe) ? aggregate.chargesDelta * 6 : 0;
  const durationScore = supportsDuration(recipe) ? aggregate.durationDelta / 120 : 0;
  const tradeoffScore = preferences.includeTradeoffs
    ? durabilityScore + chargesScore + durationScore
    : Math.max(0, durabilityScore) +
      Math.max(0, chargesScore) +
      Math.max(0, durationScore);
  const levelFit = 120 - recipe.level.minimum;

  return positiveScore - penaltyScore + tradeoffScore + levelFit;
};

const durabilityScale = 1000;

const baseChargesForLevel = (level: number) => {
  if (level <= 30) return 1;
  if (level <= 70) return 2;
  return 3;
};

const utilityRequirementGap = (
  recipe: WynncraftRecipe,
  aggregate: ReturnType<typeof aggregateCraft>,
  preferences: SolverPreferences
) => {
  const durabilityGap = supportsDurability(recipe)
    ? Math.max(
        0,
        preferences.minDurability * durabilityScale -
          (rangeMaximum(recipe.durability) + aggregate.durabilityDelta)
      ) / durabilityScale
    : 0;
  const durationGap = supportsDuration(recipe)
    ? Math.max(
        0,
        preferences.minDuration -
          (rangeAverage(recipe.duration) + aggregate.durationDelta)
      ) / 30
    : 0;
  const chargesGap = supportsConsumableStats(recipe)
    ? Math.max(
        0,
        preferences.minCharges -
          (baseChargesForLevel(recipe.level.minimum) + aggregate.chargesDelta)
      ) * 2
    : 0;

  return durabilityGap + durationGap + chargesGap;
};

const utilityIngredientScore = (
  recipe: WynncraftRecipe,
  ingredient: WynncraftIngredient,
  preferences: SolverPreferences
) => {
  const durability =
    supportsDurability(recipe) && preferences.minDurability > 0
      ? Math.max(0, ingredient.itemOnlyIDs?.durabilityModifier ?? 0) / durabilityScale
      : 0;
  const duration =
    supportsDuration(recipe) && preferences.minDuration > 0
      ? Math.max(0, ingredient.consumableOnlyIDs?.duration ?? 0) / 30
      : 0;
  const charges =
    supportsConsumableStats(recipe) && preferences.minCharges > 0
      ? Math.max(0, ingredient.consumableOnlyIDs?.charges ?? 0) * 2
      : 0;

  return durability + duration + charges;
};

const compareAggregatesByTarget = (
  left: ReturnType<typeof aggregateCraft>,
  right: ReturnType<typeof aggregateCraft>,
  targetIds: string[]
) => {
  for (const id of targetIds) {
    const leftRange = left.ids[id];
    const rightRange = right.ids[id];
    const meanDelta = rangeMidpoint(rightRange) - rangeMidpoint(leftRange);
    if (Math.abs(meanDelta) > 0.0001) return meanDelta;

    const maxDelta = (rightRange?.max ?? 0) - (leftRange?.max ?? 0);
    if (Math.abs(maxDelta) > 0.0001) return maxDelta;

    const minDelta = (rightRange?.min ?? 0) - (leftRange?.min ?? 0);
    if (Math.abs(minDelta) > 0.0001) return minDelta;
  }

  return 0;
};

const candidateLayouts = (
  targetIngredients: WynncraftIngredient[],
  boosterIngredients: WynncraftIngredient[],
  utilityIngredients: WynncraftIngredient[],
  seedIngredients: WynncraftIngredient[],
  pureTargetIngredients: WynncraftIngredient[],
  recipe: WynncraftRecipe,
  preferences: SolverPreferences,
  idBaselines: Record<string, number>
) => {
  const requestedPoolSize = MAX_INGREDIENT_POOL_SIZE;
  const pool = uniqueIngredients([
    ...seedIngredients,
    ...targetIngredients
  ]).slice(0, Math.min(18, Math.max(requestedPoolSize, seedIngredients.length)));
  const strongBoosters = boosterIngredients.filter(
    (booster) => strongestBoosterTotal(booster) > 100
  ).slice(0, 8);
  const searchBoosters = boosterIngredients
    .filter((booster) => !pool.some((ingredient) => ingredient.internalName === booster.internalName))
    .slice(0, 4);
  const replacementBoosters = uniqueIngredients([...strongBoosters, ...searchBoosters]);
  const boosters = replacementBoosters.slice(0, 12);
  const searchPool = [...pool, ...boosters];
  const beamWidth = 18;
  const seen = new Set<string>();
  const layouts: GridIngredient[][] = [];
  const addLayout = (grid: GridIngredient[]) => {
    const key = gridKey(grid);
    if (!seen.has(key)) {
      seen.add(key);
      layouts.push(grid);
    }
  };

  pureTargetIngredients.forEach((ingredient) => addLayout(Array(6).fill(ingredient)));
  seedIngredients.forEach((ingredient) => addLayout(Array(6).fill(ingredient)));
  pool.slice(0, 8).forEach((ingredient) => addLayout(Array(6).fill(ingredient)));
  const strongestPureTargets = uniqueIngredients([
    ...seedIngredients,
    ...pureTargetIngredients
  ]).slice(0, 16);
  strongestPureTargets.forEach((payload) => {
    replacementBoosters.forEach((booster) => {
      bestBoosterLayouts(booster, payload, preferences.targetIds).forEach(addLayout);
    });
  });

  const topSix = pool.slice(0, 6);
  addLayout([...topSix, ...Array(Math.max(0, 6 - topSix.length)).fill(null)]);
  addLayout([...topSix].reverse().concat(Array(Math.max(0, 6 - topSix.length)).fill(null)));
  addLayout([topSix[0], topSix[2], topSix[4], topSix[1], topSix[3], topSix[5]].map(
    (ingredient) => ingredient ?? null
  ));
  addLayout([topSix[5], topSix[3], topSix[1], topSix[4], topSix[2], topSix[0]].map(
    (ingredient) => ingredient ?? null
  ));

  let beam: Array<{ grid: GridIngredient[]; score: number }> = [
    { grid: Array(6).fill(null), score: Number.NEGATIVE_INFINITY },
    ...seedIngredients.map((ingredient) => ({
      grid: Array(6).fill(ingredient),
      score: Number.NEGATIVE_INFINITY
    }))
  ];

  for (let slot = 0; slot < 6; slot += 1) {
    const nextBeam = new Map<string, { grid: GridIngredient[]; score: number }>();

    beam.forEach(({ grid }) => {
      searchPool.forEach((ingredient) => {
        if (!ingredient) return;
        const nextGrid = [...grid];
        nextGrid[slot] = ingredient;
        const aggregate = aggregateCraft(nextGrid);
        const score = scoreAggregate(recipe, aggregate, preferences, idBaselines);
        const key = gridKey(nextGrid);
        const existing = nextBeam.get(key);
        if (!existing || score > existing.score) {
          nextBeam.set(key, { grid: nextGrid, score });
        }
      });
    });

    beam = Array.from(nextBeam.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, beamWidth);
  }

  beam.forEach((candidate) => addLayout(candidate.grid));

  for (let restart = 0; restart < Math.min(4, pool.length); restart += 1) {
    let greedy: GridIngredient[] = Array(6).fill(null);
    for (let slot = 0; slot < 6; slot += 1) {
      const best = searchPool
        .map((ingredient, index) => {
          const grid = [...greedy];
          grid[slot] = ingredient;
          const aggregate = aggregateCraft(grid);
          return {
            ingredient,
            score:
              scoreAggregate(recipe, aggregate, preferences, idBaselines) -
              (index === restart ? 0 : index * 0.0001)
          };
        })
        .sort((a, b) => b.score - a.score)[0];
      greedy[slot] = best?.ingredient ?? null;
    }
    addLayout(greedy);
  }

  boosters.forEach((booster) => {
    const masks = boosterMasksForIngredient(booster).slice(0, 3);
    pool.slice(0, 10).forEach((payload) => {
      bestBoosterLayouts(booster, payload, preferences.targetIds).forEach(addLayout);
      masks.forEach((mask) => {
        const grid = Array(6).fill(payload);
        grid[mask.boosterIndex] = booster;
        addLayout(grid);
      });
    });
  });

  if (!layouts.length) {
    addLayout(Array(6).fill(null));
  }

  const scoreLayouts = () =>
    layouts
      .map((grid) => {
        const aggregate = aggregateCraft(grid);
        return {
          grid,
          aggregate,
          score: scoreAggregate(recipe, aggregate, preferences, idBaselines)
        };
      })
      .sort(
        (a, b) =>
          compareAggregatesByTarget(a.aggregate, b.aggregate, preferences.targetIds) ||
          b.score - a.score
      );

  let scoredLayouts = scoreLayouts();
  const utilityPool = uniqueIngredients(utilityIngredients)
    .filter((ingredient) => utilityIngredientScore(recipe, ingredient, preferences) > 0)
    .sort(
      (a, b) =>
        utilityIngredientScore(recipe, b, preferences) -
          utilityIngredientScore(recipe, a, preferences) ||
        targetIngredientScore(b, preferences.targetIds, "mean") -
          targetIngredientScore(a, preferences.targetIds, "mean")
    )
    .slice(0, 10);

  const pureBaseLayouts = scoredLayouts.filter((candidate) =>
    isSingleTargetIngredientLayout(candidate.grid, preferences.targetIds)
  );

  if (utilityPool.length) {
    const utilityBases = uniqueGrids([
      ...pureBaseLayouts.slice(0, 6).map((candidate) => candidate.grid),
      ...scoredLayouts.slice(0, 10).map((candidate) => candidate.grid)
    ]);

    utilityBases.forEach((baseGrid) => {
      const baseAggregate = aggregateCraft(baseGrid);
      const baseGap = utilityRequirementGap(recipe, baseAggregate, preferences);
      if (baseGap <= 0) return;

      utilityPool.forEach((utilityIngredient) => {
        const bestReplacement = GRID_COORDS.map((_, slot) => {
          if (baseGrid[slot]?.internalName === utilityIngredient.internalName) return null;
          const grid = [...baseGrid];
          grid[slot] = utilityIngredient;
          const aggregate = aggregateCraft(grid);
          return {
            grid,
            aggregate,
            utilityGap: utilityRequirementGap(recipe, aggregate, preferences),
            score: scoreAggregate(recipe, aggregate, preferences, idBaselines)
          };
        })
          .filter(
            (
              candidate
            ): candidate is {
              grid: GridIngredient[];
              aggregate: ReturnType<typeof aggregateCraft>;
              utilityGap: number;
              score: number;
            } => Boolean(candidate)
          )
          .filter((candidate) => candidate.utilityGap < baseGap - 0.0001)
          .sort(
            (a, b) =>
              a.utilityGap - b.utilityGap ||
              compareAggregatesByTarget(
                a.aggregate,
                b.aggregate,
                preferences.targetIds
              ) ||
              b.score - a.score
          )[0];

        if (bestReplacement) addLayout(bestReplacement.grid);
      });
    });

    scoredLayouts = scoreLayouts();
  }

  const pureLayouts = scoredLayouts.filter((candidate) =>
    isSingleTargetIngredientLayout(candidate.grid, preferences.targetIds)
  );

  return uniqueByGrid([...scoredLayouts, ...pureLayouts])
    .slice(0, Math.max(80, pureLayouts.length))
    .map((candidate) => candidate.grid);
};

export const solveRecipe = (
  recipe: WynncraftRecipe,
  ingredients: WynncraftIngredient[],
  preferences: SolverPreferences,
  utilityIngredients: WynncraftIngredient[] = []
): SolvedCraft[] => {
  const maxIngredientLevel = preferences.maxIngredientLevel ?? recipe.level.maximum;
  const bannedTerms = bannedIngredientTerms(preferences.bannedIngredients);
  const compatibleItems = ingredients.filter((ingredient) => {
      const level = ingredient.requirements?.level ?? 1;
      const skills = ingredient.requirements?.skills ?? [];
      const matchesSkill = skills.length === 0 || skills.includes(recipe.skill);
      const matchesQuery =
        !preferences.ingredientQuery ||
        ingredient.displayName
          .toLowerCase()
          .includes(preferences.ingredientQuery.toLowerCase());
      return (
        level <= maxIngredientLevel &&
        matchesSkill &&
        matchesQuery &&
        !isBannedIngredient(ingredient, bannedTerms)
      );
    });
  const idBaselines = buildIdBaselines(compatibleItems, [
    ...preferences.targetIds,
    ...preferences.avoidIds
  ]);
  const targetItems = preferences.targetIds.length
    ? compatibleItems.filter((ingredient) =>
        hasPositiveTargetId(ingredient, preferences.targetIds)
      )
    : compatibleItems;
  const seedIngredients = targetLeaders(targetItems, preferences.targetIds);
  const compatible = compatibleItems
    .sort(
      (a, b) =>
        Number(hasPositiveTargetId(b, preferences.targetIds)) -
          Number(hasPositiveTargetId(a, preferences.targetIds)) ||
        targetIngredientScore(b, preferences.targetIds, "mean") -
          targetIngredientScore(a, preferences.targetIds, "mean") ||
        ingredientPower(recipe, b, preferences.targetIds, preferences.avoidIds, idBaselines) -
          ingredientPower(recipe, a, preferences.targetIds, preferences.avoidIds, idBaselines) ||
        modifierPower(b) - modifierPower(a)
    )
    .slice(0, MAX_INGREDIENT_POOL_SIZE);
  const boosterPool = compatibleItems
    .filter((ingredient) => modifierPower(ingredient) > 0)
    .sort(
      (a, b) =>
        strongestBoosterTotal(b) - strongestBoosterTotal(a) ||
        modifierPower(b) - modifierPower(a)
    )
    .slice(0, 8);
  const compatibleUtilityIngredients = uniqueIngredients(
    utilityIngredients.filter((ingredient) => {
      const level = ingredient.requirements?.level ?? 1;
      const skills = ingredient.requirements?.skills ?? [];
      const matchesSkill = skills.length === 0 || skills.includes(recipe.skill);
      const matchesQuery =
        !preferences.ingredientQuery ||
        ingredient.displayName
          .toLowerCase()
          .includes(preferences.ingredientQuery.toLowerCase());
      return (
        level <= maxIngredientLevel &&
        matchesSkill &&
        matchesQuery &&
        !isBannedIngredient(ingredient, bannedTerms)
      );
    })
  );

  const layouts = candidateLayouts(
    compatible,
    boosterPool,
    compatibleUtilityIngredients,
    seedIngredients,
    targetItems,
    recipe,
    preferences,
    idBaselines
  );
  const scored = layouts.map((grid) => {
    const aggregate = aggregateCraft(grid);

    return {
      grid,
      aggregate,
      score: scoreAggregate(recipe, aggregate, preferences, idBaselines)
    };
  });

  const sorted = scored.sort(
    (a, b) =>
      compareAggregatesByTarget(a.aggregate, b.aggregate, preferences.targetIds) ||
      b.score - a.score
  );
  const protectedTargetLayouts = sorted.filter((candidate) =>
    isSingleTargetIngredientLayout(candidate.grid, preferences.targetIds)
  );
  const utilityIngredientNames = new Set(
    compatibleUtilityIngredients.map((ingredient) => ingredient.internalName)
  );
  const protectedUtilityLayouts = sorted
    .filter((candidate) =>
      candidate.grid.some(
        (ingredient) =>
          ingredient !== null && utilityIngredientNames.has(ingredient.internalName)
      )
    )
    .sort(
      (a, b) =>
        utilityRequirementGap(recipe, a.aggregate, preferences) -
          utilityRequirementGap(recipe, b.aggregate, preferences) ||
        compareAggregatesByTarget(a.aggregate, b.aggregate, preferences.targetIds) ||
        b.score - a.score
    )
    .slice(0, 8);
  const selected = uniqueByGrid([
    ...sorted.slice(0, 24),
    ...protectedTargetLayouts.slice(0, 8),
    ...protectedUtilityLayouts
  ]);

  return selected
    .map((candidate) => {
      const entries = Object.entries(candidate.aggregate.ids).sort(
        ([, a], [, b]) => Math.abs(rangeMidpoint(b)) - Math.abs(rangeMidpoint(a))
      );

      return {
        recipe,
        grid: candidate.grid,
        score: candidate.score,
        ids: candidate.aggregate.ids,
        positives: entries
          .filter(([id, value]) => rangeMidpoint(value) > 0 && preferences.targetIds.includes(id))
          .slice(0, 8)
          .map(([id, value]) => ({ id, value })),
        penalties: entries
          .filter(([id, value]) => rangeMidpoint(value) !== 0 && preferences.avoidIds.includes(id))
          .slice(0, 6)
          .map(([id, value]) => ({ id, value })),
        durabilityDelta: candidate.aggregate.durabilityDelta,
        chargesDelta: candidate.aggregate.chargesDelta,
        durationDelta: candidate.aggregate.durationDelta,
        requirements: candidate.aggregate.requirements,
        effectiveness: candidate.aggregate.effectiveness,
        notes: compatible.length
          ? []
          : ["No compatible ingredients matched the filters, showing the base recipe only."]
      };
    });
};

export const fetchRecipes = async (): Promise<WynncraftRecipe[]> => {
  const cache = await fetchCache();
  if (cache) return cache.recipes;

  const response = await fetch(
    `${WYNNCRAFT_API}/item/recipe/database?full_result`,
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) throw new Error("Unable to load Wynncraft recipes.");
  return response.json();
};

export const fetchIngredients = async (): Promise<WynncraftIngredient[]> => {
  const data = await fetchIngredientData();
  return data.ingredients;
};

export const fetchIngredientData = async (): Promise<WynncraftIngredientData> => {
  const cache = await fetchCache();
  if (cache) {
    return {
      ingredients: cache.ingredients,
      utilityIngredients: cache.utilityIngredients ?? cache.ingredients.filter(isUtilityIngredient)
    };
  }

  const response = await fetch(
    `${WYNNCRAFT_API}/item/database?fullResult`,
    { next: { revalidate: 3600 } }
  );
  if (!response.ok) throw new Error("Unable to load Wynncraft item data.");
  const items = (await response.json()) as WynncraftIngredient[];
  const ingredients = items.filter((item) => item.type === "ingredient");
  return {
    ingredients,
    utilityIngredients: ingredients.filter(isUtilityIngredient)
  };
};
