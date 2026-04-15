import { callGemini } from './ai';

const SYSTEM_PROMPT = `You are a nutritionist.
For each ingredient that is not "safe", suggest a healthier alternative.
Return ONLY a JSON object where each key is the exact ingredient name, and the value is the alternative string or null.
Example: {"Sugar": "Stevia", "Water": null}`;

/**
 * Agent 4 – Suggests healthier substitutes for flagged ingredients.
 */
export async function suggestSubstitutes(analysed: any[]): Promise<Record<string, string | null>> {
  const input = JSON.stringify(analysed.map(i => i.ingredient));
  const result = await callGemini(SYSTEM_PROMPT, input);

  return result || {};
}
