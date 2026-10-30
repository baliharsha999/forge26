import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, Search, Mic, MicOff, RefreshCw, ExternalLink, 
  Sparkles, Bot, User, Landmark, FileCheck, ShieldAlert, Activity,
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
    setTelemetryLogs(["[JanSetu Lite] Initializing Deterministic Playwright Agent..."]);

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
    
    // Update status in backend mock portal operator database
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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      
      {/* Top Civic Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-amber-500 to-orange-600 p-2.5 rounded-xl shadow-lg">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-xl tracking-tight text-white">JanSetu Lite</h1>
                <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold px-2 py-0.5 rounded-full">
                  BUILDATHON 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">Multimodal Civic Complaint Agent & Scheme Navigator</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="http://localhost:8000/portal"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition"
            >
              <span>🏛️ Mock Municipal Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              API Setu + Hand-Verified Store
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-slate-800/80">
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
                className={`flex items-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-all ${
                  active 
                    ? 'border-amber-500 text-amber-400 bg-slate-800/50' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* TAB 1: CITIZEN INTAKE & EXPLICIT CONFIRMATION */}
        {activeTab === 'grievance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left: Input & Speech Recognition */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Multimodal Complaint Intake
                  </h2>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                    {[
                      { code: 'en', label: 'English' },
                      { code: 'hi', label: 'हिंदी' },
                      { code: 'te', label: 'తెలుగు' }
                    ].map(l => (
                      <button
                        key={l.code}
                        onClick={() => setLanguage(l.code)}
                        className={`px-2.5 py-1 rounded font-medium transition ${
                          language === l.code ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Privacy Warning Banner if triggered */}
                {privacyWarning && (
                  <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>{privacyWarning}</div>
                  </div>
                )}

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
                    className="w-full p-4 pr-12 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                  />
                  
                  {/* Voice Input Button */}
                  <button
                    onClick={toggleSpeechRecognition}
                    title="Speak in your regional language"
                    className={`absolute bottom-3 right-3 p-2.5 rounded-full shadow transition ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-700'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {/* Quick Test Incident Chips */}
                <div className="mb-4">
                  <span className="text-xs text-slate-500 font-medium block mb-1.5">⚡ Test with sample civic problems:</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button 
                      onClick={() => setRawInput("Massive dangerous crater pothole near Pillar 42 Kukatpally, waterlogged after rain and two-wheelers slipping")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      🚧 Dangerous Roadway Pothole
                    </button>
                    <button 
                      onClick={() => setRawInput("Contaminated drinking water with brown sludge coming through tap in Bhavanipuram Ward 12")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      🚰 Water Supply Contamination
                    </button>
                    <button 
                      onClick={() => setRawInput("High voltage transformer sparking continuously near street corner, severe fire risk")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      ⚡ Transformer Fire Hazard
                    </button>
                  </div>
                </div>

                {/* Citizen Details (Optional) */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Citizen Info (Optional)</span>
                    <span className="text-[10px] text-slate-400 font-normal">No Aadhaar or ID required</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-500 block mb-1">Name</label>
                      <input 
                        type="text" 
                        value={citizenName} 
                        onChange={e => setCitizenName(e.target.value)} 
                        className="w-full p-2 bg-white rounded border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">Mobile</label>
                      <input 
                        type="text" 
                        value={citizenPhone} 
                        onChange={e => setCitizenPhone(e.target.value)} 
                        className="w-full p-2 bg-white rounded border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">District</label>
                      <input 
                        type="text" 
                        value={citizenDistrict} 
                        onChange={e => setCitizenDistrict(e.target.value)} 
                        className="w-full p-2 bg-white rounded border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">Locality / Ward</label>
                      <input 
                        type="text" 
                        value={citizenLocality} 
                        onChange={e => setCitizenLocality(e.target.value)} 
                        className="w-full p-2 bg-white rounded border border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Synthesize Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !rawInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Parsing Multimodal JSON...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Synthesize Structured Complaint
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Confirmation Screen & Playwright Agent */}
            <div className="lg:col-span-6 space-y-6">
              {analysisResult ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  
                  {/* Step Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div>
                      <span className="text-xs uppercase font-bold text-amber-600">Review & Confirm Before Filing</span>
                      <h3 className="font-bold text-slate-900 text-base">{analysisResult.category}</h3>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        analysisResult.urgency_level === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        Urgency: {analysisResult.urgency_score}/10 ({analysisResult.urgency_level})
                      </span>
                    </div>
                  </div>

                  {/* Follow-up question if fields missing */}
                  {analysisResult.follow_up_prompt && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Follow-up Question:</span>
                        {analysisResult.follow_up_prompt}
                      </div>
                    </div>
                  )}

                  {/* Editable Complaint Form */}
                  <div className="space-y-3 mb-5 text-sm">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Target Department:</span>
                      <input 
                        type="text"
                        value={analysisResult.department}
                        onChange={e => setAnalysisResult({ ...analysisResult, department: e.target.value })}
                        className="w-full text-xs p-1.5 bg-white rounded border border-slate-300 font-medium"
                      />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-xs font-semibold text-slate-500 block mb-1">Incident Location:</span>
                      <input 
                        type="text"
                        value={analysisResult.location_text}
                        onChange={e => setAnalysisResult({ ...analysisResult, location_text: e.target.value })}
                        className="w-full text-xs p-1.5 bg-white rounded border border-slate-300 font-medium"
                      />
                    </div>

                    <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                      <span className="text-xs font-semibold text-blue-900 block mb-1">Formal Petition Wording:</span>
                      <textarea
                        rows={3}
                        value={analysisResult.description}
                        onChange={e => setAnalysisResult({ ...analysisResult, description: e.target.value })}
                        className="w-full text-xs p-2 bg-white rounded border border-blue-300 text-blue-950 font-normal"
                      />
                    </div>

                    <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                      <span className="font-semibold block mb-0.5">Statutory Act & Mandatory Remedy:</span>
                      <div>{analysisResult.applicable_act_or_regulation}</div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">{analysisResult.actionable_remedy}</div>
                    </div>
                  </div>

                  {/* Mandatory Explicit Confirmation Button */}
                  {!submissionResult && (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-amber-50 rounded-lg text-[11px] text-amber-800 border border-amber-200">
                        🔒 <strong>Safety Rule:</strong> No complaint is filed without your explicit confirmation. Review the details above and press Confirm to execute the Playwright filing script.
                      </div>
                      <button
                        onClick={handleSubmitGrievance}
                        disabled={submitting}
                        className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                            <span>Playwright script is filling Mock Portal form...</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-4 h-4 text-amber-400" />
                            <span>Confirm & File via Deterministic Playwright Script</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Receipt & Live Telemetry */}
                  {submissionResult && (
                    <div className="mt-5 space-y-4">
                      <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase opacity-90">Registration Acknowledged</span>
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
                            SLA: {submissionResult.estimated_sla_days} Days
                          </span>
                        </div>
                        <div className="text-2xl font-black font-mono tracking-tight">{submissionResult.tracking_id}</div>
                        <div className="text-xs opacity-90 mt-1">
                          Officer: {submissionResult.assigned_officer_designation}
                        </div>
                        <div className="text-[10px] font-mono opacity-75 mt-2 break-all">
                          Seal: {submissionResult.verification_hash}
                        </div>
                      </div>

                      <div className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
                        <div className="text-amber-400 font-bold pb-1 border-b border-slate-800 flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5" />
                          Deterministic Playwright DOM Telemetry:
                        </div>
                        {telemetryLogs.map((log, idx) => (
                          <div key={idx} className="leading-relaxed">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center min-h-[350px]">
                  <div className="bg-amber-50 p-4 rounded-2xl mb-3 text-amber-500">
                    <Bot className="w-10 h-10" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base mb-1">Awaiting Citizen Speech or Text</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Enter your issue on the left. JanSetu Lite will extract the category and location into strict JSON, show you the draft for confirmation, and dispatch via Playwright.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SCHEME NAVIGATOR (API SETU / VERIFIED) */}
        {activeTab === 'schemes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">Government Schemes Discovery</h2>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Hand-Verified (myscheme.gov.in)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">15 curated welfare schemes verified against official guidelines with exact source text</p>
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
                      className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      schemeCategory === c.id 
                        ? 'bg-amber-500 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Schemes Cards */}
              {loadingSchemes ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading government schemes...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {schemes.map(scheme => (
                    <div key={scheme.id} className="p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 transition shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {scheme.level.toUpperCase()} SCHEME • {scheme.state}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            Verified: {scheme.last_verified_date}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mb-2">{scheme.name}</h4>
                        
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg mb-3">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase block">Benefit:</span>
                          <span className="text-xs text-emerald-950 font-medium">{scheme.benefit}</span>
                        </div>

                        <div className="mb-3">
                          <span className="text-xs font-semibold text-slate-700 block mb-1">Key Eligibility:</span>
                          <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                            {scheme.eligibility_criteria.map((c: string, idx: number) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Source: myScheme.gov.in</span>
                        <a
                          href={scheme.official_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
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

        {/* TAB 3: 3-OUTCOME CLAIM VERIFIER */}
        {activeTab === 'factcheck' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">3-Outcome Scheme Claim Checker</h2>
                  <p className="text-xs text-slate-500">Strictly evaluates claims as Matches, Contradicts, or Couldn't Verify with quoted source text</p>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                <textarea
                  rows={3}
                  value={claimText}
                  onChange={e => setClaimText(e.target.value)}
                  placeholder="Paste viral claim, e.g.: 'PM-KISAN gives farmers Rs 6,000 per year in three installments' or 'PM free laptop scheme'..."
                  className="w-full p-4 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-400 font-medium py-1">Quick check:</span>
                    <button
                      onClick={() => {
                        setClaimText("PM-KISAN gives farmers Rs 6,000 per year in three installments");
                        handleFactCheck("PM-KISAN gives farmers Rs 6,000 per year in three installments");
                      }}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded border border-emerald-200"
                    >
                      "PM-KISAN ₹6k" (Matches)
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Central Government giving free laptops to all students");
                        handleFactCheck("Central Government giving free laptops to all students");
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-800 px-2 py-1 rounded border border-red-200"
                    >
                      "Free Laptops" (Contradicts)
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Gram panchayat free bicycles for everyone");
                        handleFactCheck("Gram panchayat free bicycles for everyone");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded"
                    >
                      "Free Bicycles" (Unverified)
                    </button>
                  </div>

                  <button
                    onClick={() => handleFactCheck()}
                    disabled={checkingFact || !claimText.trim()}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {checkingFact ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Check Against Official Dataset
                  </button>
                </div>
              </div>

              {/* 3-Outcome Result Display */}
              {factResult && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className={`p-5 rounded-2xl border ${
                    factResult.outcome === 'matches'
                      ? 'bg-emerald-50/80 border-emerald-300'
                      : (factResult.outcome === 'contradicts' ? 'bg-red-50/80 border-red-300' : 'bg-slate-50 border-slate-300')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          factResult.outcome === 'matches'
                            ? 'bg-emerald-600 text-white'
                            : (factResult.outcome === 'contradicts' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white')
                        }`}>
                          {factResult.verdict}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          Confidence: {factResult.truth_score}%
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-500">
                        Verified Date: {factResult.last_verified_date}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base mb-2">Evaluation Summary:</h4>
                    <p className="text-sm text-slate-800 mb-4 leading-relaxed">{factResult.summary}</p>

                    {/* Exact Quoted Source Text */}
                    <div className="p-4 bg-white rounded-xl border border-slate-200 mb-4">
                      <span className="text-xs font-bold text-slate-900 block mb-1">Exact Quoted Official Source Text:</span>
                      <blockquote className="text-xs italic text-slate-700 border-l-4 border-amber-500 pl-3 py-1">
                        "{factResult.exact_source_text}"
                      </blockquote>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        Official Source URL:{' '}
                        <a href={factResult.official_source_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                          {factResult.official_source_url}
                        </a>
                      </div>
                      <div className="font-medium text-slate-800">
                        Advice: {factResult.action_advice_for_citizens}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: TRACKING & ESCALATION STUDIO */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Grievance Tracking & Escalation Studio</h2>
                  <p className="text-xs text-slate-500">Live database ledger with "Simulate 15 Days Later" demo control and RTI/Appeal generator</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="http://localhost:8000/portal/admin"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5"
                  >
                    Operator Portal Console <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={fetchLedger}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tracking ID</th>
                      <th className="py-3 px-4">Citizen & Ward</th>
                      <th className="py-3 px-4">Department & Issue</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Days Elapsed</th>
                      <th className="py-3 px-4 text-center">Overdue Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grievancesList.map(g => {
                      const days = (simulatedDays[g.tracking_id] || 0) + (g.status === 'Resolved' ? 2 : 4);
                      const isOverdue = days >= 15 || g.status === 'Overdue';

                      return (
                        <tr key={g.tracking_id} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                            {g.tracking_id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{g.citizen_name}</div>
                            <div className="text-slate-400 text-[11px]">{g.location}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{g.department}</div>
                            <div className="text-slate-500 text-[11px] truncate max-w-xs">{g.title}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isOverdue ? 'Overdue' : g.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {days} Days
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isOverdue && (
                                <button
                                  onClick={() => handleSimulateOverdue(g.tracking_id)}
                                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded font-medium text-[11px] flex items-center gap-1"
                                >
                                  <FastForward className="w-3 h-3" /> +15 Days
                                </button>
                              )}
                              {isOverdue && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'reminder')}
                                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                                  >
                                    Reminder
                                  </button>
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'appeal')}
                                    className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[10px] font-bold"
                                  >
                                    1st Appeal
                                  </button>
                                  <button
                                    onClick={() => handleOpenEscalation(g.tracking_id, 'rti')}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold"
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

      {/* Escalation Letter Modal */}
      {selectedEscalation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase">Statutory Escalation Document</span>
                  <h3 className="font-bold text-slate-900 text-base">{selectedEscalation.subject_line}</h3>
                </div>
                <button onClick={() => setSelectedEscalation(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 text-xs text-slate-500">
                <span>Quoting Statute: <strong>{selectedEscalation.statutory_act_quoted}</strong></span>
              </div>

              <textarea
                rows={12}
                value={selectedEscalation.letter_body}
                onChange={e => setSelectedEscalation({ ...selectedEscalation, letter_body: e.target.value })}
                className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 leading-relaxed"
              />

              <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-900 border border-amber-200">
                💡 <strong>Notice:</strong> {selectedEscalation.action_note} (Never auto-sent).
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 mt-4">
              <button
                onClick={handleCopyDraft}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5"
              >
                {copiedDraft ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copiedDraft ? 'Copied!' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handleDownloadDraft}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Download .txt Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <p className="font-medium text-slate-600 mb-1">JanSetu Lite — Built for NxtWave Buildathon 2026</p>
        <p>Civic Pulse, Digital Governance & Public Information Track</p>
        <p className="mt-1">Developed by @cyugandharreddy08, @baliharsha999 & @Raghavendra-Kasireddy</p>
      </footer>
    </div>
  );
}
