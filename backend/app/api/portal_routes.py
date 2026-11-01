from fastapi import APIRouter, Form, Request, HTTPException
from fastapi.responses import HTMLResponse
import random
from datetime import datetime
from app.db.database import get_db, list_all_grievances, get_grievance_by_tracking_id

portal_router = APIRouter(prefix="/portal")

PORTAL_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Unified Civic Redressal Portal - Municipal Corporation & Nagarik AI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --surface-lowest: #0c0e11;
      --surface-card: #16181b;
      --surface-elevated: #1a1c1f;
      --primary: #E58C5C;
      --primary-container: #B8643A;
      --gold: #f2ca50;
      --on-surface: #E8E9F2;
      --muted: #8F93B5;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--surface-lowest);
      color: var(--on-surface);
    }
    .font-space {
      font-family: 'Space Grotesk', monospace;
    }
    .glass-panel {
      background: rgba(22, 24, 27, 0.72);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(229, 140, 92, 0.18);
      box-shadow: 0 24px 60px -15px rgba(0, 0, 0, 0.75), inset 0 1px 1px rgba(255, 255, 255, 0.12);
    }
    .glass-input {
      background: rgba(12, 14, 17, 0.85);
      border: 1px solid rgba(143, 147, 181, 0.22);
      color: #E8E9F2;
      transition: all 0.2s ease-in-out;
    }
    .glass-input:focus {
      outline: none;
      border-color: #f2ca50;
      box-shadow: 0 0 0 2px rgba(242, 202, 80, 0.25), 0 0 18px rgba(242, 202, 80, 0.15);
    }
    .glass-input::placeholder {
      color: #5c607a;
    }
    .gold-gradient-text {
      background: linear-gradient(135deg, #f2ca50 0%, #E58C5C 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .ambient-glow {
      position: fixed;
      pointer-events: none;
      border-radius: 50%;
      filter: blur(90px);
      z-index: 0;
      opacity: 0.18;
    }
  </style>
</head>
<body class="min-h-screen relative overflow-x-hidden selection:bg-[#E58C5C] selection:text-[#0c0e11]">
  
  <!-- Ambient Luminous Glow Orbs -->
  <div class="ambient-glow bg-[#E58C5C] w-[450px] h-[450px] -top-32 -left-20"></div>
  <div class="ambient-glow bg-[#f2ca50] w-[400px] h-[400px] top-1/3 -right-24"></div>
  <div class="ambient-glow bg-[#3b82f6] w-[350px] h-[350px] -bottom-20 left-1/4"></div>

  <!-- Mandatory Notice Banner -->
  <div class="relative z-10 bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2 backdrop-blur-md">
    <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px]">!</span>
    <span>DEMO MUNICIPAL REDRESSAL PORTAL — Verified Sandbox for Nagarik AI Extension & Playwright Autofill Engine</span>
  </div>

  <!-- Header -->
  <header class="relative z-10 border-b border-white/5 bg-[#111316]/80 backdrop-blur-xl">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-3.5">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E58C5C]/20 to-[#f2ca50]/20 border border-[#f2ca50]/30 flex items-center justify-center text-xl shadow-lg shadow-[#E58C5C]/10">
          🏛️
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm sm:text-base font-bold text-white tracking-tight">Unified Municipal Redressal Gateway</h1>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E58C5C]/15 border border-[#E58C5C]/30 text-[#E58C5C]">DEMO GOV</span>
          </div>
          <p class="text-xs text-[#8F93B5]">Public Grievance Registration & Statutory Dispatch Division</p>
        </div>
      </div>
      <div>
        <a href="/portal/admin" class="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-[#1a1c1f] hover:bg-[#22252a] text-[#f2ca50] border border-[#f2ca50]/30 shadow-md transition-all">
          <span>Operator Console</span>
          <span class="text-[10px]">➔</span>
        </a>
      </div>
    </div>
  </header>

  <!-- Main Content Form -->
  <main class="relative z-10 max-w-2xl mx-auto px-4 py-8">
    <div class="glass-panel rounded-2xl p-6 sm:p-8">
      
      <!-- Submission Confirmation Card (Target of autofill dispatch) -->
      <div id="submission-confirmation" class="hidden mb-6 p-5 rounded-xl bg-gradient-to-br from-emerald-950/70 to-[#111316] border border-emerald-500/40 shadow-xl shadow-emerald-950/30 transition-all">
        <div class="flex items-center gap-2.5 text-emerald-400 font-bold text-sm mb-1.5">
          <div class="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xs">✓</div>
          <span>Grievance Officially Dispatched to Dispatch Queue</span>
        </div>
        <div class="text-xs text-emerald-300/80 mb-2">Statutory Tracking Reference Number:</div>
        <div id="tracking-id" class="text-2xl font-black text-[#f2ca50] font-space tracking-wider drop-shadow-md">CP-2026-00000</div>
        <div class="text-xs text-[#8F93B5] mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between">
          <span>Digital receipt logged in municipal ledger</span>
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">Filed & SLA Active</span>
        </div>
      </div>

      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-bold text-white tracking-tight">File a Citizen Grievance</h2>
        <span class="text-[11px] font-semibold text-[#f2ca50] flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-[#f2ca50] animate-ping"></span>
          Autofill Ready
        </span>
      </div>
      <p class="text-xs text-[#8F93B5] mb-6">Enter municipal complaint details manually or use the <strong class="text-[#E58C5C]">Nagarik AI Sidepanel</strong> for 1-click intelligent dispatch.</p>

      <form id="complaint-form" onsubmit="handleFormSubmit(event)" class="space-y-4">
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Citizen Name <span class="text-[#E58C5C]">*</span></label>
            <input type="text" id="citizen-name" name="citizen_name" required placeholder="Full legal name" class="glass-input w-full text-xs p-3 rounded-xl">
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Contact Mobile Number <span class="text-[#E58C5C]">*</span></label>
            <input type="tel" id="citizen-phone" name="citizen_phone" required placeholder="10-digit citizen mobile" class="glass-input w-full text-xs p-3 rounded-xl">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Responsible Municipal Department <span class="text-[#E58C5C]">*</span></label>
          <select id="department-select" name="department" required class="glass-input w-full text-xs p-3 rounded-xl cursor-pointer">
            <option value="" disabled selected class="bg-[#111316] text-[#8F93B5]">-- Select Responsible Department --</option>
            <option value="Municipal Corporation & Public Works" class="bg-[#111316] text-[#E8E9F2]">Municipal Corporation & Public Works</option>
            <option value="Water Supply & Sewerage Board" class="bg-[#111316] text-[#E8E9F2]">Water Supply & Sewerage Board</option>
            <option value="State Electricity Distribution Company (DISCOM)" class="bg-[#111316] text-[#E8E9F2]">State Electricity Distribution Company (DISCOM)</option>
            <option value="Solid Waste Management & Public Health" class="bg-[#111316] text-[#E8E9F2]">Solid Waste Management & Public Health</option>
            <option value="Civil Supplies & Consumer Affairs" class="bg-[#111316] text-[#E8E9F2]">Civil Supplies & Consumer Affairs</option>
          </select>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Issue Category <span class="text-[#E58C5C]">*</span></label>
            <input type="text" id="category-select" name="category" required placeholder="e.g. Water Pipeline Leakage" class="glass-input w-full text-xs p-3 rounded-xl">
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Urgency Level <span class="text-[#E58C5C]">*</span></label>
            <select id="urgency-select" name="urgency_level" required class="glass-input w-full text-xs p-3 rounded-xl cursor-pointer">
              <option value="" disabled selected class="bg-[#111316] text-[#8F93B5]">-- Select Urgency --</option>
              <option value="HIGH" class="bg-[#111316] text-amber-400 font-semibold">HIGH (Immediate Public Risk)</option>
              <option value="MEDIUM" class="bg-[#111316] text-[#E8E9F2]">MEDIUM (Standard Maintenance)</option>
              <option value="LOW" class="bg-[#111316] text-[#8F93B5]">LOW (General Inquiry)</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Exact Location / Ward / Landmark <span class="text-[#E58C5C]">*</span></label>
          <input type="text" id="location-input" name="location" required placeholder="House No., Street, Colony, Ward, Landmark" class="glass-input w-full text-xs p-3 rounded-xl">
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Detailed Description of Problem <span class="text-[#E58C5C]">*</span></label>
          <textarea id="description-textarea" name="description" rows="3" required placeholder="Describe the civic grievance, damage, and public impact in detail..." class="glass-input w-full text-xs p-3 rounded-xl resize-y"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-[#E8E9F2] mb-1.5">Photographic Evidence (Optional)</label>
          <input type="file" id="photo-upload" name="photo" accept="image/*" class="w-full text-xs text-[#8F93B5] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-[#E58C5C]/30 file:text-xs file:font-semibold file:bg-[#E58C5C]/15 file:text-[#E58C5C] hover:file:bg-[#E58C5C]/25 cursor-pointer">
        </div>

        <button type="submit" id="submit-button" class="w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide uppercase transition-all duration-200 bg-gradient-to-r from-[#E58C5C] via-[#ea996d] to-[#f2ca50] text-[#0c0e11] shadow-lg shadow-[#E58C5C]/20 hover:shadow-[#E58C5C]/35 hover:scale-[1.005] active:scale-[0.99] cursor-pointer">
          Submit Grievance to Municipal Dispatch
        </button>
      </form>
    </div>
  </main>

  <script>
    async function handleFormSubmit(e) {
      e.preventDefault();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const trackingId = 'CP-2026-' + randomNum;
      
      document.getElementById('tracking-id').innerText = trackingId;
      const conf = document.getElementById('submission-confirmation');
      conf.classList.remove('hidden');
      conf.scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>
"""

ADMIN_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Portal Operator Dashboard - Municipal Redressal Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --surface-lowest: #0c0e11;
      --surface-card: #16181b;
      --surface-elevated: #1a1c1f;
      --primary: #E58C5C;
      --gold: #f2ca50;
      --on-surface: #E8E9F2;
      --muted: #8F93B5;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--surface-lowest);
      color: var(--on-surface);
    }
    .font-space {
      font-family: 'Space Grotesk', monospace;
    }
    .glass-panel {
      background: rgba(22, 24, 27, 0.75);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border: 1px solid rgba(229, 140, 92, 0.18);
      box-shadow: 0 24px 60px -15px rgba(0, 0, 0, 0.75);
    }
  </style>
</head>
<body class="min-h-screen p-4 sm:p-8 bg-[#0c0e11] text-[#E8E9F2]">
  <div class="max-w-5xl mx-auto">
    <!-- Notice -->
    <div class="bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-amber-500/20 border border-amber-500/30 text-amber-300 px-4 py-2 text-center text-xs font-semibold rounded-xl mb-6 backdrop-blur-md">
      ⚠️ DEMO OPERATOR CONSOLE — Simulate statutory status changes (e.g. Overdue, Resolved) for live evaluation.
    </div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold text-white tracking-tight">Municipal Grievance Dispatch Console</h1>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f2ca50]/15 text-[#f2ca50] border border-[#f2ca50]/30">OPERATOR LEVEL</span>
        </div>
        <p class="text-xs text-[#8F93B5] mt-1">Real-time status transitions and civic SLA escalation unit</p>
      </div>
      <a href="/portal" class="text-xs self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold bg-[#1a1c1f] hover:bg-[#22252a] text-[#E58C5C] border border-[#E58C5C]/30 shadow-md transition">
        <span>← Back to Portal Form</span>
      </a>
    </div>

    <!-- Table Container -->
    <div class="glass-panel rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-[#111316]/90 border-b border-white/5 font-semibold text-[#8F93B5]">
            <tr>
              <th class="p-3.5">Ref ID</th>
              <th class="p-3.5">Citizen Details</th>
              <th class="p-3.5">Category</th>
              <th class="p-3.5">Current Status</th>
              <th class="p-3.5">Statutory Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5" id="records-body">
            <!-- Populated dynamically by JS -->
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    async function loadComplaints() {
      try {
        const res = await fetch('/api/v1/grievance/list');
        const data = await res.json();
        const tbody = document.getElementById('records-body');
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-xs text-[#8F93B5]">No civic grievances registered yet. Submit via /portal or Nagarik AI!</td></tr>';
          return;
        }

        data.forEach(item => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-white/[0.02] transition-colors';
          
          let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
          if (item.status === 'Resolved') badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          if (item.status === 'Overdue') badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
          if (item.status === 'In Progress') badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';

          tr.innerHTML = `
            <td class="p-3.5 font-space font-bold text-[#f2ca50]">${item.tracking_id}</td>
            <td class="p-3.5 font-medium text-white">${item.citizen_name || 'Anonymous Citizen'}<br><span class="text-[#8F93B5] text-[10px]">${item.district || 'General Ward'}</span></td>
            <td class="p-3.5 text-[#E8E9F2]">${item.category}</td>
            <td class="p-3.5"><span class="px-2 py-0.5 rounded-md font-bold text-[10px] border ${badgeColor}">${item.status}</span></td>
            <td class="p-3.5">
              <select onchange="updateStatus('${item.tracking_id}', this.value)" class="text-[11px] p-1.5 rounded-lg bg-[#0c0e11] text-[#E8E9F2] border border-[#8F93B5]/30 focus:border-[#f2ca50] outline-none">
                <option value="">Update...</option>
                <option value="Filed">Filed</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Overdue">Overdue (Trigger SLA)</option>
              </select>
            </td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error("Failed to load grievances:", err);
      }
    }

    async function updateStatus(trackingId, newStatus) {
      if (!newStatus) return;
      try {
        await fetch('/portal/admin/toggle-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tracking_id: trackingId, status: newStatus })
        });
        loadComplaints();
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    }

    loadComplaints();
  </script>
</body>
</html>
"""

@portal_router.get("", response_class=HTMLResponse)
@portal_router.get("/", response_class=HTMLResponse)
async def get_mock_portal():
    return HTMLResponse(content=PORTAL_HTML)

@portal_router.get("/admin", response_class=HTMLResponse)
@portal_router.get("/admin/", response_class=HTMLResponse)
async def get_portal_admin():
    return HTMLResponse(content=ADMIN_HTML)

@portal_router.post("/admin/toggle-status")
async def toggle_status(payload: dict):
    tracking_id = payload.get("tracking_id")
    new_status = payload.get("status")
    if not tracking_id or not new_status:
        raise HTTPException(status_code=400, detail="Missing tracking_id or status")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE grievances SET status = ? WHERE tracking_id = ?", (new_status, tracking_id))
    conn.commit()
    conn.close()
    return {"success": True, "tracking_id": tracking_id, "new_status": new_status}
