import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X, Activity, FastForward, FileText, Download, Copy, Check,
  ExternalLink, RefreshCw, AlertCircle, ShieldAlert, CheckCircle2, Clock
} from 'lucide-react';

interface GrievanceItem {
  tracking_id: string;
  citizen_name: string;
  department: string;
  category?: string;
  title: string;
  location: string;
  status: string;
  created_at?: string;
}

interface EscalationResult {
  tracking_id: string;
  escalation_type: string;
  statutory_act_quoted: string;
  subject_line: string;
  letter_body: string;
  action_note: string;
}

interface CivicGrievanceStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'en' | 'hi' | 'te';
}

const DEFAULT_GRIEVANCES: GrievanceItem[] = [
  {
    tracking_id: 'CP-2026-88192',
    citizen_name: 'Ramesh Sharma',
    department: 'Municipal Water Supply & Sewerage Board',
    category: 'Drinking Water Contamination',
    title: 'Contaminated brown sludge water pipeline breach in Ward 14',
    location: 'Bhavanipuram, Ward 14',
    status: 'In Progress'
  },
  {
    tracking_id: 'CP-2026-77341',
    citizen_name: 'Ananya Rao',
    department: 'Roads & Public Works Department (GHMC)',
    category: 'Dangerous Roadway Pothole',
    title: 'Deep crater pothole near Pillar 42 Main Road junction',
    location: 'Kukatpally, Pillar 42',
    status: 'Registered'
  },
  {
    tracking_id: 'CP-2026-66219',
    citizen_name: 'Mohammad Tariq',
    department: 'Southern Power Distribution Corporation (TSSPDCL)',
    category: 'Transformer Fire Hazard',
    title: 'Sparking high-voltage transformer near residential homes',
    location: 'Santosh Nagar Colony',
    status: 'Resolved'
  }
];

export const CivicGrievanceStudioModal: React.FC<CivicGrievanceStudioModalProps> = ({
  isOpen,
  onClose,
  currentLanguage
}) => {
  const [grievances, setGrievances] = useState<GrievanceItem[]>(DEFAULT_GRIEVANCES);
  const [simulatedDays, setSimulatedDays] = useState<{ [id: string]: number }>({});
  const [loading, setLoading] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationResult | null>(null);
  const [escalationLoading, setEscalationLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchGrievances();
    }
  }, [isOpen]);

  const fetchGrievances = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/api/v1/grievance/list');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setGrievances(res.data);
      }
    } catch {
      // Use rich default records if backend is offline
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateOverdue = async (trackingId: string) => {
    const newDays = (simulatedDays[trackingId] || 0) + 15;
    setSimulatedDays(prev => ({ ...prev, [trackingId]: newDays }));

    try {
      await axios.post('http://localhost:8000/portal/admin/toggle-status', {
        tracking_id: trackingId,
        status: 'Overdue'
      });
      fetchGrievances();
    } catch {
      // local update
      setGrievances(prev =>
        prev.map(g => g.tracking_id === trackingId ? { ...g, status: 'Overdue' } : g)
      );
    }
  };

  const handleOpenEscalation = async (trackingId: string, type: 'reminder' | 'appeal' | 'rti') => {
    setEscalationLoading(true);
    const days = (simulatedDays[trackingId] || 0) + 16;
    const targetGrievance = grievances.find(g => g.tracking_id === trackingId);

    try {
      const res = await axios.post('http://localhost:8000/api/v1/escalate', {
        tracking_id: trackingId,
        escalation_type: type,
        days_elapsed: days
      });
      setSelectedEscalation(res.data);
    } catch {
      // Fallback statutory letter synthesis
      let statutoryAct = 'Right to Public Services Act / Citizen Charter';
      let subject = `URGENT REMINDER: Unresolved Public Grievance (${trackingId})`;
      let actionNote = 'Submit to Ward Executive Engineer or Municipal Commissioner.';

      if (type === 'appeal') {
        statutoryAct = 'State Public Services Guarantee Act (First Appellate Authority)';
        subject = `FIRST STATUTORY APPEAL: Failure of Grievance Redressal Officer within Mandated SLA (${trackingId})`;
        actionNote = 'Submit to District Collector / First Appellate Authority.';
      } else if (type === 'rti') {
        statutoryAct = 'Right to Information Act, 2005 (Section 6(1))';
        subject = `RTI APPLICATION UNDER SEC 6(1): Inspection of Action Taken on Grievance Ref ${trackingId}`;
        actionNote = 'Submit with ₹10 Court Fee Stamp to Public Information Officer (PIO).';
      }

      const dept = targetGrievance?.department || 'Municipal Administration';
      const loc = targetGrievance?.location || 'Ward Area';
      const title = targetGrievance?.title || 'Public Civic Grievance';
      const name = targetGrievance?.citizen_name || 'Concerned Citizen';

      const letterBody = `TO:
The Public Information Officer / Grievance Redressal Authority,
Department of ${dept},
Jurisdiction: ${loc}

SUBJECT: ${subject}
REFERENCE GRIEVANCE TRACKING ID: ${trackingId}
MANDATED CITIZEN CHARTER SLA: 7 Days (Elapsed: ${days} Days)

RESPECTED SIR / MADAM,

I, ${name}, a lawful citizen residing at ${loc}, draw your urgent attention to the unresolved public complaint registered on the official municipal grievance portal under reference ${trackingId}:

INCIDENT DESCRIPTION:
"${title}"

STATUTORY GROUNDS:
Under the provisions of the ${statutoryAct}, public authorities are statutorily bound to remediate public hazards within the prescribed time limit. As ${days} days have elapsed without resolution:

PRAYERS & INFORMATION REQUESTED:
1. Provide the daily action taken report (ATR) on Grievance Reference ${trackingId}.
2. Provide the name, designation, and official contact details of the officer assigned to inspect and resolve this complaint.
3. State reasons for non-compliance with the citizen charter timeline.
4. Immediate inspection and dispatch of the required municipal repair team.

Sincerely,
${name}
Citizen of India
Tracking Ref: ${trackingId}
Generated via Nagarik AI Sovereign Legal Studio on ${new Date().toLocaleDateString()}`;

      setSelectedEscalation({
        tracking_id: trackingId,
        escalation_type: type.toUpperCase(),
        statutory_act_quoted: statutoryAct,
        subject_line: subject,
        letter_body: letterBody,
        action_note: actionNote
      });
    } finally {
      setEscalationLoading(false);
    }
  };

  const handleCopyDraft = () => {
    if (!selectedEscalation) return;
    navigator.clipboard.writeText(selectedEscalation.letter_body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDraft = () => {
    if (!selectedEscalation) return;
    const blob = new Blob([selectedEscalation.letter_body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statutory_${selectedEscalation.escalation_type}_${selectedEscalation.tracking_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#101216] border border-[#22262f] shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#22262f] bg-[#16191f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#f2ca50]/15 border border-[#f2ca50]/30 text-[#f2ca50]">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#e2e2e6]">
                  {currentLanguage === 'hi' ? 'न्याय सेतु — शिकायत ट्रैकर एवं आरटीआई स्टूडियो' : (currentLanguage === 'te' ? 'న్యాయ సేతు — ఫిర్యాదు ట్రాకర్ & ఆర్టీఐ స్టూడియో' : 'Nyaya Setu — Grievance Tracker & RTI Studio')}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Right to Service 2026
                </span>
              </div>
              <p className="text-xs text-[#8F93B5] mt-0.5">
                Audit citizen charter SLAs, simulate delays, and synthesize statutory RTI applications
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchGrievances}
              className="p-2 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#f2ca50]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-[#16191f] border border-[#22262f] flex items-center justify-between gap-3 text-xs text-[#8F93B5]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#f2ca50] shrink-0" />
              <span>
                Standard Civic SLA is <strong>7 Days</strong>. When overdue (15+ days), statutory escalation buttons activate.
              </span>
            </div>
            <a
              href="http://localhost:8000/portal/admin"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#f2ca50] hover:underline font-semibold shrink-0"
            >
              <span>Operator Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Grievance Ledger Table */}
          <div className="overflow-x-auto rounded-xl border border-[#22262f] bg-[#0c0e11]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#16191f] text-[#8F93B5] uppercase font-bold border-b border-[#22262f] tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tracking ID</th>
                  <th className="py-3 px-4">Citizen & Location</th>
                  <th className="py-3 px-4">Department & Issue</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Days Elapsed</th>
                  <th className="py-3 px-4 text-center">Statutory Escalations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22262f]/60">
                {grievances.map((g) => {
                  const days = (simulatedDays[g.tracking_id] || 0) + (g.status === 'Resolved' ? 2 : 4);
                  const isOverdue = days >= 15 || g.status === 'Overdue';

                  return (
                    <tr key={g.tracking_id} className="hover:bg-[#16191f]/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#ffb692]">
                        {g.tracking_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#e2e2e6]">{g.citizen_name}</div>
                        <div className="text-[#8F93B5] text-[11px]">{g.location}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#e2e2e6] max-w-xs truncate">{g.department}</div>
                        <div className="text-[#8F93B5] text-[11px] max-w-xs truncate">{g.title}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isOverdue
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : g.status === 'Resolved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isOverdue ? 'Overdue' : g.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#e2e2e6]">
                        {days} Days
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isOverdue && (
                            <button
                              onClick={() => handleSimulateOverdue(g.tracking_id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#f2ca50]/15 text-[#f2ca50] border border-[#f2ca50]/30 hover:bg-[#f2ca50]/25 transition-all flex items-center gap-1"
                              title="Simulate passing 15 days to test statutory escalation"
                            >
                              <FastForward className="w-3 h-3" />
                              <span>+15 Days</span>
                            </button>
                          )}
                          {isOverdue && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEscalation(g.tracking_id, 'reminder')}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600 hover:text-white transition-all"
                              >
                                Reminder
                              </button>
                              <button
                                onClick={() => handleOpenEscalation(g.tracking_id, 'appeal')}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-all"
                              >
                                1st Appeal
                              </button>
                              <button
                                onClick={() => handleOpenEscalation(g.tracking_id, 'rti')}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-600/30 text-red-300 border border-red-500/40 hover:bg-red-600 hover:text-white transition-all"
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

          {/* Statutory Escalation View Modal / Expansion */}
          {selectedEscalation && (
            <div className="p-4 rounded-xl border border-[#f2ca50]/40 bg-[#16191f] space-y-3 animate-fade-in shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[#22262f]">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#f2ca50] tracking-wider">
                    Official Statutory Drafting Tool
                  </span>
                  <h4 className="text-sm font-bold text-[#e2e2e6]">{selectedEscalation.subject_line}</h4>
                </div>
                <button
                  onClick={() => setSelectedEscalation(null)}
                  className="p-1 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-[#8F93B5]">
                <span>Quoted Statutory Authority: <strong className="text-white">{selectedEscalation.statutory_act_quoted}</strong></span>
              </div>

              <textarea
                rows={10}
                value={selectedEscalation.letter_body}
                onChange={(e) => setSelectedEscalation({ ...selectedEscalation, letter_body: e.target.value })}
                className="w-full p-3 font-mono text-xs rounded-xl bg-[#0c0e11] border border-[#22262f] text-[#e2e2e6] focus:outline-none focus:border-[#f2ca50]/50 leading-relaxed resize-none"
              />

              <div className="p-2.5 rounded-lg bg-[#22262f]/60 text-xs text-[#ffb692] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ffb692]" />
                <span><strong>Submission Protocol:</strong> {selectedEscalation.action_note} (Never auto-sent without signature).</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleCopyDraft}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#22262f] text-[#e2e2e6] hover:bg-[#2a2f3a] transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Petition!' : 'Copy to Clipboard'}</span>
                </button>
                <button
                  onClick={handleDownloadDraft}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#f2ca50] text-[#0c0e11] hover:brightness-105 transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Legal Petition (.txt)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
