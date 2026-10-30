# 🏛️ JanSetu AI (जन सेतु) — Civic Pulse & Digital Governance Copilot

[![Hackathon Track](https://img.shields.io/badge/Track-Civic%20Pulse%20%26%20Digital%20Governance-orange.svg)](https://github.com/cyugandharreddy08/nxtwave-buildathon-2026)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.162-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%20%2B%20Tailwind-blue.svg)](https://react.dev/)
[![Compliance](https://img.shields.io/badge/Data%20Rule-Zero%20Dummy%20Data%20(Active%20DB%20%2B%20APIs)-emerald.svg)](#zero-dummy-data-compliance)
[![Build Status](https://img.shields.io/badge/Tests-7%20Passed%20(100%25)-brightgreen.svg)](#running-the-test-suite)

> **JanSetu AI** is an autonomous, multimodal civic copilot designed for Indian public service delivery. It democratizes governance by enabling citizens—regardless of literacy level or language—to report civic grievances via speech/photos, discover government welfare schemes, verify viral social media policies against official Press Information Bureau (PIB) gazettes, and autonomously register petitions on municipal portals using autonomous agent workflows.

---

## 📌 1. Problem Statement
- **Target Issue & Context**: Navigating public administration in India is plagued by opaque bureaucracy, language barriers, complex legal acts, and lack of accountability in grievance redressal (e.g. CPGRAMS, municipal portals). Simultaneously, viral misinformation regarding bogus government grants and fake subsidies frequently dupes vulnerable populations.
- **Target Audience**: 
  1. Everyday citizens seeking swift civic resolution (damaged roads, water contamination, electricity hazards).
  2. Marginalized communities, farmers, students, and seniors needing easy access to statutory welfare schemes.
  3. Digital citizens seeking reliable verification of viral civic forwards before circulating them.

---

## 💡 2. Solution Overview
JanSetu AI bridges the gap between citizens, statutory governance, and public institutions through four integrated capabilities:
1. **Multimodal Regional Grievance Intake**: Voice input in regional Indian languages (Hindi, Telugu, English) or photo evidence parsing.
2. **Autonomous Browser-Use Agent**: Dispatches an agent that navigates the civic portal, fills out jurisdiction and grievance details, captures execution telemetry, and returns an official verifiable registration ID.
3. **Statutory Legal Grounding**: Auto-references applicable Indian governance acts (e.g., *The Motor Vehicles Act*, *GHMC Act 1955 Sec 374*, *The Electricity Act 2003*, *National Food Security Act 2013*).
4. **Civic Pulse Fact-Check Radar**: Cross-references viral claims against verified Press Information Bureau (PIB) and Gazette records with zero-tolerance for fake subsidies.
5. **Public Transparency Ledger**: Live SQLite-backed public ledger providing transparent SLA status, tracking, and assigned ward engineer records.

---

## 🏗️ 3. System Architecture

```mermaid
flowchart TD
    subgraph Citizen_Layer ["Citizen Interface (Vite + React + Tailwind)"]
        UI1["🎙️ Vernacular Voice Recognition (Web Speech API)"]
        UI2["📸 Photo Evidence Upload"]
        UI3["🔍 Fact-Check & Scheme Search"]
    end

    subgraph Backend_Gateway ["Backend Gateway (FastAPI 0.162)"]
        API1["POST /api/v1/grievance/analyze"]
        API2["POST /api/v1/grievance/submit"]
        API3["POST /api/v1/fact-check"]
        API4["GET /api/v1/schemes"]
    end

    subgraph AI_Agent_Engine ["AI Reasoning & Autonomous Agent Engine"]
        M1["Gemini 2.0 Multimodal Reasoner"]
        M2["Statutory Legal Classifier & Urgency Scorer"]
        M3["Playwright Autonomous Browser Agent"]
        M4["Telemetry Logger & Crypto Seal Generator"]
    end

    subgraph Data_Layer ["Live Data & Active Storage"]
        DB[(Active SQLite Database: civic_pulse.db)]
        OSM["OpenStreetMap / Nominatim Reverse Geocoding API"]
        PIB["PIB & Official Gazette Knowledge Base"]
        SCHEMES["Central & State Government Schemes Directory"]
    end

    UI1 --> API1
    UI2 --> API1
    UI3 --> API3

    API1 --> M1
    API1 --> M2
    API2 --> M3
    M3 --> M4
    M3 --> DB

    API3 --> PIB
    API4 --> SCHEMES
    API1 -.-> OSM
    DB --> UI1
```

---

## 🛡️ Zero Dummy Data Compliance
In strict adherence to hackathon technical rules:
- **No Static Hardcoded Mock Dictionaries**: All grievances are saved and queried from an **active SQLite database (`backend/civic_pulse.db`)** with dynamic SQL inserts and queries.
- **Real-Time Geocoding**: Integrated with the live **OpenStreetMap Nominatim API** to resolve geographic coordinates into administrative wards and districts.
- **Official Open Datasets**: Schemes and fact-checks are sourced directly from verified **PIB Fact Check Bulletins** and **Data.gov.in / MyScheme statutory records**.
- **Cryptographic Audit Trail**: Each submission produces a unique SHA-256 certificate hash and timestamped telemetry log.

---

## 👥 Team
- **[@cyugandharreddy08](https://github.com/cyugandharreddy08)** — System Architecture, AI Engine & Backend APIs
- **[@baliharsha999](https://github.com/baliharsha999)** — Frontend UX, Voice Interface & State Management
- **[@Raghavendra-Kasireddy](https://github.com/Raghavendra-Kasireddy)** — Autonomous Browser Agent, Data Pipeline & Testing

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Navigate to backend and create virtual environment
cd d:\buildathon
python -m venv backend\venv

# Activate virtual environment
# Windows:
.\backend\venv\Scripts\Activate.ps1
# Linux/macOS:
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
$env:PYTHONPATH="backend"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API Swagger Documentation will be available at: `http://localhost:8000/docs`*

### 2. Frontend Setup
```bash
cd d:\buildathon\frontend
npm install
npm run dev
```
*Frontend application will be live at: `http://localhost:5173`*

### 3. One-Click Start (Windows PowerShell)
```powershell
.\start.ps1
```

---

## 🧪 Running the Test Suite
Our codebase includes end-to-end integration and unit tests covering all core endpoints:
```powershell
$env:PYTHONPATH="backend"
.\backend\venv\Scripts\pytest backend\tests -v
```
**Results: 7 Passed (100% test pass rate)**
- `test_root`: Root gateway health
- `test_health`: DB connection verification
- `test_schemes_search`: Dynamic scheme querying
- `test_fact_check_bogus_claim`: Phishing/bogus subsidy detection
- `test_fact_check_verified_claim`: Cabinet gazette verification
- `test_grievance_analysis`: NLP classification and statutory routing
- `test_autonomous_grievance_submission`: End-to-end browser agent dispatch and DB persistence

---

## 📜 License
Built for the **NxtWave Buildathon 2026** under the MIT License.
