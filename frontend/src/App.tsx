import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Copy, Check,
  ExternalLink, Plus, MessageSquare, Trash2, Search, Menu, X,
  ShieldCheck, ArrowRight,
  Globe, Sparkles, Monitor, Download,
  Settings, ChevronsLeft, ChevronsRight, Phone,
  FileText, Bookmark
} from 'lucide-react';
import { LOGO_EMBLEM_BASE64 } from './assets/logo_base64';
import { AISaathiExtensionModal } from './components/AISaathiExtensionModal';
import { CivicSettingsModal, type SettingsLanguage } from './components/CivicSettingsModal';
import { CivicHelplineModal } from './components/CivicHelplineModal';
import { speakCivicText, stopAllSpeech, deduplicateConsecutiveWords, mergeTranscripts, sanitizeCitizenPII } from './utils/civicAudioEngine';

// Civic Language Support
export type CivicLanguage = 'en' | 'hi' | 'te' | 'ta';

interface SchemeCitation {
  id: string;
  name: string;
  department: string;
  level: string;
  state: string;
  benefit: string;
  eligibility_summary: string;
  official_url: string;
  source_text: string;
  last_verified_date: string;
  confidence_score: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  language?: CivicLanguage;
  citations?: SchemeCitation[];
  retrievalBadge?: string;
  suggestedFollowups?: string[];
}

interface ChatThread {
  id: string;
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  language: CivicLanguage;
}

// Ultra-reliable Triple-Layer Logo Emblem Component
export const NagarikEmblem: React.FC<{ className?: string; size?: number }> = ({ className = "w-7 h-7", size = 28 }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  if (retryFailed) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#0c0e11" stroke="#f2ca50" strokeWidth="3" />
        <circle cx="50" cy="50" r="28" fill="#16191f" stroke="#ffb692" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="50" cy="50" r="8" fill="#f2ca50" />
        <path d="M50 12 L50 88 M12 50 L88 50 M23 23 L77 77 M23 77 L77 23" stroke="#f2ca50" strokeWidth="1.5" strokeOpacity="0.8" />
      </svg>
    );
  }

  const src = !imgFailed ? LOGO_EMBLEM_BASE64 : './logo_emblem.png';

  return (
    <img
      src={src}
      alt="Nagarik AI Emblem"
      className={`${className} object-cover rounded-xl`}
      onError={() => {
        if (!imgFailed) setImgFailed(true);
        else setRetryFailed(true);
      }}
    />
  );
};

export function App() {
  // State: Language & Threads
  const [selectedLanguage, setSelectedLanguage] = useState<CivicLanguage>('en');
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem('nagarik_civic_threads');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    const initialId = 'thread_' + Date.now();
    const initialSession = 'sess_' + Math.random().toString(36).substring(2, 10);
    return [{
      id: initialId,
      sessionId: initialSession,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      language: 'en'
    }];
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('nagarik_civic_threads');
      if (saved) {
        const parsed: ChatThread[] = JSON.parse(saved);
        if (parsed.length > 0) return parsed[0].id;
      }
    } catch {
      // ignore
    }
    return threads[0]?.id || 'thread_default';
  });

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const item = localStorage.getItem('nagarik_sidebar_collapsed');
    return item === null ? true : item === 'true';
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('nagarik_sidebar_collapsed', next ? 'true' : 'false');
      return next;
    });
  };

  const [threadSearch, setThreadSearch] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Modals
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [incognito, setIncognito] = useState<boolean>(() => {
    return sessionStorage.getItem('nagarik_incognito') === 'true';
  });

  const handleToggleIncognito = (enabled: boolean) => {
    setIncognito(enabled);
    sessionStorage.setItem('nagarik_incognito', enabled ? 'true' : 'false');
  };

  const handleClearAllHistory = () => {
    localStorage.removeItem('nagarik_civic_threads');
    const initialId = 'thread_' + Date.now();
    const initialSession = 'sess_' + Math.random().toString(36).substring(2, 10);
    const resetThread: ChatThread = {
      id: initialId,
      sessionId: initialSession,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      language: selectedLanguage
    };
    setThreads([resetThread]);
    setActiveThreadId(initialId);
  };

  // Refs
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Active thread
  const currentThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const messages = currentThread?.messages || [];

  // Persist threads
  useEffect(() => {
    if (incognito) return;
    try {
      localStorage.setItem('nagarik_civic_threads', JSON.stringify(threads));
    } catch {
      // ignore
    }
  }, [threads, incognito]);

  // Rock-Solid, Zero-Jitter Scroll: ONLY scrolls the chat container, NEVER scrolls the page
  const scrollToBottomIfNear = (force: boolean = false) => {
    if (!messagesContainerRef.current) return;
    const el = messagesContainerRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (force || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottomIfNear();
  }, [messages, generationStep]);

  // Keyboard shortcut Alt+N for new chat, Alt+S for sidebar toggle, Alt+E for Extension
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNewThread();
      } else if (e.altKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 't')) {
        e.preventDefault();
        toggleSidebarCollapsed();
      } else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowExtensionModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [threads]);

  // Speak Text Function with Robust Multilingual Regional Voice Matching (Telugu, Hindi, English)
  const speakText = (text: string, onEnd?: () => void, targetLang?: CivicLanguage) => {
    speakCivicText(text, targetLang || selectedLanguage, () => {
      setSpeakingId(null);
      if (onEnd) onEnd();
    });
  };

  // Create New Thread
  const handleCreateNewThread = () => {
    const newId = 'thread_' + Date.now();
    const newSession = 'sess_' + Math.random().toString(36).substring(2, 10);
    const newThread: ChatThread = {
      id: newId,
      sessionId: newSession,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      language: selectedLanguage
    };
    setThreads([newThread, ...threads]);
    setActiveThreadId(newId);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Delete Thread
  const handleDeleteThread = (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    const filtered = threads.filter(t => t.id !== threadId);
    if (filtered.length === 0) {
      handleCreateNewThread();
    } else {
      setThreads(filtered);
      if (activeThreadId === threadId) {
        setActiveThreadId(filtered[0].id);
      }
    }
  };

  // Input Bar Voice Typing (Speech Recognition)
  const toggleListening = () => {
    // Avoid speaker-to-mic feedback loop
    stopAllSpeech();

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice typing is not supported in this browser. Please try Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : selectedLanguage === 'ta' ? 'ta-IN' : 'en-IN';

      rec.onstart = () => setIsListening(true);
      rec.onresult = (event: any) => {
        let assembled = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const chunk = (item[0]?.transcript || '').trim();
          if (!chunk) continue;
          assembled = mergeTranscripts(assembled, chunk);
        }
        const cleaned = deduplicateConsecutiveWords(assembled);
        const finalTxt = cleaned || assembled;
        if (finalTxt) {
          setInputQuery(finalTxt);
        }
      };
      rec.onerror = (e: any) => {
        console.warn('[Nagarik Voice] Recognition error:', e?.error);
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setIsListening(false);
          recognitionRef.current = null;
        }
      };
      rec.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('[Nagarik Voice] Failed to start:', err);
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  // Audio Playback Toggle for Individual Message with Full Multilingual Regional Support
  const handleToggleSpeak = (msgId: string, text: string, lang?: CivicLanguage) => {
    if (speakingId === msgId) {
      stopAllSpeech();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(msgId);
    speakCivicText(text, lang || selectedLanguage, () => {
      setSpeakingId(null);
    });
  };

  // Copy Message to Clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send Chat Message
  const handleSendChat = async (
    overrideQuery?: string,
    isVoiceAgentQuery: boolean = false,
    overrideLang?: CivicLanguage
  ) => {
    const query = (overrideQuery || inputQuery).trim();
    if (!query || isGenerating) return;

    const currentThread = threads.find(t => t.id === activeThreadId);
    if (!currentThread) return;

    const activeLang = overrideLang || selectedLanguage;

    setInputQuery('');
    const userMsgId = 'user_' + Date.now();
    const botMsgId = 'bot_' + Date.now();

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: activeLang
    };

    const initialBotMessage: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: activeLang,
      citations: []
    };

    const newTitle = currentThread.messages.length === 0 ? query.slice(0, 32) : currentThread.title;
    const updatedMessages = [...currentThread.messages, userMessage, initialBotMessage];

    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        return {
          ...t,
          title: newTitle,
          updatedAt: new Date().toISOString(),
          messages: updatedMessages
        };
      }
      return t;
    }));

    setIsGenerating(true);
    setGenerationStep('Retrieving gazetted government welfare schemes...');

    // Immediate scroll on submission
    setTimeout(() => scrollToBottomIfNear(true), 50);

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    let streamSucceeded = false;
    let fullBotText = '';

    // Client-side PII protection: mask citizen identity before network transmission
    const { cleanText: sanitizedQuery } = sanitizeCitizenPII(query);

    const payload = {
      query: sanitizedQuery,
      language: activeLang,
      session_id: currentThread.sessionId,
      thread_id: currentThread.id,
      history: currentThread.messages.slice(-6).map(m => ({
        role: m.role,
        content: sanitizeCitizenPII(m.content).cleanText
      })),
      is_incognito: incognito,
      incognito: incognito
    };

    const appendChunk = (chunk: string, citations?: SchemeCitation[], followups?: string[]) => {
      fullBotText += chunk;
      setThreads(prevThreads => prevThreads.map(t => {
        if (t.id === activeThreadId) {
          const msgs = t.messages.map(m => {
            if (m.id === botMsgId) {
              return {
                ...m,
                content: m.content + chunk,
                citations: citations || m.citations,
                suggestedFollowups: followups || m.suggestedFollowups
              };
            }
            return m;
          });
          return { ...t, messages: msgs };
        }
        return t;
      }));
      // Rock-solid inner container scroll
      scrollToBottomIfNear();
    };

    // 1. Attempt Streaming
    try {
      const streamUrl = isLocalhost
        ? 'http://localhost:8000/api/v1/chat/stream'
        : 'https://ocplgpmsfwibjzjvxynv.supabase.co/functions/v1/chat?stream=true';

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcGxncG1zZndpYmp6anZ4eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MDQyMDQsImV4cCI6MjEwOTA4MDIwNH0.ve2ATBpUVCOBYZ5FtexNu897vLLe3oGJgOYeccLv_zY'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;

            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (dataStr === '[DONE]') {
                streamSucceeded = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const textChunk = parsed.text ?? parsed.content ?? (parsed.type === 'chunk' || parsed.type === 'token' ? (parsed.chunk || parsed.token) : undefined);

                if (parsed.type === 'step') {
                  setGenerationStep(parsed.title || 'Verifying official criteria...');
                } else if (textChunk !== undefined) {
                  appendChunk(String(textChunk), parsed.citations, parsed.suggested_followups);
                  streamSucceeded = true;
                } else if (parsed.type === 'citations' && parsed.citations) {
                  appendChunk('', parsed.citations, parsed.suggested_followups);
                } else if (parsed.type === 'done') {
                  if (parsed.suggested_followups) {
                    appendChunk('', parsed.citations, parsed.suggested_followups);
                  }
                } else if (parsed.answer) {
                  appendChunk(String(parsed.answer), parsed.citations, parsed.suggested_followups);
                  streamSucceeded = true;
                }
              } catch {
                if (dataStr) {
                  appendChunk(dataStr);
                  streamSucceeded = true;
                }
              }
            }
          }
        }
      }
    } catch {
      // streaming fallback below
    }

    // 2. Fallback to Supabase Cloud Function if streaming had zero tokens
    if (!streamSucceeded) {
      try {
        setGenerationStep('Connecting to sovereign civic knowledge base...');
        const resp = await axios.post(
          'https://ocplgpmsfwibjzjvxynv.supabase.co/functions/v1/chat',
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcGxncG1zZndpYmp6anZ4eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MDQyMDQsImV4cCI6MjEwOTA4MDIwNH0.ve2ATBpUVCOBYZ5FtexNu897vLLe3oGJgOYeccLv_zY'
            },
            timeout: 15000
          }
        );

        if (resp.data) {
          const content = resp.data.answer || resp.data.content || 'Information retrieved.';
          const citations = resp.data.citations || [];
          const followups = resp.data.suggested_followups || [];
          fullBotText = content;

          if (isVoiceAgentQuery) {
            setVoiceAssistantReply(content);
          }

          setThreads(prevThreads => prevThreads.map(t => {
            if (t.id === activeThreadId) {
              const msgs = t.messages.map(m => {
                if (m.id === botMsgId) {
                  return { ...m, content, citations, suggestedFollowups: followups };
                }
                return m;
              });
              return { ...t, messages: msgs };
            }
            return t;
          }));
        }
      } catch {
        fullBotText = 'Kindly check your internet connection or verify your query. Nagarik AI is ready to assist.';
        setThreads(prevThreads => prevThreads.map(t => {
          if (t.id === activeThreadId) {
            const msgs = t.messages.map(m => {
              if (m.id === botMsgId) {
                return { ...m, content: fullBotText };
              }
              return m;
            });
            return { ...t, messages: msgs };
          }
          return t;
        }));
      }
    }

    setIsGenerating(false);
    setGenerationStep('');
    setTimeout(() => scrollToBottomIfNear(true), 100);
  };

  const [savedSchemeToast, setSavedSchemeToast] = useState<string | null>(null);

  const handleSaveCitationToBasta = (cite: SchemeCitation) => {
    try {
      const existingStr = localStorage.getItem('nagarik_saved_schemes');
      const list = existingStr ? JSON.parse(existingStr) : [];
      if (!list.some((s: any) => s.name === cite.name)) {
        list.push({
          id: cite.id || 'scheme_' + Date.now(),
          name: cite.name,
          department: cite.department || 'Government Welfare Portal',
          benefit: cite.benefit || 'Verified Government Scheme',
          eligibility_summary: cite.eligibility_summary || 'Check official guidelines on portal',
          official_url: cite.official_url,
          saved_at: new Date().toLocaleDateString()
        });
        localStorage.setItem('nagarik_saved_schemes', JSON.stringify(list));
      }
      setSavedSchemeToast(cite.name);
      setTimeout(() => setSavedSchemeToast(null), 2500);
    } catch {
      // ignore
    }
  };

  const filteredThreads = threads.filter(t =>
    t.title.toLowerCase().includes(threadSearch.toLowerCase())
  );

  // Quick Prompt Cards for welcome screen (Sovereign Theme)
  const promptCards = [
    {
      icon: '🌾',
      title: selectedLanguage === 'hi' ? 'पीएम किसान ₹6,000' : selectedLanguage === 'te' ? 'పీఎం కిసాన్ ₹6,000' : 'PM-KISAN ₹6,000 Aid',
      desc: selectedLanguage === 'hi' ? 'पात्रता व आवेदन प्रक्रिया' : selectedLanguage === 'te' ? 'అర్హత మరియు దరఖాస్తు' : 'Annual income support for farmers',
      query: selectedLanguage === 'hi' ? 'पीएम किसान योजना के लिए पात्रता और आवेदन कैसे करें?' : selectedLanguage === 'te' ? 'పీఎం కిసాన్ పథకం అర్హతలు మరియు దరఖాస్తు విధానం ఏమిటి?' : 'What are the eligibility criteria and application steps for PM-KISAN?'
    },
    {
      icon: '🏥',
      title: selectedLanguage === 'hi' ? 'आयुष्मान भारत कार्ड' : selectedLanguage === 'te' ? 'ఆయుష్మాన్ భారత్ కార్డు' : 'Ayushman Bharat PM-JAY',
      desc: selectedLanguage === 'hi' ? '₹5 लाख तक मुफ्त इलाज' : selectedLanguage === 'te' ? '₹5 లక్షల ఉచిత వైద్యం' : '₹5 Lakh cashless hospital treatment',
      query: selectedLanguage === 'hi' ? 'आयुष्मान भारत कार्ड कैसे बनाएं और कौन से अस्पताल मान्य हैं?' : selectedLanguage === 'te' ? 'ఆయుష్మాన్ భారత్ హెల్త్ కార్డు ఎలా పొందాలి?' : 'How to apply for Ayushman Bharat card and get ₹5 Lakh hospital coverage?'
    },
    {
      icon: '🎓',
      title: selectedLanguage === 'hi' ? 'छात्रवृत्ति योजनाएं' : selectedLanguage === 'te' ? 'విద్యార్థి స్కాలర్‌షిప్‌లు' : 'Student Scholarships',
      desc: selectedLanguage === 'hi' ? '10वीं, 12वीं व कॉलेज छात्र' : selectedLanguage === 'te' ? 'పాఠశాల మరియు కాలేజీ విద్యార్థులకు' : 'National Scholarship Portal schemes',
      query: selectedLanguage === 'hi' ? 'कॉलेज और स्कूल छात्रों के लिए नेशनल स्कॉलरशिप पोर्टल की योजनाएं बताएं' : selectedLanguage === 'te' ? 'విద్యార్థుల కోసం అందుబాటులో ఉన్న ముఖ్యమైన స్కాలర్‌షిప్‌లు ఏమిటి?' : 'What government scholarships are available for school and college students?'
    },
    {
      icon: '🚗',
      title: selectedLanguage === 'hi' ? 'ड्राइविंग लाइसेंस' : selectedLanguage === 'te' ? 'డ్రైవింగ్ లైసెన్స్' : 'Driving Licence Online',
      desc: selectedLanguage === 'hi' ? 'सारथी पोर्टल पर ऑनलाइन प्रक्रिया' : selectedLanguage === 'te' ? 'సారథి పోర్టల్ ద్వారా ఆన్‌లైన్' : 'Official Sarathi Parivahan portal steps',
      query: selectedLanguage === 'hi' ? 'ड्राइविंग लाइसेंस के लिए ऑनलाइन आवेदन कैसे करें?' : selectedLanguage === 'te' ? 'ఆన్‌లైన్‌లో డ్రైవింగ్ లైసెన్స్ ఎలా దరఖాస్తు చేయాలి?' : 'How to apply for a Driving Licence online through Sarathi Parivahan?'
    },
    {
      icon: '💼',
      title: selectedLanguage === 'hi' ? 'मुद्रा व्यापार ऋण' : selectedLanguage === 'te' ? 'ముద్రా వ్యాపార రుణాలు' : 'Mudra Business Loan',
      desc: selectedLanguage === 'hi' ? 'बिना गारंटी ₹20 लाख तक लोन' : selectedLanguage === 'te' ? 'హామీ లేకుండా వ్యాపార రుణాలు' : 'Collateral-free loans up to ₹20 Lakh',
      query: selectedLanguage === 'hi' ? 'मुद्रा लोन के तहत नया बिजनेस शुरू करने के लिए लोन कैसे मिलेगा?' : selectedLanguage === 'te' ? 'ముద్రా లోన్ ద్వారా చిన్న వ్యాపారానికి రుణం ఎలా పొందాలి?' : 'How can I get a Mudra loan to start a small business?'
    },
    {
      icon: '🏠',
      title: selectedLanguage === 'hi' ? 'पीएम आवास योजना' : selectedLanguage === 'te' ? 'పీఎం ఆవాస్ యోజన' : 'PM Awas Yojana (PMAY)',
      desc: selectedLanguage === 'hi' ? 'पक्का मकान बनाने के लिए सब्सिडी' : selectedLanguage === 'te' ? 'సొంత ఇల్లు నిర్మాణానికి సాయం' : 'Housing subsidy for eligible families',
      query: selectedLanguage === 'hi' ? 'प्रधानमंत्री आवास योजना के तहत घर बनाने के लिए कितनी सब्सिडी मिलती है?' : selectedLanguage === 'te' ? 'పీఎం ఆవాస్ యోజన కింద ఇల్లు కట్టుకోవడానికి ఎలా దరఖాస్తు చేయాలి?' : 'How do I apply for PM Awas Yojana housing subsidy?'
    }
  ];

  return (
    <div className="fixed inset-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-full overflow-hidden bg-[#0c0e11] text-[#e2e2e6] font-sans antialiased">
      {/* ================================================================= */}
      {/* 1. LEFT SIDEBAR (COLLAPSIBLE / EXTENDABLE CONVERSATION HISTORY)   */}
      {/* ================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#121418] border-r border-[#22262f] sidebar-transition md:static ${
          sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'
        } ${
          sidebarCollapsed
            ? 'md:w-0 md:opacity-0 md:border-none md:p-0 md:overflow-hidden md:pointer-events-none'
            : 'md:w-72 md:opacity-100 md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#22262f] bg-[#16191f] shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1d24] border border-[#f2ca50]/40 shadow-inner p-0.5">
              <NagarikEmblem className="w-8 h-8 rounded-full" size={32} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="brand-serif italic font-bold text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#f2ca50] via-amber-200 to-[#ffb692]">
                  Nagarik AI
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-[#f2ca50]/15 text-[#f2ca50] border border-[#f2ca50]/30 font-mono">
                  Sovereign
                </span>
              </div>
              <p className="text-[11px] text-[#8F93B5]">Civic Intelligence Copilot</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Button */}
            <button
              onClick={() => {
                setSidebarCollapsed(true);
                try { localStorage.setItem('nagarik_sidebar_collapsed', 'true'); } catch {}
              }}
              className="hidden md:flex p-1.5 rounded-lg text-[#8F93B5] hover:text-[#f2ca50] hover:bg-[#22262f] transition-colors"
              title="Collapse conversation history (Alt+S)"
              aria-label="Collapse History"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Start Fresh Conversation */}
        <div className="p-3 shrink-0">
          <button
            onClick={handleCreateNewThread}
            className="hover-pop-btn-orange w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f2ca50] to-[#ffb692] text-[#241a00] font-bold text-sm shadow-md hover:opacity-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Search Past Conversations */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#8F93B5]" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="w-full bg-[#16191f] border border-[#22262f] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e2e2e6] placeholder-[#8F93B5] focus:outline-none focus:border-[#f2ca50]/60"
            />
          </div>
        </div>

        {/* Conversation Threads List (Simplified & Clean) */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin">
          <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-[#8F93B5] uppercase tracking-wider flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[10px] bg-[#1a1d24] px-1.5 py-0.5 rounded text-[#8F93B5] font-mono">
              {filteredThreads.length}
            </span>
          </div>

          {filteredThreads.map(thread => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => {
                  setActiveThreadId(thread.id);
                  setSidebarOpen(false);
                }}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-xs transition-all ${
                  isActive
                    ? 'bg-[#1a1d24] text-white font-medium border border-[#f2ca50]/40 shadow-sm'
                    : 'text-[#8F93B5] hover:bg-[#16191f] hover:text-[#e2e2e6]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#f2ca50]' : 'text-[#8F93B5]'}`} />
                  <span className="truncate">{thread.title || 'Civic Consultation'}</span>
                </div>
                {threads.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteThread(e, thread.id)}
                    title="Delete conversation"
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Simplified Sidebar Footer */}
        <div className="p-3 border-t border-[#22262f] space-y-2 bg-[#101216] shrink-0">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowExtensionModal(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold bg-[#1a1d24] border border-[#f2ca50]/40 text-[#f2ca50] hover:bg-[#22262f] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Monitor className="w-4 h-4 text-[#f2ca50]" />
              <span>AI Saathi (Extension)</span>
            </div>
            <span className="text-[10px] bg-[#f2ca50]/20 px-1.5 py-0.5 rounded text-[#f2ca50] font-mono">Chrome</span>
          </button>

          {threads.length > 1 && (
            <button
              onClick={() => {
                if (window.confirm('Clear all conversation history?')) {
                  handleClearAllHistory();
                }
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-[#8F93B5] hover:text-red-400 hover:bg-[#16191f] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}

          <div className="pt-1 px-1 flex items-center justify-between text-[10px] text-[#8F93B5] border-t border-[#22262f]/60">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Zero-Knowledge Architecture
            </span>
            <span className="text-[#f2ca50] font-mono">Sovereign AI</span>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ================================================================= */}
      {/* 2. MAIN CONVERSATION WORKSPACE                                    */}
      {/* ================================================================= */}
      <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#0c0e11] relative">
        {/* Top Minimal Sovereign Header - Fully Responsive on Mobile (< 640px) */}
        <header className="flex items-center justify-between h-14 px-2 sm:px-4 border-b border-[#22262f] bg-[#101216]/90 backdrop-blur-xl shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Sidebar Toggle Button (Always accessible to collapse and expand) */}
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setSidebarOpen(prev => !prev);
                } else {
                  toggleSidebarCollapsed();
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 bg-[#1a1d24] border-[#f2ca50]/50 text-[#f2ca50] shadow-sm hover:border-[#f2ca50] hover:bg-[#22262f]"
              title="Toggle Conversation History (Alt+S)"
              aria-label="Toggle Conversation History"
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="w-4 h-4 text-[#f2ca50]" />
              ) : (
                <ChevronsLeft className="w-4 h-4 text-[#f2ca50]" />
              )}
              <span className="hidden sm:inline text-xs text-[#e2e2e6]">
                {sidebarCollapsed ? 'History' : 'Collapse'}
              </span>
              {threads.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f2ca50]/20 text-[#f2ca50] font-mono">
                  {threads.length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-[#e2e2e6] truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">
                {currentThread?.title || 'Nagarik AI Copilot'}
              </span>
            </div>
          </div>

          {/* Right Header Controls - Auto-fit for mobile screens */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* AI Saathi Extension Button */}
            <button
              onClick={() => setShowExtensionModal(true)}
              className="hover-pop-btn-slate flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#1a1d24] border border-[#f2ca50]/40 text-[#f2ca50] hover:border-[#f2ca50] text-xs font-semibold shadow-sm transition-all shrink-0"
              title="Open AI Saathi Browser Extension & Guardian (Alt+E)"
              aria-label="AI Saathi Extension"
            >
              <Monitor className="w-3.5 h-3.5 text-[#f2ca50]" />
              <span className="hidden md:inline">AI Saathi</span>
            </button>

            {/* National Helplines (SOS / 24x7) Button */}
            <button
              onClick={() => setShowHelplineModal(true)}
              className="hover-pop-btn-slate flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#1a1d24] border border-amber-500/40 text-amber-400 hover:border-amber-400 text-xs font-semibold shadow-sm transition-all shrink-0"
              title="National Helplines (112, 1930, 181, 1912)"
              aria-label="National Helplines"
            >
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Helplines</span>
            </button>

            {/* Preferences & Accessibility Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="hover-pop-btn-slate flex items-center gap-1 sm:gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#1a1d24] border border-[#22262f] text-[#8F93B5] hover:text-[#f2ca50] hover:border-[#f2ca50]/50 text-xs font-semibold shadow-sm transition-all shrink-0"
              title="Settings & Accessibility"
              aria-label="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Settings</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-[#16191f] border border-[#22262f] rounded-lg p-0.5 text-xs shrink-0">
              {(['en', 'hi', 'te'] as CivicLanguage[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-all ${
                    selectedLanguage === lang
                      ? 'bg-[#f2ca50] text-[#241a00] font-bold shadow-sm'
                      : 'text-[#8F93B5] hover:text-white'
                  }`}
                  aria-label={`Switch language to ${lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Telugu'}`}
                >
                  {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'తెలుగు'}
                </button>
              ))}
            </div>

            {/* New Thread Button */}
            <button
              onClick={handleCreateNewThread}
              className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#16191f] hover:bg-[#22262f] text-xs font-medium text-[#e2e2e6] border border-[#22262f] transition-colors shrink-0"
              title="New Conversation (Alt+N)"
              aria-label="New Conversation"
            >
              <Plus className="w-3.5 h-3.5 text-[#f2ca50]" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </header>

        {/* Message Feed / Welcome Screen (Rock-Solid Scrolling Container) */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 scrollbar-thin overscroll-contain"
        >
          <div className="max-w-3xl mx-auto space-y-6">
            {/* EMPTY STATE: Welcome Screen */}
            {messages.length === 0 && (
              <div className="py-6 text-center space-y-8 animate-fade-in">
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#16191f] border border-[#B8643A]/50 shadow-lg shadow-black/60">
                    <NagarikEmblem className="w-10 h-10" size={40} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {selectedLanguage === 'hi'
                      ? 'नमस्ते! आप किस योजना या सेवा की तलाश में हैं?'
                      : selectedLanguage === 'te'
                      ? 'నమస్కారం! మీరు ఏ ప్రభుత్వ పథకం లేదా సేవ కోసం చూస్తున్నారు?'
                      : 'Namaste! How can Nagarik AI assist you today?'}
                  </h1>
                  <p className="text-sm text-[#8F93B5] max-w-lg mx-auto leading-relaxed">
                    {selectedLanguage === 'hi'
                      ? 'प्रमाणित केंद्रीय व राज्य योजनाओं, पात्रता नियमों और आधिकारिक सरकारी पोर्टलों की सटीक जानकारी।'
                      : selectedLanguage === 'te'
                      ? 'అధికారిక కేంద్ర మరియు రాష్ట్ర సంక్షేమ పథకాలు, అర్హత నిబంధనలు మరియు ప్రత్యక్ష ప్రయోజనాల సమాచారం.'
                      : 'Official Central & State Welfare Schemes, Eligibility Criteria & Direct Benefit Access.'}
                  </p>

                  {/* Quick Feature Pills */}
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      onClick={() => setShowExtensionModal(true)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16191f] border border-[#f2ca50]/40 text-xs font-semibold text-[#f2ca50] hover:bg-[#22262f] shadow-sm transition-all"
                    >
                      <Monitor className="w-3.5 h-3.5 text-[#f2ca50]" />
                      <span>AI Saathi Browser Extension</span>
                      <ArrowRight className="w-3 h-3 text-[#f2ca50]" />
                    </button>

                    <button
                      onClick={() => setShowHelplineModal(true)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#16191f] border border-amber-500/40 text-xs font-semibold text-amber-400 hover:bg-[#22262f] shadow-sm transition-all"
                    >
                      <Phone className="w-3.5 h-3.5 text-amber-400" />
                      <span>24x7 National Helplines (SOS)</span>
                      <ArrowRight className="w-3 h-3 text-amber-400" />
                    </button>
                  </div>
                </div>

                {/* 6 Clean Prompt Cards from Nagarik_AI_frontend */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                  {promptCards.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChat(card.query)}
                      className="hover-pop-card group flex flex-col justify-between p-4 rounded-xl bg-[#16191f] border border-[#22262f] hover:border-[#f2ca50]/50 hover:bg-[#1e2330] transition-all text-left shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <h2 className="font-semibold text-sm text-[#e2e2e6] group-hover:text-[#f2ca50] transition-colors">
                          {card.title}
                        </h2>
                        <p className="text-xs text-[#8F93B5] leading-relaxed line-clamp-2">
                          {card.desc}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-[11px] font-medium text-[#f2ca50] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Ask now</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CONVERSATION MESSAGES */}
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isLatestBotMessage = !isUser && idx === messages.length - 1;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Bot Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#16191f] border border-[#B8643A]/50 flex items-center justify-center shrink-0 mt-0.5">
                      <NagarikEmblem className="w-5 h-5" size={20} />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#1e2330] text-white rounded-tr-sm border border-[#2b303b] shadow-sm'
                        : 'bg-[#121418] text-[#e2e2e6] rounded-tl-sm border border-[#22262f] shadow-md'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-3">
                        {/* Bot Content with live streaming cursor */}
                        <div className="relative">
                          <div
                            className="prose-civic"
                            dangerouslySetInnerHTML={{
                              __html: marked.parse(msg.content || '') as string
                            }}
                          />
                          {isGenerating && isLatestBotMessage && (
                            <span className="streaming-cursor" title="Streaming response..." />
                          )}
                        </div>

                        {/* Official Citations & Portals */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-3 border-t border-[#22262f] space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f2ca50]">
                              <Globe className="w-3.5 h-3.5" />
                              <span>Verified Official Portals:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {msg.citations.map((cite, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="inline-flex items-center rounded-lg bg-[#16191f] border border-[#22262f] hover:border-[#f2ca50]/60 transition-colors overflow-hidden"
                                >
                                  <a
                                    href={cite.official_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#ffb692] hover:text-[#f2ca50] transition-colors"
                                  >
                                    <span>{cite.name}</span>
                                    <ExternalLink className="w-3 h-3 text-[#8F93B5]" />
                                  </a>
                                  <button
                                    onClick={() => handleSaveCitationToBasta(cite)}
                                    title="Save to Nagarik Basta (Document Locker)"
                                    className="p-1.5 border-l border-[#22262f] text-[#8F93B5] hover:text-[#f2ca50] hover:bg-[#22262f] transition-colors"
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggested Follow-ups */}
                        {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                          <div className="pt-2 flex flex-wrap gap-1.5">
                            {msg.suggestedFollowups.map((followup, fIdx) => (
                              <button
                                key={fIdx}
                                onClick={() => handleSendChat(followup)}
                                className="px-2.5 py-1 rounded-full bg-[#1a1d24] border border-[#22262f] hover:border-[#f2ca50]/40 text-xs text-[#c5cfdb] hover:text-white transition-colors"
                              >
                                {followup}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Bottom Actions Bar */}
                        <div className="flex items-center gap-3 pt-2 text-xs text-[#8F93B5]">
                          <button
                            onClick={() => handleToggleSpeak(msg.id, msg.content, msg.language)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
                              speakingId === msg.id
                                ? 'bg-[#f2ca50]/15 text-[#f2ca50] border border-[#f2ca50]/30 shadow-sm'
                                : 'hover:text-white hover:bg-[#16191f]'
                            }`}
                            title={speakingId === msg.id ? "Stop voice audio" : "Listen in authentic Telugu / Hindi / English"}
                          >
                            {speakingId === msg.id ? (
                              <>
                                <div className="flex items-center gap-0.5 px-0.5 h-3.5">
                                  <div className="w-0.5 bg-[#f2ca50] rounded-full animate-soundwave-1" />
                                  <div className="w-0.5 bg-[#f2ca50] rounded-full animate-soundwave-2" />
                                  <div className="w-0.5 bg-[#f2ca50] rounded-full animate-soundwave-3" />
                                </div>
                                <span className="text-[#f2ca50] font-medium text-[11px]">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span className="text-[11px]">Listen</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1 hover:text-white transition-colors"
                            title="Copy text"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Stable Live Reasoning Status (Zero layout shift) */}
            {isGenerating && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#16191f] border border-[#f2ca50]/30 max-w-md text-xs text-[#8F93B5]">
                <div className="w-2 h-2 rounded-full bg-[#f2ca50] animate-ping" />
                <span className="truncate">{generationStep || 'Searching gazettes...'}</span>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. PINNED BOTTOM INPUT BAR (SOVEREIGN GLOW)                       */}
        {/* ================================================================= */}
        <div className="p-3 sm:p-4 pb-[max(0.6rem,env(safe-area-inset-bottom))] border-t border-[#22262f] bg-[#101216]/95 backdrop-blur-md shrink-0 z-20">
          <div className="max-w-3xl mx-auto space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="input-bar-glow relative flex items-center bg-[#16191f] border border-[#22262f] rounded-2xl shadow-xl focus-within:border-[#f2ca50]/60 focus-within:ring-1 focus-within:ring-[#f2ca50]/30 transition-all"
            >
              {/* Mic / Voice Search */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-l-2xl transition-colors ${
                  isListening
                    ? 'text-red-500 animate-pulse bg-red-500/10'
                    : 'text-[#8F93B5] hover:text-white'
                }`}
                title={isListening ? 'Listening... speak now' : 'Voice typing'}
                aria-label="Voice typing"
              >
                {isListening ? <MicOff className="w-5 h-5 text-red-500" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input - 16px text-base on mobile prevents iOS viewport auto-zoom */}
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  isListening
                    ? (selectedLanguage === 'hi' ? 'सुन रहा हूँ... बोलिए' : selectedLanguage === 'te' ? 'వింటున్నాను... మాట్లాడండి' : 'Listening... Speak now')
                    : (selectedLanguage === 'hi'
                    ? 'सरकारी योजनाओं, पात्रता या सेवाओं के बारे में पूछें...'
                    : selectedLanguage === 'te'
                    ? 'ప్రభుత్వ పథకాలు లేదా సేవల గురించి అడగండి...'
                    : 'Ask about any government scheme, eligibility, or civic service...')
                }
                disabled={isGenerating}
                className="flex-1 bg-transparent py-3 px-2 text-base sm:text-sm text-[#e2e2e6] placeholder-[#8F93B5] focus:outline-none disabled:opacity-50"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isGenerating}
                className={`p-2.5 mr-1.5 rounded-xl transition-all ${
                  inputQuery.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-[#d4af37] via-[#f2ca50] to-[#ffb692] text-[#241a00] shadow-md hover:opacity-95 cursor-pointer font-bold'
                    : 'text-[#3f3a2f] cursor-not-allowed'
                }`}
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between px-2 text-[10px] sm:text-[11px] text-[#8F93B5]">
              <span className="truncate flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">UIDAI Aadhaar Redacted • Voice Enabled in 22 Official Languages</span>
              </span>
              <span className="hidden sm:inline shrink-0 ml-2">Press Enter to send</span>
            </div>
          </div>
        </div>
      </main>

      {/* ================================================================= */}
      {/* 4. MODALS: AI SAATHI EXTENSION & CONSULTATION SUMMARIZER          */}
      {/* ================================================================= */}

      {/* AI Saathi Browser Extension Modal */}
      <AISaathiExtensionModal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        selectedLanguage={selectedLanguage}
      />

      {/* National Helplines Directory Modal (SOS / 24x7) */}
      <CivicHelplineModal
        isOpen={showHelplineModal}
        onClose={() => setShowHelplineModal(false)}
        currentLanguage={selectedLanguage === 'ta' ? 'en' : selectedLanguage}
      />

      {/* Citizen Preferences & Settings Modal */}
      <CivicSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        selectedLanguage={selectedLanguage}
        onLanguageChange={(lang) => setSelectedLanguage(lang as CivicLanguage)}
        onClearHistory={handleClearAllHistory}
        incognito={incognito}
        onToggleIncognito={handleToggleIncognito}
      />

      {/* Toast Notification for Bookmarked Scheme */}
      {savedSchemeToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#16191f] border border-[#f2ca50]/50 text-white text-xs font-semibold shadow-2xl animate-slide-smooth">
          <Check className="w-4 h-4 text-[#f2ca50]" />
          <span>Saved to your civic dossier: <strong>{savedSchemeToast}</strong></span>
        </div>
      )}
    </div>
  );
}

export default App;
