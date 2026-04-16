import { runUnifiedAnalysis } from './agents/orchestratorAgent';
import { ScanReport } from './types';

/**
 * Runs the consolidated AI pipeline (1 agent call instead of 4).
 * This optimizes performance and respects API rate limits.
 */
export async function runPipeline(rawText: string, country: string): Promise<ScanReport> {
  // Step 1: Run unified analysis (Parse + Analyze + Regulatory + Substitutes)
  const merged = await runUnifiedAnalysis(rawText, country);

  if (merged.length === 0) {
    throw new Error('No ingredients could be parsed from the input text');
  }

  // Compute safety score
  const totalCount = merged.length;
  const harmfulCount = merged.filter((i) => i.severity !== 'safe' && i.severity !== 'low').length;
  
  // Weights for score calculation: safe=100, low=90, medium=50, high=0
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
