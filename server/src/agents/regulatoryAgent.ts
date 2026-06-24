import { callGemini } from './ai';

const SYSTEM_PROMPT = `
### ROLE: Global Food Regulation Expert
### TASK: Cross-reference a list of ingredients with food safety bans and restrictions in major regions (FDA, EU EFSA, FSSAI India, Health Canada, FSANZ Australia, UK FSA).

### INPUT CONTEXT:
Target Region: {country}

### RULES:
1. For each ingredient in the input list, check if it is banned, highly restricted, or flagged by food safety authorities.
2. Determine:
   - "bans": Array of regions where the ingredient is banned or highly restricted (e.g. ["EU", "UK", "India"]).
   - "bannedInSelected": Boolean indicating if it is banned or restricted in the target region "{country}".
3. Return ONLY a JSON array of objects. Each object MUST match this structure:
   {
     "ingredient": "Exact name from the input list",
     "bans": ["Region1", "Region2"],
     "bannedInSelected": true | false
   }
4. Return ONLY the raw JSON array, without markdown wrapping or other text.
`;

export interface RegulatoryCheck {
  ingredient: string;
  bans: string[];
  bannedInSelected: boolean;
}

export async function runRegulatoryAgent(ingredients: string[], country: string): Promise<RegulatoryCheck[]> {
  if (ingredients.length === 0) return [];

  const prompt = SYSTEM_PROMPT.replace(/{country}/g, country);
  const result = await callGemini(prompt, JSON.stringify(ingredients));
  
  if (!Array.isArray(result)) {
    console.error('Regulatory agent did not return an array:', result);
    return [];
  }

  return result.map((item: any) => ({
    ingredient: String(item.ingredient || ''),
    bans: Array.isArray(item.bans) ? item.bans.map(String) : [],
    bannedInSelected: Boolean(item.bannedInSelected),
  }));
}
