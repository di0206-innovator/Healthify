import { callGemini } from './ai';
import { AnalysedIngredient } from '../types';

const SYSTEM_PROMPT = `
### ROLE: Food Safety Orchestrator & Regulatory Expert
### TASK: Analyze a list of food ingredients for health risks, regulatory status, and suggest natural substitutes.

### WORKFLOW:
1. **Parse**: Extract each individual ingredient from the raw text. Remove quantities and irrelevant formatting.
2. **Analyze**: For each ingredient, determine its safety severity ("safe", "low", "medium", "high"), the scientific reason for this assessment, and its category.
3. **Regulatory Check**: Check if the ingredient is banned in the specified country ({country}) or other major regions (EU, USA, etc.).
4. **Substitutes**: For any ingredient with "medium" or "high" severity, suggest a healthier natural substitute.

### OUTPUT FORMAT:
Return ONLY a JSON array of objects. Each object MUST match this structure:
{
  "ingredient": "Name of the ingredient",
  "severity": "safe" | "low" | "medium" | "high",
  "reason": "Scientific reason for severity (1-2 sentences)",
  "category": "e.g. artificial dye, preservative, sweetener, etc.",
  "bans": ["Region1", "Region2"],
  "bannedInSelected": true | false,
  "substitute": "Natural alternative name" | null
}

### CRITICAL INSTRUCTION:
- Return ONLY the JSON array. No markdown, no intro text.
- Be precise about "bannedInSelected" for {country}.
- If no ingredients are found, return an empty array [].
`;

/**
 * Unified Orchestrator Agent – Handles the entire analysis in one AI call.
 */
export async function runUnifiedAnalysis(rawText: string, country: string): Promise<AnalysedIngredient[]> {
  const prompt = SYSTEM_PROMPT.replace(/{country}/g, country);
  const result = await callGemini(prompt, rawText);

  if (!Array.isArray(result)) {
    console.error('Unified agent did not return an array:', result);
    return [];
  }

  return result.map((item: any) => ({
    ingredient: String(item.ingredient || ''),
    severity: (['safe', 'low', 'medium', 'high'].includes(item.severity) ? item.severity : 'safe') as any,
    reason: String(item.reason || 'No specific data found'),
    category: String(item.category || 'other'),
    bans: Array.isArray(item.bans) ? item.bans : [],
    bannedInSelected: Boolean(item.bannedInSelected),
    substitute: item.substitute ? String(item.substitute) : null,
  }));
}
