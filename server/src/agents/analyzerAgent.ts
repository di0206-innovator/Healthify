import { callGemini } from './ai';

const SYSTEM_PROMPT = `
### ROLE: Food Safety Analyst
### TASK: Analyze a list of ingredients for health risks and categories.

### RULES:
1. For each ingredient in the list, determine:
   - "severity": "safe" | "low" | "medium" | "high"
   - "reason": A brief scientific reason for this safety assessment (1-2 sentences).
   - "category": E.g., "sweetener", "preservative", "artificial color", "thickener", "stabilizer", "healthy natural", etc.
2. If the ingredient is generally recognized as safe, set severity to "safe".
3. Return ONLY a JSON array of objects. Each object MUST match this structure:
   {
     "ingredient": "Exact name from the input list",
     "severity": "safe" | "low" | "medium" | "high",
     "reason": "Scientific reason for assessment",
     "category": "Ingredient category label"
   }
4. Return ONLY the raw JSON array, without markdown wrapping or other text.
`;

export interface AnalyzedItem {
  ingredient: string;
  severity: 'safe' | 'low' | 'medium' | 'high';
  reason: string;
  category: string;
}

export async function runAnalyzerAgent(ingredients: string[]): Promise<AnalyzedItem[]> {
  if (ingredients.length === 0) return [];
  
  const result = await callGemini(SYSTEM_PROMPT, JSON.stringify(ingredients));
  if (!Array.isArray(result)) {
    console.error('Analyzer agent did not return an array:', result);
    return [];
  }

  return result.map((item: any) => ({
    ingredient: String(item.ingredient || ''),
    severity: (['safe', 'low', 'medium', 'high'].includes(item.severity) ? item.severity : 'safe') as any,
    reason: String(item.reason || 'No specific hazard data found'),
    category: String(item.category || 'other'),
  }));
}
