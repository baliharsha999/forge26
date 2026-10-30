import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, ShieldCheck, Search, Mic, MicOff, RefreshCw, ExternalLink, 
  Sparkles, Bot, User, Landmark, FileCheck, ShieldAlert, Activity
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
  
  // Citizen Details
  const [citizenName, setCitizenName] = useState('Ananya Rao');
  const [citizenPhone, setCitizenPhone] = useState('9876543210');
  const [citizenState] = useState('Telangana');
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
  
  // Ledger State
  const [grievancesList, setGrievancesList] = useState<any[]>([]);

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
      alert('Speech recognition is not supported in this browser. Please type your grievance.');
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
    try {
      const res = await axios.post(`${API_BASE}/grievance/analyze`, {
        raw_input: rawInput,
        language: language,
        location: `${citizenLocality}, ${citizenDistrict}, ${citizenState}`
      });
      setAnalysisResult(res.data);
    } catch (err) {
      alert('Error analyzing grievance. Ensure backend is running.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Submit Grievance via Autonomous Agent
  const handleSubmitGrievance = async () => {
    if (!analysisResult) return;
    setSubmitting(true);
    setTelemetryLogs(["[JanSetu Agent] Launching Autonomous Browser Agent Session..."]);

    try {
      const payload = {
        citizen: {
          name: citizenName,
          phone: citizenPhone,
          state: citizenState,
          district: citizenDistrict,
          locality: citizenLocality
        },
        department: analysisResult.department,
        category: analysisResult.category,
        urgency_level: analysisResult.urgency_level,
        title: analysisResult.standardized_english_summary.slice(0, 80),
        description: analysisResult.standardized_english_summary,
        location: analysisResult.extracted_location || citizenLocality
      };

      const res = await axios.post(`${API_BASE}/grievance/submit`, payload);
      setSubmissionResult(res.data);
      setTelemetryLogs(res.data.browser_agent_telemetry || []);
      fetchLedger();
    } catch (err) {
      alert('Failed to submit grievance via agent.');
    } finally {
      setSubmitting(false);
    }
  };

  // Fact Check Verification
  const handleFactCheck = async (claim?: string) => {
    const textToCheck = claim || claimText;
    if (!textToCheck.trim()) return;
    setCheckingFact(true);
    try {
      const res = await axios.post(`${API_BASE}/fact-check`, { claim: textToCheck });
      setFactResult(res.data);
    } catch (err) {
      alert('Failed to verify claim.');
    } finally {
      setCheckingFact(false);
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
                <h1 className="font-bold text-xl tracking-tight text-white">JanSetu AI</h1>
                <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold px-2 py-0.5 rounded-full">
                  CIVIC PULSE 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Digital Governance, Public Service & Media Verification</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Backend & Active SQLite DB
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-slate-800/80">
          {[
            { id: 'grievance', label: '1. Citizen Copilot & Autonomous Agent', icon: Bot },
            { id: 'schemes', label: '2. Welfare Scheme Navigator', icon: FileCheck },
            { id: 'factcheck', label: '3. Civic Pulse Fact-Check Radar', icon: ShieldCheck },
            { id: 'ledger', label: '4. Public Transparency Ledger', icon: Activity },
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
        
        {/* TAB 1: CITIZEN COPILOT & AUTONOMOUS AGENT */}
        {activeTab === 'grievance' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Multimodal Input & Citizen Info */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Multimodal Citizen Grievance Intake
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

                <div className="relative mb-4">
                  <textarea
                    rows={4}
                    value={rawInput}
                    onChange={e => setRawInput(e.target.value)}
                    placeholder={
                      language === 'te' 
                        ? 'మా వీధిలో డ్రైనేజ్ లైన్ పగిలి నీళ్లు రోడ్డు మీద పారుతున్నాయి, దుర్గంధం వస్తోంది...' 
                        : (language === 'hi' 
                            ? 'हमारे मोहल्ले में ट्रांसफार्मर में स्पार्क हो रहा है और बिजली बार-बार जा रही है...' 
                            : 'Explain civic issue in your own words, voice, or paste a description...')
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

                {/* Quick Test Prompt Chips */}
                <div className="mb-4">
                  <span className="text-xs text-slate-500 font-medium block mb-1.5">⚡ Test with realistic civic incidents:</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button 
                      onClick={() => setRawInput("Massive dangerous crater pothole near Pillar 42 Kukatpally, waterlogged after rain and two-wheelers slipping")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      🚧 Dangerous Road Crater
                    </button>
                    <button 
                      onClick={() => setRawInput("Contaminated drinking water with brown sludge coming through municipal tap in Bhavanipuram Ward 12")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      🚰 Water Contamination
                    </button>
                    <button 
                      onClick={() => setRawInput("High voltage transformer sparking continuously near street junction, fire risk for nearby houses")}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md"
                    >
                      ⚡ Transformer Fire Hazard
                    </button>
                  </div>
                </div>

                {/* Citizen Metadata Accordion */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> Citizen Identity & Jurisdiction
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

                {/* Analyze Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !rawInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Synthesizing Multimodal Reasoning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Synthesize & Classify Petition
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: AI Synthesis & Autonomous Agent Filing */}
            <div className="lg:col-span-6 space-y-6">
              {analysisResult ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div>
                      <span className="text-xs uppercase font-bold text-slate-400">AI Classification</span>
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

                  {/* Department & Statutory Act */}
                  <div className="space-y-3 mb-5 text-sm">
                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-medium text-slate-500 block">Responsible Department:</span>
                        <span className="font-semibold text-slate-900">{analysisResult.department}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <Landmark className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-medium text-slate-500 block">Applicable Indian Governance Act:</span>
                        <span className="text-xs text-slate-700">{analysisResult.applicable_act_or_regulation}</span>
                      </div>
                    </div>

                    <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                      <span className="text-xs font-semibold text-blue-900 block mb-1">Formally Drafted Petition (Standard English):</span>
                      <p className="text-xs text-blue-800 leading-relaxed">{analysisResult.standardized_english_summary}</p>
                    </div>

                    <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-900">
                      <span className="font-semibold block mb-0.5">Mandated Actionable Remedy:</span>
                      {analysisResult.actionable_remedy}
                    </div>
                  </div>

                  {/* Deploy Agent Button */}
                  {!submissionResult && (
                    <button
                      onClick={handleSubmitGrievance}
                      disabled={submitting}
                      className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <span>Autonomous Agent is navigating portal...</span>
                        </>
                      ) : (
                        <>
                          <Bot className="w-4 h-4 text-amber-400" />
                          <span>Deploy Autonomous Browser Agent to Register Form</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Telemetry Live Feed & Certificate */}
                  {submissionResult && (
                    <div className="mt-5 space-y-4">
                      {/* Success Badge */}
                      <div className="p-4 bg-emerald-500 text-white rounded-xl shadow-md">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold tracking-wider uppercase opacity-90">Registration Confirmed</span>
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
                            SLA: {submissionResult.estimated_sla_days} Days
                          </span>
                        </div>
                        <div className="text-2xl font-black tracking-tight">{submissionResult.tracking_id}</div>
                        <div className="text-xs opacity-90 mt-1">
                          Assigned to: {submissionResult.assigned_officer_designation}
                        </div>
                        <div className="text-[10px] font-mono opacity-75 mt-2 break-all">
                          Digital Seal: {submissionResult.verification_hash}
                        </div>
                      </div>

                      {/* Live Browser-Use Agent Telemetry */}
                      <div className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-slate-300 space-y-1.5 max-h-52 overflow-y-auto">
                        <div className="text-amber-400 font-bold pb-1 border-b border-slate-800 flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5" />
                          Autonomous Browser Agent Execution Telemetry:
                        </div>
                        {telemetryLogs.map((log, idx) => (
                          <div key={idx} className="leading-relaxed">
                            {log}
                          </div>
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
                  <h3 className="font-bold text-slate-800 text-base mb-1">Awaiting Citizen Complaint</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Enter or speak your issue on the left. The multimodal agent will classify the municipal jurisdiction, draft statutory petition wording, and auto-dispatch to the public portal.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: WELFARE SCHEMES NAVIGATOR */}
        {activeTab === 'schemes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Official Welfare Schemes & Subsidies Navigator</h2>
                  <p className="text-xs text-slate-500">Verified Central & State Government benefits with eligibility checklists</p>
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
                      placeholder="Search by crop, scholarship, loan..."
                      className="pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 w-64 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  { id: 'all', label: 'All Schemes' },
                  { id: 'farmer', label: '🌾 Farmers & Agriculture' },
                  { id: 'student', label: '🎓 Students & Education' },
                  { id: 'healthcare', label: '🏥 Healthcare' },
                  { id: 'women', label: '👩 Women Empowerment' },
                  { id: 'msme', label: '💼 Small Businesses & MSME' },
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

              {/* Schemes Grid */}
              {loadingSchemes ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading verified government schemes...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {schemes.map(scheme => (
                    <div key={scheme.id} className="p-5 rounded-xl border border-slate-200 bg-white hover:border-amber-400 transition shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {scheme.ministry}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                            {scheme.state}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mb-2">{scheme.title}</h4>
                        
                        {/* Financial Benefit Badge */}
                        <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg mb-3">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase block">Financial & Welfare Benefit:</span>
                          <span className="text-xs text-emerald-950 font-medium">{scheme.financial_benefit}</span>
                        </div>

                        {/* Eligibility Bullets */}
                        <div className="mb-3">
                          <span className="text-xs font-semibold text-slate-700 block mb-1">Key Eligibility Criteria:</span>
                          <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                            {scheme.eligibility_criteria.map((c: string, idx: number) => (
                              <li key={idx}>{c}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Documents */}
                        <div className="mb-4">
                          <span className="text-xs font-semibold text-slate-700 block mb-1">Required Documents:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {scheme.documents_required.map((d: string, idx: number) => (
                              <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                {d}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Target: {scheme.target_beneficiary.slice(0, 35)}...</span>
                        <a
                          href={scheme.official_portal_url}
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

        {/* TAB 3: FACT-CHECK RADAR */}
        {activeTab === 'factcheck' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Civic Pulse Fact-Check Radar</h2>
                  <p className="text-xs text-slate-500">Cross-reference viral WhatsApp forwards and public policy claims against official PIB & Gazette records</p>
                </div>
              </div>

              <div className="space-y-4 mb-5">
                <textarea
                  rows={3}
                  value={claimText}
                  onChange={e => setClaimText(e.target.value)}
                  placeholder="Paste viral message, e.g.: 'Govt is providing free laptops to all students under PM scheme' or 'New ₹10,000 cash subsidy'..."
                  className="w-full p-4 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                />

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="text-slate-400 font-medium py-1">Quick check:</span>
                    <button
                      onClick={() => {
                        setClaimText("Govt announced free laptops for all students in India");
                        handleFactCheck("Govt announced free laptops for all students in India");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded"
                    >
                      "Free Laptops" Claim
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Ayushman Bharat now free for senior citizens aged 70 and above");
                        handleFactCheck("Ayushman Bharat now free for senior citizens aged 70 and above");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded"
                    >
                      "70+ Ayushman Bharat"
                    </button>
                    <button
                      onClick={() => {
                        setClaimText("Ministry crediting ₹10,000 cash relief bonus in all accounts");
                        handleFactCheck("Ministry crediting ₹10,000 cash relief bonus in all accounts");
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded"
                    >
                      "₹10k Cash Bonus"
                    </button>
                  </div>

                  <button
                    onClick={() => handleFactCheck()}
                    disabled={checkingFact || !claimText.trim()}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {checkingFact ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Verify Claim
                  </button>
                </div>
              </div>

              {/* Fact Check Results Card */}
              {factResult && (
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <div className={`p-5 rounded-2xl border ${
                    factResult.verdict === 'VERIFIED'
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : (factResult.verdict === 'BOGUS' ? 'bg-red-50/70 border-red-300' : 'bg-amber-50/70 border-amber-300')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${
                          factResult.verdict === 'VERIFIED'
                            ? 'bg-emerald-600 text-white'
                            : (factResult.verdict === 'BOGUS' ? 'bg-red-600 text-white' : 'bg-amber-600 text-white')
                        }`}>
                          VERDICT: {factResult.verdict}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          Truth Score: {factResult.truth_score}%
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600">
                        Official Fact-Check Unit
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base mb-2">Claim Analysis:</h4>
                    <p className="text-sm text-slate-700 mb-4 leading-relaxed">{factResult.summary}</p>

                    <div className="space-y-2 mb-4">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Key Verified Evidence:</span>
                      <ul className="text-xs text-slate-700 space-y-1 list-disc pl-5">
                        {factResult.key_findings.map((f: string, idx: number) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                      <div>
                        <span className="font-semibold text-slate-900">Official Citation: </span>
                        {factResult.official_source_citation}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Official Gazette / PIB Link: </span>
                        <a 
                          href={factResult.gazette_or_pib_reference} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-blue-600 hover:underline break-all"
                        >
                          {factResult.gazette_or_pib_reference}
                        </a>
                      </div>
                      <div className="pt-1 text-slate-800 font-medium">
                        💡 <span className="font-bold">Citizen Advice: </span>{factResult.action_advice_for_citizens}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PUBLIC TRANSPARENCY LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Civic Redressal Live Database Ledger</h2>
                  <p className="text-xs text-slate-500">Live SQLite-backed public register of grievances, department routing, and SLA tracking</p>
                </div>
                <button
                  onClick={fetchLedger}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Records
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tracking ID</th>
                      <th className="py-3 px-4">Citizen & Location</th>
                      <th className="py-3 px-4">Department & Issue</th>
                      <th className="py-3 px-4">Urgency</th>
                      <th className="py-3 px-4">Status & SLA</th>
                      <th className="py-3 px-4">Assigned Officer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grievancesList.map(g => (
                      <tr key={g.tracking_id} className="hover:bg-slate-50 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                          {g.tracking_id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{g.citizen_name}</div>
                          <div className="text-slate-400 text-[11px]">{g.location || `${g.district}, ${g.state}`}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800">{g.department}</div>
                          <div className="text-slate-500 text-[11px] truncate max-w-xs">{g.title}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            g.urgency_level === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {g.urgency_level}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 mb-0.5">
                            {g.status}
                          </span>
                          <div className="text-[10px] text-slate-400">Target: {g.sla_days} days</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {g.assigned_officer}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <p className="font-medium text-slate-600 mb-1">JanSetu AI — NxtWave Buildathon 2026 Project</p>
        <p>Built for the <em>Civic Pulse, Digital Governance & Public Information</em> Track.</p>
        <p className="mt-1">Developed with ❤️ by @cyugandharreddy08, @baliharsha999 & @Raghavendra-Kasireddy</p>
      </footer>
    </div>
  );
}
