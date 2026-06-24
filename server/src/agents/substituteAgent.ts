import { callGemini } from './ai';

const SYSTEM_PROMPT = `
### ROLE: Natural Culinary Substitute Expert
### TASK: Suggest natural, healthier, and practical alternatives for chemical or harmful ingredients.

### RULES:
1. For each ingredient in the input list, suggest a single, natural, and widely available alternative (e.g. for "High Fructose Corn Syrup" suggest "Raw Honey or Maple Syrup").
2. The substitute description should be brief (a name or 2-4 word description).
3. If no clear natural alternative exists, return null for "substitute".
4. Return ONLY a JSON array of objects. Each object MUST match this structure:
   {
     "ingredient": "Exact name from the input list",
     "substitute": "Natural alternative name" | null
   }
5. Return ONLY the raw JSON array, without markdown wrapping or other text.
`;

export interface SubstituteSuggestion {
  ingredient: string;
  substitute: string | null;
}

export async function runSubstituteAgent(flaggedIngredients: string[]): Promise<SubstituteSuggestion[]> {
  if (flaggedIngredients.length === 0) return [];

  const result = await callGemini(SYSTEM_PROMPT, JSON.stringify(flaggedIngredients));
  
  if (!Array.isArray(result)) {
    console.error('Substitute agent did not return an array:', result);
    return [];
  }

  return result.map((item: any) => ({
    ingredient: String(item.ingredient || ''),
    substitute: item.substitute ? String(item.substitute).trim() : null,
  }));
}
