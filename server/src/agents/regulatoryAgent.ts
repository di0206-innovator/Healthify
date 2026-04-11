import { callGemini } from './ai';

const SYSTEM_PROMPT = `You are a food regulatory expert with knowledge of FDA (USA), FSSAI (India), EFSA (EU), Health Canada, FSANZ (Australia), and FSA (UK) regulations.
For each ingredient in the provided array, add a "bans" field listing countries where the ingredient is partially or fully banned or restricted. Use these country codes: "USA", "India", "EU", "Canada", "Australia", "UK".
Also add a "bannedInSelected" boolean — true if it is banned or restricted in: {country}.
Return ONLY the updated JSON array. No markdown, no explanation outside the JSON.`;

/**
 * Agent 3 – Checks regulatory bans for each ingredient.
 */
export async function checkBans(analysed: any[], country: string): Promise<any[]> {
  const prompt = SYSTEM_PROMPT.replace('{country}', country);
  const input = JSON.stringify(analysed);
  const result = await callGemini(prompt, input);

  if (!Array.isArray(result)) {
    throw new Error('Regulatory agent did not return an array');
  }

  // Ensure bans field exists and is an array
  return result.map((item: any) => ({
    ...item,
    bans: Array.isArray(item.bans) ? item.bans : [],
    bannedInSelected: Boolean(item.bannedInSelected),
  }));
}
