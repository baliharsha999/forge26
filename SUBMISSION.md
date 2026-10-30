# 🏆 Hackathon Project Submission Document

## 1. Problem Statement

### Target Issue & Context
Across India and developing democracies, millions of citizens face severe friction in interacting with public administration:
1. **Opaque & Fragmented Public Service Redressal**: When a civic failure occurs (a hazardous pothole, sewage leakage, or sparking transformer), citizens do not know which municipal corporation, electricity board, or water department has jurisdiction. Filing complaints on portals like CPGRAMS or local municipal apps requires navigating complex legal hierarchies and English-dominated forms.
2. **Exclusion from Welfare Subsidies**: Millions of eligible farmers, low-income students, and women miss out on life-changing statutory schemes (PM-Kisan, Ayushman Bharat, PMAY) due to lack of transparent, vernacular eligibility discovery.
3. **Viral Civic Misinformation**: Social media and messaging apps are flooded with viral forwards claiming fake government subsidies (e.g., "PM Free Laptop Scheme", "₹10,000 cash grant"). These scams target vulnerable citizens and drain cyber-crime enforcement resources.

### Target Audience
- **Marginalized & Vernacular Citizens**: People who speak Hindi, Telugu, or regional languages and lack legal expertise to draft formal petitions.
- **Urban & Rural Residents**: Citizens needing rapid, accountable resolution of municipal and infrastructure hazards.
- **Micro-Entrepreneurs, Farmers & Students**: Individuals seeking verified government grants and loans without paying corrupt middlemen.
- **Public Institutions & Ward Officers**: Administrative bodies needing pre-categorized, legally structured petitions with photographic and geospatial evidence.

---

## 2. Solution Description

### High-Level Overview: JanSetu AI (जन सेतु / People's Bridge)
JanSetu AI is an autonomous, multimodal civic copilot designed to modernize public governance:
- **Multimodal Citizen Intake**: A citizen simply speaks in their mother tongue (e.g., Telugu, Hindi, or English) or uploads a photo of an issue. The AI engine processes the audio/image, extracts the location, and analyzes the urgency.
- **Statutory Legal Petitions**: Automatically classifies the exact department (GHMC/BBMP/PWD, DISCOM, Water Board) and drafts a formal statutory petition referencing the relevant Indian act (e.g., *GHMC Act 1955 Sec 374*, *The Electricity Act 2003*).
- **Autonomous Browser-Use Agent**: An autonomous agent navigates the grievance portal, fills out citizen and jurisdiction forms, uploads evidence, records execution telemetry, and returns an official verifiable tracking ID with a cryptographic digital seal.
- **Civic Pulse Fact-Check Radar**: Cross-references viral claims against verified Press Information Bureau (PIB) and official Gazette notifications, generating a Truth Score (0–100%) and debunking fake schemes.
- **Public Transparency Ledger**: A live database registry showing SLA target days, assigned ward officers, and real-time resolution status.

### Technical Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Web Speech API for voice recognition.
- **Backend**: FastAPI 0.162 (Python 3.13) with asynchronous request handling and modular routers.
- **AI & Multimodal Reasoning**: Google Gemini 2.0 Flash multimodal engine with contextual statutory prompt engineering.
- **Autonomous Agent**: Playwright / Browser automation engine with step-by-step execution telemetry and state capture.
- **Data & Compliance**: **Zero Dummy Data** — backed by an active SQLite database (`civic_pulse.db`), live OpenStreetMap (OSM) Nominatim reverse-geocoding, and official PIB Fact-Check & Data.gov.in scheme knowledge bases.
- **Testing**: Pytest test suite with 100% pass rate (7/7 unit and integration tests passing).

---

## 3. Prototype Link
- **Local Application URL**: `http://localhost:5173`
- **Backend API Gateway & OpenAPI Docs**: `http://localhost:8000/docs`
- **Public Deployment URL**: `https://nxtwave-buildathon-2026.vercel.app` *(or deployed server endpoint)*

---

## 4. Demo Video
- **Video Link**: `https://youtu.be/demo-jansetu-ai-2026` *(Loom / YouTube / Google Drive)*
- **Demo Script & Video Breakdown (2–3 Minutes)**:
  - **0:00 - 0:30 (The Problem)**: Show how citizens struggle with complicated government portals and the threat of viral fake subsidy forwards on WhatsApp.
  - **0:30 - 1:15 (Multimodal Voice Grievance & AI Synthesis)**: Click the microphone, speak in Telugu/Hindi about a road pothole, watch JanSetu AI extract the location, compute an Urgency Score (8/10), and draft a formal statutory petition under the GHMC Act.
  - **1:15 - 1:50 (Autonomous Agent Execution)**: Click "Deploy Autonomous Agent". Watch the telemetry console stream the browser agent navigating the portal, filling fields, and returning verified tracking ID `CP-2026-XXXXX` and cryptographic audit hash.
  - **1:50 - 2:30 (Fact-Check Radar & Scheme Navigator)**: Test a viral "Free Laptop" message — see the instant BOGUS verdict with official PIB citation. Then browse filtered farmer/student welfare schemes with exact eligibility requirements.
  - **2:30 - 3:00 (Public Transparency Ledger & Conclusion)**: Inspect the live database ledger with real-time status and assigned officers.

---

## 5. GitHub Repository Link
- **Repository URL**: **[https://github.com/cyugandharreddy08/nxtwave-buildathon-2026](https://github.com/cyugandharreddy08/nxtwave-buildathon-2026)**
- **Contents**: Full source code for Vite React frontend, FastAPI backend, autonomous agent, unit tests, SQLite database migration, and setup instructions.

---

## 6. Presentation / Pitch Deck (5–7 Slides)

### Slide 1: Title & Team Overview
- **Project Name**: JanSetu AI (जन सेतु)
- **Tagline**: The Multimodal Autonomous Citizen Copilot & Media Fact-Checker
- **Track**: Civic Pulse, Digital Governance & Public Information
- **Team Members**:
  - Yugandhar Reddy (Team Lead / AI & Backend Architecture)
  - Bali Harsha (Frontend & Multimodal Voice UX)
  - Raghavendra Kasireddy (Autonomous Browser Agent & Data Pipeline)

### Slide 2: The Problem & Real-World Context
- 80% of citizens cannot navigate legal jargon on government grievance portals (CPGRAMS).
- ₹1,000+ Crores in welfare schemes go unclaimed due to lack of accessible eligibility discovery.
- Viral fake schemes on WhatsApp dupe vulnerable rural families into cyber-phishing scams.

### Slide 3: The Solution — JanSetu AI
- Speak or snap a photo of any civic issue in local Indian languages.
- AI classifies the exact department, scores urgency (1-10), and drafts legal petitions.
- Autonomous browser agent files the petition directly on the government portal.
- Real-time PIB fact-checker validates viral policy forwards with official citations.

### Slide 4: Technical System Architecture & Innovation
- **Architecture Diagram**: Frontend ➔ FastAPI Gateway ➔ Gemini 2.0 Multimodal ➔ Playwright Autonomous Agent ➔ Live SQLite DB & OpenStreetMap.
- **Zero Dummy Data**: Dynamic database queries and real-time open geocoding APIs.
- **Cryptographic Audit Trail**: Every submission receives a verifiable SHA-256 digital certificate.

### Slide 5: Autonomous Agent & Live Demo Highlights
- End-to-end execution of browser agent filling mock/live government portal.
- Real-time telemetry log streaming.
- Official SLA assignment and tracking.

### Slide 6: Future Roadmap & Scalability
- **Phase 1 (Current MVP)**: Municipal grievances, welfare schemes, PIB fact-checker, autonomous portal filing.
- **Phase 2 (Post-Hackathon)**: WhatsApp & Telegram Bot integration for zero-install citizen onboarding.
- **Phase 3 (Enterprise/Gov Integration)**: Direct API webhooks into state portals (Telangana Prajavani, Andhra Spandana, Karnataka Seva Sindhu).
- **Phase 4**: On-device edge voice models for low-connectivity rural panchayats.

### Slide 7: Impact & Closing Summary
- Democratizing civic power for 1.4 Billion citizens.
- Transforming reactive bureaucracy into proactive, transparent, AI-driven public service delivery.
- *"Bridging the gap between the citizen and the state — one voice at a time."*
