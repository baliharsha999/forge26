import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, Search, Mic, MicOff, RefreshCw, ExternalLink, 
  Sparkles, Bot, User, FileCheck, ShieldAlert, Activity,
  AlertCircle, Copy, Download, X, Check, FastForward, Info
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'grievance' | 'schemes' | 'factcheck' | 'ledger'>('grievance');
  
  // Grievance State
  const [rawInput, setRawInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  
  // Citizen Details (Editable)
  const [citizenName, setCitizenName] = useState('Ananya Rao');
  const [citizenPhone, setCitizenPhone] = useState('9876543210');
  const [citizenDistrict, setCitizenDistrict] = useState('Hyderabad');
  const [citizenLocality, setCitizenLocality] = useState('Banjara Hills Road No 12');
  
  // Submission & Telemetry
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  
  // Schemes State
  const [schemes, setSchemes] = useState<any[]>([]);
  const [schemeCategory, setSchemeCategory] = useState('all');
  const [schemeQuery, setSchemeQuery] = useState('');
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  
  // Fact Check State
  const [claimText, setClaimText] = useState('');
  const [factResult, setFactResult] = useState<any>(null);
  const [checkingFact, setCheckingFact] = useState(false);
  
  // Ledger & Overdue Simulation State
  const [grievancesList, setGrievancesList] = useState<any[]>([]);
  const [simulatedDays, setSimulatedDays] = useState<{ [id: string]: number }>({});
  
  // Escalation Modal State
  const [selectedEscalation, setSelectedEscalation] = useState<any>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Load initial schemes and ledger
  useEffect(() => {
    fetchSchemes('all', '');
    fetchLedger();
  }, []);

  const fetchSchemes = async (cat: string, q: string) => {
    setLoadingSchemes(true);
    try {
      const res = await axios.get(`${API_BASE}/schemes`, {
        params: { category: cat, query: q }
      });
      setSchemes(res.data);
    } catch (err) {
      console.error('Error fetching schemes:', err);
    } finally {
      setLoadingSchemes(false);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await axios.get(`${API_BASE}/grievance/list`);
      setGrievancesList(res.data);
    } catch (err) {
      console.error('Error fetching ledger:', err);
    }
  };

  // Voice Recognition Handler
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use typed input.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'te' ? 'te-IN' : (language === 'hi' ? 'hi-IN' : 'en-IN');

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setRawInput(prev => (prev ? prev + ' ' + transcript : transcript));
    };

    recognition.start();
  };

  // Analyze Grievance
  const handleAnalyze = async () => {
    if (!rawInput.trim()) return;
    setAnalyzing(true);
    setSubmissionResult(null);
    setPrivacyWarning(null);

    try {
      const res = await axios.post(`${API_BASE}/grievance/analyze`, {
        raw_input: rawInput,
        language: language,
        location: `${citizenLocality}, ${citizenDistrict}`
      });
      setAnalysisResult(res.data);
      if (res.data.privacy_warning) {
        setPrivacyWarning(res.data.privacy_warning);
      }
    } catch (err) {
      alert('Error analyzing grievance. Ensure backend is running.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Submit Grievance via Deterministic Playwright Script
  const handleSubmitGrievance = async () => {
    if (!analysisResult) return;
    setSubmitting(true);
    setTelemetryLogs(["[Nagarik AI] Initializing Deterministic Playwright Agent..."]);

    try {
      const payload = {
        citizen: {
          name: citizenName,
          phone: citizenPhone,
          state: "Telangana",
          district: citizenDistrict,
          locality: citizenLocality
        },
        department: analysisResult.department,
        category: analysisResult.category,
        urgency_level: analysisResult.urgency_level,
        title: analysisResult.description.slice(0, 80),
        description: analysisResult.description,
        location: analysisResult.location_text || citizenLocality,
        user_confirmed: true
      };

      const res = await axios.post(`${API_BASE}/grievance/submit`, payload);
      setSubmissionResult(res.data);
      setTelemetryLogs(res.data.browser_agent_telemetry || []);
      fetchLedger();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to submit grievance via agent.';
      alert(detail);
    } finally {
      setSubmitting(false);
    }
  };

  // Fact Check Verification (3 Outcomes)
  const handleFactCheck = async (claim?: string) => {
    const textToCheck = claim || claimText;
    if (!textToCheck.trim()) return;
    setCheckingFact(true);
    try {
      const res = await axios.post(`${API_BASE}/fact-check`, { claim: textToCheck });
      setFactResult(res.data);
    } catch (err) {
      alert('Failed to verify claim against official dataset.');
    } finally {
      setCheckingFact(false);
    }
  };

  // Simulate 15 Days Later
  const handleSimulateOverdue = async (trackingId: string) => {
    const newDays = (simulatedDays[trackingId] || 0) + 15;
    setSimulatedDays(prev => ({ ...prev, [trackingId]: newDays }));
    
    try {
      await axios.post('http://localhost:8000/portal/admin/toggle-status', {
        tracking_id: trackingId,
        status: 'Overdue'
      });
      fetchLedger();
    } catch (err) {
      console.error(err);
    }
  };

  // Generate Escalation Draft
  const handleOpenEscalation = async (trackingId: string, type: 'reminder' | 'appeal' | 'rti') => {
    try {
      const days = simulatedDays[trackingId] || 16;
      const res = await axios.post(`${API_BASE}/escalate`, {
        tracking_id: trackingId,
        escalation_type: type,
        days_elapsed: days
      });
      setSelectedEscalation(res.data);
    } catch (err) {
      alert('Failed to draft statutory escalation.');
    }
  };

  // Copy Draft to Clipboard
  const handleCopyDraft = () => {
    if (selectedEscalation) {
      navigator.clipboard.writeText(selectedEscalation.letter_body);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    }
  };

  // Download Draft as Text File
  const handleDownloadDraft = () => {
    if (selectedEscalation) {
      const element = document.createElement("a");
      const file = new Blob([selectedEscalation.letter_body], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = `${selectedEscalation.escalation_type}_${selectedEscalation.tracking_id}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="min-h-screen text-[#E8E9F2] relative overflow-hidden">
      
      {/* Floating Ambient Glowing Orbs for VisionOS Glass Refraction */}
      <div className="web-ambient-container" aria-hidden="true">
        <div className="ambient-orb-web orb-saffron-web"></div>
        <div className="ambient-orb-web orb-indigo-web"></div>
        <div className="ambient-orb-web orb-cyan-web"></div>
      </div>

      {/* Top Civic Navigation & Brand Header */}
      <header className="sticky top-0 z-40 bg-[rgba(11,14,27,0.8)] backdrop-blur-[28px] border-b border-[rgba(255,255,255,0.08)] shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group cursor-pointer">
              <div className="mandala-aura-ring"></div>
              <img 
                src="/logo_emblem.png" 
                alt="Nagarik AI Emblem" 
                className="w-11 h-11 rounded-full object-cover relative z-10 border-2 border-[#B8643A] shadow-[0_0_20px_rgba(240,106,37,0.45)] transition-transform duration-500 group-hover:rotate-45"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-black text-xl tracking-tight text-[#E8E9F2] flex items-center gap-1.5">
                  <span>Nagarik</span>
                  <span className="text-xs bg-gradient-to-r from-[#F06A25] to-[#D95315] text-[#0B0C1E] border border-[#B8643A] font-black px-2 py-0.5 rounded-md shadow-[0_2px_8px_rgba(240,106,37,0.4)]">
                    AI
                  </span>
                </h1>
                <span className="text-[10px] bg-[rgba(240,106,37,0.15)] text-[#E58C5C] border border-[rgba(240,106,37,0.35)] font-bold px-2 py-0.5 rounded-full">
                  BUILDATHON 2026
                </span>
              </div>
              <p className="text-xs text-[#8F93B5] font-medium tracking-wide">
                Empowering Every Citizen • Multimodal Civic Copilot & Scheme Navigator
              </p>
            </div>
          </div>

          {/* Quick External Actions */}
          <div className="flex items-center space-x-3">
            <a
              href="http://localhost:8000/portal"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[rgba(31,37,63,0.6)] text-[#E8E9F2] border border-[rgba(255,255,255,0.15)] hover:bg-[#2F3558] transition-all hover:scale-[1.02] shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
            >
              <span>🏛️ Mock Municipal Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#E58C5C]" />
            </a>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[rgba(12,38,30,0.7)] text-[#34d399] border border-[rgba(52,211,153,0.3)] shadow-[0_4px_14px_rgba(5,150,105,0.2)]">
              <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse"></span>
              API Setu + Hand-Verified Store
            </span>
          </div>
        </div>

        {/* VisionOS Frosted Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1.5 border-t border-[rgba(255,255,255,0.06)] overflow-x-auto">
          {[
            { id: 'grievance', label: '1. Citizen Intake & Confirm', icon: Bot },
            { id: 'schemes', label: '2. Schemes (API Setu / Verified)', icon: FileCheck },
            { id: 'factcheck', label: '3. 3-Outcome Claim Verifier', icon: ShieldCheck },
            { id: 'ledger', label: '4. Tracking & Escalation Studio', icon: Activity },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-3 px-4 text-xs font-bold transition-all relative border-b-2 whitespace-nowrap ${
                  active 
                    ? 'border-[#F06A25] text-[#E8E9F2] bg-[rgba(240,106,37,0.12)]' 
                    : 'border-transparent text-[#8F93B5] hover:text-[#E8E9F2] hover:bg-[rgba(31,37,63,0.3)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#F06A25]' : 'text-[#8F93B5]'}`} />
                <span>{tab.label}</span>
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F06A25] via-[#E58C5C] to-[#F06A25] shadow-[0_0_12px_#F06A25]"></span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        
        {/* ============================================================ */}
        {/* TAB 1: CITIZEN INTAKE & EXPLICIT CONFIRMATION                 */}
        {/* ============================================================ */}
        {activeTab === 'grievance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Multimodal Intake */}
            <div className="lg:col-span-6 space-y-6">
              <div className="glass-panel p-6">
                
                {/* Header & Language Selector */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="text-base font-black text-[#E8E9F2] flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#F06A25]" />
                    Multimodal Complaint Intake
                  </h2>
                  <div className="flex gap-1 bg-[rgba(11,14,27,0.8)] p-1 rounded-xl border border-[rgba(255,255,255,0.1)] text-xs">
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'hi', label: 'हिंदी' },
                      { code: 'te', label: 'తెలుగు' }
                    ].map(l => (
                      <button
                        key={l.code}
                        onClick={() => setLanguage(l.code)}
                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                          language === l.code 
                            ? 'bg-gradient-to-r from-[#F06A25] to-[#D95315] text-[#0B0C1E] shadow-[0_2px_8px_rgba(240,106,37,0.4)]' 
                            : 'text-[#8F93B5] hover:text-[#E8E9F2]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privacy Warning Banner */}
                {privacyWarning && (
                  <div className="mb-4 p-3.5 bg-[rgba(46,26,12,0.85)] border-t-[1.5px] border-t-[rgba(240,106,37,0.6)] border-x border-b border-[rgba(240,106,37,0.3)] rounded-xl text-xs text-[#ffedd5] flex items-start gap-2.5 shadow-[0_8px_20px_rgba(240,106,37,0.18)]">
                    <AlertCircle className="w-4 h-4 text-[#F06A25] shrink-0 mt-0.5" />
                    <div>{privacyWarning}</div>
                  </div>
                )}

                {/* Textarea with Speech Mic */}
                <div className="relative mb-4">
                  <textarea
                    rows={4}
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    placeholder={
                      language === 'te' 
                        ? 'మా వీధిలో డ్రైనేజ్ లైన్ పగిలి నీళ్లు రోడ్డు మీద పారుతున్నాయి...' 
                        : (language === 'hi' 
                            ? 'हमारे मोहल्ले में ट्रांसफार्मर में स्पार्क हो रहा है और बिजली बार-बार जा रही है...' 
                            : 'Speak or type your civic issue. Click the mic button to speak in Hindi, Telugu or English...')
                    }
                    className="w-full p-4 pr-14 text-sm glass-input leading-relaxed resize-none"
                  />
                  
                  {/* Floating Apple-Grade Voice Mic */}
                  <button
                    onClick={toggleSpeechRecognition}
                    title="Speak in your regional language"
                    className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${
                      isRecording 
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white animate-pulse border border-red-400' 
                        : 'bg-[rgba(31,37,63,0.85)] text-[#E8E9F2] hover:bg-[#2F3558] border border-[rgba(255,255,255,0.15)]'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-[#E58C5C]" />}
                  </button>
                </div>

                {/* Quick Test Incident Chips */}
                <div className="mb-5">
                  <span className="text-xs text-[#8F93B5] font-bold block mb-2">⚡ Test with sample civic problems:</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button 
                      onClick={() => setRawInput("Massive dangerous crater pothole near Pillar 42 Kukatpally, waterlogged after rain and two-wheelers slipping")}
                      className="btn-slate-action px-3 py-1.5 rounded-lg text-xs"
                    >
                      🚧 Dangerous Roadway Pothole
                    </button>
                    <button 
                      onClick={() => setRawInput("Contaminated drinking water with brown sludge coming through tap in Bhavanipuram Ward 12")}
                      className="btn-slate-action px-3 py-1.5 rounded-lg text-xs"
                    >
                      🚰 Water Supply Contamination
                    </button>
                    <button 
                      onClick={() => setRawInput("High voltage transformer sparking continuously near street corner, severe fire risk")}
                      className="btn-slate-action px-3 py-1.5 rounded-lg text-xs"
                    >
                      ⚡ Transformer Fire Hazard
                    </button>
                  </div>
                </div>

                {/* Citizen Details (Optional) */}
                <div className="bg-[rgba(14,18,34,0.7)] p-4 rounded-2xl border-t-[1.5px] border-t-[rgba(255,255,255,0.18)] border-x border-b border-[rgba(255,255,255,0.06)] mb-5 shadow-inner">
                  <div className="text-xs font-bold text-[#E58C5C] uppercase tracking-wider mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Citizen Info (Optional)</span>
                    <span className="text-[10px] text-[#8F93B5] font-medium">No Aadhaar or ID required</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[#8F93B5] block mb-1 font-semibold">Name</label>
                      <input 
                        type="text" 
                        value={citizenName} 
                        onChange={e => setCitizenName(e.target.value)} 
                        className="w-full p-2 glass-input font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[#8F93B5] block mb-1 font-semibold">Mobile</label>
                      <input 
                        type="text" 
                        value={citizenPhone} 
                        onChange={e => setCitizenPhone(e.target.value)} 
                        className="w-full p-2 glass-input font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[#8F93B5] block mb-1 font-semibold">District</label>
                      <input 
                        type="text" 
                        value={citizenDistrict} 
                        onChange={e => setCitizenDistrict(e.target.value)} 
                        className="w-full p-2 glass-input font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[#8F93B5] block mb-1 font-semibold">Locality / Ward</label>
                      <input 
                        type="text" 
                        value={citizenLocality} 
                        onChange={e => setCitizenLocality(e.target.value)} 
                        className="w-full p-2 glass-input font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Synthesize Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !rawInput.trim()}
                  className="w-full py-3.5 btn-primary-orange text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#0B0C1E]" />
                      <span>Parsing Multimodal JSON...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#0B0C1E]" />
                      <span>Synthesize Structured Complaint</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Review, Explicit Confirmation & Playwright Telemetry */}
            <div className="lg:col-span-6 space-y-6">
              {analysisResult ? (
                <div className="glass-panel p-6">
                  
                  {/* Step Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-[rgba(255,255,255,0.08)] mb-4">
                    <div>
                      <span className="text-xs uppercase font-black text-[#F06A25] tracking-wider">
                        Review & Confirm Before Filing
                      </span>
                      <h3 className="font-black text-[#E8E9F2] text-base mt-0.5">{analysisResult.category}</h3>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-black shadow-sm ${
                        analysisResult.urgency_level === 'HIGH' 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        Urgency: {analysisResult.urgency_score}/10 ({analysisResult.urgency_level})
                      </span>
                    </div>
                  </div>

                  {/* Follow-up question if fields missing */}
                  {analysisResult.follow_up_prompt && (
                    <div className="mb-4 p-3.5 bg-[rgba(12,32,60,0.7)] border-t-[1.5px] border-t-[rgba(59,130,246,0.5)] border-x border-b border-[rgba(59,130,246,0.2)] rounded-xl text-xs text-[#bfdbfe] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#60a5fa] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-white mb-0.5">Follow-up Question:</span>
                        {analysisResult.follow_up_prompt}
                      </div>
                    </div>
                  )}

                  {/* Editable Complaint Form */}
                  <div className="space-y-3.5 mb-5 text-sm">
                    <div className="bg-[rgba(14,18,34,0.75)] p-3 rounded-xl border border-[rgba(255,255,255,0.08)]">
                      <span className="text-xs font-bold text-[#8F93B5] block mb-1">Target Department:</span>
                      <input 
                        type="text"
                        value={analysisResult.department}
                        onChange={e => setAnalysisResult({ ...analysisResult, department: e.target.value })}
                        className="w-full text-xs p-2 glass-input font-medium"
                      />
                    </div>

                    <div className="bg-[rgba(14,18,34,0.75)] p-3 rounded-xl border border-[rgba(255,255,255,0.08)]">
                      <span className="text-xs font-bold text-[#8F93B5] block mb-1">Incident Location:</span>
                      <input 
                        type="text"
                        value={analysisResult.location_text}
                        onChange={e => setAnalysisResult({ ...analysisResult, location_text: e.target.value })}
                        className="w-full text-xs p-2 glass-input font-medium"
                      />
                    </div>

                    <div className="bg-[rgba(14,24,48,0.75)] p-3.5 rounded-xl border border-[rgba(59,130,246,0.25)]">
                      <span className="text-xs font-bold text-[#93c5fd] block mb-1">Formal Petition Wording:</span>
                      <textarea
                        rows={3}
                        value={analysisResult.description}
                        onChange={e => setAnalysisResult({ ...analysisResult, description: e.target.value })}
                        className="w-full text-xs p-2.5 glass-input text-[#E8E9F2] leading-relaxed resize-none"
                      />
                    </div>

                    <div className="bg-[rgba(12,38,30,0.75)] p-3.5 rounded-xl border border-[rgba(52,211,153,0.3)] text-xs text-[#a7f3d0]">
                      <span className="font-black text-[#34d399] block mb-1 uppercase tracking-wider">
                        Statutory Act & Mandatory Remedy:
                      </span>
                      <div className="font-semibold text-[#ecfdf5]">{analysisResult.applicable_act_or_regulation}</div>
                      <div className="text-[11px] text-[#6ee7b7] mt-1">{analysisResult.actionable_remedy}</div>
                    </div>
                  </div>

                  {/* Mandatory Explicit Confirmation Button */}
                  {!submissionResult && (
                    <div className="space-y-3">
                      <div className="p-3 bg-[rgba(46,26,12,0.85)] rounded-xl text-xs text-[#ffedd5] border border-[rgba(240,106,37,0.4)]">
                        🔒 <strong>Safety Rule:</strong> No complaint is filed without your explicit confirmation. Review the details above and press Confirm to execute the Playwright filing script.
                      </div>
                      <button
                        onClick={handleSubmitGrievance}
                        disabled={submitting}
                        className="w-full py-4 btn-primary-orange text-sm flex items-center justify-center gap-2.5 disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-[#0B0C1E]" />
                            <span>Playwright script is filling Municipal Portal form...</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-5 h-5 text-[#0B0C1E]" />
                            <span>Confirm & File via Deterministic Playwright Script</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Receipt & Live Telemetry */}
                  {submissionResult && (
                    <div className="mt-5 space-y-4">
                      <div className="p-5 bg-gradient-to-br from-[#059669] to-[#047857] text-white rounded-2xl shadow-[0_12px_30px_rgba(5,150,105,0.4)] border-t-[1.5px] border-t-[rgba(255,255,255,0.4)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black uppercase tracking-wider opacity-90">Registration Acknowledged</span>
                          <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                            SLA: {submissionResult.estimated_sla_days} Days
                          </span>
                        </div>
                        <div className="text-2xl font-black font-mono tracking-tight my-1">{submissionResult.tracking_id}</div>
                        <div className="text-xs opacity-90">
                          Officer: {submissionResult.assigned_officer_designation}
                        </div>
                        <div className="text-[10px] font-mono opacity-80 mt-2 break-all bg-black/20 p-2 rounded-lg">
                          Seal: {submissionResult.verification_hash}
                        </div>
                      </div>

                      <div className="bg-[rgba(11,14,27,0.92)] p-4 rounded-xl text-xs font-mono text-[#E8E9F2] space-y-2 max-h-48 overflow-y-auto border border-[rgba(255,255,255,0.08)] shadow-inner">
                        <div className="text-[#F06A25] font-black pb-1.5 border-b border-[rgba(255,255,255,0.08)] flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#F06A25]" />
                          <span>Deterministic Playwright DOM Telemetry:</span>
                        </div>
                        {telemetryLogs.map((log, idx) => (
                          <div key={idx} className="leading-relaxed text-[#8F93B5]">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-panel p-8 text-center flex flex-col items-center justify-center min-h-[380px]">
                  <div className="relative mb-4">
                    <div className="mandala-aura-ring"></div>
                    <img 
                      src="/logo_emblem.png" 
                      alt="Nagarik AI Emblem" 
                      className="w-16 h-16 rounded-full object-cover relative z-10 border-2 border-[#B8643A] shadow-[0_0_24px_rgba(240,106,37,0.5)] animate-pulse"
                    />
                  </div>
                  <h3 className="font-black text-[#E8E9F2] text-base mb-1.5">Awaiting Citizen Speech or Text</h3>
                  <p className="text-xs text-[#8F93B5] max-w-sm leading-relaxed">
                    Enter your issue on the left. Nagarik AI will extract the department and location into strict JSON, show you the draft for confirmation, and dispatch via Playwright.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: SCHEME NAVIGATOR (API SETU / VERIFIED)                */}
        {/* ============================================================ */}
        {activeTab === 'schemes' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              
              {/* Header & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-black text-[#E8E9F2]">Government Schemes Discovery</h2>
                    <span className="text-[10px] font-black bg-[rgba(12,38,30,0.8)] text-[#34d399] border border-[rgba(52,211,153,0.35)] px-2.5 py-0.5 rounded-full">
                      Hand-Verified (myscheme.gov.in)
                    </span>
                  </div>
                  <p className="text-xs text-[#8F93B5] mt-1">15 curated welfare schemes verified against official guidelines with exact source text</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={schemeQuery}
                      onChange={e => {
                        setSchemeQuery(e.target.value);
                        fetchSchemes(schemeCategory, e.target.value);
                      }}
                      placeholder="Search schemes..."
                      className="pl-9 pr-4 py-2 text-xs glass-input w-64 font-medium"
                    />
                    <Search className="w-4 h-4 text-[#8F93B5] absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: 'all', label: 'All Schemes' },
                  { id: 'farmer', label: '🌾 Farmers' },
                  { id: 'student', label: '🎓 Students' },
                  { id: 'healthcare', label: '🏥 Healthcare' },
                  { id: 'women', label: '👩 Women' },
                  { id: 'msme', label: '💼 MSME & Loans' },
                  { id: 'senior', label: '👴 Senior Citizens' }
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSchemeCategory(c.id);
                      fetchSchemes(c.id, schemeQuery);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      schemeCategory === c.id 
                        ? 'bg-gradient-to-r from-[#F06A25] to-[#D95315] text-[#0B0C1E] shadow-[0_4px_14px_rgba(240,106,37,0.4)] border border-[#B8643A]' 
                        : 'btn-slate-action'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Schemes Cards Grid */}
              {loadingSchemes ? (
                <div className="py-16 text-center text-sm text-[#8F93B5] flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#F06A25]" />
                  <span>Loading verified government schemes...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {schemes.map(scheme => (
                    <div key={scheme.id} className="glass-panel p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[11px] font-black text-[#E58C5C] uppercase tracking-wider">
                            {scheme.level.toUpperCase()} SCHEME • {scheme.state}
                          </span>
                          <span className="text-[10px] bg-[rgba(31,37,63,0.7)] text-[#8F93B5] px-2 py-0.5 rounded font-mono border border-[rgba(255,255,255,0.08)]">
                            Verified: {scheme.last_verified_date}
                          </span>
                        </div>
                        <h4 className="font-black text-[#E8E9F2] text-base mb-2.5">{scheme.name}</h4>
                        
                        <div className="bg-[rgba(12,38,30,0.75)] border border-[rgba(52,211,153,0.3)] p-3 rounded-xl mb-3.5">
                          <span className="text-[10px] font-black text-[#34d399] uppercase tracking-wider block mb-0.5">Benefit:</span>
                          <span className="text-xs text-[#ecfdf5] font-semibold">{scheme.benefit}</span>
                        </div>

                        <div className="mb-3.5">
                          <span className="text-xs font-bold text-[#8F93B5] block mb-1.5">Key Eligibility:</span>
                          <ul className="text-xs text-[#E8E9F2] space-y-1.5 list-disc pl-4 leading-relaxed">
                            {scheme.eligibility_criteria.map((c: string, idx: number) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-3.5 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between">
                        <span className="text-[11px] text-[#8F93B5]">Source: myScheme.gov.in</span>
                        <a
                          href={scheme.official_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-black text-[#E58C5C] hover:text-[#F06A25] transition-colors"
                        >
                          Official Portal <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: 3-OUTCOME CLAIM VERIFIER                              */}
        {/* ============================================================ */}
        {activeTab === 'factcheck' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="glass-panel p-6">
              <div className="flex items-center gap-3.5 mb-5">
                <div className="p-3 bg-[rgba(220,38,38,0.2)] text-red-400 border border-red-500/30 rounded-2xl shadow-[0_4px_16px_rgba(220,38,38,0.3)]">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#E8E9F2]">3-Outcome Scheme Claim Checker</h2>
                  <p className="text-xs text-[#8F93B5] mt-0.5">Strictly evaluates claims as Matches, Contradicts, or Couldn't Verify with quoted source text</p>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                <textarea
                  rows={3}
                  value={claimText}
                  onChange={e => setClaimText(e.target.value)}
                  placeholder="Paste viral claim, e.g.: 'PM-KISAN gives farmers Rs 6,000 per year in three installments' or 'PM free laptop scheme'..."
                  className="w-full p-4 text-sm glass-input leading-relaxed resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-[#8F93B5] font-bold py-1">Quick check:</span>
                    <button
                      onClick={() => {
                        setClaimText("PM-KISAN gives farmers Rs 6,000 per year in three installments");
                        handleFactCheck("PM-KISAN gives farmers Rs 6,000 per year in three installments");
                      }}
                      className="btn-slate-action px-2.5 py-1 rounded-lg text-xs text-[#34d399]"
                    >
                      "PM-KISAN ₹6k" (Matches)
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Central Government giving free laptops to all students");
                        handleFactCheck("Central Government giving free laptops to all students");
                      }}
                      className="btn-slate-action px-2.5 py-1 rounded-lg text-xs text-red-400"
                    >
                      "Free Laptops" (Contradicts)
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Gram panchayat free bicycles for everyone");
                        handleFactCheck("Gram panchayat free bicycles for everyone");
                      }}
                      className="btn-slate-action px-2.5 py-1 rounded-lg text-xs text-[#8F93B5]"
                    >
                      "Free Bicycles" (Unverified)
                    </button>
                  </div>

                  <button
                    onClick={() => handleFactCheck()}
                    disabled={checkingFact || !claimText.trim()}
                    className="px-6 py-2.5 btn-primary-orange text-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {checkingFact ? <RefreshCw className="w-4 h-4 animate-spin text-[#0B0C1E]" /> : <Search className="w-4 h-4 text-[#0B0C1E]" />}
                    <span>Check Against Official Dataset</span>
                  </button>
                </div>
              </div>

              {/* 3-Outcome Result Display */}
              {factResult && (
                <div className="mt-8 border-t border-[rgba(255,255,255,0.08)] pt-6">
                  <div className={`p-5 rounded-2xl border-t-[1.5px] border-x border-b shadow-xl ${
                    factResult.outcome === 'matches'
                      ? 'bg-[rgba(12,38,30,0.85)] border-t-[rgba(52,211,153,0.6)] border-[rgba(52,211,153,0.3)] shadow-[0_12px_30px_rgba(5,150,105,0.25)]'
                      : (factResult.outcome === 'contradicts' 
                          ? 'bg-[rgba(48,16,16,0.85)] border-t-[rgba(239,68,68,0.6)] border-[rgba(239,68,68,0.3)] shadow-[0_12px_30px_rgba(220,38,38,0.25)]' 
                          : 'bg-[rgba(20,24,42,0.85)] border-t-[rgba(255,255,255,0.25)] border-[rgba(255,255,255,0.1)]')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          factResult.outcome === 'matches'
                            ? 'bg-[#059669] text-white shadow-[0_2px_10px_rgba(5,150,105,0.5)]'
                            : (factResult.outcome === 'contradicts' 
                                ? 'bg-[#dc2626] text-white shadow-[0_2px_10px_rgba(220,38,38,0.5)]' 
                                : 'bg-[#475569] text-white')
                        }`}>
                          {factResult.verdict}
                        </span>
                        <span className="text-xs text-[#8F93B5] font-mono">
                          Confidence: {factResult.truth_score}%
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#8F93B5]">
                        Verified Date: {factResult.last_verified_date}
                      </span>
                    </div>

                    <h4 className="font-black text-[#E8E9F2] text-base mb-2">Evaluation Summary:</h4>
                    <p className="text-sm text-[#E8E9F2] mb-4 leading-relaxed">{factResult.summary}</p>

                    {/* Exact Quoted Source Text */}
                    <div className="p-4 bg-[rgba(11,14,27,0.8)] rounded-xl border border-[rgba(255,255,255,0.08)] mb-4">
                      <span className="text-xs font-black text-[#E58C5C] block mb-1">Exact Quoted Official Source Text:</span>
                      <blockquote className="text-xs italic text-[#E8E9F2] border-l-4 border-[#F06A25] pl-3 py-1">
                        "{factResult.exact_source_text}"
                      </blockquote>
                    </div>

                    <div className="text-xs text-[#8F93B5] flex flex-wrap items-center justify-between gap-2">
                      <div>
                        Official Source URL:{' '}
                        <a href={factResult.official_source_url} target="_blank" rel="noreferrer" className="text-[#38bdf8] hover:underline font-semibold">
                          {factResult.official_source_url}
                        </a>
                      </div>
                      <div className="font-bold text-[#E8E9F2]">
                        Advice: {factResult.action_advice_for_citizens}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: TRACKING & ESCALATION STUDIO                          */}
        {/* ============================================================ */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="glass-panel p-6">
              
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-black text-[#E8E9F2]">Grievance Tracking & Escalation Studio</h2>
                  <p className="text-xs text-[#8F93B5] mt-0.5">Live database ledger with "Simulate 15 Days Later" demo control and RTI/Appeal generator</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <a
                    href="http://localhost:8000/portal/admin"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-slate-action px-3 py-1.5 text-xs font-bold flex items-center gap-1.5"
                  >
                    Operator Portal Console <ExternalLink className="w-3.5 h-3.5 text-[#E58C5C]" />
                  </a>
                  <button
                    onClick={fetchLedger}
                    className="btn-primary-orange px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,14,27,0.7)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[rgba(31,37,63,0.6)] text-[#8F93B5] uppercase font-black border-b border-[rgba(255,255,255,0.08)] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Tracking ID</th>
                      <th className="py-3.5 px-4">Citizen & Ward</th>
                      <th className="py-3.5 px-4">Department & Issue</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Days Elapsed</th>
                      <th className="py-3.5 px-4 text-center">Overdue Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(255,255,255,0.05)]">
                    {grievancesList.map(g => {
                      const days = (simulatedDays[g.tracking_id] || 0) + (g.status === 'Resolved' ? 2 : 4);
                      const isOverdue = days >= 15 || g.status === 'Overdue';

                      return (
                        <tr key={g.tracking_id} className="hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                          <td className="py-4 px-4 font-mono font-black text-[#E58C5C]">
                            {g.tracking_id}
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-[#E8E9F2]">{g.citizen_name}</div>
                            <div className="text-[#8F93B5] text-[11px]">{g.location}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-bold text-[#E8E9F2]">{g.department}</div>
                            <div className="text-[#8F93B5] text-[11px] truncate max-w-xs">{g.title}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                              isOverdue 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {isOverdue ? 'Overdue' : g.status}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono text-[#E8E9F2]">
                            {days} Days
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isOverdue && (
                                <button
                                  onClick={() => handleSimulateOverdue(g.tracking_id)}
                                  className="px-3 py-1 bg-[rgba(240,106,37,0.15)] hover:bg-[rgba(240,106,37,0.25)] text-[#E58C5C] border border-[rgba(240,106,37,0.35)] rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all"
                                >
                                  <FastForward className="w-3 h-3" /> +15 Days
                                </button>
                              )}
                              {isOverdue && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'reminder')}
                                    className="px-2.5 py-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg text-[10px] font-black shadow-md transition-all"
                                  >
                                    Reminder
                                  </button>
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'appeal')}
                                    className="px-2.5 py-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg text-[10px] font-black shadow-md transition-all"
                                  >
                                    1st Appeal
                                  </button>
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'rti')}
                                    className="px-2.5 py-1 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg text-[10px] font-black shadow-md transition-all"
                                  >
                                    RTI Draft
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* VisionOS Floating Escalation Letter Modal */}
      {selectedEscalation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-2xl w-full p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[rgba(255,255,255,0.08)] mb-4">
                <div>
                  <span className="text-xs font-black text-[#F06A25] uppercase tracking-wider">Statutory Escalation Document</span>
                  <h3 className="font-black text-[#E8E9F2] text-base mt-0.5">{selectedEscalation.subject_line}</h3>
                </div>
                <button onClick={() => setSelectedEscalation(null)} className="p-1.5 text-[#8F93B5] hover:text-white rounded-lg hover:bg-[rgba(255,255,255,0.08)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 text-xs text-[#8F93B5]">
                <span>Quoting Statute: <strong className="text-[#E8E9F2]">{selectedEscalation.statutory_act_quoted}</strong></span>
              </div>

              <textarea
                rows={11}
                value={selectedEscalation.letter_body}
                onChange={e => setSelectedEscalation({ ...selectedEscalation, letter_body: e.target.value })}
                className="w-full p-3.5 font-mono text-xs glass-input text-[#E8E9F2] leading-relaxed resize-none"
              />

              <div className="mt-3.5 p-3.5 bg-[rgba(46,26,12,0.85)] rounded-xl text-xs text-[#ffedd5] border border-[rgba(240,106,37,0.35)]">
                💡 <strong>Notice:</strong> {selectedEscalation.action_note} (Never auto-sent).
              </div>
            </div>

            <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-end gap-3 mt-4">
              <button
                onClick={handleCopyDraft}
                className="btn-slate-action px-4 py-2.5 text-xs font-bold flex items-center gap-2"
              >
                {copiedDraft ? <Check className="w-4 h-4 text-[#34d399]" /> : <Copy className="w-4 h-4" />}
                {copiedDraft ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handleDownloadDraft}
                className="btn-primary-orange px-4 py-2.5 text-xs flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download .txt Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.08)] bg-[rgba(11,14,27,0.7)] py-8 mt-16 text-center text-xs text-[#8F93B5]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-2">
            <img src="/logo_emblem.png" alt="Nagarik AI" className="w-5 h-5 rounded-full" />
            <span className="font-black text-sm text-[#E8E9F2]">Nagarik AI (नागरिक AI)</span>
            <span className="text-[#F06A25] font-bold">— "Empowering Every Citizen"</span>
          </div>
          <p className="font-semibold text-[#8F93B5] mb-1">Built for NxtWave Buildathon 2026</p>
          <p className="text-[11px] text-[#8F93B5]/80">Civic Pulse, Digital Governance & Public Information Track</p>
          <p className="mt-2 text-[11px] text-[#8F93B5]/60">Developed by @cyugandharreddy08, @baliharsha999 & @Raghavendra-Kasireddy</p>
        </div>
      </footer>
    </div>
  );
}
