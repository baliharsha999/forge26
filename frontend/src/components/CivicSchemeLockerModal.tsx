import React, { useState, useEffect } from 'react';
import {
  X, Bookmark, CheckSquare, Square, Download, Share2,
  ExternalLink, FileCheck, Trash2, Plus, Sparkles, AlertCircle, Copy, Check
} from 'lucide-react';

export interface SavedScheme {
  id: string;
  name: string;
  department: string;
  benefit: string;
  eligibility_summary: string;
  official_url: string;
  saved_at: string;
}

const DEFAULT_CURATED_SCHEMES: SavedScheme[] = [
  {
    id: 'pm_kisan',
    name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)',
    department: 'Ministry of Agriculture and Farmers Welfare',
    benefit: '₹6,000 per year direct income support in three equal installments',
    eligibility_summary: 'Small and marginal landholder farmer families with cultivable landholding',
    official_url: 'https://pmkisan.gov.in',
    saved_at: new Date().toLocaleDateString()
  },
  {
    id: 'pmjay_ayushman',
    name: 'Ayushman Bharat PM-JAY',
    department: 'National Health Authority',
    benefit: '₹5 Lakh per family per year cashless inpatient hospitalization',
    eligibility_summary: 'Families identified in SECC 2011 rural and urban occupational criteria',
    official_url: 'https://pmjay.gov.in',
    saved_at: new Date().toLocaleDateString()
  }
];

const STANDARD_DOCUMENT_CHECKLIST = [
  { id: 'doc_aadhaar', label: 'Aadhaar Card with active mobile linkage (for biometric & OTP eKYC)' },
  { id: 'doc_bank', label: 'Bank Passbook / Cancelled Cheque with NPCI Aadhaar seeding' },
  { id: 'doc_income', label: 'Income Certificate from Revenue Authority / Tehsildar (current FY)' },
  { id: 'doc_residence', label: 'Domicile / Residence Certificate or Electricity Bill' },
  { id: 'doc_caste', label: 'Caste / Community Certificate (for SC/ST/OBC/EWS quotas)' },
  { id: 'doc_land', label: 'Land Record Patta / RoR 1-B / Pahani (for farmer schemes)' },
  { id: 'doc_ration', label: 'NFSA Food Security Card / BPL Ration Card' }
];

interface CivicSchemeLockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'en' | 'hi' | 'te';
}

export const CivicSchemeLockerModal: React.FC<CivicSchemeLockerModalProps> = ({
  isOpen,
  onClose,
  currentLanguage
}) => {
  const [savedSchemes, setSavedSchemes] = useState<SavedScheme[]>(() => {
    try {
      const saved = localStorage.getItem('nagarik_saved_schemes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CURATED_SCHEMES;
  });

  const [checkedDocs, setCheckedDocs] = useState<{ [id: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('nagarik_doc_checklist');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { doc_aadhaar: true, doc_bank: true };
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('nagarik_saved_schemes', JSON.stringify(savedSchemes));
    } catch {}
  }, [savedSchemes]);

  useEffect(() => {
    try {
      localStorage.setItem('nagarik_doc_checklist', JSON.stringify(checkedDocs));
    } catch {}
  }, [checkedDocs]);

  if (!isOpen) return null;

  const toggleDoc = (id: string) => {
    setCheckedDocs((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRemoveScheme = (id: string) => {
    setSavedSchemes((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDownloadDossier = () => {
    const readyCount = STANDARD_DOCUMENT_CHECKLIST.filter((d) => checkedDocs[d.id]).length;
    const totalCount = STANDARD_DOCUMENT_CHECKLIST.length;

    let content = `========================================================================\n`;
    content += `         NAGARIK AI — CITIZEN WELFARE APPLICATION DOSSIER               \n`;
    content += `                    "Empowering Every Citizen"                           \n`;
    content += `========================================================================\n\n`;
    content += `Generated On: ${new Date().toLocaleString()}\n`;
    content += `Document Readiness Score: ${readyCount} / ${totalCount} (${Math.round((readyCount / totalCount) * 100)}% Ready)\n\n`;

    content += `------------------------------------------------------------------------\n`;
    content += `1. SHORTLISTED WELFARE SCHEMES (${savedSchemes.length})\n`;
    content += `------------------------------------------------------------------------\n`;
    savedSchemes.forEach((s, idx) => {
      content += `[${idx + 1}] ${s.name}\n`;
      content += `    Department : ${s.department}\n`;
      content += `    Benefit    : ${s.benefit}\n`;
      content += `    Eligibility: ${s.eligibility_summary}\n`;
      content += `    Portal Link: ${s.official_url}\n\n`;
    });

    content += `------------------------------------------------------------------------\n`;
    content += `2. CITIZEN DOCUMENT READINESS CHECKLIST\n`;
    content += `------------------------------------------------------------------------\n`;
    STANDARD_DOCUMENT_CHECKLIST.forEach((d) => {
      const isDone = !!checkedDocs[d.id];
      content += `[${isDone ? '✔ READY' : '✖ PENDING'}] ${d.label}\n`;
    });

    content += `\n========================================================================\n`;
    content += `OFFICIAL ADVISORY:\n`;
    content += `Government schemes never require processing fees on unofficial websites.\n`;
    content += `Apply directly via official portals or your nearest Common Service Centre (CSC).\n`;
    content += `========================================================================\n`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Nagarik_AI_Welfare_Dossier_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const names = savedSchemes.map((s) => `• ${s.name} (${s.benefit})`).join('\n');
    const text = `📁 *Nagarik AI — My Saved Welfare Schemes*\n\n${names}\n\n_Generated via Nagarik AI Sovereign Copilot_`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const readyDocsCount = STANDARD_DOCUMENT_CHECKLIST.filter((d) => checkedDocs[d.id]).length;
  const readinessPercent = Math.round((readyDocsCount / STANDARD_DOCUMENT_CHECKLIST.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#101216] border border-[#22262f] shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#22262f] bg-[#16191f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#f2ca50]/15 border border-[#f2ca50]/30 text-[#f2ca50]">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#e2e2e6]">
                  {currentLanguage === 'hi' ? 'नागरिक बस्ता — सहेजी गई योजनाएं एवं दस्तावेज चेकलिस्ट' : (currentLanguage === 'te' ? 'పౌర బస్తా — భద్రపరిచిన పథకాలు & డాక్యుమెంట్ చెక్‌లిస్ట్' : 'Nagarik Basta — Saved Schemes & Document Locker')}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2ca50]/15 text-[#f2ca50] border border-[#f2ca50]/30 font-mono">
                  {savedSchemes.length} Shortlisted
                </span>
              </div>
              <p className="text-xs text-[#8F93B5] mt-0.5">
                Organize candidate welfare schemes and track required legal documents before CSC application
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Readiness Meter */}
          <div className="p-4 rounded-xl border border-[#22262f] bg-[#16191f] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#e2e2e6]">Application Readiness Score:</span>
              <span className="font-mono font-bold text-[#f2ca50]">{readinessPercent}% Ready ({readyDocsCount} of {STANDARD_DOCUMENT_CHECKLIST.length} Docs)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#0c0e11] overflow-hidden border border-[#22262f]">
              <div
                className="h-full bg-gradient-to-r from-[#f2ca50] to-emerald-400 transition-all duration-300"
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[#8F93B5]">
              Tick off your ready documents below to ensure smooth zero-rejection submissions at CSC centers.
            </p>
          </div>

          {/* Shortlisted Schemes Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#8F93B5] uppercase tracking-wider">
                My Shortlisted Schemes ({savedSchemes.length})
              </span>
              {savedSchemes.length > 0 && (
                <button
                  onClick={handleCopySummary}
                  className="text-xs text-[#f2ca50] hover:underline flex items-center gap-1 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Summary!' : 'Share Shortlist'}</span>
                </button>
              )}
            </div>

            {savedSchemes.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-[#22262f] text-xs text-[#8F93B5]">
                No schemes saved yet. Tap "Save to Basta" on any scheme citation during your consultation.
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedSchemes.map((scheme) => (
                  <div
                    key={scheme.id}
                    className="p-3.5 rounded-xl border border-[#22262f] bg-[#16191f] flex items-start justify-between gap-3 hover:border-[#f2ca50]/40 transition-all"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#e2e2e6]">{scheme.name}</h4>
                        <span className="text-[10px] text-[#8F93B5]">Saved {scheme.saved_at}</span>
                      </div>
                      <div className="text-xs text-emerald-400 font-semibold">{scheme.benefit}</div>
                      <p className="text-xs text-[#8F93B5] leading-relaxed">{scheme.eligibility_summary}</p>
                      <a
                        href={scheme.official_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#f2ca50] hover:underline font-semibold pt-1"
                      >
                        <span>Official Ministry Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <button
                      onClick={() => handleRemoveScheme(scheme.id)}
                      className="p-1.5 rounded-lg text-[#8F93B5] hover:text-red-400 hover:bg-[#22262f] transition-colors"
                      title="Remove from shortlisted schemes"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Document Checklist */}
          <div className="space-y-3 pt-2 border-t border-[#22262f]">
            <span className="text-xs font-bold text-[#8F93B5] uppercase tracking-wider block">
              Required Legal Document Checklist
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STANDARD_DOCUMENT_CHECKLIST.map((doc) => {
                const isChecked = !!checkedDocs[doc.id];
                return (
                  <div
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    className={`p-3 rounded-xl border cursor-pointer text-xs transition-all flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-emerald-950/20 border-emerald-500/40 text-[#e2e2e6]'
                        : 'bg-[#16191f] border-[#22262f] text-[#8F93B5] hover:text-[#e2e2e6]'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-[#8F93B5] shrink-0 mt-0.5" />
                    )}
                    <span className="leading-snug">{doc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#22262f] bg-[#16191f] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#8F93B5] flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Ready for Common Service Centre (CSC) or Online Submission</span>
          </div>
          <button
            onClick={handleDownloadDossier}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#f2ca50] text-[#0c0e11] hover:brightness-105 transition-all flex items-center gap-2 shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download Application Dossier (.txt)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
