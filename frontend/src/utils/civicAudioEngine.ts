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
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
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
    // Standardize currency
    .replace(/₹\s*(\d+)/g, 'రూపాయలు $1')
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

/**
 * Plays an audio queue sequentially using HTML5 Audio.
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

  const audio = new Audio(audioUrl);
  currentAudioElement = audio;

  audio.onended = () => {
    if (isAudioActive) {
      playAudioQueue(langCode, onEnd);
    }
  };

  audio.onerror = (e) => {
    console.warn('[Nagarik Audio] Audio chunk playback error, trying next chunk:', e);
    if (isAudioActive) {
      playAudioQueue(langCode, onEnd);
    }
  };

  audio.play().catch(err => {
    console.warn('[Nagarik Audio] Playback prevented or interrupted:', err);
    isAudioActive = false;
    if (onEnd) onEnd();
  });
}

/**
 * Speaks text using the best available engine:
 * - Detects script (Telugu / Hindi / Tamil / English)
 * - If native browser voice exists for Telugu/Hindi, uses SpeechSynthesis
 * - Otherwise uses crystal-clear streamed Indic audio for authentic pronunciation
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

  // 1. Script auto-detection takes precedence
  const effectiveLang = detectTextScript(clean, declaredLang);
  isAudioActive = true;
  onAudioEndCallback = onEnd || null;

  // 2. Check if window.speechSynthesis has an explicit native voice for this language
  let hasNativeVoice = false;
  let matchingVoice: SpeechSynthesisVoice | null = null;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const voices = window.speechSynthesis.getVoices();
    if (effectiveLang === 'te') {
      matchingVoice = voices.find(v => v.lang.toLowerCase() === 'te-in' || v.lang.toLowerCase().startsWith('te')) ||
                      voices.find(v => v.name.toLowerCase().includes('telugu')) || null;
    } else if (effectiveLang === 'hi') {
      matchingVoice = voices.find(v => v.lang.toLowerCase() === 'hi-in' || v.lang.toLowerCase().startsWith('hi')) ||
                      voices.find(v => v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('kalpana')) || null;
    } else if (effectiveLang === 'ta') {
      matchingVoice = voices.find(v => v.lang.toLowerCase() === 'ta-in' || v.lang.toLowerCase().startsWith('ta')) ||
                      voices.find(v => v.name.toLowerCase().includes('tamil')) || null;
    } else {
      matchingVoice = voices.find(v => v.lang.toLowerCase() === 'en-in') ||
                      voices.find(v => v.lang.toLowerCase().startsWith('en')) || null;
      hasNativeVoice = true; // English is almost always supported natively
    }

    if (matchingVoice && effectiveLang !== 'te') {
      // For Hindi, if high-quality native voice exists, we can use it
      hasNativeVoice = true;
    }
  }

  // 3. For Telugu and Hindi on devices without native Indic TTS voices, use high-fidelity audio stream
  if ((effectiveLang === 'te' || effectiveLang === 'hi' || effectiveLang === 'ta') && (!hasNativeVoice || !matchingVoice)) {
    const chunks = chunkSpokenText(clean, 150);
    if (chunks.length === 0) {
      isAudioActive = false;
      if (onEnd) onEnd();
      return;
    }
    audioQueue = chunks;
    currentQueueIndex = 0;
    playAudioQueue(effectiveLang, onEnd);
    return;
  }

  // 4. Otherwise use SpeechSynthesisUtterance
  try {
    const utterance = new SpeechSynthesisUtterance(clean);
    const langCode = effectiveLang === 'te' ? 'te-IN' : effectiveLang === 'hi' ? 'hi-IN' : effectiveLang === 'ta' ? 'ta-IN' : 'en-IN';
    utterance.lang = langCode;
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      isAudioActive = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn('[Nagarik Audio] SpeechSynthesis error, falling back to audio stream:', e);
      // Fallback to audio stream if browser SpeechSynthesis fails
      const chunks = chunkSpokenText(clean, 150);
      if (chunks.length > 0) {
        audioQueue = chunks;
        currentQueueIndex = 0;
        playAudioQueue(effectiveLang, onEnd);
      } else {
        isAudioActive = false;
        if (onEnd) onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[Nagarik Audio] SpeechSynthesis throw, fallback:', err);
    const chunks = chunkSpokenText(clean, 150);
    if (chunks.length > 0) {
      audioQueue = chunks;
      currentQueueIndex = 0;
      playAudioQueue(effectiveLang, onEnd);
    } else {
      isAudioActive = false;
      if (onEnd) onEnd();
    }
  }
}
