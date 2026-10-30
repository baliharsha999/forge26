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
  <title>DEMO Civic Redressal Portal - Municipal Corporation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800 font-sans min-h-screen">
  
  <!-- Mandatory Notice Banner -->
  <div class="bg-amber-500 text-slate-900 px-4 py-2 text-center text-xs font-bold tracking-wide shadow-sm flex items-center justify-center gap-2">
    <span>⚠️ DEMO MUNICIPAL PORTAL — Not a real government site. Built for testing & Playwright automation.</span>
  </div>

  <header class="bg-blue-900 text-white shadow-md">
    <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="bg-white/10 p-2 rounded-lg text-2xl font-bold">🏛️</div>
        <div>
          <h1 class="text-lg font-bold">Unified Municipal Redressal Gateway</h1>
          <p class="text-xs text-blue-200">Public Grievance Registration & Dispatch Unit (Mock)</p>
        </div>
      </div>
      <div>
        <a href="/portal/admin" class="text-xs bg-blue-800 hover:bg-blue-700 text-blue-100 px-3 py-1.5 rounded font-medium transition">
          Operator Dashboard ➔
        </a>
      </div>
    </div>
  </header>

  <main class="max-w-2xl mx-auto px-4 py-8">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      
      <div id="submission-confirmation" class="hidden mb-6 p-5 bg-emerald-50 border-2 border-emerald-500 rounded-xl">
        <div class="text-emerald-800 font-bold text-sm mb-1">✅ Grievance Officially Dispatched!</div>
        <div class="text-xs text-emerald-700 mb-2">Tracking Reference Number:</div>
        <div id="tracking-id" class="text-2xl font-black text-emerald-900 font-mono tracking-wider">CP-2026-00000</div>
        <div class="text-xs text-slate-500 mt-2">Screenshot receipt generated. Status: <span class="font-semibold text-emerald-700">Filed</span></div>
      </div>

      <h2 class="text-base font-bold text-slate-900 mb-1">File a Public Grievance</h2>
      <p class="text-xs text-slate-500 mb-6">Enter details below or let JanSetu autonomous agent fill it automatically.</p>

      <form id="complaint-form" onsubmit="handleFormSubmit(event)" class="space-y-4">
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Citizen Name *</label>
            <input type="text" id="citizen-name" name="citizen_name" required placeholder="Enter full name" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-600">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Contact Mobile Number *</label>
            <input type="tel" id="citizen-phone" name="citizen_phone" required placeholder="10-digit mobile number" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-600">
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Responsible Municipal Department *</label>
          <select id="department-select" name="department" required class="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-600">
            <option value="" disabled selected>-- Select Responsible Department --</option>
            <option value="Municipal Corporation & Public Works">Municipal Corporation & Public Works</option>
            <option value="Water Supply & Sewerage Board">Water Supply & Sewerage Board</option>
            <option value="State Electricity Distribution Company (DISCOM)">State Electricity Distribution Company (DISCOM)</option>
            <option value="Solid Waste Management & Public Health">Solid Waste Management & Public Health</option>
            <option value="Civil Supplies & Consumer Affairs">Civil Supplies & Consumer Affairs</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Issue Category *</label>
            <input type="text" id="category-select" name="category" required placeholder="e.g. Water Pipeline Leakage" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-600">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Urgency Level *</label>
            <select id="urgency-select" name="urgency_level" required class="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-600">
              <option value="" disabled selected>-- Select Urgency --</option>
              <option value="HIGH">HIGH (Immediate Safety Risk)</option>
              <option value="MEDIUM">MEDIUM (Standard Maintenance)</option>
              <option value="LOW">LOW (General Inquiry)</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Exact Location / Ward / Landmark *</label>
          <input type="text" id="location-input" name="location" required placeholder="House No., Street, Colony, Ward, Landmark" class="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-600">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Detailed Description of Problem *</label>
          <textarea id="description-textarea" name="description" rows="3" required placeholder="Describe the civic grievance and damage in detail..." class="w-full text-xs p-2.5 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-600"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Photographic Evidence (Optional)</label>
          <input type="file" id="photo-upload" name="photo" accept="image/*" class="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
        </div>

        <button type="submit" id="submit-button" class="w-full py-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition">
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
      document.getElementById('submission-confirmation').classList.remove('hidden');
      document.getElementById('submission-confirmation').scrollIntoView({ behavior: 'smooth' });
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
  <title>Portal Operator Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800 font-sans p-6">
  <div class="max-w-5xl mx-auto">
    <div class="bg-amber-500 text-slate-900 px-4 py-2 text-center text-xs font-bold rounded-lg mb-6">
      ⚠️ DEMO OPERATOR DASHBOARD — Use this to simulate status changes (e.g. Overdue) for buildathon evaluation.
    </div>

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-900">Municipal Grievance Dispatch Console</h1>
        <p class="text-xs text-slate-500">Live operator status toggles for demo verification</p>
      </div>
      <a href="/portal" class="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg">Back to Portal Form</a>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
          <tr>
            <th class="p-3">Ref ID</th>
            <th class="p-3">Citizen</th>
            <th class="p-3">Category</th>
            <th class="p-3">Current Status</th>
            <th class="p-3">Toggle Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100" id="records-body">
          <!-- Populated by JS -->
        </tbody>
      </table>
    </div>
  </div>

  <script>
    async function loadComplaints() {
      const res = await fetch('/api/v1/grievance/list');
      const data = await res.json();
      const tbody = document.getElementById('records-body');
      tbody.innerHTML = '';
      
      data.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50';
        tr.innerHTML = `
          <td class="p-3 font-mono font-bold text-blue-700">${item.tracking_id}</td>
          <td class="p-3">${item.citizen_name}<br><span class="text-slate-400 text-[10px]">${item.district}</span></td>
          <td class="p-3">${item.category}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-800">${item.status}</span></td>
          <td class="p-3">
            <select onchange="updateStatus('${item.tracking_id}', this.value)" class="text-[11px] p-1 rounded border border-slate-300">
              <option value="">Change...</option>
              <option value="Filed">Filed</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Overdue">Overdue</option>
            </select>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    async function updateStatus(trackingId, newStatus) {
      if (!newStatus) return;
      await fetch('/portal/admin/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracking_id: trackingId, status: newStatus })
      });
      loadComplaints();
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
