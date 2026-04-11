import { callGemini } from './ai';

const SYSTEM_PROMPT = `You are an ingredient parser. Extract a clean list of food ingredients from the provided text. Remove quantities, percentages, and formatting. Return ONLY a JSON array of ingredient name strings. No explanation, no markdown.

Example output: ["Water", "Sugar", "Salt"]`;

/**
 * Agent 1 – Parses raw ingredient text into a clean array of ingredient names.
 */
export async function parseIngredients(rawText: string): Promise<string[]> {
  const result = await callGemini(SYSTEM_PROMPT, rawText);

  if (!Array.isArray(result)) {
    throw new Error('Input agent did not return an array');
  }

  return result.map((item: any) => String(item).trim()).filter((s: string) => s.length > 0);
}
