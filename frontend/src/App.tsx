import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { marked } from 'marked';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Copy, Check, RefreshCw,
  ExternalLink, Plus, MessageSquare, Trash2, Search, Menu, X,
  ShieldCheck, Calculator, Smartphone, Compass, ArrowRight,
  Globe, Sparkles
} from 'lucide-react';
import { LOGO_EMBLEM_BASE64 } from './assets/logo_base64';
import { CivicEligibilityCalculator } from './components/CivicEligibilityCalculator';
import { WhatsAppBotView } from './components/WhatsAppBotView';

// Civic Language Support
type CivicLanguage = 'en' | 'hi' | 'te';

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
        <circle cx="50" cy="50" r="46" fill="#0E121E" stroke="#F59E0B" strokeWidth="3" />
        <circle cx="50" cy="50" r="28" fill="#1E293B" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="50" cy="50" r="8" fill="#F59E0B" />
        <path d="M50 12 L50 88 M12 50 L88 50 M23 23 L77 77 M23 77 L77 23" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.7" />
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
  const [threadSearch, setThreadSearch] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Modals for secondary tools
  const [showEligibilityModal, setShowEligibilityModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  // Refs
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Active thread
  const currentThread = threads.find(t => t.id === activeThreadId) || threads[0];
  const messages = currentThread?.messages || [];

  // Persist threads
  useEffect(() => {
    try {
      localStorage.setItem('nagarik_civic_threads', JSON.stringify(threads));
    } catch {
      // ignore
    }
  }, [threads]);

  // Throttled Auto-scroll
  useEffect(() => {
    if (scrollTimerRef.current) return;
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      chatBottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }, 120);
  }, [messages, generationStep]);

  // Keyboard shortcut Alt+N for new chat, Alt+T for sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNewThread();
      } else if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [threads]);

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

  // Speech Recognition (Voice typing)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice typing is not supported in this browser. Please try Google Chrome or Edge.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : 'en-IN';

    rec.onstart = () => setIsListening(true);
    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputQuery(prev => (prev ? prev + ' ' : '') + transcript);
      setIsListening(false);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  // Text-to-Speech (Audio playback)
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = selectedLanguage === 'hi' ? 'hi-IN' : selectedLanguage === 'te' ? 'te-IN' : 'en-IN';
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Copy Message to Clipboard
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send Chat Message
  const handleSendChat = async (overrideQuery?: string) => {
    const query = (overrideQuery || inputQuery).trim();
    if (!query || isGenerating) return;

    setInputQuery('');
    const userMsgId = 'user_' + Date.now();
    const botMsgId = 'bot_' + Date.now();

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLanguage
    };

    const initialBotMessage: ChatMessage = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: selectedLanguage,
      citations: []
    };

    // Update active thread
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
    setGenerationStep('Searching 5,210 verified schemes...');

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let streamSucceeded = false;

    // Build payload
    const payload = {
      query,
      language: selectedLanguage,
      session_id: currentThread.sessionId,
      thread_id: currentThread.id,
      history: currentThread.messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
    };

    // Helper: Append chunk to bot message
    const appendChunk = (chunk: string, citations?: SchemeCitation[], followups?: string[]) => {
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
                if (parsed.type === 'step') {
                  setGenerationStep(parsed.title || 'Verifying official criteria...');
                } else if (parsed.type === 'token' && parsed.content) {
                  appendChunk(parsed.content);
                  streamSucceeded = true;
                } else if (parsed.type === 'citations' && parsed.citations) {
                  appendChunk('', parsed.citations, parsed.suggested_followups);
                } else if (parsed.content) {
                  appendChunk(parsed.content, parsed.citations, parsed.suggested_followups);
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
        // Ultimate fallback
        setThreads(prevThreads => prevThreads.map(t => {
          if (t.id === activeThreadId) {
            const msgs = t.messages.map(m => {
              if (m.id === botMsgId) {
                return {
                  ...m,
                  content: 'Kindly check your internet connection or try again. You can also test all live services directly on the [Host Verification Page](./host.html).'
                };
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
  };

  // Filtered threads for sidebar
  const filteredThreads = threads.filter(t =>
    t.title.toLowerCase().includes(threadSearch.toLowerCase())
  );

  // Quick Prompt Cards for welcome screen
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0D14] text-[#E2E8F0] font-sans antialiased">
      {/* ================================================================= */}
      {/* 1. LEFT SIDEBAR (COLLAPSIBLE / RESPONSIVE)                         */}
      {/* ================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-[#0E131F] border-r border-[#1E2638] transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E2638]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#161D2E] border border-[#F59E0B]/40 shadow-sm">
              <NagarikEmblem className="w-6 h-6" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">Nagarik AI</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">Civic</span>
              </div>
              <p className="text-[11px] text-[#94A3B8]">Sovereign Intelligence</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E2638]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Start Fresh Conversation */}
        <div className="p-3">
          <button
            onClick={handleCreateNewThread}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#F59E0B] text-white font-semibold text-sm shadow-md hover:opacity-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Search Past Conversations */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              className="w-full bg-[#141B2D] border border-[#1E2638] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#CBD5E1] placeholder-[#64748B] focus:outline-none focus:border-[#F59E0B]/50"
            />
          </div>
        </div>

        {/* Conversation Threads List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin">
          <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            History ({filteredThreads.length})
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
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                  isActive
                    ? 'bg-[#1E293B] text-white font-medium border border-[#334155]'
                    : 'text-[#94A3B8] hover:bg-[#141B2D] hover:text-[#E2E8F0]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#F59E0B]' : 'text-[#64748B]'}`} />
                  <span className="truncate">{thread.title || 'Untitled'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteThread(e, thread.id)}
                  title="Delete conversation"
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Bottom Quick Links */}
        <div className="p-3 border-t border-[#1E2638] space-y-1.5 bg-[#0C101A]">
          <button
            onClick={() => setShowEligibilityModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-[#161D2E] hover:text-white transition-colors"
          >
            <Calculator className="w-4 h-4 text-[#38BDF8]" />
            <span>Check Eligibility</span>
          </button>

          <button
            onClick={() => setShowWhatsAppModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-[#161D2E] hover:text-white transition-colors"
          >
            <Smartphone className="w-4 h-4 text-[#4ADE80]" />
            <span>WhatsApp Citizen Bot</span>
          </button>

          <a
            href="./host.html"
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#CBD5E1] hover:bg-[#161D2E] hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Compass className="w-4 h-4 text-[#F59E0B]" />
              <span>Host Verification Portal</span>
            </div>
            <ExternalLink className="w-3 h-3 text-[#64748B]" />
          </a>

          <div className="pt-2 px-1 flex items-center justify-between text-[10px] text-[#64748B]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#4ADE80]" />
              UIDAI Compliant
            </span>
            <span>5,210 Schemes</span>
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
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0D14]">
        {/* Top Minimal Header */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-[#1E2638] bg-[#0E131F]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#161D2E] transition-colors md:hidden"
              title="Open History"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[#F1F5F9] truncate max-w-[200px] sm:max-w-md">
                {currentThread?.title || 'Nagarik AI Copilot'}
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-[#141B2D] border border-[#1E2638] rounded-lg p-0.5 text-xs">
              {(['en', 'hi', 'te'] as CivicLanguage[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    selectedLanguage === lang
                      ? 'bg-[#F59E0B] text-[#0A0D14] font-bold shadow-sm'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'తెలుగు'}
                </button>
              ))}
            </div>

            <button
              onClick={handleCreateNewThread}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161D2E] hover:bg-[#1E2638] text-xs font-medium text-[#E2E8F0] border border-[#1E2638] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>New</span>
            </button>
          </div>
        </header>

        {/* Message Feed / Welcome Screen */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* EMPTY STATE: Welcome Screen */}
            {messages.length === 0 && (
              <div className="py-8 text-center space-y-8 animate-fade-in">
                <div className="space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#141B2D] border border-[#F59E0B]/40 shadow-lg shadow-black/40">
                    <NagarikEmblem className="w-10 h-10" size={40} />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {selectedLanguage === 'hi'
                      ? 'नमस्ते! आप किस योजना या सेवा की तलाश में हैं?'
                      : selectedLanguage === 'te'
                      ? 'నమస్కారం! మీరు ఏ ప్రభుత్వ పథకం లేదా సేవ కోసం చూస్తున్నారు?'
                      : 'Namaste! How can Nagarik AI assist you today?'}
                  </h1>
                  <p className="text-sm text-[#94A3B8] max-w-lg mx-auto">
                    {selectedLanguage === 'hi'
                      ? '5,210+ प्रमाणित केंद्रीय व राज्य योजनाओं, पात्रता नियमों और आधिकारिक पोर्टलों की सीधी जानकारी।'
                      : selectedLanguage === 'te'
                      ? '5,210+ కేంద్ర మరియు రాష్ట్ర సంక్షేమ పథకాలు, అర్హతలు మరియు అధికారిక పోర్టల్ సమాచారం.'
                      : 'Verified guidance across 5,210 Central & State welfare schemes, eligibility rules, and official portals.'}
                  </p>
                </div>

                {/* 6 Clean Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                  {promptCards.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChat(card.query)}
                      className="group flex flex-col justify-between p-4 rounded-xl bg-[#0E131F] border border-[#1E2638] hover:border-[#F59E0B]/50 hover:bg-[#141B2D] transition-all text-left shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="text-2xl mb-1">{card.icon}</div>
                        <h2 className="font-semibold text-sm text-[#F1F5F9] group-hover:text-[#F59E0B] transition-colors">
                          {card.title}
                        </h2>
                        <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2">
                          {card.desc}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-3 text-[11px] font-medium text-[#F59E0B] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Ask now</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CONVERSATION MESSAGES */}
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Bot Avatar */}
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-[#161D2E] border border-[#F59E0B]/40 flex items-center justify-center shrink-0 mt-0.5">
                      <NagarikEmblem className="w-5 h-5" size={20} />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#1E293B] text-white rounded-tr-sm border border-[#334155]'
                        : 'bg-[#0E131F] text-[#E2E8F0] rounded-tl-sm border border-[#1E2638] shadow-md'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="space-y-3">
                        {/* Bot Content */}
                        <div
                          className="prose-gov"
                          dangerouslySetInnerHTML={{
                            __html: marked.parse(msg.content || '') as string
                          }}
                        />

                        {/* Official Citations & Portals */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="pt-3 border-t border-[#1E2638] space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F59E0B]">
                              <Globe className="w-3.5 h-3.5" />
                              <span>Verified Official Portals:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {msg.citations.map((cite, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={cite.official_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141B2D] border border-[#1E2638] hover:border-[#F59E0B]/60 text-xs text-[#38BDF8] hover:text-[#7DD3FC] transition-colors"
                                >
                                  <span>{cite.name}</span>
                                  <ExternalLink className="w-3 h-3 text-[#94A3B8]" />
                                </a>
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
                                className="px-2.5 py-1 rounded-full bg-[#161D2E] border border-[#1E2638] hover:border-[#F59E0B]/40 text-xs text-[#CBD5E1] hover:text-white transition-colors"
                              >
                                {followup}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Bottom Actions Bar */}
                        <div className="flex items-center gap-3 pt-2 text-xs text-[#64748B]">
                          <button
                            onClick={() => handleToggleSpeak(msg.id, msg.content)}
                            className="flex items-center gap-1 hover:text-[#E2E8F0] transition-colors"
                            title="Listen"
                          >
                            {speakingId === msg.id ? (
                              <>
                                <VolumeX className="w-3.5 h-3.5 text-[#F59E0B]" />
                                <span className="text-[#F59E0B]">Stop</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="flex items-center gap-1 hover:text-[#E2E8F0] transition-colors"
                            title="Copy text"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-400" />
                                <span className="text-green-400">Copied</span>
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
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#0E131F] border border-[#1E2638] max-w-md text-xs text-[#94A3B8]">
                <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />
                <span className="truncate">{generationStep || 'Searching gazettes...'}</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. PINNED BOTTOM INPUT BAR                                        */}
        {/* ================================================================= */}
        <div className="p-4 border-t border-[#1E2638] bg-[#0E131F]/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="relative flex items-center bg-[#141B2D] border border-[#1E2638] rounded-2xl shadow-lg focus-within:border-[#F59E0B]/60 focus-within:ring-1 focus-within:ring-[#F59E0B]/30 transition-all"
            >
              {/* Mic / Voice Search */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-l-2xl transition-colors ${
                  isListening ? 'text-red-500 animate-pulse' : 'text-[#64748B] hover:text-[#E2E8F0]'
                }`}
                title={isListening ? 'Listening...' : 'Voice typing'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  selectedLanguage === 'hi'
                    ? 'सरकारी योजनाओं, पात्रता या सेवाओं के बारे में पूछें...'
                    : selectedLanguage === 'te'
                    ? 'ప్రభుత్వ పథకాలు లేదా సేవల గురించి అడగండి...'
                    : 'Ask about any government scheme, eligibility, or civic service...'
                }
                disabled={isGenerating}
                className="flex-1 bg-transparent py-3 px-2 text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none disabled:opacity-50"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isGenerating}
                className={`p-2.5 mr-1.5 rounded-xl transition-all ${
                  inputQuery.trim() && !isGenerating
                    ? 'bg-gradient-to-r from-[#EA580C] to-[#F59E0B] text-white shadow-md hover:opacity-95 cursor-pointer'
                    : 'text-[#475569] cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between px-2 text-[11px] text-[#64748B]">
              <span className="truncate">
                🔒 UIDAI Aadhaar PII Redacted • Free Public Citizen Knowledge Base
              </span>
              <span className="hidden sm:inline">Press Enter to send</span>
            </div>
          </div>
        </div>
      </main>

      {/* ================================================================= */}
      {/* 4. CLEAN MODALS FOR ELIGIBILITY & WHATSAPP                         */}
      {/* ================================================================= */}

      {/* Eligibility Calculator Modal */}
      {showEligibilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0E131F] border border-[#1E2638] rounded-2xl overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2638] mb-6">
              <div className="flex items-center gap-3">
                <Calculator className="w-6 h-6 text-[#38BDF8]" />
                <div>
                  <h2 className="text-lg font-bold text-white">Civic Entitlement Calculator</h2>
                  <p className="text-xs text-[#94A3B8]">Determine your official benefits based on age, income, and category</p>
                </div>
              </div>
              <button
                onClick={() => setShowEligibilityModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E2638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CivicEligibilityCalculator
              onAskCopilot={(query: string) => {
                setShowEligibilityModal(false);
                handleSendChat(query);
              }}
              selectedLanguage={selectedLanguage}
            />
          </div>
        </div>
      )}

      {/* WhatsApp Citizen Bot Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0E131F] border border-[#1E2638] rounded-2xl overflow-y-auto shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2638] mb-4">
              <div className="flex items-center gap-3">
                <Smartphone className="w-6 h-6 text-[#4ADE80]" />
                <div>
                  <h2 className="text-lg font-bold text-white">WhatsApp Citizen Gateway</h2>
                  <p className="text-xs text-[#94A3B8]">Access Nagarik AI on WhatsApp with zero app install</p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E2638]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <WhatsAppBotView
              currentLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
