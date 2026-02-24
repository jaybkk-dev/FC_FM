// ============================================================
// FC FACILITIES MANAGEMENT — AI (OpenAI Helpers)
// Container-bound to: FC_FM_MASTER_REQUESTS
// ============================================================
// All OpenAI calls go through callAI_().
// Single API key from Config.gs.
// ============================================================


/**
 * Calls OpenAI API with a prompt and returns the text response.
 */
function callAI_(prompt) {
  const payload = {
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 1024,
  };

  const options = {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(OPENAI_URL, options);
  const code = response.getResponseCode();

  if (code !== 200) {
    Logger.log('OpenAI HTTP ' + code + ': ' + response.getContentText());
    throw new Error('OpenAI API HTTP ' + code);
  }

  const json = JSON.parse(response.getContentText());
  const text = json.choices && json.choices[0] && json.choices[0].message
    ? json.choices[0].message.content : null;
  if (!text) throw new Error('Empty OpenAI response');
  return text.trim();
}


/**
 * Detects language and translates text bidirectionally (EN ↔ TH).
 * Returns { en: "...", th: "..." }
 */
function translateText_(text) {
  if (!text || text.trim() === '') return { en: '', th: '' };

  const prompt = 'You are a translator for a restaurant facilities management system in Bangkok, Thailand.\n\n' +
    'Given this text, detect the language and provide both English and Thai translations.\n\n' +
    'Text: "' + text + '"\n\n' +
    'Respond ONLY in this exact JSON format, no markdown, no code blocks:\n' +
    '{"en": "English version here", "th": "Thai version here"}\n\n' +
    'Rules:\n' +
    '- If the text is in English, translate to Thai and keep the English as-is.\n' +
    '- If the text is in Thai, translate to English and keep the Thai as-is.\n' +
    '- If mixed, provide clean versions of both.\n' +
    '- Keep it concise and professional.\n' +
    '- For technical/maintenance terms, use standard terminology.';

  try {
    const result = callAI_(prompt);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log('Translation error: ' + e.message + ' for text: ' + text);
    return { en: text, th: text };
  }
}


/**
 * Translates a request title to English if it's in Thai.
 * Returns English title. If already ASCII, returns as-is (no API call).
 */
function translateTitle_(title) {
  if (!title || title.trim() === '') return '';
  if (/^[\x00-\x7F]*$/.test(title)) return title;
  const result = translateText_(title);
  return result.en || title;
}


/**
 * One-way English → Thai translation for the confirmation card.
 * Skips the API if text is already mostly Thai.
 */
function translateToThai_(text) {
  if (!text || text.trim() === '') return '';
  // If >30% Thai chars, it's already Thai
  if (/[\u0E00-\u0E7F]/.test(text) && text.match(/[\u0E00-\u0E7F]/g).length > text.length * 0.3) {
    return text;
  }
  try {
    const res = UrlFetchApp.fetch(OPENAI_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + OPENAI_API_KEY },
      payload: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'Translate the following maintenance issue description to Thai. Return ONLY the Thai translation, nothing else.' },
          { role: 'user', content: text }
        ]
      }),
      muteHttpExceptions: true,
    });
    const json = JSON.parse(res.getContentText());
    return (json.choices && json.choices[0]) ? json.choices[0].message.content.trim() : text;
  } catch (e) {
    Logger.log('translateToThai_ failed: ' + e.message);
    return text;
  }
}


/**
 * Auto-classifies a request into TASK_CATEGORY + PRIORITY_LEVEL.
 * Accepts optional pre-loaded categories array to avoid repeated reads.
 * Returns { category: "...", priority: "..." }
 */
function classifyRequest_(title, details, mediaLinks, categoriesCache) {
  // Use cache if provided, otherwise load from REFERENCE
  let catData;
  if (categoriesCache) {
    catData = categoriesCache;
  } else {
    const refSs = SpreadsheetApp.openById(REFERENCE_ID);
    const catSheet = refSs.getSheetByName('TASK_CATEGORIES');
    catData = catSheet.getRange(2, 1, catSheet.getLastRow() - 1, 2).getValues();
  }

  const categories = catData
    .filter(function(row) { return row[0]; })
    .map(function(row) { return '- ' + row[0] + ': ' + row[1]; });

  const hasMedia = mediaLinks && mediaLinks.trim() !== '';

  const prompt = 'You are a facilities management dispatcher for a restaurant group in Bangkok.\n\n' +
    'Given this maintenance request, classify it into ONE task category and assign a priority level.\n\n' +
    'REQUEST TITLE: ' + title + '\n' +
    'REQUEST DETAILS: ' + details + '\n' +
    'HAS PHOTOS/MEDIA: ' + (hasMedia ? 'Yes' : 'No') + '\n\n' +
    'AVAILABLE TASK CATEGORIES:\n' + categories.join('\n') + '\n\n' +
    'PRIORITY LEVELS:\n' +
    '- CRITICAL: Safety hazard, health code violation, business cannot operate\n' +
    '- URGENT: Significant impact on operations, needs attention within 24h\n' +
    '- MODERATE: Affects operations but workarounds exist, fix within 1 week\n' +
    '- LOW: Cosmetic, preventive, or non-urgent improvement\n\n' +
    'Respond ONLY in this exact JSON format, no markdown, no code blocks:\n' +
    '{"category": "EXACT CATEGORY NAME FROM LIST", "priority": "CRITICAL or URGENT or MODERATE or LOW"}\n\n' +
    'Pick the single best matching category. If unclear, use "GENERAL MAINTENANCE".';

  try {
    const result = callAI_(prompt);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const validCategories = catData.map(function(row) { return row[0]; }).filter(Boolean);
    if (validCategories.indexOf(parsed.category) === -1) {
      parsed.category = 'GENERAL MAINTENANCE';
    }

    const validPriorities = ['CRITICAL', 'URGENT', 'MODERATE', 'LOW'];
    if (validPriorities.indexOf(parsed.priority) === -1) {
      parsed.priority = 'MODERATE';
    }

    return parsed;
  } catch (e) {
    Logger.log('Classification error: ' + e.message);
    return { category: 'GENERAL MAINTENANCE', priority: 'MODERATE' };
  }
}
