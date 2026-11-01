import React, { useState } from 'react';
import axios from 'axios';
import {
  Sparkles, Award, CheckCircle2, ArrowRight, ExternalLink,
  RefreshCw, User, HelpCircle, ChevronDown, Check, ShieldCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api/v1';

interface CivicEligibilityCalculatorProps {
  onAskCopilot: (query: string) => void;
  selectedLanguage: 'en' | 'hi' | 'te';
}

const INDIAN_STATES = [
  "All-India", "Andhra Pradesh", "Telangana", "Meghalaya", "Karnataka",
  "Tamil Nadu", "Maharashtra", "Uttar Pradesh", "Bihar", "Delhi",
  "Kerala", "Rajasthan", "Madhya Pradesh", "Gujarat", "West Bengal",
  "Odisha", "Punjab", "Haryana", "Assam", "Jammu and Kashmir",
  "Jharkhand", "Chhattisgarh", "Uttarakhand", "Himachal Pradesh",
  "Goa", "Tripura", "Manipur", "Nagaland", "Mizoram", "Arunachal Pradesh",
  "Sikkim", "Puducherry", "Ladakh"
];

export const CivicEligibilityCalculator: React.FC<CivicEligibilityCalculatorProps> = ({
  onAskCopilot,
  selectedLanguage
}) => {
  const [state, setState] = useState('All-India');
  const [occupation, setOccupation] = useState('farmer');
  const [age, setAge] = useState<number>(32);
  const [gender, setGender] = useState('female');
  const [income, setIncome] = useState<number>(180000);
  const [landholder, setLandholder] = useState<boolean>(true);
  const [hasSchoolChildren, setHasSchoolChildren] = useState<boolean>(false);
  const [caste, setCaste] = useState<string>('general');
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [results, setResults] = useState<any[] | null>(null);

  // Quick Persona Presets
  const applyPreset = (preset: string) => {
    if (preset === 'mother_ap') {
      setState('Andhra Pradesh');
      setOccupation('women');
      setGender('female');
      setAge(34);
      setIncome(120000);
      setLandholder(false);
      setHasSchoolChildren(true);
      setCaste('obc');
    } else if (preset === 'farmer_small') {
      setState('All-India');
      setOccupation('farmer');
      setGender('male');
      setAge(42);
      setIncome(150000);
      setLandholder(true);
      setHasSchoolChildren(false);
      setCaste('general');
    } else if (preset === 'senior_70') {
      setState('All-India');
      setOccupation('senior');
      setGender('any');
      setAge(72);
      setIncome(240000);
      setLandholder(false);
      setHasSchoolChildren(false);
      setCaste('general');
    } else if (preset === 'student_scholarship') {
      setState('All-India');
      setOccupation('student');
      setGender('any');
      setAge(19);
      setIncome(180000);
      setLandholder(false);
      setHasSchoolChildren(false);
      setCaste('sc');
    } else if (preset === 'artisan_vishwakarma') {
      setState('All-India');
      setOccupation('artisan');
      setGender('male');
      setAge(38);
      setIncome(160000);
      setLandholder(false);
      setHasSchoolChildren(false);
      setCaste('obc');
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await axios.post(`${API_BASE}/schemes/eligibility`, {
        occupation,
        annual_income: Number(income),
        gender,
        age: Number(age),
        landholder,
        state,
        has_school_children: hasSchoolChildren,
        caste
      });
      setResults(res.data.likely_eligible_schemes || []);
    } catch (err) {
      console.warn('Eligibility evaluation error:', err);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-[rgba(240,106,37,0.3)] shadow-2xl relative overflow-hidden mb-8">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#F06A25]/10 via-[#2F3558]/20 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2F3558] border border-[#B8643A]/50 text-xs font-mono text-[#ffb692] font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#F06A25]" />
            <span>SOVEREIGN CIVIC ELIGIBILITY ENGINE</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#E8E9F2]">
            Citizen Entitlement & Eligibility Calculator
          </h2>
          <p className="text-xs sm:text-sm text-[#8F93B5] mt-1">
            Instant statutory evaluation against Central & 28 Indian States welfare parameters.
          </p>
        </div>

        {/* Quick Persona Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#8F93B5]">Quick Presets:</span>
          <button
            onClick={() => applyPreset('mother_ap')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#1a1d24] hover:bg-[#2F3558] text-[#ffb692] border border-[#B8643A]/40 transition-all"
          >
            👩‍👦 Mother with School Child (AP)
          </button>
          <button
            onClick={() => applyPreset('farmer_small')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#1a1d24] hover:bg-[#2F3558] text-[#ffb692] border border-[#B8643A]/40 transition-all"
          >
            🌾 Landholder Farmer
          </button>
          <button
            onClick={() => applyPreset('senior_70')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#1a1d24] hover:bg-[#2F3558] text-[#ffb692] border border-[#B8643A]/40 transition-all"
          >
            👵 Senior 70+ (Universal Cover)
          </button>
          <button
            onClick={() => applyPreset('student_scholarship')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#1a1d24] hover:bg-[#2F3558] text-[#ffb692] border border-[#B8643A]/40 transition-all"
          >
            🎓 Reserved Category Student
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* State */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">State / Union Territory</label>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          >
            {INDIAN_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Occupation */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">Occupation / Profile</label>
          <select
            value={occupation}
            onChange={e => setOccupation(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          >
            <option value="farmer">Farmer / Agriculture</option>
            <option value="student">Student / Aspirant</option>
            <option value="women">Woman Entrepreneur / Mother</option>
            <option value="artisan">Traditional Artisan / Vishwakarma</option>
            <option value="senior">Senior Citizen</option>
            <option value="entrepreneur">Micro Business / MSME</option>
          </select>
        </div>

        {/* Age */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">Age: {age} Years</label>
          <input
            type="number"
            min="10"
            max="100"
            value={age}
            onChange={e => setAge(Number(e.target.value))}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">Gender</label>
          <select
            value={gender}
            onChange={e => setGender(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="any">Any / Other</option>
          </select>
        </div>

        {/* Annual Income */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">
            Annual Income: ₹{(income / 100000).toFixed(1)} Lakhs
          </label>
          <select
            value={income}
            onChange={e => setIncome(Number(e.target.value))}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          >
            <option value={90000}>Under ₹1 Lakh (BPL / EWS)</option>
            <option value={180000}>₹1 Lakh - ₹2.5 Lakhs (SECC Lower)</option>
            <option value={400000}>₹2.5 Lakhs - ₹4.5 Lakhs (Scholarship Cap)</option>
            <option value={750000}>Above ₹5 Lakhs (Middle Income)</option>
          </select>
        </div>

        {/* Caste / Category */}
        <div>
          <label className="block text-xs font-bold text-[#E8E9F2] mb-1.5">Category</label>
          <select
            value={caste}
            onChange={e => setCaste(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-[#101322] border border-[rgba(255,255,255,0.1)] text-xs text-[#E8E9F2] focus:border-[#F06A25] outline-none"
          >
            <option value="general">General</option>
            <option value="obc">OBC</option>
            <option value="sc">SC (Scheduled Caste)</option>
            <option value="st">ST (Scheduled Tribe)</option>
          </select>
        </div>

        {/* Checkbox: Owns Land */}
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="landholder_check"
            checked={landholder}
            onChange={e => setLandholder(e.target.checked)}
            className="w-4 h-4 accent-[#F06A25] rounded cursor-pointer"
          />
          <label htmlFor="landholder_check" className="text-xs font-bold text-[#E8E9F2] cursor-pointer">
            Owns Cultivable Land (PM-KISAN / Rythu Bharosa)
          </label>
        </div>

        {/* Checkbox: School Children */}
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="school_check"
            checked={hasSchoolChildren}
            onChange={e => setHasSchoolChildren(e.target.checked)}
            className="w-4 h-4 accent-[#F06A25] rounded cursor-pointer"
          />
          <label htmlFor="school_check" className="text-xs font-bold text-[#E8E9F2] cursor-pointer">
            Children in School (Class 1-12) (Thalliki Vandanam)
          </label>
        </div>
      </div>

      {/* Evaluate Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#F06A25] to-[#E58C5C] text-[#0B0C1E] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#F06A25]/30 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {evaluating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#0B0C1E]" />
              <span>Scanning 5,210 Scheme Rules...</span>
            </>
          ) : (
            <>
              <Award className="w-4 h-4 text-[#0B0C1E]" />
              <span>Evaluate My Entitlements (అర్హత గణన / पात्रता जांचें)</span>
            </>
          )}
        </button>

        {results && (
          <span className="text-xs text-[#34d399] font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Found {results.length} high-confidence entitlement matches
          </span>
        )}
      </div>

      {/* Results View */}
      {results && results.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.08)]">
          <h3 className="text-sm font-black text-[#E8E9F2] uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#34d399]" />
            <span>Verified Matched Entitlements For Your Profile:</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((res: any, idx: number) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#101322] border border-[rgba(240,106,37,0.3)] flex flex-col justify-between hover:border-[#F06A25] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30">
                      {res.status || 'Likely Eligible'}
                    </span>
                    <span className="text-[10px] font-mono text-[#8F93B5]">
                      Rank #{idx + 1}
                    </span>
                  </div>

                  <h4 className="font-black text-[#E8E9F2] text-sm mb-2">{res.scheme_name}</h4>

                  <div className="space-y-1 mb-4">
                    {res.reasons.map((r: string, rIdx: number) => (
                      <div key={rIdx} className="text-xs text-[#ffedd5] flex items-start gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#34d399] shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[rgba(255,255,255,0.08)] flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      onAskCopilot(`Walk me through the step-by-step application procedure, required documents, and bank seeding for ${res.scheme_name}`);
                    }}
                    className="text-xs font-bold text-[#ffb692] hover:text-[#F06A25] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ask Nagarik Copilot</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <a
                    href={res.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#8F93B5] hover:text-[#E8E9F2] flex items-center gap-1"
                  >
                    <span>Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
