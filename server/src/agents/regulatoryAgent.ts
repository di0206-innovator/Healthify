import { callGemini } from './ai';

const SYSTEM_PROMPT = `You are a food regulatory expert.
For each ingredient in the provided array, determine:
1. "bans": A list of countries where it is partially or fully banned/restricted (USA, India, EU, Canada, Australia, UK).
2. "bannedInSelected": Boolean if it is banned in {country}.

Return ONLY a JSON object where each key is the exact ingredient name from the input array.
Example: {"Sodium Nitrite": {"bans": ["EU"], "bannedInSelected": false}}`;

/**
 * Agent 3 – Checks regulatory bans for each ingredient.
 */
export async function checkBans(analysed: any[], country: string): Promise<Record<string, any>> {
  const prompt = SYSTEM_PROMPT.replace('{country}', country);
  const input = JSON.stringify(analysed.map(i => i.ingredient));
  const result = await callGemini(prompt, input);

  return result || {};
}
