import React, { useState } from 'react';
import {
  Download, ExternalLink, ShieldCheck, CheckCircle2,
  Copy, Check, X, Sparkles, Monitor, ArrowRight,
  FileCheck, Lock, AlertTriangle, Layers, Radio
} from 'lucide-react';
import { NagarikEmblem } from '../App';

interface AISaathiExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: 'en' | 'hi' | 'te';
}

export const AISaathiExtensionModal: React.FC<AISaathiExtensionModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'install' | 'architecture'>('simulator');
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  // Simulator State
  const [simStep, setSimStep] = useState<number>(1);
  const [simProblem, setSimProblem] = useState<string>('Broken storm water drain overflowing near Ward 14 market, causing mosquito breeding.');
  const [simCategory, setSimCategory] = useState<string>('Sanitation & Storm Drainage');
  const [simAadhaarDetected, setSimAadhaarDetected] = useState<boolean>(true);
  const [simAadhaarMasked, setSimAadhaarMasked] = useState<string>('XXXX-XXXX-4819');
  const [simVoiceActive, setSimVoiceActive] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(key);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#121418] border border-[#f2ca50]/40 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22262f] bg-[#16191f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1d24] border border-[#B8643A]/50 flex items-center justify-center shadow-sm">
              <NagarikEmblem className="w-6 h-6" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  AI Saathi — Civic Browser Guardian
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f2ca50]/20 text-[#f2ca50] border border-[#f2ca50]/40">
                  Chrome Extension
                </span>
              </div>
              <p className="text-xs text-[#8F93B5]">
                Real-time municipal portal guardian, voice autofill & UIDAI Aadhaar redaction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="./nagarik-extension.zip"
              download
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#f2ca50] text-[#241a00] font-bold text-xs hover:opacity-95 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center border-b border-[#22262f] bg-[#101216] px-6 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'simulator'
                ? 'border-[#f2ca50] text-[#f2ca50]'
                : 'border-transparent text-[#8F93B5] hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Interactive Sidepanel Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('install')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'install'
                ? 'border-[#f2ca50] text-[#f2ca50]'
                : 'border-transparent text-[#8F93B5] hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install in Chrome / Edge (3 Steps)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'architecture'
                ? 'border-[#f2ca50] text-[#f2ca50]'
                : 'border-transparent text-[#8F93B5] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manifest V3 Architecture</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* TAB 1: INTERACTIVE SIDEPANEL SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Simulated Browser Webpage Context */}
              <div className="md:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-[#16191f] border border-[#22262f] space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#8F93B5] border-b border-[#22262f] pb-2">
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-[#ffb692]">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      https://pgportal.gov.in/Grievance
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#8F93B5]">CPGRAMS Portal</span>
                  </div>

                  <h3 className="text-sm font-bold text-white">
                    Citizen Complaint Form (Government Portal)
                  </h3>

                  {/* Mock Form Fields */}
                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-[#8F93B5]">Aadhaar / Citizen Reference ID</label>
                      <div className="relative mt-1">
                        <input
                          type="text"
                          readOnly
                          value={simAadhaarDetected ? simAadhaarMasked : '5482-1920-4819'}
                          className="w-full bg-[#0c0e11] border border-[#B8643A]/40 rounded-lg px-3 py-1.5 text-xs text-[#f2ca50] font-mono"
                        />
                        <span className="absolute right-2.5 top-1.5 flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                          <ShieldCheck className="w-3 h-3" />
                          Masked
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#8F93B5]">Grievance Category (Auto-Classified)</label>
                      <input
                        type="text"
                        readOnly
                        value={simCategory}
                        className="w-full mt-1 bg-[#0c0e11] border border-[#22262f] rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-[#8F93B5]">Citizen Problem Statement</label>
                      <textarea
                        rows={3}
                        value={simProblem}
                        onChange={(e) => setSimProblem(e.target.value)}
                        className="w-full mt-1 bg-[#0c0e11] border border-[#22262f] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#f2ca50]/50"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      AI Saathi Content Script Active
                    </span>
                    <button
                      onClick={() => setSimStep(prev => (prev % 3) + 1)}
                      className="text-[#f2ca50] hover:underline"
                    >
                      Cycle Next Step →
                    </button>
                  </div>
                </div>

                {/* Features Highlight Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#16191f] border border-[#22262f] space-y-1">
                    <span className="text-[#f2ca50] font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Anti-Phishing
                    </span>
                    <p className="text-[11px] text-[#8F93B5]">
                      Blocks unauthorized non-.gov.in imposters impersonating CSCs.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-[#16191f] border border-[#22262f] space-y-1">
                    <span className="text-[#ffb692] font-bold flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5" />
                      Voice Co-Pilot
                    </span>
                    <p className="text-[11px] text-[#8F93B5]">
                      Reads form questions in Hindi, Telugu & English for low-literacy users.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Simulated AI Saathi Sidepanel (as seen in Chrome) */}
              <div className="md:col-span-6 flex flex-col rounded-2xl bg-[#0c0e11] border border-[#f2ca50]/40 overflow-hidden shadow-xl">
                {/* Sidepanel Top Header */}
                <div className="flex items-center justify-between p-3.5 border-b border-[#22262f] bg-[#16191f]">
                  <div className="flex items-center gap-2">
                    <NagarikEmblem className="w-5 h-5" size={20} />
                    <span className="text-xs font-bold text-white tracking-wide">
                      AI Saathi <span className="text-[#f2ca50]">Sidepanel</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSimVoiceActive(v => !v)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        simVoiceActive
                          ? 'bg-[#f2ca50]/20 text-[#f2ca50] border-[#f2ca50]/40'
                          : 'bg-white/5 text-[#8F93B5] border-transparent'
                      }`}
                    >
                      {simVoiceActive ? '🔊 Voice ON' : '🔇 Muted'}
                    </button>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                      LIVE DOM
                    </span>
                  </div>
                </div>

                {/* Sidepanel Live Wizard Body */}
                <div className="p-4 space-y-4 flex-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#8F93B5]">
                    <span className="font-semibold text-white">Step {simStep} of 3: Civic Triage</span>
                    <span className="text-[#f2ca50] font-mono">{simStep === 1 ? '33%' : simStep === 2 ? '66%' : '100%'}</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#1e2023] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#d4af37] to-[#f2ca50] h-full transition-all duration-300"
                      style={{ width: `${(simStep / 3) * 100}%` }}
                    />
                  </div>

                  {/* Dynamic Wizard Step Content */}
                  {simStep === 1 && (
                    <div className="p-3 rounded-xl bg-[#16191f] border border-[#22262f] space-y-2">
                      <div className="text-[#f2ca50] font-bold text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Autofill Verification</span>
                      </div>
                      <p className="text-[11px] text-[#e2e2e6] leading-relaxed">
                        Nagarik AI inspected the active portal DOM. The grievance requires municipal classification for <strong>Ward 14</strong>.
                      </p>
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => setSimStep(2)}
                          className="flex-1 py-1.5 rounded-lg bg-[#f2ca50] text-[#241a00] font-bold text-xs hover:opacity-95"
                        >
                          Confirm Classification
                        </button>
                      </div>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="p-3 rounded-xl bg-[#16191f] border border-[#22262f] space-y-2">
                      <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Aadhaar Masking Active</span>
                      </div>
                      <p className="text-[11px] text-[#e2e2e6] leading-relaxed">
                        Citizen Aadhaar ending with <strong>4819</strong> has been masked per UIDAI Section 29 compliance. Only the last 4 digits are shared with the municipal clerk.
                      </p>
                      <button
                        onClick={() => setSimStep(3)}
                        className="w-full py-1.5 rounded-lg bg-[#f2ca50] text-[#241a00] font-bold text-xs hover:opacity-95"
                      >
                        Proceed to Evidence Upload
                      </button>
                    </div>
                  )}

                  {simStep === 3 && (
                    <div className="p-3 rounded-xl bg-[#16191f] border border-emerald-500/40 space-y-2">
                      <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready to File Grievance</span>
                      </div>
                      <p className="text-[11px] text-[#e2e2e6] leading-relaxed">
                        All mandatory fields on <code>pgportal.gov.in</code> have been validated. Citizen receipt will be hashed with SHA-256 upon submission.
                      </p>
                      <button
                        onClick={() => setSimStep(1)}
                        className="w-full py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs hover:opacity-95"
                      >
                        Reset Simulator
                      </button>
                    </div>
                  )}

                  {/* Quick Extension Action */}
                  <a
                    href="./nagarik-extension.zip"
                    download
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-[#f2ca50]" />
                    <span>Download nagarik-extension.zip (365 KB)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STEP-BY-STEP INSTALLATION GUIDE */}
          {activeTab === 'install' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#16191f] border border-[#22262f] space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#f2ca50]" />
                  <span>How to Load AI Saathi Extension into Google Chrome or Microsoft Edge</span>
                </h3>

                <div className="space-y-3 pt-2">
                  {/* Step 1 */}
                  <div className="p-3 rounded-lg bg-[#0c0e11] border border-[#22262f] flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#f2ca50] text-[#241a00] font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </span>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-bold text-white">Download and Extract Extension Archive</h4>
                      <p className="text-[#8F93B5]">
                        Click the button below to download <code>nagarik-extension.zip</code> and unzip it to any folder on your laptop.
                      </p>
                      <div className="pt-1">
                        <a
                          href="./nagarik-extension.zip"
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f2ca50] text-[#241a00] font-bold text-xs hover:opacity-95"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download nagarik-extension.zip</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-lg bg-[#0c0e11] border border-[#22262f] flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#f2ca50] text-[#241a00] font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white">Open Chrome Extensions Manager</h4>
                        <button
                          onClick={() => handleCopy('url', 'chrome://extensions')}
                          className="text-[11px] text-[#f2ca50] flex items-center gap-1 hover:underline"
                        >
                          {copiedStep === 'url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedStep === 'url' ? 'Copied' : 'Copy URL'}</span>
                        </button>
                      </div>
                      <p className="text-[#8F93B5]">
                        Open a new browser tab, navigate to <code>chrome://extensions</code>, and toggle <strong>"Developer mode"</strong> in the top-right corner.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-lg bg-[#0c0e11] border border-[#22262f] flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#f2ca50] text-[#241a00] font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </span>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-bold text-white">Click "Load Unpacked" and Select Folder</h4>
                      <p className="text-[#8F93B5]">
                        Click the <strong>"Load unpacked"</strong> button in the top-left and select the extracted <code>extension</code> directory containing <code>manifest.json</code>.
                      </p>
                      <p className="text-emerald-400 font-semibold pt-1">
                        ✓ AI Saathi Civic Copilot icon will appear in your browser extension toolbar!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANIFEST ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#16191f] border border-[#22262f] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Manifest V3 File Structure & Host Permissions</h3>
                  <span className="text-[11px] font-mono text-[#f2ca50]">Version 1.0.1</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#0c0e11] border border-[#22262f] space-y-1 font-mono text-[11px]">
                    <div className="text-[#f2ca50] font-bold">Extension Package Tree:</div>
                    <div className="text-[#8F93B5] space-y-0.5">
                      <div>📁 extension/</div>
                      <div className="pl-3">├── 📄 manifest.json (V3)</div>
                      <div className="pl-3">├── 📁 background/service_worker.js</div>
                      <div className="pl-3">├── 📁 sidepanel/sidepanel.html, css, js</div>
                      <div className="pl-3">├── 📁 content/content_script.js</div>
                      <div className="pl-3">└── 📁 content/adapters/</div>
                      <div className="pl-6">├── cpgrams_adapter.js</div>
                      <div className="pl-6">└── generic_portal_adapter.js</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0c0e11] border border-[#22262f] space-y-1 text-[11px]">
                    <div className="text-[#ffb692] font-bold">Guaranteed Host Match Rules:</div>
                    <ul className="text-[#8F93B5] list-disc pl-4 space-y-1">
                      <li><code>https://*.gov.in/*</code> (Central & State Portals)</li>
                      <li><code>https://*.nic.in/*</code> (National Informatics Centre)</li>
                      <li><code>https://*.pgportal.gov.in/*</code> (CPGRAMS Grievances)</li>
                      <li><code>http://localhost:8000/*</code> (Local RAG Gateway)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#22262f] bg-[#16191f] text-xs text-[#8F93B5]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            UIDAI Aadhaar Redacted • Manifest V3 Native Sidepanel
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#22262f] text-white hover:bg-[#2b303b] font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
