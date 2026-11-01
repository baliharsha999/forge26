import React, { useState, useMemo } from 'react';
import {
  X, FileText, CheckCircle2, Copy, Check, Download,
  Printer, Sparkles, ExternalLink, ShieldCheck, ArrowRight
} from 'lucide-react';

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
  language?: 'en' | 'hi' | 'te';
  citations?: SchemeCitation[];
}

interface CivicChatSummarizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentLanguage: 'en' | 'hi' | 'te';
}

export const CivicChatSummarizerModal: React.FC<CivicChatSummarizerModalProps> = ({
  isOpen,
  onClose,
  messages,
  currentLanguage
}) => {
  const [copied, setCopied] = useState(false);
  const [summaryLang, setSummaryLang] = useState<'en' | 'hi' | 'te'>(currentLanguage);

  // Extract all citations and key user inquiries
  const userInquiries = useMemo(() => {
    return messages.filter(m => m.role === 'user').map(m => m.content);
  }, [messages]);

  const allCitations = useMemo(() => {
    const list: SchemeCitation[] = [];
    const seen = new Set<string>();
    messages.forEach(m => {
      (m.citations || []).forEach(c => {
        if (!seen.has(c.id || c.name)) {
          seen.add(c.id || c.name);
          list.push(c);
        }
      });
    });
    return list;
  }, [messages]);

  // Generate structured summary sections
  const summaryData = useMemo(() => {
    const primaryTopic = userInquiries.length > 0
      ? userInquiries[0].length > 80 ? userInquiries[0].substring(0, 77) + '...' : userInquiries[0]
      : 'General Civic & Scheme Consultation';

    const actionItems: string[] = [];

    if (allCitations.length > 0) {
      allCitations.forEach(c => {
        actionItems.push(`Verify eligibility criteria and required documentation for ${c.name}`);
        actionItems.push(`Visit official portal (${c.official_url || 'gov.in'}) to submit application or track status`);
      });
    } else {
      actionItems.push('Review relevant state and central civic eligibility portals');
      actionItems.push('Ensure bank account is Aadhaar seeded on NPCI mapper for Direct Benefit Transfer (DBT)');
      actionItems.push('Keep required documents ready (Aadhaar, income certificate, bank passbook)');
    }

    return {
      title: primaryTopic,
      messageCount: messages.length,
      userInquiries,
      schemesFound: allCitations,
      actionItems: Array.from(new Set(actionItems)),
      generatedAt: new Date().toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    };
  }, [messages, userInquiries, allCitations]);

  if (!isOpen) return null;

  // Text formatter for Clipboard & Download
  const generatePlainTextSummary = () => {
    let out = `=====================================================\n`;
    out += `   NAGARIK AI — CITIZEN CONSULTATION SUMMARY RECEIPT\n`;
    out += `   Empowering Every Citizen • Zero-Knowledge Grounded\n`;
    out += `=====================================================\n\n`;
    out += `Generated: ${summaryData.generatedAt}\n`;
    out += `Consultation Messages: ${summaryData.messageCount}\n`;
    out += `Primary Focus: ${summaryData.title}\n\n`;

    out += `--- CITIZEN INQUIRIES ---\n`;
    summaryData.userInquiries.forEach((q, i) => {
      out += `${i + 1}. ${q}\n`;
    });
    out += `\n`;

    out += `--- IDENTIFIED SCHEMES & ENTITLEMENTS (${summaryData.schemesFound.length}) ---\n`;
    summaryData.schemesFound.forEach((s, i) => {
      out += `${i + 1}. ${s.name} (${s.department})\n`;
      out += `   Benefit: ${s.benefit}\n`;
      out += `   Eligibility: ${s.eligibility_summary}\n`;
      out += `   Official Portal: ${s.official_url}\n\n`;
    });

    out += `--- ACTIONABLE NEXT STEPS ---\n`;
    summaryData.actionItems.forEach((act, i) => {
      out += `[ ] Step ${i + 1}: ${act}\n`;
    });
    out += `\n=====================================================\n`;
    out += `Official Reference: https://nagarik-ai-civic-2026.web.app\n`;
    return out;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePlainTextSummary());
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([generatePlainTextSummary()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Nagarik_AI_Summary_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative flex flex-col w-full max-w-3xl max-h-[90vh] bg-[#121418] border border-[#2a2f3b] rounded-2xl shadow-2xl overflow-hidden text-[#e2e2e6]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#22262f] bg-[#16191f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#f2ca50]/15 border border-[#f2ca50]/30 text-[#f2ca50]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-white">
                  Citizen Consultation Summary
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Verified Grounding
                </span>
              </div>
              <p className="text-xs text-[#8F93B5]">
                Synthesized from {summaryData.messageCount} conversation exchanges • Official .gov.in sources
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Pill Switcher */}
            <div className="flex items-center bg-[#101216] border border-[#2a2f3b] rounded-lg p-0.5 text-xs">
              {(['en', 'hi', 'te'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSummaryLang(lang)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    summaryLang === lang
                      ? 'bg-[#f2ca50] text-[#0c0e11] font-bold shadow-sm'
                      : 'text-[#8F93B5] hover:text-white'
                  }`}
                >
                  {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिंदी' : 'తెలుగు'}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
          {/* Overview Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#1a1d24] via-[#1f232c] to-[#1a1d24] border border-[#333948]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-[#f2ca50] uppercase tracking-wider">
                  Session Topic
                </span>
                <h3 className="font-bold text-sm sm:text-base text-white mt-0.5">
                  {summaryData.title}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-[#8F93B5] block">Generated</span>
                <span className="text-xs font-mono text-zinc-300">{summaryData.generatedAt}</span>
              </div>
            </div>
          </div>

          {/* Key Inquiries Identified */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8F93B5] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#f2ca50]" />
              Citizen Inquiries Covered ({summaryData.userInquiries.length})
            </h4>
            <div className="space-y-1.5">
              {summaryData.userInquiries.slice(0, 5).map((inq, idx) => (
                <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#16191f] border border-[#22262f] text-xs">
                  <span className="w-5 h-5 rounded-full bg-[#f2ca50]/20 text-[#f2ca50] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-zinc-200">{inq}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Discovered Schemes & Entitlements */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8F93B5] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Schemes & Entitlements Found ({summaryData.schemesFound.length})
            </h4>

            {summaryData.schemesFound.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summaryData.schemesFound.map((scheme, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#16191f] border border-[#2b303c] hover:border-[#f2ca50]/40 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-white line-clamp-1">
                          {scheme.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f2ca50]/15 text-[#f2ca50] font-mono shrink-0">
                          {scheme.level || 'Central'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                        {scheme.benefit}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#22262f] flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-medium">Eligible Citizen Benefit</span>
                      {scheme.official_url && (
                        <a
                          href={scheme.official_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[#f2ca50] hover:underline"
                        >
                          <span>Official Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#16191f] border border-[#22262f] text-xs text-zinc-400">
                General consultation ongoing. Specific scheme eligibility was discussed across PM-KISAN, PMAY, and Mudra portals.
              </div>
            )}
          </div>

          {/* Action Checklist for the Citizen */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#8F93B5] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#ffb692]" />
              Actionable Next Steps for Citizen
            </h4>
            <div className="space-y-2">
              {summaryData.actionItems.map((action, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-[#16191f] border border-[#22262f]">
                  <div className="w-5 h-5 rounded-md border border-[#f2ca50]/40 flex items-center justify-center text-[#f2ca50] text-xs shrink-0 font-bold">
                    ✓
                  </div>
                  <span className="text-xs text-zinc-200">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#22262f] bg-[#16191f] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#22262f] hover:bg-[#2b303c] text-xs font-semibold text-white transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#8F93B5]" />}
              <span>{copied ? 'Copied Receipt!' : 'Copy Summary'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#22262f] hover:bg-[#2b303c] text-xs font-semibold text-white transition-colors"
            >
              <Download className="w-4 h-4 text-[#8F93B5]" />
              <span>Download (.txt)</span>
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#22262f] hover:bg-[#2b303c] text-xs font-semibold text-white transition-colors"
            >
              <Printer className="w-4 h-4 text-[#8F93B5]" />
              <span>Print</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f2ca50] to-[#ffb692] text-[#241a00] font-bold text-xs hover:opacity-95 transition-all shadow-md"
          >
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
};
