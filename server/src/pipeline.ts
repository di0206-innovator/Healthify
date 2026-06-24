import { runUnifiedAnalysis } from './agents/orchestratorAgent';
import { ScanReport } from './types';

/**
 * Runs the unified orchestrator AI pipeline (Parser + Analyst + Regulatory/Substitutes in 1 call).
 * Accepts an onProgress callback to report steps as they execute.
 */
export async function runPipeline(
  rawText: string,
  country: string,
  onProgress?: (step: string) => void
): Promise<ScanReport> {
  // We simulate steps to maintain compatibility with the client's progress UI state machine
  onProgress?.('parsing');
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  onProgress?.('analysing');
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  onProgress?.('checking-bans');
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  onProgress?.('finding-alternatives');
  
  // Call the single-stage unified orchestrator
  const merged = await runUnifiedAnalysis(rawText.trim(), country);
  
  onProgress?.('generating-report');

  const totalCount = merged.length;
  const harmfulCount = merged.filter((i) => i.severity !== 'safe' && i.severity !== 'low').length;

  const scoreSum = merged.reduce((acc, item) => {
    if (item.severity === 'safe') return acc + 100;
    if (item.severity === 'low') return acc + 85;
    if (item.severity === 'medium') return acc + 40;
    if (item.severity === 'high') return acc + 0;
    return acc + 50; 
  }, 0);
  
  const safetyScore = totalCount > 0 ? Math.round(scoreSum / totalCount) : 100;

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
