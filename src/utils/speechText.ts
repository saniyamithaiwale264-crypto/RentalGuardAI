/**
 * Normalizes lease text, risk summaries, and legal abbreviations into clean,
 * natural-sounding spoken prose for crystal-clear pronunciation across
 * both Gemini neural TTS and browser Web Speech engines.
 */
export function normalizeSpeechPronunciation(raw: string): string {
  if (!raw) return '';

  let text = raw
    // Convert line breaks and list breaks into natural sentence pauses
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    // Strip markdown formatting symbols that TTS engines sometimes read literally
    .replace(/[*_`~#]/g, '')
    // Replace section/currency symbols & common lease abbreviations
    .replace(/§\s*/g, 'Section ')
    .replace(/\bSec\.\s*/gi, 'Section ')
    .replace(/\bArt\.\s*/gi, 'Article ')
    .replace(/\be\.g\.\s*/gi, 'for example, ')
    .replace(/\bi\.e\.\s*/gi, 'that is, ')
    .replace(/\betc\./gi, 'and so on')
    .replace(/\bapprox\.\s*/gi, 'approximately ')
    .replace(/\bvs\.?\s+/gi, 'versus ')
    .replace(/\bmin\.\s*/gi, 'minimum ')
    .replace(/\bmax\.\s*/gi, 'maximum ')
    .replace(/\bHVAC\b/g, 'heating and air conditioning')
    .replace(/\bROI\b/g, 'return on investment')
    // Expand slash rates cleanly
    .replace(/\/\s*(mo|month)\b/gi, ' per month')
    .replace(/\/\s*(yr|year)\b/gi, ' per year')
    .replace(/\/\s*(wk|week)\b/gi, ' per week')
    .replace(/\/\s*day\b/gi, ' per day')
    // Remove ".00" on whole currency amounts like $9,800.00 -> $9,800
    .replace(/([$€£₹¥]\s?\d[\d,]*)\.00\b/g, '$1')
    // Separate version tags like v1.0 cleanly
    .replace(/\bv(\d+\.\d+(?:\.\d+)?)\b/gi, 'version $1')
    // Turn colons and semicolons into subtle spoken pauses
    .replace(/\s*[:;]\s+/g, ', ')
    // Replace em-dashes / spaced hyphens with gentle pauses
    .replace(/\s+[—–-]\s+/g, ', ')
    // Collapse repeated punctuation or spaces
    .replace(/([.!?।。！？])\s*([.!?।。！？])+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove orphaned leading punctuation
  text = text.replace(/^[.,;:\s]+/, '').trim();
  return text;
}
