/**
 * Phonetic Hinglish normalizer.
 *
 * Real-world TTS engines mispronounce Hinglish (Hindi-words-spelled-in-English).
 * This service normalizes:
 *   1. Common Devanagari words → Latin phonetic spellings
 *   2. Hinglish slang → cleaner phonetic forms
 *   3. Strips/replaces characters TTS engines stumble on
 *
 * Idempotent: calling it twice on the same string yields the same result.
 */

const PHONETIC_MAP: Array<[RegExp, string]> = [
  // Devanagari script → phonetic latin (most-common chars only).
  [/अ/g, "a"], [/आ/g, "aa"], [/इ/g, "i"], [/ई/g, "ee"], [/उ/g, "u"], [/ऊ/g, "oo"],
  [/ऋ/g, "ri"], [/ए/g, "e"], [/ऐ/g, "ai"], [/ओ/g, "o"], [/औ/g, "au"],
  [/क/g, "ka"], [/ख/g, "kha"], [/ग/g, "ga"], [/घ/g, "gha"], [/ङ/g, "nga"],
  [/च/g, "cha"], [/छ/g, "chha"], [/ज/g, "ja"], [/झ/g, "jha"], [/ञ/g, "nya"],
  [/ट/g, "ta"], [/ठ/g, "tha"], [/ड/g, "da"], [/ढ/g, "dha"], [/ण/g, "na"],
  [/त/g, "ta"], [/थ/g, "tha"], [/द/g, "da"], [/ध/g, "dha"], [/न/g, "na"],
  [/प/g, "pa"], [/फ/g, "pha"], [/ब/g, "ba"], [/भ/g, "bha"], [/म/g, "ma"],
  [/य/g, "ya"], [/र/g, "ra"], [/ल/g, "la"], [/व/g, "va"], [/श/g, "sha"],
  [/ष/g, "sha"], [/स/g, "sa"], [/ह/g, "ha"],
  [/ा/g, "a"], [/ि/g, "i"], [/ी/g, "ee"], [/ु/g, "u"], [/ू/g, "oo"],
  [/े/g, "e"], [/ै/g, "ai"], [/ो/g, "o"], [/ौ/g, "au"], [/ं/g, "n"], [/ः/g, "h"],
  [/्/g, ""],
];

const HINGLISH_WORD_FIXES: Array<[RegExp, string]> = [
  // Hinglish → cleaner phonetic spellings the TTS engine renders well.
  [/\bkya\b/gi, "kyaa"],
  [/\bkyu\b/gi, "kyon"],
  [/\bkyun\b/gi, "kyon"],
  [/\bbhi\b/gi, "bhee"],
  [/\bhai\b/gi, "hai"],
  [/\bhain\b/gi, "hain"],
  [/\btum\b/gi, "tum"],
  [/\bmera\b/gi, "meraa"],
  [/\bmere\b/gi, "mere"],
  [/\bmeri\b/gi, "meree"],
  [/\bdosti\b/gi, "dostee"],
  [/\bdost\b/gi, "dost"],
  [/\bsapna\b/gi, "sapnaa"],
  [/\bsapne\b/gi, "sapne"],
  [/\bzindagi\b/gi, "zindagee"],
  [/\bdard\b/gi, "dard"],
  [/\bpyaar\b/gi, "pyaar"],
  [/\bpyar\b/gi, "pyaar"],
  [/\bishq\b/gi, "ishq"],
  [/\bjaan\b/gi, "jaan"],
  [/\bdil\b/gi, "dil"],
  [/\bbhul\b/gi, "bhool"],
  [/\bya\b/gi, "yaa"],
  [/\bnahi\b/gi, "naheen"],
  [/\bnahin\b/gi, "naheen"],
];

const TTS_TROUBLE: Array<[RegExp, string]> = [
  [/–|—/g, ", "],   // long dashes confuse some engines
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/\.{2,}/g, "..."],
  [/\s+/g, " "],
];

export function normalizeForTts(input: string): string {
  if (!input) return "";
  let s = input;
  for (const [re, rep] of PHONETIC_MAP) s = s.replace(re, rep);
  for (const [re, rep] of HINGLISH_WORD_FIXES) s = s.replace(re, rep);
  for (const [re, rep] of TTS_TROUBLE) s = s.replace(re, rep);
  return s.trim();
}

/**
 * Detect if a piece of text is likely Hinglish (Roman-script Hindi),
 * Devanagari, or pure English. Used to pick a TTS voice.
 */
export function detectVoiceLanguage(input: string): "hi" | "hi-en" | "en" {
  if (!input) return "en";
  if (/[\u0900-\u097F]/.test(input)) return "hi";
  const hinglishMarkers = /\b(hai|kyaa|nahi|nahin|tum|mera|meri|mere|dil|jaan|pyaar|pyar|ishq|dosti|dost|zindagi|sapna)\b/i;
  if (hinglishMarkers.test(input)) return "hi-en";
  return "en";
}
