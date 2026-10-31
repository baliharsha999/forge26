"""
myScheme Scraper & HTML Generator
Fetches live scheme data and HTML from myscheme.gov.in, parses structured ASTs,
and generates self-contained, total HTML scheme documents.
"""

import os
import re
import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime
from db import SchemeDatabase, DEFAULT_DB_PATH

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.myscheme.gov.in/'
}

COMMON_ALIASES = {
    'pm kisan': 'pm-kisan',
    'pmkisan': 'pm-kisan',
    'kisan samman': 'pm-kisan',
    'kisan samman nidhi': 'pm-kisan',
    'pm awas': 'pmay-u',
    'pmay': 'pmay-u',
    'pmay urban': 'pmay-u',
    'pmay-u': 'pmay-u',
    'pmay gramin': 'pmay-g',
    'pmay-g': 'pmay-g',
    'pmmvy': 'pmmvy',
    'matru vandana': 'pmmvy',
    'matri vandana': 'pmmvy',
    'pm mudra': 'pmmy',
    'mudra': 'pmmy',
    'mudra loan': 'pmmy',
    'pmmy': 'pmmy',
    'pm svanidhi': 'pm-svanidhi',
    'svanidhi': 'pm-svanidhi',
    'street vendor': 'pm-svanidhi',
    'sukanya samriddhi': 'ssy',
    'ssy': 'ssy',
    'atal pension': 'apy',
    'apy': 'apy',
    'ayushman bharat': 'masabsn',
    'pmjay': 'masabsn',
    'kisan credit card': 'kcc',
    'kcc': 'kcc',
    'solar rooftop': 'cmsrcis',
    'pm kusum': 'pm-kusum',
    'kusum': 'pm-kusum'
}


def slate_to_html(nodes: Any) -> str:
    """
    Recursively converts Slate / Portable Text AST nodes from myscheme.gov.in into valid HTML.
    Handles headings, paragraphs, bold, italic, underline, lists, links, and nested items.
    """
    if not nodes:
        return ""
    if isinstance(nodes, str):
        # Escape minimal HTML entities but preserve text
        escaped = nodes.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return f"<p>{escaped}</p>"
    if isinstance(nodes, dict):
        nodes = [nodes]
    if not isinstance(nodes, list):
        return str(nodes)

    html_parts = []
    for node in nodes:
        if not isinstance(node, dict):
            html_parts.append(str(node))
            continue

        node_type = node.get("type")
        children = node.get("children", [])

        # Process inner text or nested children
        if "text" in node and not children:
            t = node.get("text", "")
            # HTML entity encoding for special chars
            t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            if node.get("bold"):
                t = f"<strong>{t}</strong>"
            if node.get("italic"):
                t = f"<em>{t}</em>"
            if node.get("underline"):
                t = f"<u>{t}</u>"
            inner_html = t
        else:
            inner_html = slate_to_html(children)

        # Wrap by node type
        if node_type == "paragraph":
            html_parts.append(f"<p>{inner_html}</p>")
        elif node_type == "heading_one":
            html_parts.append(f"<h1>{inner_html}</h1>")
        elif node_type == "heading_two":
            html_parts.append(f"<h2>{inner_html}</h2>")
        elif node_type == "heading_three":
            html_parts.append(f"<h3>{inner_html}</h3>")
        elif node_type == "heading_four":
            html_parts.append(f"<h4>{inner_html}</h4>")
        elif node_type in ("bulleted_list", "unordered-list"):
            html_parts.append(f"<ul>{inner_html}</ul>")
        elif node_type in ("numbered_list", "ordered-list"):
            html_parts.append(f"<ol>{inner_html}</ol>")
        elif node_type == "list_item":
            html_parts.append(f"<li>{inner_html}</li>")
        elif node_type == "link":
            href = node.get("link") or node.get("url", "#")
            html_parts.append(f'<a href="{href}" target="_blank" rel="noopener noreferrer">{inner_html}</a>')
        else:
            html_parts.append(inner_html)

    return "".join(html_parts)


def html_to_plain_text(html_text: str) -> str:
    """Converts HTML string to clean, readable plain text for LLM prompts."""
    if not html_text:
        return ""
    # Replace block tags with newlines
    text = re.sub(r'<(p|h[1-6]|li|tr)[^>]*>', '\n', html_text)
    text = re.sub(r'</(p|h[1-6]|li|tr)>', '\n', text)
    text = re.sub(r'<br\s*/?>', '\n', text)
    # Strip remaining tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode basic entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
    # Clean redundant whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


class MySchemeScraper:
    def __init__(self, data_dir: str = r"d:\forge26\data", db_path: str = DEFAULT_DB_PATH):
        self.data_dir = data_dir
        self.db_path = db_path
        self.db = SchemeDatabase(db_path=self.db_path)
        self.index_path = os.path.join(self.data_dir, "schemes_index.json")
        os.makedirs(self.data_dir, exist_ok=True)
        self.schemes_index = self._load_index()

    def _load_index(self) -> List[Dict]:
        """Loads schemes catalog index from disk or downloads it live from myscheme.gov.in."""
        if os.path.exists(self.index_path):
            try:
                with open(self.index_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
            except Exception as e:
                print(f"[Warning] Failed to load local index: {e}")

        # Fetch live index
        return self.refresh_index()

    def refresh_index(self) -> List[Dict]:
        """Fetches the latest index of all 5,200+ schemes from myscheme.gov.in."""
        url = "https://www.myscheme.gov.in/api/apisetu/schemes"
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                schemes = data.get("data", [])
                if schemes:
                    with open(self.index_path, "w", encoding="utf-8") as f:
                        json.dump(schemes, f, ensure_ascii=False, indent=2)
                    self.schemes_index = schemes
                    return schemes
        except Exception as e:
            print(f"[Error] Failed to fetch schemes index: {e}")
        return []

    def search_schemes(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Searches the schemes database using exact aliases, fuzzy token matching,
        and keyword relevance. Returns top matching schemes.
        """
        if not query or not query.strip():
            return []

        q_norm = query.lower().strip()

        # Check direct alias dictionary first
        for alias, target_slug in COMMON_ALIASES.items():
            if alias in q_norm or q_norm in alias:
                # Find the scheme matching this target_slug
                for s in self.schemes_index:
                    if s.get("slug", "").lower() == target_slug.lower():
                        # Return this as top priority
                        other_matches = self._keyword_search(q_norm, top_k - 1, exclude_slug=target_slug)
                        return [s] + other_matches

        return self._keyword_search(q_norm, top_k)

    def _keyword_search(self, q_norm: str, top_k: int = 5, exclude_slug: str = "") -> List[Dict]:
        """Ranks schemes using token matching and substrings."""
        q_words = set(re.findall(r"\w+", q_norm))
        # Filter stop words
        stopwords = {"for", "the", "a", "an", "is", "in", "of", "and", "to", "am", "i", "can", "get", "scheme", "yojana"}
        q_keywords = q_words - stopwords or q_words

        results = []
        for s in self.schemes_index:
            slug = (s.get("slug") or "").lower()
            if slug == exclude_slug.lower():
                continue

            basic = s.get("en", {}).get("basicDetails", {})
            name = (basic.get("schemeName") or "").lower()
            short_title = (basic.get("schemeShortTitle") or "").lower()

            score = 0
            # Exact matches
            if q_norm == slug or q_norm == short_title:
                score += 120
            elif q_norm in name:
                score += 70
            elif q_norm in slug:
                score += 50
            elif q_norm in short_title:
                score += 50

            # Keyword overlap
            name_words = set(re.findall(r"\w+", name)) | set(re.findall(r"\w+", short_title)) | set(re.findall(r"\w+", slug))
            overlap = len(q_keywords & name_words)
            score += overlap * 15

            if score > 0:
                results.append((score, s))

        results.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in results[:top_k]]

    def fetch_scheme_details(self, slug: str) -> Dict[str, Any]:
        """
        Fetches structured scheme data from myscheme.gov.in including:
        - Basic details & metadata
        - Content (brief, detailed, benefits, exclusions, references)
        - Eligibility criteria
        - Application process
        - Required documents
        - Frequently asked questions (FAQs)
        """
        slug = slug.strip().lower()
        api_url = f"https://www.myscheme.gov.in/api/apisetu/schemes?slug={urllib.parse.quote(slug)}&lang=en"
        headers = {**DEFAULT_HEADERS, "Referer": f"https://www.myscheme.gov.in/schemes/{slug}"}

        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        scheme_data = data.get("data", {})
        if not scheme_data or not isinstance(scheme_data, dict):
            raise ValueError(f"No scheme data found on myscheme.gov.in for slug '{slug}'")

        en = scheme_data.get("en", {})
        scheme_id = scheme_data.get("_id")

        # Fetch documents & FAQs if scheme_id is present
        documents = []
        faqs = []

        if scheme_id:
            # 1. Documents
            try:
                doc_url = f"https://www.myscheme.gov.in/api/apisetu/schemes/{scheme_id}/documents?lang=en"
                doc_req = urllib.request.Request(doc_url, headers=headers)
                with urllib.request.urlopen(doc_req, timeout=8) as d_resp:
                    doc_json = json.loads(d_resp.read().decode("utf-8"))
                    documents = doc_json.get("data", {}).get("en", {}).get("documents_required", [])
            except Exception as e:
                print(f"[Warning] Could not fetch documents for {slug}: {e}")

            # 2. FAQs
            try:
                faq_url = f"https://www.myscheme.gov.in/api/apisetu/schemes/{scheme_id}/faqs?lang=en"
                faq_req = urllib.request.Request(faq_url, headers=headers)
                with urllib.request.urlopen(faq_req, timeout=8) as f_resp:
                    faq_json = json.loads(f_resp.read().decode("utf-8"))
                    faqs = faq_json.get("data", {}).get("en", {}).get("faqs", [])
            except Exception as e:
                print(f"[Warning] Could not fetch FAQs for {slug}: {e}")

        return {
            "slug": slug,
            "id": scheme_id,
            "basicDetails": en.get("basicDetails", {}),
            "schemeContent": en.get("schemeContent", {}),
            "eligibilityCriteria": en.get("eligibilityCriteria", {}),
            "applicationProcess": en.get("applicationProcess", []),
            "documents": documents,
            "faqs": faqs,
            "raw_payload": scheme_data
        }

    def fetch_raw_webpage_html(self, slug: str) -> str:
        """Web-scrapes the raw live HTML of the scheme page from myscheme.gov.in."""
        url = f"https://www.myscheme.gov.in/schemes/{slug}"
        req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"[Warning] Failed to fetch raw webpage HTML for {slug}: {e}")
            return f"<!-- Failed to fetch live webpage from {url}: {e} -->"

    def build_total_html(self, scheme_bundle: Dict[str, Any]) -> str:
        """
        Compiles the complete, standalone, professionally styled total HTML file of the scheme.
        Contains national header, badges, overview, eligibility, benefits, application steps,
        required documents, interactive FAQs, and official references.
        """
        slug = scheme_bundle.get("slug", "")
        basic = scheme_bundle.get("basicDetails", {})
        content = scheme_bundle.get("schemeContent", {})
        eligibility = scheme_bundle.get("eligibilityCriteria", {})
        app_process = scheme_bundle.get("applicationProcess", [])
        documents = scheme_bundle.get("documents", [])
        faqs = scheme_bundle.get("faqs", [])

        scheme_name = basic.get("schemeName") or slug.upper()
        short_title = basic.get("schemeShortTitle") or slug.upper()
        nodal_ministry = basic.get("nodalMinistryName", {})
        ministry_name = nodal_ministry.get("label") if isinstance(nodal_ministry, dict) else str(nodal_ministry or "Government of India")
        department = basic.get("nodalDepartmentName", {}).get("label", "") if isinstance(basic.get("nodalDepartmentName"), dict) else str(basic.get("nodalDepartmentName") or "")
        level = basic.get("level", "Central")
        scheme_type = basic.get("schemeType", "Central Sector")
        tags = basic.get("tags", [])
        beneficiaries = basic.get("targetBeneficiaries", [])
        dbt = "Yes" if basic.get("dbtScheme") else "No"
        open_date = basic.get("schemeOpenDate", "Active")

        # Convert sections to HTML
        brief_desc = content.get("briefDescription", "")
        detailed_html = slate_to_html(content.get("detailedDescription")) or f"<p>{content.get('detailedDescription_md', '')}</p>"
        benefits_html = slate_to_html(content.get("benefits")) or f"<p>{content.get('benefits_md', '')}</p>"
        eligibility_html = slate_to_html(eligibility.get("eligibilityDescription")) or f"<p>{eligibility.get('eligibilityDescription_md', '')}</p>"
        exclusions_html = slate_to_html(content.get("exclusions")) or (f"<p>{content.get('exclusions_md', '')}</p>" if content.get('exclusions_md') else "<p>No specific exclusions mentioned.</p>")

        # Application Process HTML
        app_process_html = ""
        if isinstance(app_process, list) and app_process:
            for proc in app_process:
                mode = proc.get("mode", "Standard Process")
                steps = proc.get("process", [])
                rendered_steps = slate_to_html(steps)
                app_process_html += f"""
                <div class="process-card">
                    <h3 class="process-mode">Mode: {mode}</h3>
                    <div class="process-steps">
                        {rendered_steps}
                    </div>
                </div>
                """
        else:
            app_process_html = "<p>Please visit the official nodal ministry portal to apply.</p>"

        # Documents HTML
        docs_html = slate_to_html(documents) if documents else "<p>Standard KYC documents (Aadhaar Card, Bank Account Details, Identity & Residence Proof) are generally required.</p>"

        # FAQs HTML
        faqs_html = ""
        if isinstance(faqs, list) and faqs:
            for idx, item in enumerate(faqs, 1):
                q = item.get("question", f"Question {idx}")
                ans = slate_to_html(item.get("answer")) or f"<p>{item.get('answer_md', '')}</p>"
                faqs_html += f"""
                <details class="faq-item">
                    <summary class="faq-question"><strong>Q{idx}. {q}</strong></summary>
                    <div class="faq-answer">
                        {ans}
                    </div>
                </details>
                """
        else:
            faqs_html = "<p>No FAQs currently indexed for this scheme.</p>"

        # References HTML
        references = content.get("references", [])
        refs_html = ""
        if references and isinstance(references, list):
            refs_html += '<ul class="references-list">'
            for ref in references:
                if isinstance(ref, dict):
                    title = ref.get("title", "Official Guideline / Link")
                    url = ref.get("url", "#")
                    refs_html += f'<li><a href="{url}" target="_blank" rel="noopener noreferrer">{title} ↗</a></li>'
            refs_html += "</ul>"
        else:
            refs_html = f'<p><a href="https://www.myscheme.gov.in/schemes/{slug}" target="_blank">View on myScheme.gov.in ↗</a></p>'

        tags_list = []
        for t in tags:
            if isinstance(t, dict):
                tags_list.append(t.get("label") or t.get("value") or str(t))
            else:
                tags_list.append(str(t))

        tags_html = "".join([f'<span class="badge badge-tag">{tag}</span>' for tag in tags_list])
        
        beneficiary_names = []
        for b in beneficiaries:
            if isinstance(b, dict):
                beneficiary_names.append(b.get("label") or b.get("value") or str(b))
            else:
                beneficiary_names.append(str(b))
        beneficiaries_html = ", ".join(beneficiary_names) if beneficiary_names else "Eligible Citizens"

        scrape_time = datetime.now().strftime("%d %B %Y, %I:%M %p")

        total_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{scheme_name} - Complete Scheme Dossier</title>
    <style>
        :root {{
            --primary: #1a365d;
            --primary-dark: #0f172a;
            --primary-accent: #2563eb;
            --saffron: #ff9933;
            --green: #138808;
            --bg-light: #f8fafc;
            --surface: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            --header-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
        }}

        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg-light);
            color: var(--text-main);
            line-height: 1.6;
            padding-bottom: 60px;
        }}

        /* National Tricolor Top Bar */
        .tricolor-stripe {{
            height: 6px;
            background: linear-gradient(90deg, #ff9933 33.33%, #ffffff 33.33%, #ffffff 66.66%, #138808 66.66%);
            width: 100%;
        }}

        /* Header */
        header {{
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            padding: 24px 32px;
            box-shadow: var(--header-shadow);
        }}

        .header-content {{
            max-width: 1100px;
            margin: 0 auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }}

        .brand {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}

        .emblem {{
            font-size: 32px;
            line-height: 1;
        }}

        .brand-text h1 {{
            font-size: 20px;
            color: var(--primary);
            font-weight: 800;
            letter-spacing: -0.5px;
        }}

        .brand-text p {{
            font-size: 13px;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
        }}

        .header-actions {{
            display: flex;
            gap: 12px;
        }}

        .btn {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.2s;
        }}

        .btn-primary {{
            background: var(--primary-accent);
            color: #ffffff;
        }}

        .btn-primary:hover {{
            background: #1d4ed8;
        }}

        .btn-outline {{
            background: var(--surface);
            border-color: var(--border);
            color: var(--text-main);
        }}

        .btn-outline:hover {{
            background: #f1f5f9;
        }}

        /* Container */
        .container {{
            max-width: 1100px;
            margin: 32px auto;
            padding: 0 20px;
        }}

        /* Scheme Banner Card */
        .scheme-banner {{
            background: var(--surface);
            border-radius: 12px;
            padding: 32px;
            box-shadow: var(--card-shadow);
            border: 1px solid var(--border);
            margin-bottom: 24px;
        }}

        .badges {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
        }}

        .badge {{
            padding: 4px 10px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        .badge-primary {{
            background: #e0f2fe;
            color: #0369a1;
        }}

        .badge-success {{
            background: #dcfce7;
            color: #15803d;
        }}

        .badge-warning {{
            background: #fef3c7;
            color: #b45309;
        }}

        .badge-tag {{
            background: #f1f5f9;
            color: #475569;
        }}

        .scheme-title {{
            font-size: 28px;
            color: var(--primary-dark);
            margin-bottom: 8px;
            font-weight: 800;
            line-height: 1.3;
        }}

        .scheme-ministry {{
            font-size: 16px;
            color: var(--text-muted);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        /* Quick Info Grid */
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #edf2f7;
            margin-top: 20px;
        }}

        .info-item {{
            display: flex;
            flex-direction: column;
            gap: 4px;
        }}

        .info-label {{
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
        }}

        .info-value {{
            font-size: 15px;
            font-weight: 700;
            color: var(--primary);
        }}

        /* Section Styling */
        .section-card {{
            background: var(--surface);
            border-radius: 12px;
            padding: 28px 32px;
            box-shadow: var(--card-shadow);
            border: 1px solid var(--border);
            margin-bottom: 24px;
        }}

        .section-header {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #f1f5f9;
        }}

        .section-icon {{
            font-size: 22px;
        }}

        .section-title {{
            font-size: 20px;
            color: var(--primary);
            font-weight: 700;
        }}

        .section-body {{
            font-size: 15px;
            color: #334155;
            line-height: 1.7;
        }}

        .section-body p {{
            margin-bottom: 14px;
        }}

        .section-body ul, .section-body ol {{
            margin: 12px 0 16px 24px;
        }}

        .section-body li {{
            margin-bottom: 8px;
        }}

        .section-body a {{
            color: var(--primary-accent);
            text-decoration: underline;
            font-weight: 500;
        }}

        /* Eligibility Box Highlight */
        .eligibility-box {{
            background: #f0fdf4;
            border-left: 4px solid var(--green);
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 16px;
        }}

        /* Benefits Box Highlight */
        .benefits-box {{
            background: #eff6ff;
            border-left: 4px solid var(--primary-accent);
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 16px;
        }}

        /* Exclusions Box Highlight */
        .exclusions-box {{
            background: #fff7ed;
            border-left: 4px solid var(--saffron);
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin-bottom: 16px;
        }}

        /* Process Steps */
        .process-card {{
            background: #f8fafc;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }}

        .process-mode {{
            font-size: 16px;
            color: var(--primary);
            font-weight: 700;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        /* FAQ Accordion */
        .faq-item {{
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 12px;
            background: #ffffff;
            transition: all 0.2s;
        }}

        .faq-item[open] {{
            border-color: var(--primary-accent);
            box-shadow: var(--card-shadow);
        }}

        .faq-question {{
            padding: 16px 20px;
            cursor: pointer;
            font-size: 15px;
            color: var(--primary-dark);
            user-select: none;
            list-style: none;
            position: relative;
        }}

        .faq-question::-webkit-details-marker {{
            display: none;
        }}

        .faq-question::after {{
            content: "+";
            position: absolute;
            right: 20px;
            font-size: 20px;
            font-weight: 700;
            color: var(--primary-accent);
        }}

        .faq-item[open] .faq-question::after {{
            content: "−";
        }}

        .faq-answer {{
            padding: 0 20px 20px 20px;
            color: #475569;
            font-size: 14.5px;
            border-top: 1px dashed var(--border);
            padding-top: 16px;
        }}

        /* Footer */
        footer {{
            text-align: center;
            margin-top: 48px;
            padding: 24px;
            color: var(--text-muted);
            font-size: 13px;
            border-top: 1px solid var(--border);
        }}

        footer a {{
            color: var(--primary-accent);
            text-decoration: none;
        }}

        /* Print styles */
        @media print {{
            body {{
                background: #ffffff;
            }}
            .header-actions, .tricolor-stripe {{
                display: none;
            }}
            .section-card, .scheme-banner {{
                box-shadow: none;
                border: 1px solid #ccc;
                page-break-inside: avoid;
            }}
            .faq-item {{
                border: 1px solid #ccc;
            }}
            .faq-answer {{
                display: block !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="tricolor-stripe"></div>

    <header>
        <div class="header-content">
            <div class="brand">
                <div class="emblem">🏛️</div>
                <div class="brand-text">
                    <h1>Government Welfare Scheme Assistant</h1>
                    <p>myScheme.gov.in Direct Web-Scrape Archive</p>
                </div>
            </div>
            <div class="header-actions">
                <button class="btn btn-outline" onclick="window.print()">🖨️ Print / Save as PDF</button>
                <a href="https://www.myscheme.gov.in/schemes/{slug}" target="_blank" class="btn btn-primary">🌐 View Official Portal</a>
            </div>
        </div>
    </header>

    <div class="container">
        <!-- Scheme Header Banner -->
        <div class="scheme-banner">
            <div class="badges">
                <span class="badge badge-primary">{level} Scheme</span>
                <span class="badge badge-success">{scheme_type}</span>
                <span class="badge badge-warning">DBT: {dbt}</span>
                {tags_html}
            </div>

            <h1 class="scheme-title">{scheme_name} ({short_title})</h1>
            <div class="scheme-ministry">
                <span>🏢 {ministry_name}</span>
                {f"<span>• {department}</span>" if department else ""}
            </div>

            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Scheme Slug</span>
                    <span class="info-value">{slug}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Target Beneficiaries</span>
                    <span class="info-value">{beneficiaries_html}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">DBT Enabled</span>
                    <span class="info-value">{dbt}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Scraped Date</span>
                    <span class="info-value">{scrape_time}</span>
                </div>
            </div>
        </div>

        <!-- Section 1: Overview & Brief -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">📖</span>
                <h2 class="section-title">Overview & Objectives</h2>
            </div>
            <div class="section-body">
                {f"<p><strong>Summary:</strong> {brief_desc}</p>" if brief_desc else ""}
                {detailed_html}
            </div>
        </div>

        <!-- Section 2: Eligibility Criteria -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">✅</span>
                <h2 class="section-title">Eligibility Criteria</h2>
            </div>
            <div class="section-body">
                <div class="eligibility-box">
                    {eligibility_html}
                </div>
            </div>
        </div>

        <!-- Section 3: Benefits -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">💰</span>
                <h2 class="section-title">Scheme Benefits & Financial Assistance</h2>
            </div>
            <div class="section-body">
                <div class="benefits-box">
                    {benefits_html}
                </div>
            </div>
        </div>

        <!-- Section 4: Exclusions -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">🚫</span>
                <h2 class="section-title">Exclusions (Disqualifications)</h2>
            </div>
            <div class="section-body">
                <div class="exclusions-box">
                    {exclusions_html}
                </div>
            </div>
        </div>

        <!-- Section 5: Application Process -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">📝</span>
                <h2 class="section-title">Step-by-Step Application Process</h2>
            </div>
            <div class="section-body">
                {app_process_html}
            </div>
        </div>

        <!-- Section 6: Documents Required -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">📄</span>
                <h2 class="section-title">Required Documents</h2>
            </div>
            <div class="section-body">
                {docs_html}
            </div>
        </div>

        <!-- Section 7: FAQs -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">❓</span>
                <h2 class="section-title">Frequently Asked Questions (FAQs)</h2>
            </div>
            <div class="section-body">
                {faqs_html}
            </div>
        </div>

        <!-- Section 8: References & Official Sources -->
        <div class="section-card">
            <div class="section-header">
                <span class="section-icon">🔗</span>
                <h2 class="section-title">Official Sources & Reference Links</h2>
            </div>
            <div class="section-body">
                {refs_html}
            </div>
        </div>
    </div>

    <footer>
        <p>Scraped live from <a href="https://www.myscheme.gov.in/schemes/{slug}" target="_blank">myscheme.gov.in/schemes/{slug}</a> on {scrape_time}.</p>
        <p>Content is sourced from the official National Government Portal of India. Generated by Scheme Assistant Agent.</p>
    </footer>
</body>
</html>"""
        return total_html

    def scrape_and_save(self, slug: str, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes scheme retrieval and compilation:
        1. Checks if scheme already exists in the SQL database (unless force_refresh=True).
        2. If not in DB, fetches live data from myscheme.gov.in and scrapes raw web HTML.
        3. Compiles the total standalone HTML document.
        4. Stores EVERYTHING directly into the SQLite database table 'schemes' (no folder file writing).
        5. Returns the stored scheme bundle containing the total HTML and plain text summary.
        """
        slug = slug.strip().lower()

        # Check SQL database first
        if not force_refresh:
            existing = self.db.get_scheme(slug)
            if existing and existing.get("total_html"):
                print(f"[Scraper] Scheme '{slug}' retrieved directly from SQL database.")
                text_summary = f"""
Scheme Name: {existing.get('scheme_name')} ({existing.get('short_title')})
Ministry: {existing.get('ministry')}
Level: {existing.get('level', 'Central')}
Category: {existing.get('category', '')}
Tags: {existing.get('tags', '')}

Brief Description:
{existing.get('brief_description', '')}

Detailed Description:
{existing.get('detailed_description', '')}

Eligibility Criteria:
{existing.get('eligibility_criteria', '')}

Benefits:
{existing.get('benefits', '')}

Exclusions:
{existing.get('exclusions', '')}

Documents Required:
{existing.get('documents_required', '')}
""".strip()
                return {
                    "slug": slug,
                    "scheme_name": existing.get("scheme_name", slug),
                    "short_title": existing.get("short_title", slug),
                    "total_html_content": existing.get("total_html"),
                    "raw_html_content": existing.get("raw_html"),
                    "text_summary": text_summary,
                    "db_id": existing.get("id"),
                    "stored_in_db": True,
                    "scraped_at": existing.get("scraped_at"),
                    "details": json.loads(existing.get("json_data") or "{}")
                }

        print(f"[Scraper] Scraping scheme details for '{slug}' from myscheme.gov.in...")
        # 1. Fetch structured scheme details
        details = self.fetch_scheme_details(slug)

        # 2. Fetch raw webpage HTML
        print(f"[Scraper] Fetching live webpage HTML for '{slug}'...")
        raw_webpage = self.fetch_raw_webpage_html(slug)

        # 3. Build total HTML file
        print(f"[Scraper] Compiling total HTML document for '{slug}'...")
        total_html = self.build_total_html(details)

        # 4. Extract structured text fields for database storage and LLM reasoning
        basic = details.get("basicDetails", {})
        content = details.get("schemeContent", {})
        eligibility = details.get("eligibilityCriteria", {})

        eligibility_text = html_to_plain_text(slate_to_html(eligibility.get("eligibilityDescription"))) or eligibility.get("eligibilityDescription_md", "")
        benefits_text = html_to_plain_text(slate_to_html(content.get("benefits"))) or content.get("benefits_md", "")
        exclusions_text = html_to_plain_text(slate_to_html(content.get("exclusions"))) or content.get("exclusions_md", "None specified")
        detailed_text = html_to_plain_text(slate_to_html(content.get("detailedDescription"))) or content.get("detailedDescription_md", "")
        docs_text = html_to_plain_text(slate_to_html(details.get("documents", [])))

        nodal_ministry = basic.get("nodalMinistryName", {})
        ministry_str = nodal_ministry.get("label") if isinstance(nodal_ministry, dict) else str(nodal_ministry or "Government of India")
        dept_obj = basic.get("nodalDepartmentName", {})
        dept_str = dept_obj.get("label") if isinstance(dept_obj, dict) else str(dept_obj or "")

        tags_raw = basic.get("tags", [])
        tags_list = [t.get("label", str(t)) if isinstance(t, dict) else str(t) for t in tags_raw]

        beneficiaries_raw = basic.get("targetBeneficiaries", [])
        beneficiaries_list = [b.get("label", str(b)) if isinstance(b, dict) else str(b) for b in beneficiaries_raw]

        # 5. Store directly into SQLite Database (NOT into folder files)
        print(f"[Scraper] Committing scheme record and total HTML directly into SQL database '{self.db_path}'...")
        db_record = {
            "slug": slug,
            "scheme_name": basic.get("schemeName", slug),
            "short_title": basic.get("schemeShortTitle", slug),
            "ministry": ministry_str,
            "department": dept_str,
            "level": basic.get("level", "Central"),
            "category": basic.get("schemeCategory", ""),
            "tags": tags_list,
            "target_beneficiaries": beneficiaries_list,
            "dbt_scheme": "Yes" if basic.get("dbtScheme") else "No",
            "brief_description": content.get("briefDescription", ""),
            "detailed_description": detailed_text,
            "eligibility_criteria": eligibility_text,
            "benefits": benefits_text,
            "exclusions": exclusions_text,
            "application_process": slate_to_html(details.get("applicationProcess", [])),
            "documents_required": docs_text,
            "faqs": details.get("faqs", []),
            "references": content.get("references", []),
            "total_html": total_html,
            "raw_html": raw_webpage,
            "details": details
        }

        row_id = self.db.save_scheme(db_record)
        print(f"[Scraper] Successfully stored scheme '{slug}' in SQL database (Record ID: {row_id}, HTML Size: {len(total_html)} chars).")

        text_summary = f"""
Scheme Name: {basic.get('schemeName')} ({basic.get('schemeShortTitle')})
Ministry: {ministry_str}
Level: {basic.get('level', 'Central')}
Category: {basic.get('schemeCategory', '')}
Tags: {', '.join(tags_list)}

Brief Description:
{content.get('briefDescription', '')}

Detailed Description:
{detailed_text}

Eligibility Criteria:
{eligibility_text}

Benefits:
{benefits_text}

Exclusions:
{exclusions_text}

Documents Required:
{docs_text}
""".strip()

        return {
            "slug": slug,
            "scheme_name": basic.get("schemeName", slug),
            "short_title": basic.get("schemeShortTitle", slug),
            "total_html_content": total_html,
            "raw_html_content": raw_webpage,
            "text_summary": text_summary,
            "db_id": row_id,
            "stored_in_db": True,
            "details": details
        }
