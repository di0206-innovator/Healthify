import { runParserAgent } from './agents/parserAgent';
import { runAnalyzerAgent } from './agents/analyzerAgent';
import { runRegulatoryAgent } from './agents/regulatoryAgent';
import { runSubstituteAgent } from './agents/substituteAgent';
import { ScanReport, AnalysedIngredient } from './types';

/**
 * Runs the modular multi-agent AI pipeline (Parser -> Analyst -> Regulatory/Substitutes).
 * Accepts an onProgress callback to report steps as they execute.
 */
export async function runPipeline(
  rawText: string,
  country: string,
  onProgress?: (step: string) => void
): Promise<ScanReport> {
  // Step 1: Parse
  onProgress?.('parsing');
  const ingredientNames = await runParserAgent(rawText);

  if (ingredientNames.length === 0) {
    throw new Error('No ingredients could be parsed from the input text');
  }

  // Step 2: Analyze
  onProgress?.('analysing');
  const analyzed = await runAnalyzerAgent(ingredientNames);

  // Step 3: Regulatory & Step 4: Substitutes (in parallel)
  onProgress?.('checking-bans');
  
  // We only get substitutes for medium or high severity ingredients
  const flaggedNames = analyzed
    .filter((i) => i.severity === 'medium' || i.severity === 'high')
    .map((i) => i.ingredient);

  const [regulatory, substitutes] = await Promise.all([
    runRegulatoryAgent(ingredientNames, country),
    (async () => {
      onProgress?.('finding-alternatives');
      return runSubstituteAgent(flaggedNames);
    })()
  ]);

  onProgress?.('generating-report');

  // Merge agent findings
  const merged: AnalysedIngredient[] = analyzed.map((item) => {
    const regCheck = regulatory.find((r) => r.ingredient.toLowerCase() === item.ingredient.toLowerCase());
    const subSuggestion = substitutes.find((s) => s.ingredient.toLowerCase() === item.ingredient.toLowerCase());

    return {
      ingredient: item.ingredient,
      severity: item.severity,
      reason: item.reason,
      category: item.category,
      bans: regCheck ? regCheck.bans : [],
      bannedInSelected: regCheck ? regCheck.bannedInSelected : false,
      substitute: subSuggestion ? subSuggestion.substitute : null,
    };
  });

  // Compute safety score
  const totalCount = merged.length;
  const harmfulCount = merged.filter((i) => i.severity !== 'safe' && i.severity !== 'low').length;

  const scoreSum = merged.reduce((acc, item) => {
    if (item.severity === 'safe') return acc + 100;
    if (item.severity === 'low') return acc + 85;
    if (item.severity === 'medium') return acc + 40;
    if (item.severity === 'high') return acc + 0;
    return acc + 50; 
  }, 0);
  
  const safetyScore = Math.round(scoreSum / totalCount);

  let grade: ScanReport['grade'];
  if (safetyScore >= 85) grade = 'A';
  else if (safetyScore >= 70) grade = 'B';
  else if (safetyScore >= 50) grade = 'C';
  else if (safetyScore >= 30) grade = 'D';
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
