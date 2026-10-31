"""
CLI Interface for Scheme Assistant Agent with SQL Database Integration
Allows command-line queries, interactive chat, and SQL database record inspection.
"""

import sys
import os

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add d:\forge26 to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agent import SchemeAgent
from db import SchemeDatabase, DEFAULT_DB_PATH


def print_banner():
    print("=" * 72)
    print("🏛️   myScheme.gov.in Intelligence Agent (CLI + SQL Database)")
    print("     Live Web Scraping, Eligibility Analysis & SQL Storage")
    print(f"     Database: {DEFAULT_DB_PATH}")
    print("=" * 72)


def list_stored_schemes():
    db = SchemeDatabase(DEFAULT_DB_PATH)
    schemes = db.list_schemes()
    print("\n" + "=" * 72)
    print(f"🗄️  SCHEMES STORED IN SQL DATABASE ({len(schemes)} total)")
    print("=" * 72)
    if not schemes:
        print("No schemes stored yet. Run a search query to scrape and store schemes.")
        return

    print(f"{'ID':<5} {'SLUG':<15} {'SHORT TITLE':<15} {'HTML SIZE':<12} {'UPDATED AT'}")
    print("-" * 72)
    for s in schemes:
        size_kb = f"{round((s.get('html_size_bytes') or 0)/1024, 1)} KB"
        print(f"{s['id']:<5} {s['slug']:<15} {(s.get('short_title') or s['slug'])[:14]:<15} {size_kb:<12} {s.get('updated_at')}")
    print("-" * 72)


def export_scheme_html(slug: str, output_path: str = None):
    db = SchemeDatabase(DEFAULT_DB_PATH)
    html = db.get_scheme_html(slug)
    if not html:
        print(f"❌ Scheme '{slug}' not found in SQL database.")
        return

    if not output_path:
        output_path = f"{slug}.html"

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Exported total HTML for '{slug}' from SQL database to: {os.path.abspath(output_path)}")


def run_interactive():
    print_banner()
    agent = SchemeAgent()
    print("Commands:")
    print("  - Type any question to check scheme eligibility.")
    print("  - Type ':list' to see all schemes stored in the SQL database.")
    print("  - Type ':export <slug>' to export a scheme's HTML from the SQL database.")
    print("  - Type 'exit' or 'quit' to exit.\n")

    while True:
        try:
            user_input = input("\n👤 User: ").strip()
            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                print("Exiting Scheme Assistant. Dhanyawad!")
                break
            if user_input == ":list":
                list_stored_schemes()
                continue
            if user_input.startswith(":export"):
                parts = user_input.split()
                if len(parts) > 1:
                    export_scheme_html(parts[1])
                else:
                    print("Usage: :export <slug>")
                continue

            print("\n🔍 Web-scraping myscheme.gov.in & committing to SQL database...\n")
            result = agent.process_chat(user_input)

            if result.get("success"):
                verdict = result.get("verdict", "INFO")
                scheme = result.get("scheme_matched", {})
                db_info = result.get("database_info", {})

                print("-" * 72)
                print(f"🎯 Verdict: [{verdict}]  |  🏛️ Scheme: {scheme.get('name')} ({scheme.get('short_title')})")
                print("-" * 72)
                sys.stdout.buffer.write((result["answer"] + "\n").encode("utf-8"))

                print("-" * 72)
                print(f"🗄️ SQL Record ID: #{db_info.get('record_id')} in {db_info.get('db_path')} ({db_info.get('html_size_kb')} KB)")
                print("-" * 72)
            else:
                print(f"❌ Error: {result.get('message')}")

        except KeyboardInterrupt:
            print("\nSession interrupted. Exiting.")
            break
        except Exception as e:
            print(f"❌ Exception: {e}")


def main():
    if len(sys.argv) > 1:
        arg1 = sys.argv[1].strip()
        if arg1 in ("--list", "-l"):
            list_stored_schemes()
            return
        elif arg1 in ("--export", "-e") and len(sys.argv) > 2:
            export_scheme_html(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
            return

        query = " ".join(sys.argv[1:])
        print_banner()
        agent = SchemeAgent()
        print(f"\n👤 Query: {query}")
        print("\n🔍 Web-scraping myscheme.gov.in & updating SQL database...\n")
        result = agent.process_chat(query)
        if result.get("success"):
            sys.stdout.buffer.write((result["answer"] + "\n").encode("utf-8"))
            db_info = result.get("database_info", {})
            print(f"\n🗄️ Stored in SQL Database: Record #{db_info.get('record_id')} in '{db_info.get('db_path')}'")
        else:
            print(f"❌ {result.get('message')}")
    else:
        run_interactive()


if __name__ == "__main__":
    main()
