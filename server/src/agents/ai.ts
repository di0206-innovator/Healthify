import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === 'your_key_here') {
  console.warn('⚠️  GEMINI_API_KEY is not set. Please set it in server/.env');
}

const genAI = new GoogleGenerativeAI(apiKey || '');

/**
 * Call Gemini with a system prompt and user input, expecting JSON back.
 * Includes retry logic for markdown-wrapped responses.
 */
export async function callGemini(
  systemPrompt: string,
  userInput: string,
  timeoutMs: number = 30000
): Promise<any> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n---\n\nInput:\n${userInput}` }],
        },
      ],
    });

    clearTimeout(timeout);
    const text = result.response.text();
    return parseJsonResponse(text);
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Agent call timed out after ' + timeoutMs + 'ms');
    }
    throw error;
  }
}

/**
 * Call Gemini with vision capabilities for image OCR.
 */
export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  timeoutMs: number = 30000
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });

    clearTimeout(timeout);
    return result.response.text().trim();
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Vision call timed out after ' + timeoutMs + 'ms');
    }
    throw error;
  }
}

/**
 * Parse JSON from Gemini response. 
 * Since we use responseMimeType: 'application/json', this is usually a direct parse.
 */
function parseJsonResponse(text: string): any {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Fallback search for JSON structure if model ignores mime type
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        throw new Error('Agent returned unparseable response');
      }
    }
    throw new Error('Agent returned unparseable response');
  }
}
