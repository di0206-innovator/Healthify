import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

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

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

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
 * Includes exponential backoff for resilience and fallback between verified models.
 */
export async function callGemini(
  systemPrompt: string,
  userInput: string,
  timeoutMs: number = 40000
): Promise<any> {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview'
  ];
  let lastError: any;

  for (const modelName of models) {
    try {
      return await withRetry(async () => {
        const model = getGenAI().getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
          systemInstruction: systemPrompt,
          safetySettings,
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: userInput }] }],
            safetySettings,
          });

          clearTimeout(timeout);
          return parseJsonResponse(result.response.text());
        } catch (error: any) {
          clearTimeout(timeout);
          throw error;
        }
      }, 2);
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.response?.status;
      const shouldFallback = status === 429 || status === 404 || status === 503;
      
      if (shouldFallback && modelName !== models.at(-1)) {
        const nextIndex = models.indexOf(modelName) + 1;
        const nextModel = models.at(nextIndex);
        console.warn(`⚠️  Error ${status} for ${modelName}. Falling back to ${nextModel}...`);
        continue;
      }
      break;
    }
  }
  throw lastError;
}

/**
 * Call Gemini with vision capabilities for image OCR, with fallback.
 */
export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  timeoutMs: number = 60000
): Promise<string> {
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite-preview'
  ];
  let lastError: any;

  for (const modelName of models) {
    try {
      return await withRetry(async () => {
        const model = getGenAI().getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
          systemInstruction: prompt,
          safetySettings,
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const result = await model.generateContent({
            contents: [
              {
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: imageBase64 } },
                ],
              },
            ],
            safetySettings,
          });

          clearTimeout(timeout);
          return result.response.text().trim();
        } catch (error: any) {
          clearTimeout(timeout);
          throw error;
        }
      }, 1);
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.response?.status;
      const shouldFallback = status === 429 || status === 404 || status === 503;

      if (shouldFallback && modelName !== models.at(-1)) {
        const nextIndex = models.indexOf(modelName) + 1;
        const nextModel = models.at(nextIndex);
        console.warn(`⚠️  Error ${status} for ${modelName} (Vision). Falling back to ${nextModel}...`);
        continue;
      }
      break;
    }
  }
  throw lastError;
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
