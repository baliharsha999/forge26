import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def create_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6] # Blank slide layout

    # Color Palette Tokens
    C_MIDNIGHT = RGBColor(11, 12, 30)      # #0B0C1E
    C_SLATE = RGBColor(37, 42, 72)         # #252A48
    C_SLATE_BORDER = RGBColor(59, 66, 107) # #3B426B
    C_ORANGE = RGBColor(217, 123, 74)      # #D97B4A
    C_GOLD = RGBColor(242, 184, 75)        # #F2B84B
    C_TEXT = RGBColor(232, 233, 242)       # #E8E9F2
    C_MUTED = RGBColor(155, 160, 192)      # #9BA0C0
    C_GREEN = RGBColor(34, 197, 94)        # #22C55E
    C_WHITE = RGBColor(255, 255, 255)
    C_INK = RGBColor(11, 12, 30)

    assets_dir = os.path.abspath(r"d:\buildathon\docs\presentation\assets")
    diya_img = os.path.join(assets_dir, "diya_3d_render.jpg")
    maze_img = os.path.join(assets_dir, "bureaucratic_maze_3d.jpg")
    copilot_img = os.path.join(assets_dir, "copilot_pipeline_3d.jpg")
    tools_img = os.path.join(assets_dir, "tools_dashboard_3d.jpg")
    rag_img = os.path.join(assets_dir, "rag_architecture_3d.jpg")
    shield_img = os.path.join(assets_dir, "security_shield_3d.jpg")
    setu_img = os.path.join(assets_dir, "roadmap_setu_3d.jpg")

    def add_bg(slide, color):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = color
        bg.line.fill.background()
        return bg

    def add_header(slide, tag_text, title_text, dark_mode=True):
        # Tag Pill
        tag_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.5), Inches(3.8), Inches(0.38))
        tag_box.fill.solid()
        tag_box.fill.fore_color.rgb = C_SLATE if dark_mode else RGBColor(190, 95, 50)
        tag_box.line.color.rgb = C_GOLD if dark_mode else C_GOLD
        tag_box.line.width = Pt(1)
        tf = tag_box.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = tag_text.upper()
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_GOLD if dark_mode else C_WHITE
        p.alignment = PP_ALIGN.CENTER

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.95), Inches(11.7), Inches(0.65))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(24)
        p_t.font.bold = True
        p_t.font.color.rgb = C_TEXT if dark_mode else C_INK

    def add_card(slide, left, top, width, height, title, body_lines, accent_color=None):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = C_SLATE
        card.line.color.rgb = accent_color if accent_color else C_SLATE_BORDER
        card.line.width = Pt(1.5 if accent_color else 1)
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.18)
        tf.margin_bottom = Inches(0.18)

        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = accent_color if accent_color else C_GOLD

        for line in body_lines:
            p2 = tf.add_paragraph()
            p2.text = line
            p2.font.size = Pt(10)
            p2.font.color.rgb = C_TEXT
            p2.space_before = Pt(4)
        return card

    # =========================================================================
    # SLIDE 1: HOOK (3D Diya Hero Render)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    add_bg(s1, C_ORANGE)

    # Left content column
    left_w = Inches(6.8)
    
    # Event badge
    b1 = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.9), Inches(1.0), Inches(5.0), Inches(0.42))
    b1.fill.solid()
    b1.fill.fore_color.rgb = C_INK
    b1.line.color.rgb = C_GOLD
    b1.line.width = Pt(1)
    tf1 = b1.text_frame
    p = tf1.paragraphs[0]
    p.text = "FORGE BUILDATHON · CIVIC PULSE · 48 HRS"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_GOLD
    p.alignment = PP_ALIGN.CENTER

    # Brand Title
    tb_title = s1.shapes.add_textbox(Inches(0.85), Inches(1.6), left_w, Inches(1.3))
    tf = tb_title.text_frame
    p = tf.paragraphs[0]
    p.text = "Nagarik AI\n(नागरिक AI)"
    p.font.size = Pt(44)
    p.font.bold = True
    p.font.color.rgb = C_INK

    # Tagline
    tb_tag = s1.shapes.add_textbox(Inches(0.85), Inches(3.1), left_w, Inches(0.5))
    tf = tb_tag.text_frame
    p = tf.paragraphs[0]
    p.text = "Empowering Every Citizen Through Sovereign AI"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = RGBColor(60, 25, 10)

    # Hook Card
    h_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.85), Inches(3.9), Inches(6.0), Inches(1.6))
    h_card.fill.solid()
    h_card.fill.fore_color.rgb = C_INK
    h_card.line.color.rgb = C_GOLD
    h_card.line.width = Pt(1.5)
    tf = h_card.text_frame
    tf.margin_left = Inches(0.3)
    tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "“ Millions qualify. Few can find out. ”"
    p.font.size = Pt(20)
    p.font.bold = True
    p.font.color.rgb = C_GOLD
    p2 = tf.add_paragraph()
    p2.text = "A zero-knowledge civic intelligence copilot bridging 1.4 billion citizens to life-changing government welfare in their own language."
    p2.font.size = Pt(11)
    p2.font.color.rgb = C_TEXT
    p2.space_before = Pt(6)

    # Foot metadata
    tb_foot = s1.shapes.add_textbox(Inches(0.85), Inches(5.8), Inches(6.0), Inches(0.9))
    tf = tb_foot.text_frame
    p = tf.paragraphs[0]
    p.text = "Live Demo: https://nagarik-ai-civic-2026.web.app\nGitHub: github.com/cyugandharreddy08/Nagarik-AI\nTeam: @cyugandharreddy08 · @baliharsha999 · @Raghavendra-Kasireddy"
    p.font.size = Pt(10.5)
    p.font.color.rgb = RGBColor(40, 15, 5)

    # 3D Diya Image (Right Frame)
    if os.path.exists(diya_img):
        pic = s1.shapes.add_picture(diya_img, Inches(7.4), Inches(1.0), Inches(5.1), Inches(5.5))
        pic.line.color.rgb = C_GOLD
        pic.line.width = Pt(2)

    # Speaker Notes
    s1.notes_slide.notes_text_frame.text = (
        "Judges and attendees, welcome to Nagarik AI. Across India today, over 5,000 welfare schemes exist. "
        "Yet millions of low-income families, elderly citizens, and rural workers remain excluded simply because they do not know what they qualify for. "
        "Nagarik AI bridges this gap with sovereign AI and zero-knowledge privacy."
    )

    # =========================================================================
    # SLIDE 2: THE PROBLEM (3D Bureaucratic Maze Render)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_bg(s2, C_MIDNIGHT)
    add_header(s2, "Problem Statement #2 · Civic Discovery", "The Broken Journey: Why Millions Fall Through the Bureaucratic Maze")

    # Left: 3D Bureaucratic Maze Image
    if os.path.exists(maze_img):
        pic = s2.shapes.add_picture(maze_img, Inches(0.8), Inches(1.8), Inches(5.4), Inches(4.8))
        pic.line.color.rgb = C_ORANGE
        pic.line.width = Pt(1.5)

    # Right: 5 Failure Points Cards
    card_w = Inches(5.9)
    card_h = Inches(0.85)
    top_base = Inches(1.8)
    spacing = Inches(0.98)

    failure_data = [
        ("1. Scattered Welfare Information", "Schemes are fragmented across 50+ ministries, state portals, and district sites.", C_ORANGE),
        ("2. Legalistic Eligibility Rules", "Criteria are buried in 40-page administrative gazettes with conflicting conditions.", C_GOLD),
        ("3. Hidden Document Checklists", "Citizens visit offices 3+ times before learning what certificates are actually needed.", C_ORANGE),
        ("4. Linguistic & Digital Divide", "Complex portals offer only English and one regional language; no native voice guidance.", C_GOLD),
        ("5. Zero Unified Application View", "No dashboard tells a citizen: 'Here is what you qualify for, and what to do next'.", C_ORANGE),
    ]

    for i, (title, desc, col) in enumerate(failure_data):
        c_top = top_base + (i * spacing)
        add_card(s2, Inches(6.5), c_top, card_w, card_h, title, [desc], col)

    s2.notes_slide.notes_text_frame.text = (
        "Look at the citizen journey today: ask around, navigate broken portals, make repeated visits, and finally give up or pay an intermediary. "
        "The five failure points highlight why this is not an awareness problem alone—it is a systemic structural barrier that hits the most vulnerable hardest."
    )

    # =========================================================================
    # SLIDE 3: OUR SOLUTION (3D Browser Copilot Pipeline Render)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_bg(s3, C_MIDNIGHT)
    add_header(s3, "Civic Copilot Architecture", "One Plain-Language Conversation. Direct Welfare Redressal.")

    # 4-Step Loop horizontal cards
    step_w = Inches(2.7)
    step_h = Inches(1.2)
    step_y = Inches(1.75)
    steps = [
        ("1. Speak Situation", "Voice input in Telugu, Hindi, or English plain language.", C_ORANGE),
        ("2. Discover Schemes", "Instant RAG semantic matching against 15+ verified schemes.", C_GOLD),
        ("3. Understand Rules", "Clear eligibility reasoning & document checklist with SLA.", C_ORANGE),
        ("4. Safe Auto-Fill", "In-page portal auto-fill via Shadow DOM. Zero auto-submit.", C_GOLD),
    ]
    for i, (stitle, sdesc, scol) in enumerate(steps):
        add_card(s3, Inches(0.8 + (i * 2.95)), step_y, step_w, step_h, stitle, [sdesc], scol)

    # Bottom Split: 3D Copilot image on left, Before/After Comparison on right
    if os.path.exists(copilot_img):
        pic = s3.shapes.add_picture(copilot_img, Inches(0.8), Inches(3.2), Inches(5.6), Inches(3.6))
        pic.line.color.rgb = C_GOLD
        pic.line.width = Pt(1.5)

    # Before / After Card
    ba_card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.7), Inches(3.2), Inches(5.8), Inches(3.6))
    ba_card.fill.solid()
    ba_card.fill.fore_color.rgb = C_SLATE
    ba_card.line.color.rgb = C_SLATE_BORDER
    ba_card.line.width = Pt(1.5)
    tf = ba_card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.25)
    tf.margin_right = Inches(0.25)
    tf.margin_top = Inches(0.2)

    p = tf.paragraphs[0]
    p.text = "BEFORE VS. AFTER WITH NAGARIK AI"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_GOLD

    p = tf.add_paragraph()
    p.text = "❌ TODAY'S BROKEN REALITY:"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = RGBColor(239, 68, 68)
    p.space_before = Pt(8)

    p = tf.add_paragraph()
    p.text = "• 6+ disconnected state and central portals\n• 3 to 5 physical visits to CSC / Taluk offices\n• High cost paid to informal middlemen\n• Weeks lost to incomplete application forms"
    p.font.size = Pt(10)
    p.font.color.rgb = C_MUTED
    p.space_before = Pt(2)

    p = tf.add_paragraph()
    p.text = "✅ WITH NAGARIK AI COPILOT:"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_GREEN
    p.space_before = Pt(8)

    p = tf.add_paragraph()
    p.text = "• One conversational interface in native mother tongue\n• Automated eligibility deduction and verified source citations\n• Assisted form filling right inside the official portal\n• Zero PII leakage with in-browser Aadhaar redaction"
    p.font.size = Pt(10)
    p.font.color.rgb = C_TEXT
    p.space_before = Pt(2)

    s3.notes_slide.notes_text_frame.text = (
        "With Nagarik AI, the journey collapses from 6 portals and 3 physical visits down to one plain-language conversation. "
        "The citizen speaks in Telugu, Hindi, or English, sees exact eligibility reasoning, and receives guided form assistance right on the official portal."
    )

    # =========================================================================
    # SLIDE 4: KEY FEATURES (3D Tools Dashboard Render)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_bg(s4, C_MIDNIGHT)
    add_header(s4, "Core Capabilities", "Six Practical Civic Tools Engineered for Zero Guesswork")

    # 3D Tools Image on Left
    if os.path.exists(tools_img):
        pic = s4.shapes.add_picture(tools_img, Inches(0.8), Inches(1.8), Inches(5.4), Inches(4.8))
        pic.line.color.rgb = C_GOLD
        pic.line.width = Pt(1.5)

    # 6 Feature cards on right in 2x3 grid
    tools = [
        ("Voice in Mother Tongue", "Telugu, Hindi, and English with live STT and native accents.", C_GOLD),
        ("15 Verified Schemes", "Curated official dataset linked to apisetu.gov.in myScheme.", C_ORANGE),
        ("Eligibility Matcher", "Real criteria ranking engine with deterministic scoring.", C_GOLD),
        ("Safe In-Page Auto-Fill", "Shadow DOM form filler. NEVER auto-submits; citizen enters OTP.", C_ORANGE),
        ("3-Outcome Claim Verifier", "Matches official source, Contradicts source, or Couldn't verify.", C_GOLD),
        ("Statutory Escalation", "1-click generation of Reminders, First Appeals, and RTI petitions.", C_ORANGE),
    ]

    col_w = Inches(2.9)
    col_h = Inches(1.35)
    for idx, (t_name, t_desc, t_col) in enumerate(tools):
        r = idx // 2
        c = idx % 2
        x = Inches(6.5 + (c * 3.1))
        y = Inches(1.8 + (r * 1.65))
        add_card(s4, x, y, col_w, col_h, t_name, [t_desc], t_col)

    s4.notes_slide.notes_text_frame.text = (
        "Every single feature is built with extreme respect for governance ethics. "
        "Notice our safety rule: Nagarik AI never submits forms automatically. The citizen retains complete agency, enters CAPTCHA and OTP themselves, while the extension eliminates tedious manual entry."
    )

    # =========================================================================
    # SLIDE 5: TECHNICAL ARCHITECTURE (3D RAG Server Pipeline Render)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_bg(s5, C_MIDNIGHT)
    add_header(s5, "High-Performance Engineering", "Sovereign Architecture: Grounded RAG & Shadow DOM Extension")

    # 3D RAG Architecture Image on Left
    if os.path.exists(rag_img):
        pic = s5.shapes.add_picture(rag_img, Inches(0.8), Inches(1.8), Inches(5.4), Inches(4.8))
        pic.line.color.rgb = C_ORANGE
        pic.line.width = Pt(1.5)

    # Technical Deep Dive Cards on Right
    arch_specs = [
        ("Chrome MV3 Side Panel", "Native extension side-panel communicating over secure runtime messaging. Injects portal adapters via synthetic DOM events.", C_GOLD),
        ("FastAPI Sovereign Backend", "High-throughput asynchronous Python microservices hosting RAG retrieval, vector search, and API Setu integration.", C_ORANGE),
        ("Strict Grounded RAG Pipeline", "Curated official scheme database with verbatim text embeddings. Zero LLM hallucination—responses cite official source URLs.", C_GOLD),
        ("Statutory Petition Engine", "Automated formal drafting of Section 6(1) RTI applications, First Appeals under RPSA, and SLA reminder notices.", C_ORANGE),
    ]

    for i, (a_title, a_desc, a_col) in enumerate(arch_specs):
        y = Inches(1.8 + (i * 1.25))
        add_card(s5, Inches(6.5), y, Inches(6.0), Inches(1.15), a_title, [a_desc], a_col)

    s5.notes_slide.notes_text_frame.text = (
        "Here is our production architecture. The Chrome MV3 side panel talks directly to our FastAPI sovereign backend. "
        "The SchemeProvider integrates live API Setu data with an offline verified cache. Answers are strictly grounded in retrieved scheme text to eliminate hallucinations."
    )

    # =========================================================================
    # SLIDE 6: SIMPLICITY + TRUST (3D Sovereign Security Shield Render)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_bg(s6, C_MIDNIGHT)
    add_header(s6, "Security & Verification", "Safe by Design: 100% Audit Tested & Zero-Knowledge Privacy")

    # 3D Shield Image on Left
    if os.path.exists(shield_img):
        pic = s6.shapes.add_picture(shield_img, Inches(0.8), Inches(1.8), Inches(5.4), Inches(4.8))
        pic.line.color.rgb = C_GREEN
        pic.line.width = Pt(1.5)

    # Right: 4 Golden Metric Counters + Trust Safeguards
    # Top 4 Metrics Grid
    metrics = [
        ("14 / 14", "Tests Passing\nPortal contracts & adapters"),
        ("15", "Verified Schemes\nHand-audited with official URLs"),
        ("3", "Native Languages\nTelugu, Hindi, and English"),
        ("0", "Forced Submissions\nCitizen controls OTP/CAPTCHA"),
    ]

    m_w = Inches(2.9)
    m_h = Inches(1.3)
    for i, (m_val, m_lbl) in enumerate(metrics):
        r = i // 2
        c = i % 2
        x = Inches(6.5 + (c * 3.1))
        y = Inches(1.8 + (r * 1.45))
        card = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, m_w, m_h)
        card.fill.solid()
        card.fill.fore_color.rgb = C_SLATE
        card.line.color.rgb = C_GOLD
        card.line.width = Pt(1.5)
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.15)
        p = tf.paragraphs[0]
        p.text = m_val
        p.font.size = Pt(24)
        p.font.bold = True
        p.font.color.rgb = C_GOLD
        p2 = tf.add_paragraph()
        p2.text = m_lbl
        p2.font.size = Pt(10)
        p2.font.color.rgb = C_TEXT
        p2.space_before = Pt(2)

    # Bottom Safeguard Banner
    safe_banner = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.5), Inches(4.9), Inches(6.0), Inches(1.7))
    safe_banner.fill.solid()
    safe_banner.fill.fore_color.rgb = C_SLATE
    safe_banner.line.color.rgb = C_GREEN
    safe_banner.line.width = Pt(1.5)
    tf = safe_banner.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.25)
    tf.margin_top = Inches(0.15)
    p = tf.paragraphs[0]
    p.text = "🔒 ZERO-KNOWLEDGE AADHAAR & PII PROTECTION"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_GREEN
    p2 = tf.add_paragraph()
    p2.text = "• In-browser 12-digit Aadhaar regex detection and automatic masking before network requests.\n• All AI API keys reside on the secure backend; extension requests only minimal permissions.\n• Receipt Tracker auto-captures tracking numbers (e.g. CP-2026-XXXXX) for transparent status tracking."
    p2.font.size = Pt(10)
    p2.font.color.rgb = C_TEXT
    p2.space_before = Pt(4)

    s6.notes_slide.notes_text_frame.text = (
        "Trust is our foundational pillar. We run 14 automated tests across portal selectors, fact-checking, and escalation logic. "
        "Aadhaar numbers are instantly masked in the browser. Zero personal identifiable information is ever stored or leaked."
    )

    # =========================================================================
    # SLIDE 7: ROADMAP + CLOSE (3D Roadmap Setu Bridge Render)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    add_bg(s7, C_ORANGE)
    add_header(s7, "Future Scope & Closing", "Expanding from 48-Hour Build to National Scale", dark_mode=False)

    # 3D Setu Bridge Image on Left
    if os.path.exists(setu_img):
        pic = s7.shapes.add_picture(setu_img, Inches(0.8), Inches(1.8), Inches(5.4), Inches(4.8))
        pic.line.color.rgb = C_INK
        pic.line.width = Pt(2)

    # Right: 4 Roadmap Phases & Call to Action
    phases = [
        ("Phase 1: 48-Hr MVP (Current)", "Live Firebase portal, Chrome MV3 side panel, Mock & CPGRAMS adapters, 15 verified schemes.", C_INK),
        ("Phase 2: Pan-India Expansion", "Adapter support for state grievance portals, scholarship engines, and DigiLocker integration.", C_INK),
        ("Phase 3: Proactive Notifications", "Automated deadline alerts for expiring welfare windows and proactive renewal reminders.", C_INK),
        ("Phase 4: CSC & Operator Mode", "High-volume assisted mode for Common Service Center (CSC) rural operators and Gram Panchayats.", C_INK),
    ]

    for i, (ph_title, ph_desc, ph_col) in enumerate(phases):
        y = Inches(1.8 + (i * 0.95))
        card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.5), y, Inches(6.0), Inches(0.82))
        card.fill.solid()
        card.fill.fore_color.rgb = C_INK
        card.line.color.rgb = C_GOLD
        card.line.width = Pt(1)
        tf = card.text_frame
        tf.word_wrap = True
        tf.margin_left = Inches(0.2)
        tf.margin_top = Inches(0.1)
        p = tf.paragraphs[0]
        p.text = ph_title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = C_GOLD
        p2 = tf.add_paragraph()
        p2.text = ph_desc
        p2.font.size = Pt(9.5)
        p2.font.color.rgb = C_TEXT
        p2.space_before = Pt(2)

    # Action / Close Card
    cta_card = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.5), Inches(5.75), Inches(6.0), Inches(0.85))
    cta_card.fill.solid()
    cta_card.fill.fore_color.rgb = C_INK
    cta_card.line.color.rgb = C_WHITE
    cta_card.line.width = Pt(1.5)
    tf = cta_card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.2)
    tf.margin_top = Inches(0.12)
    p = tf.paragraphs[0]
    p.text = "EXPLORE THE LIVE PORTAL: nagarik-ai-civic-2026.web.app"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_GOLD
    p2 = tf.add_paragraph()
    p2.text = "Thank you! Built with pride for Forge Buildathon 2026 by @cyugandharreddy08, @baliharsha999 & @Raghavendra-Kasireddy."
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = C_TEXT
    p2.space_before = Pt(2)

    s7.notes_slide.notes_text_frame.text = (
        "In 48 hours, we proved that AI can empower citizens rather than confuse them. "
        "Our roadmap expands from this MVP to cover state welfare portals, proactive deadline alerts, and CSC operator kiosks across India. "
        "Try the live demo at nagarik-ai-civic-2026.web.app. Thank you!"
    )

    # Save presentation
    output_path = r"d:\buildathon\docs\presentation\Nagarik_AI_Forge_3D_Masterpiece.pptx"
    prs.save(output_path)
    print(f"Successfully created: {output_path}")

    # Also overwrite the primary Forge Buildathon PPTX
    primary_path = r"d:\buildathon\docs\presentation\Nagarik_AI_Forge_Buildathon.pptx"
    prs.save(primary_path)
    print(f"Successfully updated primary deck: {primary_path}")

if __name__ == "__main__":
    create_deck()
