import { parseIngredients } from './agents/inputAgent';
import { analyseIngredients } from './agents/analysisAgent';
import { checkBans } from './agents/regulatoryAgent';
import { suggestSubstitutes } from './agents/substituteAgent';
import { ScanReport, AnalysedIngredient } from './types';

/**
 * Runs the full 4-agent AI pipeline:
 * Agent 1 (Parse) → Agent 2 (Analyse) → Agent 3 + 4 in parallel (Bans + Substitutes) → Report
 */
export async function runPipeline(rawText: string, country: string): Promise<ScanReport> {
  // Step 1: Parse ingredients
  const ingredients = await parseIngredients(rawText);

  if (ingredients.length === 0) {
    throw new Error('No ingredients could be parsed from the input text');
  }

  // Step 2: Analyse for safety
  const analysed = await analyseIngredients(ingredients);

  // Steps 3 & 4: Run regulatory check and substitute suggestions in parallel
  const [withBans, withSubstitutes] = await Promise.all([
    checkBans(analysed, country),
    suggestSubstitutes(analysed),
  ]);

  // Merge results: bans from Agent 3, substitutes from Agent 4
  const merged: AnalysedIngredient[] = analysed.map((item) => {
    const banData = withBans[item.ingredient] || {};
    const substitute = withSubstitutes[item.ingredient] || null;

    return {
      ingredient: item.ingredient,
      severity: item.severity,
      reason: item.reason,
      category: item.category,
      bans: Array.isArray(banData.bans) ? banData.bans : [],
      bannedInSelected: Boolean(banData.bannedInSelected),
      substitute: typeof substitute === 'string' ? substitute : null,
    };
  });

  // Compute safety score
  const totalCount = merged.length;
  const harmfulCount = merged.filter((i) => i.severity !== 'safe').length;
  const safetyScore = Math.round(100 - (harmfulCount / totalCount) * 100);

  let grade: ScanReport['grade'];
  if (safetyScore >= 80) grade = 'A';
  else if (safetyScore >= 60) grade = 'B';
  else if (safetyScore >= 40) grade = 'C';
  else if (safetyScore >= 20) grade = 'D';
  else grade = 'F';

  return {
    ingredients: merged,
    safetyScore,
    grade,
    totalCount,
    harmfulCount,
    country,
    scannedAt: new Date().toISOString(),
  };
}
