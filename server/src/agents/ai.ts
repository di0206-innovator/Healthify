import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (genAIInstance) return genAIInstance;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('❌ GEMINI_API_KEY is missing. Please check server/.env');
  }
  
  console.log('✅ AI Client Initialized with API Key starting with:', apiKey.substring(0, 8));
  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

/**
 * Helper for exponential backoff retries on transient errors (429, 500, 503)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.response?.status;
      // Retry on Rate limit (429) or Server errors (5xx)
      const isRetryable = status === 429 || (status >= 500 && status <= 599) || error.message?.includes('fetch failed');
      
      if (i < retries && isRetryable) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`⚠️  Agent call failed (Status: ${status}). Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

/**
 * Call Gemini with a system prompt and user input, expecting JSON back.
 * Includes exponential backoff for resilience.
 */
export async function callGemini(
  systemPrompt: string,
  userInput: string,
  timeoutMs: number = 30000
): Promise<any> {
  return withRetry(async () => {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash',
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
  });
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
  return withRetry(async () => {
    const model = getGenAI().getGenerativeModel({
      model: 'gemini-2.0-flash',
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
  });
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
