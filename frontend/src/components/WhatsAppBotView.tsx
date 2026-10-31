import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Send, Phone, Video, MoreVertical, Paperclip, Mic,
  CheckCheck, ArrowLeft, ShieldCheck,
  ExternalLink, Copy, Check, FileCode,
  Globe
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

interface CitationItem {
  id: string;
  name: string;
  department: string;
  official_url: string;
  confidence_score?: number;
}

interface SuggestedReply {
  id: string;
  label: string;
  query: string;
}

interface WhatsAppMsg {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  mediaType?: 'text' | 'audio' | 'image';
  citations?: CitationItem[];
  suggestedReplies?: SuggestedReply[];
  twiml?: string;
  metaPayload?: any;
}

interface WhatsAppBotViewProps {
  currentLanguage: 'en' | 'hi' | 'te';
  onLanguageChange: (lang: 'en' | 'hi' | 'te') => void;
}

export const WhatsAppBotView: React.FC<WhatsAppBotViewProps> = ({
  currentLanguage,
  onLanguageChange
}) => {
  const [messages, setMessages] = useState<WhatsAppMsg[]>([
    {
      id: 'wa-welcome',
      sender: 'bot',
      text: `🏛️ *Welcome to Nagarik AI — WhatsApp Civic Copilot*\n_(Empowering Every Citizen • Sovereign Public Intelligence)_\n\nI can assist you with:\n• *Bank DBT Seeding Status* (NPCI Aadhaar Mapper)\n• *5,210+ Verified Welfare Schemes* (PM-KISAN, PMAY, Mudra)\n• *Civic Grievance Redressal* (Roads, sanitation, water, electricity)\n• *Document & ID Locators* (APAAR ID, UAN, Voter EPIC)\n\n👉 *Send any question directly in English, Hindi (हिंदी), or Telugu (తెలుగు), or tap an option below:*`,
      time: '12:00 PM',
      citations: [
        {
          id: 'UIDAI-01',
          name: 'myAadhaar Portal (UIDAI)',
          department: 'MeitY, Government of India',
          official_url: 'https://myaadhaar.uidai.gov.in',
          confidence_score: 0.99
        },
        {
          id: 'NPCI-02',
          name: 'NPCI Bharat Aadhaar Seeding Enabler',
          department: 'National Payments Corporation of India',
          official_url: 'https://www.npci.org.in',
          confidence_score: 0.98
        }
      ],
      suggestedReplies: [
        { id: '1', label: '1. Check DBT', query: 'How to check Aadhaar DBT bank account seeding status' },
        { id: '2', label: '2. PM-KISAN', query: 'PM-KISAN eligibility, benefits, and application guidelines' },
        { id: '3', label: '3. File Grievance', query: 'How to file a civic grievance on CPGRAMS or municipal portal' }
      ]
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+91 95539 48740');
  const [activeTabInspector, setActiveTabInspector] = useState<'citations' | 'twiml' | 'meta' | 'webhook'>('citations');
  const [copiedCode, setCopiedCode] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Active message to inspect technical telemetry for
  const latestBotMsg = [...messages].reverse().find(m => m.sender === 'bot');

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string, mediaType?: 'audio' | 'image') => {
    const rawText = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!rawText && !mediaType) return;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let displayText = rawText;
    if (mediaType === 'audio') {
      displayText = '🎙️ [Citizen Voice Note: "నా బ్యాంక్ అకౌంట్ ఆధార్ DBT సీడ్ అయిందో లేదో ఎలా చెక్ చేయాలి?"]';
    } else if (mediaType === 'image') {
      displayText = '📸 [Citizen Photo Proof: Broken Drainage & Water Puddle in Ward 14]';
    }

    const userMsg: WhatsAppMsg = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: displayText,
      time: timeFormatted,
      mediaType: mediaType || 'text'
    };

    setMessages(prev => [...prev, userMsg]);
    if (textToSend === undefined) {
      setInputText('');
    }
    setIsLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
      const response = await axios.post(`${API_BASE}/whatsapp/simulate`, {
        from_number: cleanPhone || '+919553948740',
        message: rawText || (mediaType === 'audio' ? 'Check Aadhaar DBT bank account seeding status' : 'Civic grievance water leakage issue'),
        language: currentLanguage,
        media_type: mediaType === 'audio' ? 'audio/ogg' : (mediaType === 'image' ? 'image/jpeg' : undefined)
      });

      const resData = response.data;
      const botMsg: WhatsAppMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: resData.whatsapp_message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: resData.citations,
        suggestedReplies: resData.suggested_replies,
        twiml: resData.twiml,
        metaPayload: resData.meta_payload
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('WhatsApp Bot Simulation Error:', err);
      const fallbackMsg: WhatsAppMsg = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        text: '⚠️ *Nagarik AI Gateway Temporarily Unavailable*\nPlease ensure the backend service is running at http://localhost:8000',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Hero Header */}
      <div className="text-center pt-2 pb-4">
        <div className="hover-pop-btn inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#075E54]/40 border border-[#25D366]/40 p-2 mb-3 shadow-xl shadow-black/50 text-[#25D366]">
          <span className="text-3xl">📱</span>
        </div>
        <h1 className="brand-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#E8E9F2] mb-2">
          <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#ffe088]">
            Nagarik AI WhatsApp Bot
          </span>
          <span className="text-[#8F93B5] font-sans text-xl ml-2 font-normal">
            (नागरिक AI व्हाट्सएप)
          </span>
        </h1>
        <p className="text-sm text-[#8F93B5] max-w-3xl mx-auto leading-relaxed">
          Sovereign, lightweight civic intelligence accessible to every citizen on WhatsApp. Zero application download required. Full multi-lingual voice notes, photo proof ingestion, and verified <strong className="text-[#E8E9F2]">.gov.in</strong> citations.
        </p>

        {/* Live Status Indicators */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#005c4b]/30 border border-[#25D366]/40 text-[#25D366]">
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
            Meta Cloud API Ready
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#128C7E]/20 border border-[#128C7E]/40 text-[#53bdeb]">
            <span className="w-2 h-2 rounded-full bg-[#53bdeb]"></span>
            Twilio TwiML Webhook Live
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2F3558]/50 border border-[rgba(240,106,37,0.3)] text-[#ffb692]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F06A25]" />
            UIDAI PII Masked
          </span>
        </div>
      </div>

      {/* Main Grid: Phone Simulator on Left, Controls & Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================================================ */}
        {/* LEFT COLUMN: INTERACTIVE WHATSAPP PHONE MOCKUP               */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-[420px] rounded-[44px] p-3.5 bg-gradient-to-b from-[#2a3942] to-[#111b21] shadow-2xl shadow-black/90 border-4 border-[#374248] relative">
            
            {/* Phone Top Notch / Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-[#0b141a] rounded-full z-30 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1f2c34] mr-2"></div>
              <div className="w-2 h-2 rounded-full bg-[#075E54]"></div>
            </div>

            {/* Screen Inner Frame */}
            <div className="w-full h-[660px] rounded-[36px] bg-[#0b141a] overflow-hidden flex flex-col relative border border-[rgba(255,255,255,0.06)]">
              
              {/* WhatsApp Header Bar */}
              <div className="bg-[#1f2c34] text-white px-3.5 pt-7 pb-3 flex items-center justify-between shadow-md z-20 border-b border-[#2a3942]">
                <div className="flex items-center gap-2.5">
                  <button className="text-[#aebac1] hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-[#111b21] border border-[#25D366] p-0.5 overflow-hidden flex items-center justify-center">
                      <img src="/logo_emblem.png" alt="Nagarik AI" className="w-full h-full object-cover rounded-full" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25D366] rounded-full border-2 border-[#1f2c34]"></span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs text-[#e9edef] tracking-tight">Nagarik AI</span>
                      <span className="text-[10px] text-[#25D366] font-bold">✓</span>
                    </div>
                    <span className="text-[10px] text-[#25D366] font-medium leading-none">
                      {isLoading ? 'typing...' : 'Official Civic Copilot • Online'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[#aebac1]">
                  <Video className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                  <Phone className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                  <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
                </div>
              </div>

              {/* Chat Messages Scrolling Canvas */}
              <div 
                className="flex-1 overflow-y-auto p-3.5 space-y-3 relative scrollbar-thin scrollbar-thumb-[#374248]"
                style={{
                  backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }}
              >
                {/* Security & Gazette Watermark */}
                <div className="flex justify-center my-1">
                  <span className="px-3 py-1 rounded-lg bg-[#182229] border border-[rgba(255,255,255,0.06)] text-[9px] text-[#8696a0] font-medium text-center shadow-sm max-w-[90%]">
                    🔒 Messages are end-to-end encrypted & verified against sovereign .gov.in gazettes.
                  </span>
                </div>

                {/* Messages List */}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs shadow-md leading-relaxed whitespace-pre-wrap break-words ${
                        msg.sender === 'user'
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                          : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[rgba(255,255,255,0.06)]'
                      }`}
                    >
                      {/* Bot Verified Header Badge */}
                      {msg.sender === 'bot' && (
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[rgba(255,255,255,0.08)] text-[10px]">
                          <span className="font-bold text-[#25D366] flex items-center gap-1">
                            <span>🏛️</span> Nagarik AI Official
                          </span>
                          <span className="text-[#8696a0] font-mono text-[9px]">Gazette Grounded</span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className="font-sans text-[12.5px] leading-relaxed">
                        {msg.text}
                      </div>

                      {/* Timestamp & Sent/Delivered Checkmarks */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-[#8696a0]">
                        <span>{msg.time}</span>
                        {msg.sender === 'user' && (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                        )}
                      </div>
                    </div>

                    {/* Quick-Reply Action Chips below Bot Bubbles */}
                    {msg.sender === 'bot' && msg.suggestedReplies && msg.suggestedReplies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                        {msg.suggestedReplies.map((reply) => (
                          <button
                            key={reply.id}
                            onClick={() => handleSendMessage(reply.query)}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded-full bg-[#1f2c34] hover:bg-[#005c4b] text-[#25D366] hover:text-white border border-[#25D366]/40 text-[10.5px] font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                          >
                            ⚡ {reply.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading / Typing Indicator */}
                {isLoading && (
                  <div className="flex items-start">
                    <div className="bg-[#202c33] rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs text-[#8696a0] flex items-center gap-2 border border-[rgba(255,255,255,0.06)] shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-bounce [animation-delay:0.4s]"></span>
                      <span className="text-[11px] text-[#aebac1] ml-1 font-medium">Verifying 5,210 schemes...</span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Input Action Bar */}
              <div className="bg-[#1f2c34] p-2.5 flex items-center gap-2 border-t border-[#2a3942] z-20">
                {/* Simulated Attachments / Voice Notes */}
                <button
                  onClick={() => handleSendMessage('', 'image')}
                  title="Simulate Photo Grievance"
                  disabled={isLoading}
                  className="p-1.5 text-[#8696a0] hover:text-[#25D366] hover:bg-[#2a3942] rounded-full transition-colors disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendMessage('', 'audio')}
                  title="Simulate Voice Note (Telugu/Hindi)"
                  disabled={isLoading}
                  className="p-1.5 text-[#8696a0] hover:text-[#25D366] hover:bg-[#2a3942] rounded-full transition-colors disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                  placeholder="Type a message or scheme name..."
                  className="flex-1 bg-[#2a3942] text-[#e9edef] placeholder-[#8696a0] text-xs px-3.5 py-2 rounded-2xl outline-none border border-transparent focus:border-[#25D366]/40 transition-colors"
                />

                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#25D366] text-[#0b141a] flex items-center justify-center transition-all disabled:opacity-40 disabled:hover:bg-[#00a884]"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT COLUMN: TESTING CONTROLS & GATEWAY TELEMETRY           */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* 1. Quick Citizen Test Scenarios */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h3 className="font-black text-sm text-[#E8E9F2]">1-Click Citizen Test Scenarios</h3>
              </div>
              <span className="text-[10px] font-mono text-[#F06A25] font-bold bg-[#F06A25]/10 px-2 py-0.5 rounded">
                SIMULATION SUITE
              </span>
            </div>

            <p className="text-xs text-[#8F93B5]">
              Tap any button to dispatch an authentic test inquiry through the simulation engine:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => handleSendMessage('1')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[rgba(255,255,255,0.08)] hover:border-[#25D366]/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#E8E9F2] group-hover:text-[#25D366]">
                    🏦 Aadhaar DBT Seeding
                  </span>
                  <span className="text-[10px] font-mono text-[#8F93B5]">Code: 1</span>
                </div>
                <p className="text-[11px] text-[#8F93B5] line-clamp-2">
                  Verify active NPCI mapper bank account for subsidy transfer.
                </p>
              </button>

              <button
                onClick={() => handleSendMessage('2')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[rgba(255,255,255,0.08)] hover:border-[#25D366]/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#E8E9F2] group-hover:text-[#25D366]">
                    🌾 PM-KISAN & Rythu
                  </span>
                  <span className="text-[10px] font-mono text-[#8F93B5]">Code: 2</span>
                </div>
                <p className="text-[11px] text-[#8F93B5] line-clamp-2">
                  ₹6,000 annual installment eligibility for small farmers.
                </p>
              </button>

              <button
                onClick={() => handleSendMessage('3')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[rgba(255,255,255,0.08)] hover:border-[#25D366]/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#E8E9F2] group-hover:text-[#25D366]">
                    🛡️ Civic Grievance
                  </span>
                  <span className="text-[10px] font-mono text-[#8F93B5]">Code: 3</span>
                </div>
                <p className="text-[11px] text-[#8F93B5] line-clamp-2">
                  CPGRAMS & municipal road/water redressal procedures.
                </p>
              </button>

              <button
                onClick={() => handleSendMessage('4')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[rgba(255,255,255,0.08)] hover:border-[#25D366]/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#E8E9F2] group-hover:text-[#25D366]">
                    🏥 Ayushman Bharat
                  </span>
                  <span className="text-[10px] font-mono text-[#8F93B5]">Code: 4</span>
                </div>
                <p className="text-[11px] text-[#8F93B5] line-clamp-2">
                  ₹5 Lakh free health cover & 70+ senior citizen eligibility.
                </p>
              </button>

              <button
                onClick={() => handleSendMessage('', 'audio')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[#25D366]/30 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#25D366] flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" /> Voice Note (Telugu)
                  </span>
                  <span className="text-[9px] bg-[#25D366]/10 text-[#25D366] px-1.5 py-0.5 rounded">
                    Audio Note
                  </span>
                </div>
                <p className="text-[11px] text-[#8F93B5]">
                  Simulates citizen recording speech query in native language.
                </p>
              </button>

              <button
                onClick={() => handleSendMessage('', 'image')}
                disabled={isLoading}
                className="p-3 rounded-xl bg-[#131622] hover:bg-[#1a1f33] border border-[#F06A25]/30 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-[#ffb692] flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Photo Proof
                  </span>
                  <span className="text-[9px] bg-[#F06A25]/10 text-[#ffb692] px-1.5 py-0.5 rounded">
                    Visual Proof
                  </span>
                </div>
                <p className="text-[11px] text-[#8F93B5]">
                  Simulates citizen sending photo of broken municipal road.
                </p>
              </button>
            </div>

            {/* Simulated Phone Number & Language Switch Bar */}
            <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8F93B5]">Phone:</span>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="bg-[#101322] border border-[rgba(255,255,255,0.1)] rounded px-2 py-0.5 text-xs text-[#E8E9F2] font-mono w-36"
                  placeholder="+91 95539 48740"
                />
                <a
                  href={`https://wa.me/919553948740?text=Hi%20Nagarik%20AI,%20I%20want%20to%20check%20Aadhaar%20DBT%20and%20welfare%20schemes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366] hover:text-[#0B0C1E] transition-all"
                  title="Open real chat with 9553948740 on WhatsApp"
                >
                  <ExternalLink className="w-3 h-3" /> wa.me
                </a>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[#8F93B5] flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-[#F06A25]" /> Lang:
                </span>
                <div className="flex items-center gap-1 bg-[#101322] p-1 rounded-lg border border-[rgba(255,255,255,0.08)]">
                  <button
                    onClick={() => onLanguageChange('en')}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      currentLanguage === 'en' ? 'bg-[#25D366] text-[#0B0C1E]' : 'text-[#8F93B5] hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => onLanguageChange('hi')}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      currentLanguage === 'hi' ? 'bg-[#25D366] text-[#0B0C1E]' : 'text-[#8F93B5] hover:text-white'
                    }`}
                  >
                    हिंदी
                  </button>
                  <button
                    onClick={() => onLanguageChange('te')}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      currentLanguage === 'te' ? 'bg-[#25D366] text-[#0B0C1E]' : 'text-[#8F93B5] hover:text-white'
                    }`}
                  >
                    తెలుగు
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Technical Gateway Inspector */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#53bdeb]" />
                <h3 className="font-black text-sm text-[#E8E9F2]">Live Gateway Telemetry & Citations</h3>
              </div>
              <div className="flex items-center gap-1 bg-[#101322] p-0.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-[11px]">
                <button
                  onClick={() => setActiveTabInspector('citations')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTabInspector === 'citations' ? 'bg-[#2F3558] text-[#ffb692]' : 'text-[#8F93B5] hover:text-white'
                  }`}
                >
                  Citations ({latestBotMsg?.citations?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTabInspector('twiml')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTabInspector === 'twiml' ? 'bg-[#2F3558] text-[#ffb692]' : 'text-[#8F93B5] hover:text-white'
                  }`}
                >
                  TwiML XML
                </button>
                <button
                  onClick={() => setActiveTabInspector('meta')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTabInspector === 'meta' ? 'bg-[#2F3558] text-[#ffb692]' : 'text-[#8F93B5] hover:text-white'
                  }`}
                >
                  Meta JSON
                </button>
                <button
                  onClick={() => setActiveTabInspector('webhook')}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    activeTabInspector === 'webhook' ? 'bg-[#2F3558] text-[#ffb692]' : 'text-[#8F93B5] hover:text-white'
                  }`}
                >
                  Endpoints
                </button>
              </div>
            </div>

            {/* Citations Tab */}
            {activeTabInspector === 'citations' && (
              <div className="space-y-2.5">
                {latestBotMsg?.citations && latestBotMsg.citations.length > 0 ? (
                  latestBotMsg.citations.map((c, idx) => (
                    <div
                      key={c.id || idx}
                      className="p-3 rounded-xl bg-[#131622] border border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-[#E8E9F2] flex items-center gap-1.5">
                          <span className="text-[#25D366]">🏛️</span> {c.name}
                        </span>
                        <span className="text-[11px] text-[#8F93B5] mt-0.5">{c.department}</span>
                      </div>
                      <a
                        href={c.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-slate-action px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 text-[#ffb692]"
                      >
                        <span>Open Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-xl bg-[#131622] text-center text-xs text-[#8F93B5]">
                    No external citations attached to the latest response.
                  </div>
                )}
              </div>
            )}

            {/* TwiML XML Tab */}
            {activeTabInspector === 'twiml' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#8F93B5]">
                  <span>Twilio Inbound Webhook Response (application/xml)</span>
                  <button
                    onClick={() => handleCopy(latestBotMsg?.twiml || '')}
                    className="hover:text-white flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#25D366]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy TwiML'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#0c0e14] border border-[rgba(255,255,255,0.08)] text-[11px] font-mono text-[#53bdeb] overflow-x-auto max-h-48 leading-relaxed">
                  {latestBotMsg?.twiml || '<!-- No TwiML generated yet -->'}
                </pre>
              </div>
            )}

            {/* Meta JSON Tab */}
            {activeTabInspector === 'meta' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#8F93B5]">
                  <span>Meta Cloud API Interactive JSON Payload</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(latestBotMsg?.metaPayload, null, 2))}
                    className="hover:text-white flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#25D366]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-3.5 rounded-xl bg-[#0c0e14] border border-[rgba(255,255,255,0.08)] text-[11px] font-mono text-[#ffb692] overflow-x-auto max-h-48 leading-relaxed">
                  {JSON.stringify(latestBotMsg?.metaPayload || { status: 'idle' }, null, 2)}
                </pre>
              </div>
            )}

            {/* Endpoints & Deployment Tab */}
            {activeTabInspector === 'webhook' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#131622] border border-[rgba(255,255,255,0.08)] space-y-1.5">
                  <div className="font-bold text-[#E8E9F2]">1. Inbound Webhook Endpoint</div>
                  <code className="block p-2 rounded bg-[#0c0e14] text-[#25D366] font-mono text-[11px]">
                    POST /api/v1/whatsapp/webhook
                  </code>
                  <p className="text-[11px] text-[#8F93B5]">
                    Supports Twilio form-encoded parameters and Meta Cloud API JSON envelopes automatically.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#131622] border border-[rgba(255,255,255,0.08)] space-y-1.5">
                  <div className="font-bold text-[#E8E9F2]">2. Meta Verification Challenge</div>
                  <code className="block p-2 rounded bg-[#0c0e14] text-[#53bdeb] font-mono text-[11px]">
                    GET /api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nagarik_ai_secure_token
                  </code>
                  <p className="text-[11px] text-[#8F93B5]">
                    Responds with <code className="text-[#E8E9F2]">hub.challenge</code> integer for zero-hassle Meta Developer App approval.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#131622] border border-[rgba(255,255,255,0.08)] space-y-1.5">
                  <div className="font-bold text-[#E8E9F2]">3. Interactive Simulator Endpoint</div>
                  <code className="block p-2 rounded bg-[#0c0e14] text-[#ffb692] font-mono text-[11px]">
                    POST /api/v1/whatsapp/simulate
                  </code>
                  <p className="text-[11px] text-[#8F93B5]">
                    Powers this frontend phone mockup with multi-lingual reasoning and quick action replies.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
