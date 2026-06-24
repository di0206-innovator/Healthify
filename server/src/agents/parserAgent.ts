import { callGemini } from './ai';

const SYSTEM_PROMPT = `
### ROLE: Food Safety Input Parser
### TASK: Clean and extract individual ingredients from the raw food ingredient list text.

### RULES:
1. Remove all quantities (e.g., "10g", "2%", "50ml"), percentages, parenthetical annotations (unless critical for identification), and brand names.
2. Clean up punctuation, spaces, and formatting.
3. Return a standardized JSON array of strings representing the clean ingredient names.
4. If no ingredients can be parsed, return an empty array [].
5. Do NOT include markdown code blocks (like \`\`\`json) or any intro/outro text. Return ONLY the raw JSON array.
`;

export async function runParserAgent(rawText: string): Promise<string[]> {
  const result = await callGemini(SYSTEM_PROMPT, rawText);
  if (!Array.isArray(result)) {
    console.error('Parser agent did not return an array:', result);
    return [];
  }
  return result.map((item) => String(item).trim()).filter(Boolean);
}
