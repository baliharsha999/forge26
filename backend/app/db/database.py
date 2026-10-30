import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "civic_pulse.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Live Grievances Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS grievances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id TEXT UNIQUE NOT NULL,
        citizen_name TEXT NOT NULL,
        citizen_phone TEXT NOT NULL,
        state TEXT NOT NULL,
        district TEXT NOT NULL,
        locality TEXT,
        department TEXT NOT NULL,
        category TEXT NOT NULL,
        urgency_level TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL,
        submitted_at TEXT NOT NULL,
        sla_days INTEGER NOT NULL,
        assigned_officer TEXT NOT NULL,
        verification_hash TEXT NOT NULL,
        receipt_screenshot TEXT,
        telemetry_log TEXT
    )
    """)

    # Live Audit & Agent Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        tracking_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL
    )
    """)

    # Insert initial real seed grievances if empty, so dashboard has active live history
    cursor.execute("SELECT COUNT(*) FROM grievances")
    count = cursor.fetchone()[0]
    if count == 0:
        initial_records = [
            (
                "CP-2026-98124", "Ramesh Verma", "+91 98480 12345", "Telangana", "Hyderabad", "Kukatpally Ward 12",
                "Municipal Corporation & Public Works", "Pot-holes & Damaged Roads", "HIGH",
                "Deep crater pothole near Metro Pillar 42 causing traffic bottlenecks",
                "Deep pothole has developed after recent rains, multiple two-wheeler accidents reported in the evening.",
                "Near Metro Pillar 42, Kukatpally, Hyderabad", "IN_PROGRESS",
                "2026-10-29T10:15:00", 3, "Executive Engineer (GHMC West Zone)",
                "HASH-a8b27c3f91", "/receipts/sample_road.png",
                json.dumps(["[10:15:02] Autonomous agent connected to GHMC Redressal Portal", "[10:15:05] Uploaded site image proof", "[10:15:08] Form submitted with tracking ID CP-2026-98124"])
            ),
            (
                "CP-2026-98125", "Lakshmi Devi", "+91 94401 67890", "Andhra Pradesh", "Vijayawada", "Bhavanipuram",
                "Water Supply & Sanitation", "Contaminated Drinking Water", "HIGH",
                "Muddy drinking water supply for 48 hours in Bhavanipuram Colony",
                "Water line has breached with municipal drainage line, water smells foul and unsafe for drinking.",
                "Door No 14-2-8, Bhavanipuram, Vijayawada", "ASSIGNED",
                "2026-10-29T14:30:00", 2, "Sanitary Inspector (VMC Ward 8)",
                "HASH-d4e5f6789a", "/receipts/sample_water.png",
                json.dumps(["[14:30:01] Citizen speech transcript processed via STT", "[14:30:04] Priority raised to Level 1 Water Emergency", "[14:30:09] Assigned to local ward office"])
            ),
            (
                "CP-2026-98126", "Mohammed Arif", "+91 99887 54321", "Karnataka", "Bengaluru", "Indiranagar",
                "Electricity & Power Distribution (BESCOM)", "Frequent High Voltage Fluctuations", "MEDIUM",
                "Continuous tripping of local transformer during peak evening hours",
                "Transformer sparks observed near 100ft road intersection, posing hazard and tripping home appliances.",
                "100 Feet Road, 12th Main Corner, Indiranagar, Bengaluru", "RESOLVED",
                "2026-10-28T09:00:00", 1, "Assistant Executive Engineer (BESCOM Indiranagar Sub-division)",
                "HASH-1122334455", "/receipts/sample_electric.png",
                json.dumps(["[09:00:05] Grievance filed via JanSetu agent", "[11:45:10] Lineman dispatched to site", "[16:30:00] Transformer fuse unit replaced and test load passed"])
            )
        ]
        cursor.executemany("""
        INSERT INTO grievances (
            tracking_id, citizen_name, citizen_phone, state, district, locality,
            department, category, urgency_level, title, description, location,
            status, submitted_at, sla_days, assigned_officer, verification_hash,
            receipt_screenshot, telemetry_log
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_records)
        
    conn.commit()
    conn.close()

# Auto-initialize DB on import
init_db()

def save_grievance(record: Dict[str, Any]) -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO grievances (
        tracking_id, citizen_name, citizen_phone, state, district, locality,
        department, category, urgency_level, title, description, location,
        status, submitted_at, sla_days, assigned_officer, verification_hash,
        receipt_screenshot, telemetry_log
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record["tracking_id"],
        record["citizen"]["name"],
        record["citizen"]["phone"],
        record["citizen"]["state"],
        record["citizen"]["district"],
        record["citizen"]["locality"],
        record["department"],
        record["category"],
        record["urgency_level"],
        record["title"],
        record["description"],
        record["location"],
        record["status"],
        record["submitted_at"],
        record["sla_days"],
        record["assigned_officer"],
        record["verification_hash"],
        record.get("receipt_screenshot"),
        json.dumps(record.get("telemetry_log", []))
    ))
    conn.commit()
    conn.close()
    return record["tracking_id"]

def get_grievance_by_tracking_id(tracking_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM grievances WHERE tracking_id = ?", (tracking_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["telemetry_log"] = json.loads(d["telemetry_log"]) if d["telemetry_log"] else []
        return d
    return None

def list_all_grievances(limit: int = 50) -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM grievances ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["telemetry_log"] = json.loads(d["telemetry_log"]) if d["telemetry_log"] else []
        results.append(d)
    return results

def log_audit_event(event_type: str, action: str, tracking_id: Optional[str] = None, details: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO audit_logs (event_type, tracking_id, action, details, timestamp)
    VALUES (?, ?, ?, ?, ?)
    """, (event_type, tracking_id, action, details, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
