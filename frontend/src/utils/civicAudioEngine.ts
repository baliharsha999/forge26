/**
 * Scans text for sensitive citizen identifiers (Aadhaar, PAN, phone).
 * Masks them before outbound transmission or external model processing.
 */
export function sanitizeCitizenPII(text: string): { cleanText: string; masked: boolean } {
  if (!text) return { cleanText: '', masked: false };
  let masked = false;
  // Aadhaar UID: 12 digits (with optional spaces or hyphens)
  const aadhaarRegex = /\b[2-9]\d{3}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g;
  let cleanText = text.replace(aadhaarRegex, (m) => {
    masked = true;
    const cleanDigits = m.replace(/[\s-]/g, '');
    return 'XXXX-XXXX-' + cleanDigits.slice(-4);
  });
  // PAN Card: 5 letters, 4 digits, 1 letter
  const panRegex = /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}\b/g;
  cleanText = cleanText.replace(panRegex, (m) => {
    masked = true;
    return m.slice(0, 2) + 'XXXXX' + m.slice(-2);
  });
  // 10-digit Indian phone number starting with 6, 7, 8, or 9
  const phoneRegex = /\b[6-9]\d{9}\b/g;
  cleanText = cleanText.replace(phoneRegex, () => {
    masked = true;
    return 'XXXXXX-XXXX';
  });
  return { cleanText, masked };
}

/**
 * Nagarik AI — Sovereign Multilingual Civic Audio Engine
 * Provides authentic, native-accented Text-to-Speech for Telugu, Hindi, Tamil, and English.
 * Supports auto-detection of Indic scripts and seamless fallback to high-fidelity audio streams.
 */

export type SpokenLanguage = 'en' | 'hi' | 'te' | 'ta';

let currentAudioElement: HTMLAudioElement | null = null;
let isAudioActive = false;
let audioQueue: string[] = [];
let currentQueueIndex = 0;
let onAudioEndCallback: (() => void) | null = null;

/**
 * Automatically detects whether text is written in Telugu, Devanagari (Hindi), Tamil, or English.
 */
export function detectTextScript(text: string, fallback: SpokenLanguage = 'en'): SpokenLanguage {
  if (!text) return fallback;
  // Telugu Unicode block 0C00-0C7F
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  // Devanagari (Hindi/Sanskrit/Marathi) Unicode block 0900-097F
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  // Tamil Unicode block 0B80-0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  return fallback;
}

/**
 * Sanitizes markdown, asterisks, URLs, and table formats into natural spoken sentences.
 */
export function cleanTextForSpeech(text: string, lang?: SpokenLanguage): string {
  if (!text) return '';
  const detected = lang || detectTextScript(text);
  const currencyWord = detected === 'te' ? 'రూపాయలు' : detected === 'hi' ? 'रुपये' : detected === 'ta' ? 'ரூபாய்' : 'Rupees';

  return text
    // Replace markdown links [label](url) with just label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove standalone URLs
    .replace(/https?:\/\/\S+/g, '')
    // Remove table lines | ... |
    .replace(/\|[^\n]+\|/g, '')
    // Remove markdown formatting symbols (*, _, #, `, ~, >, -)
    .replace(/[*_#`~>]/g, ' ')
    // Replace bullet points and dashes at start of line
    .replace(/^\s*[-•]\s*/gm, '')
    // Standardize currency according to language
    .replace(/₹\s*(\d+)/g, `${currencyWord} $1`)
    // Remove multiple spaces and newlines
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits long text into natural sentence chunks (max ~140 chars) for smooth streaming playback.
 */
export function chunkSpokenText(text: string, maxLen = 140): string[] {
  const clean = cleanTextForSpeech(text);
  if (!clean) return [];

  // Split on natural sentence terminators: periods, question marks, exclamation marks, danda (।), newlines
  const sentences = clean.split(/(?<=[.?!|।])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > maxLen) {
        // Subdivide long sentences by commas or word boundaries
        const words = trimmed.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).trim().length <= maxLen) {
            sub = (sub + ' ' + w).trim();
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(c => c.length > 0);
}

/**
 * Merges two speech transcript chunks (e.g. base text and interim hypotheses,
 * or successive speech events), detecting and removing overlapping token prefixes
 * between the tail of baseText and the head of newText.
 * Resolves Chromium / Android SpeechRecognition repeating buffer discrepancies.
 */
export function mergeTranscripts(baseText: string, newText: string): string {
  const b = (baseText || '').trim();
  const n = (newText || '').trim();
  if (!b) return n;
  if (!n) return b;

  const bTokens = b.split(/\s+/).filter(Boolean);
  const nTokens = n.split(/\s+/).filter(Boolean);

  const maxOverlap = Math.min(bTokens.length, nTokens.length);
  let overlapLen = 0;

  for (let len = maxOverlap; len >= 1; len--) {
    let match = true;
    for (let k = 0; k < len; k++) {
      if (bTokens[bTokens.length - len + k].toLowerCase() !== nTokens[k].toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) {
      overlapLen = len;
      break;
    }
  }

  const remaining = nTokens.slice(overlapLen);
  if (remaining.length === 0) {
    return bTokens.join(' ');
  }
  return bTokens.concat(remaining).join(' ');
}

/**
 * Deduplicates adjacent repeated words and repeated multi-word phrases (1 to 8 words)
 * caused by streaming speech-to-text interim buffer updates or speaker cadence differences.
 * Works seamlessly across English, Telugu, and Hindi scripts.
 */
export function deduplicateConsecutiveWords(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return text.trim();

  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    const prev = result.length > 0 ? result[result.length - 1] : null;
    if (prev && curr.toLowerCase() === prev.toLowerCase()) {
      continue;
    }
    result.push(curr);

    // Bounded check for repeated multi-word phrases of length K (from 12 down to 1)
    const len = result.length;
    const maxK = Math.min(12, Math.floor(len / 2));
    for (let k = maxK; k >= 1; k--) {
      let isMatch = true;
      for (let j = 0; j < k; j++) {
        if (result[len - 2 * k + j].toLowerCase() !== result[len - k + j].toLowerCase()) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        result.splice(len - k, k);
        break;
      }
    }
  }
  return result.join(' ');
}

/**
 * Cancels and silences any current audio playback across both Web Audio and SpeechSynthesis.
 */
export function stopAllSpeech(): void {
  isAudioActive = false;
  audioQueue = [];
  currentQueueIndex = 0;

  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.src = '';
    } catch {
      // Ignore abort errors
    }
    currentAudioElement = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }

  if (onAudioEndCallback) {
    const cb = onAudioEndCallback;
    onAudioEndCallback = null;
    cb();
  }
}

// Cached voices helper to handle async getVoices in Chromium
let cachedVoices: SpeechSynthesisVoice[] = [];
function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function findBestVoice(lang: SpokenLanguage): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  if (lang === 'te') {
    return (
      voices.find(v => /te[-_]in/i.test(v.lang)) ||
      voices.find(v => /telugu/i.test(v.name)) ||
      voices.find(v => /^te\b/i.test(v.lang)) ||
      null
    );
  }
  if (lang === 'hi') {
    return (
      voices.find(v => /hi[-_]in/i.test(v.lang)) ||
      voices.find(v => /hindi|kalpana|swara|madhur/i.test(v.name)) ||
      voices.find(v => /^hi\b/i.test(v.lang)) ||
      null
    );
  }
  if (lang === 'ta') {
    return (
      voices.find(v => /ta[-_]in/i.test(v.lang)) ||
      voices.find(v => /tamil/i.test(v.name)) ||
      voices.find(v => /^ta\b/i.test(v.lang)) ||
      null
    );
  }
  return (
    voices.find(v => /en[-_]in/i.test(v.lang)) ||
    voices.find(v => /^en[-_]us/i.test(v.lang)) ||
    voices.find(v => /^en/i.test(v.lang)) ||
    null
  );
}

/**
 * Subdivides text and starts sequential streaming audio via HTML5 Audio.
 */
function fallbackToAudioStream(text: string, lang: SpokenLanguage, onEnd?: () => void) {
  const chunks = chunkSpokenText(text, 140);
  if (chunks.length > 0) {
    audioQueue = chunks;
    currentQueueIndex = 0;
    playAudioQueue(lang, onEnd);
  } else {
    isAudioActive = false;
    if (onEnd) onEnd();
  }
}

/**
 * Plays an audio queue sequentially using HTML5 Audio with referrer stripping.
 */
function playAudioQueue(langCode: string, onEnd?: () => void) {
  if (!isAudioActive || currentQueueIndex >= audioQueue.length) {
    isAudioActive = false;
    if (onEnd) onEnd();
    return;
  }

  const chunk = audioQueue[currentQueueIndex];
  currentQueueIndex++;

  const encoded = encodeURIComponent(chunk);
  const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encoded}`;

  let audio: HTMLAudioElement;
  try {
    audio = document.createElement('audio');
    // Crucial: no-referrer prevents Google Translate from blocking the stream with 404
    audio.referrerPolicy = 'no-referrer';
    audio.src = audioUrl;
  } catch {
    audio = new Audio(audioUrl);
  }
  currentAudioElement = audio;

  audio.onended = () => {
    if (isAudioActive) {
      playAudioQueue(langCode, onEnd);
    }
  };

  audio.onerror = (e) => {
    console.warn('[Nagarik Audio] Audio chunk playback error, trying next chunk:', e);
    if (isAudioActive && currentQueueIndex < audioQueue.length) {
      playAudioQueue(langCode, onEnd);
    } else {
      isAudioActive = false;
      if (onEnd) onEnd();
    }
  };

  audio.play().catch(err => {
    console.warn('[Nagarik Audio] Playback prevented or interrupted:', err);
    if (isAudioActive && currentQueueIndex < audioQueue.length) {
      playAudioQueue(langCode, onEnd);
    } else {
      isAudioActive = false;
      if (onEnd) onEnd();
    }
  });
}

/**
 * Speaks text using the best available engine:
 * - Detects script (Telugu / Hindi / Tamil / English)
 * - Prioritizes native browser SpeechSynthesis IF a matching voice is actually installed (Hindi, English, etc.)
 * - Automatically routes to authentic streamed Indic audio if no native voice is installed (e.g. Telugu on Chrome/Android)
 */
export function speakCivicText(
  text: string,
  declaredLang: SpokenLanguage = 'en',
  onEnd?: () => void
): void {
  stopAllSpeech();

  const clean = cleanTextForSpeech(text);
  if (!clean) {
    if (onEnd) onEnd();
    return;
  }

  // 1. Script auto-detection takes precedence if text is in Indic script
  const effectiveLang = detectTextScript(clean, declaredLang);
  isAudioActive = true;
  onAudioEndCallback = onEnd || null;

  const langTag = effectiveLang === 'te' ? 'te-IN' : effectiveLang === 'hi' ? 'hi-IN' : effectiveLang === 'ta' ? 'ta-IN' : 'en-IN';
  const matchingVoice = findBestVoice(effectiveLang);

  // 2. Prioritize browser SpeechSynthesis ONLY IF a verified voice is installed for that language
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && matchingVoice) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.voice = matchingVoice;
      utterance.lang = matchingVoice.lang || langTag;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        isAudioActive = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        console.warn('[Nagarik Audio] SpeechSynthesis error, falling back to stream:', e);
        fallbackToAudioStream(clean, effectiveLang, onEnd);
      };

      setTimeout(() => {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.speak(utterance);
        } catch {
          fallbackToAudioStream(clean, effectiveLang, onEnd);
        }
      }, 50);
      return;
    } catch (err) {
      console.warn('[Nagarik Audio] SpeechSynthesis exception, falling back to stream:', err);
    }
  }

  // 3. Fallback: If no native system voice installed (e.g. Telugu on Chrome/Android), stream directly!
  fallbackToAudioStream(clean, effectiveLang, onEnd);
}
