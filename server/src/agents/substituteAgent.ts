import { callGemini } from './ai';

const SYSTEM_PROMPT = `You are a nutritionist and clean-label food formulation expert.
For each ingredient that has severity of "low", "medium", or "high", add a "substitute" field with a practical, healthier alternative a food manufacturer or home cook could use.
Keep each suggestion to one sentence.
For ingredients with severity "safe", set substitute to null.
Return ONLY the updated JSON array. No markdown.`;

/**
 * Agent 4 – Suggests healthier substitutes for flagged ingredients.
 */
export async function suggestSubstitutes(analysed: any[]): Promise<any[]> {
  const input = JSON.stringify(analysed);
  const result = await callGemini(SYSTEM_PROMPT, input);

  if (!Array.isArray(result)) {
    throw new Error('Substitute agent did not return an array');
  }

  return result.map((item: any) => ({
    ...item,
    substitute: item.substitute || null,
  }));
}
