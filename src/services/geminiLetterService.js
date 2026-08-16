// =================================================================
// HSS SHANGUS — Gemini AI Institutional Letter Drafting & Key Pool
// =================================================================

const STORAGE_KEY_GEMINI_KEYS = 'hss_gemini_api_keys';
const STORAGE_KEY_GEMINI_MODEL = 'hss_gemini_preferred_model';

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Recommended - Ultra Fast & Latest Reasoning)', tier: 'Latest Generation' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (High Speed & Precision)', tier: 'Next-Gen Fast' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Fast & Intelligent)', tier: 'Next-Gen' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ultra Fast & Modern)', tier: 'Fast & Intelligent' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Advanced Official Phrasing & Deep Reasoning)', tier: 'Complex Drafting' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Standard Fast)', tier: 'Standard' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Comprehensive)', tier: 'Standard Pro' }
];

/**
 * Get all stored Gemini API keys from localStorage.
 * @returns {Array<string>}
 */
export function getStoredGeminiKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEMINI_KEYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(k => String(k).trim()).filter(Boolean);
    }
    if (typeof parsed === 'string') {
      return [parsed.trim()].filter(Boolean);
    }
  } catch (e) {
    console.error('Error reading Gemini keys from localStorage:', e);
  }
  return [];
}

/**
 * Save array of Gemini API keys to localStorage.
 * @param {Array<string>} keys
 */
export function saveGeminiKeys(keys) {
  try {
    const cleaned = Array.from(new Set((keys || []).map(k => String(k).trim()).filter(Boolean)));
    localStorage.setItem(STORAGE_KEY_GEMINI_KEYS, JSON.stringify(cleaned));
    return cleaned;
  } catch (e) {
    console.error('Error saving Gemini keys:', e);
    return [];
  }
}

/**
 * Get preferred Gemini model.
 */
export function getPreferredGeminiModel() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GEMINI_MODEL);
    if (saved && AVAILABLE_GEMINI_MODELS.some(m => m.id === saved)) {
      return saved;
    }
    return 'gemini-3.7-flash';
  } catch {
    return 'gemini-3.7-flash';
  }
}

/**
 * Save preferred Gemini model.
 */
export function savePreferredGeminiModel(modelId) {
  try {
    localStorage.setItem(STORAGE_KEY_GEMINI_MODEL, modelId);
  } catch (e) {
    console.error(e);
  }
}

/**
 * Call Gemini API with automatic key rotation and failover.
 * If Key 1 hits quota limit (429) or is invalid (400/403), it moves to Key 2, Key 3, etc.
 * 
 * @param {object} params
 * @param {string} params.prompt - User instruction or prompt
 * @param {string} params.currentContent - Existing letter content if refining/humanizing
 * @param {string} params.mode - 'draft' | 'humanize' | 'expand' | 'shorten' | 'formalize'
 * @param {string} params.tone - 'Formal Government' | 'Urgent Circular' | 'Polite Request' | 'Legal Notice'
 * @param {string} params.model - Gemini model ID
 * @param {Array<string>} [params.customKeys] - Optional override keys
 */
export async function generateLetterWithGemini({
  prompt = '',
  currentContent = '',
  mode = 'draft',
  tone = 'Formal Government',
  model = null,
  customKeys = null
}) {
  const keys = customKeys && customKeys.length > 0 ? customKeys : getStoredGeminiKeys();

  if (!keys || keys.length === 0) {
    throw new Error('NO_API_KEY: Please add at least one Gemini API key in the AI Assistant settings.');
  }

  const selectedModel = model || getPreferredGeminiModel();

  // System instruction for clean HTML letter drafting
  const systemInstruction = `
You are an expert Executive Administrative Officer and Legal Drafter for "Government Higher Secondary School Shangus, Anantnag, Kashmir (J&K)".
Your task is to draft or refine official institutional letters, circulars, notifications, covering letters, and office orders.

Rules:
1. Return ONLY clean, valid HTML markup (wrapped in <p>, <strong>, <u>, <em>, <ol>, <ul>, <table>, <tr>, <th>, <td> tags).
2. DO NOT include <html>, <head>, <body>, markdown code fences (\`\`\`html or \`\`\`), or extra commentary.
3. Use respectful, dignified, and impeccable standard government phrasing (e.g. "In pursuance to...", "I have the honor to submit...", "It is hereby notified for the information of all concerned...", "Yours faithfully,").
4. Do NOT re-generate the school letterhead header (school name, seal logo, ref no, date) because the software already manages the top header and bottom signature blocks automatically.
5. Provide only the main body content (starting with "To," or addressee, "Subject:", "Reference:" if applicable, "Sir / Madam,", followed by paragraphs, any structured data tables, and concluding courtesies like "Yours faithfully,").
  `.trim();

  let userMessage = '';

  if (mode === 'humanize') {
    userMessage = `
Please humanize, polish, and elevate the following existing draft for an official letter from Govt. Higher Secondary School Shangus.
Tone: ${tone}.
Ensure seamless flow, impeccable grammar, respectful tone, and clear paragraph structuring.

Existing Draft:
${currentContent}

Additional user notes: ${prompt || 'Make it sound natural, authoritative yet courteous.'}
    `.trim();
  } else if (mode === 'formalize') {
    userMessage = `
Format and elevate the following text into standard official government letter style with proper Addressee, Subject line, Reference line (if applicable), numbered paragraphs, and concluding courtesies:

Draft text:
${currentContent || prompt}
    `.trim();
  } else if (mode === 'shorten') {
    userMessage = `
Condense and make the following official letter body more concise, direct, and crisp while retaining all essential facts and respectful institutional tone:

Current content:
${currentContent}
    `.trim();
  } else if (mode === 'expand') {
    userMessage = `
Elaborate and provide comprehensive administrative depth, clear guidelines, and necessary clauses to the following letter body:

Current content:
${currentContent}

User instruction: ${prompt}
    `.trim();
  } else {
    // Default 'draft' mode
    userMessage = `
Draft an official letter body for Govt. Higher Secondary School Shangus based on the following instructions:

Prompt/Intent: ${prompt}
Tone: ${tone}

Structure:
- Addressee ("To, ...")
- Subject Line ("Subject: <u>...</u>")
- Salutation ("Respected Sir / Madam," or "Sir / Madam,")
- Main Letter Body (Clear, well-phrased paragraphs or numbered points)
- If items or fees or dates are mentioned, organize them in a clean <table> with <th> and <td> borders.
- Concluding courtesy ("Yours faithfully,").
    `.trim();
  }

  // Multi-key failover loop
  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(key)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }]
            }
          ],
          generationConfig: {
            temperature: mode === 'humanize' ? 0.6 : 0.4,
            maxOutputTokens: 2500
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;

        // Check if rate limit, quota exceeded, or key issue
        const isQuotaOrKeyIssue =
          response.status === 429 ||
          response.status === 403 ||
          response.status === 400 ||
          errMsg.toLowerCase().includes('quota') ||
          errMsg.toLowerCase().includes('exhausted') ||
          errMsg.toLowerCase().includes('api_key_invalid');

        if (isQuotaOrKeyIssue && i < keys.length - 1) {
          console.warn(`Gemini API Key #${i + 1} quota/error (${errMsg}). Automatically switching to Key #${i + 2}...`);
          lastError = new Error(`Key #${i + 1} error: ${errMsg}`);
          continue; // Try next key!
        }

        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!rawText.trim()) {
        throw new Error('Gemini API returned an empty response. Please try again with more details in your prompt.');
      }

      // Clean markdown code blocks if the model accidentally included ```html
      let cleanHtml = rawText
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();

      return {
        html: cleanHtml,
        usedKeyIndex: i,
        model: selectedModel
      };

    } catch (err) {
      lastError = err;
      if (i < keys.length - 1) {
        console.warn(`Failed with Key #${i + 1} (${err.message}). Trying Key #${i + 2}...`);
        continue;
      }
    }
  }

  throw lastError || new Error('All provided Gemini API keys failed or exhausted their quota.');
}
