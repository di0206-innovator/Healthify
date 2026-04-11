import { callGemini } from './ai';

interface AnalysisResult {
  ingredient: string;
  severity: 'safe' | 'low' | 'medium' | 'high';
  reason: string;
  category: string;
}

const SYSTEM_PROMPT = `You are a food safety toxicologist. For each ingredient provided, assess its safety for human consumption based on scientific evidence and regulatory data.
Return ONLY a JSON array. Each object must have:
{
  "ingredient": string,
  "severity": "safe" | "low" | "medium" | "high",
  "reason": string (1-2 sentences, plain English, for a general consumer),
  "category": string (e.g. "artificial dye", "preservative", "sweetener", "emulsifier", "natural ingredient", "flour/grain", "fat/oil", "flavor enhancer", "additive")
}
Do not include markdown or any text outside the JSON array.`;

/**
 * Agent 2 – Analyses each ingredient for safety concerns.
 */
export async function analyseIngredients(ingredients: string[]): Promise<AnalysisResult[]> {
  const input = JSON.stringify(ingredients);
  const result = await callGemini(SYSTEM_PROMPT, input);

  if (!Array.isArray(result)) {
    throw new Error('Analysis agent did not return an array');
  }

  return result;
}
