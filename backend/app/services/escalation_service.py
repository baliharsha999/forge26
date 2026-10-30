from datetime import datetime, timedelta
from typing import Dict, Any
from app.models.schemas import EscalationResponse

def generate_statutory_escalation(
    complaint: Dict[str, Any],
    escalation_type: str = "reminder",
    days_elapsed: int = 15
) -> EscalationResponse:
    """
    Generates a legally structured, formal escalation document for an overdue grievance.
    Outputs: Reminder Letter, First Appeal (RPSA), or RTI Application Draft (Section 6(1)).
    """
    tracking_id = complaint["tracking_id"]
    citizen_name = complaint["citizen_name"]
    department = complaint["department"]
    category = complaint["category"]
    location = complaint["location"]
    submitted_at = complaint.get("submitted_at", datetime.now().isoformat())
    date_str = submitted_at.split("T")[0]
    today_str = datetime.now().strftime("%Y-%m-%d")

    if escalation_type == "appeal":
        authority = f"First Appellate Authority under Right to Public Services Act, {department}"
        subject = f"FIRST APPEAL: Non-Redressal of Grievance Ref #{tracking_id} within Statutory SLA"
        act = "Section 5 & 6 of The Right to Public Services Delivery Act (RPSA)"
        body = f"""To,
The First Appellate Authority,
{department},
Government Administration.

Subject: FIRST APPEAL under the Right to Public Services Act regarding non-resolution of Grievance #{tracking_id}.

Respected Authority,

1. I am submitting this First Appeal under the provisions of the Right to Public Services Act against the failure of the Designated Public Officer to resolve my registered grievance within the mandated Service Level Agreement (SLA).

2. Summary of Original Complaint:
   - Grievance Tracking ID: {tracking_id}
   - Date of Registration: {date_str}
   - Category: {category}
   - Incident Location: {location}
   - Days Elapsed without Resolution: {days_elapsed} Days

3. Relief Sought:
   - I request the First Appellate Authority to issue an immediate compliance order directing the responsible ward engineering unit to rectify the reported defect within 48 hours.
   - I also request that appropriate statutory inquiry be initiated regarding the unjustified administrative delay.

Submitted by:
{citizen_name}
Date: {today_str}
Location: {location}
"""
        action_note = "Download or copy this First Appeal and deliver it to your Zonal Commissioner / Sub-Divisional Magistrate office."

    elif escalation_type == "rti":
        authority = f"Public Information Officer (PIO), {department}"
        subject = f"APPLICATION UNDER SECTION 6(1) OF THE RTI ACT, 2005 - Action Taken on #{tracking_id}"
        act = "Section 6(1) of the Right to Information Act, 2005"
        body = f"""FORM 'A'
Application for Information under Section 6(1) of the Right to Information Act, 2005

To,
The Central / State Public Information Officer (PIO),
{department},
Civic Administration Center.

1. Full Name of Applicant: {citizen_name}
2. Particulars of Information Required:
   Regarding my official grievance registered under Tracking Reference #{tracking_id} on {date_str} concerning "{category}" at {location}:

   (i) Please provide the certified daily progress report / dispatch diary showing the movement of my complaint file from the date of submission ({date_str}) to date.
   (ii) Please provide the names, designations, and official contact details of the officers who were required to resolve this complaint within the stipulated SLA.
   (iii) If no action has been taken, please provide the certified copy of reasons recorded on file for the failure to resolve the issue within the prescribed SLA.
   (iv) Please provide a certified copy of the Citizen's Charter indicating the maximum permissible time limit for resolving grievances of this nature.

3. Application Fee: ₹10 Postal Order / Court Fee Stamp affixed herewith.

Applicant Signature: {citizen_name}
Date: {today_str}
Address: {location}
"""
        action_note = "Submit this RTI application along with a ₹10 court fee stamp or postal order to the Public Information Officer (PIO)."

    else:  # Default: Reminder
        authority = f"Executive Engineer / Designated Officer, {department}"
        subject = f"URGENT REMINDER: Unresolved Public Grievance Ref #{tracking_id} ({days_elapsed} Days Elapsed)"
        act = "Citizen's Charter & Municipal Grievance Redressal Regulation"
        body = f"""To,
The Executive Engineer / Ward Officer,
{department},
Local Municipal / Public Works Division.

Subject: URGENT REMINDER regarding pending Grievance Ref #{tracking_id}.

Respected Sir/Madam,

This is to bring to your urgent attention that my civic grievance registered under Reference ID #{tracking_id} on {date_str} regarding "{category}" located at "{location}" remains unresolved.

As per the Citizen's Charter, the stipulated resolution window was within 3-7 working days. More than {days_elapsed} days have passed, and the hazard continues to cause severe hardship to local residents.

Kindly treat this as an urgent reminder and expedite on-site inspection and remedial action.

Thanking you,
{citizen_name}
Reference: {tracking_id}
Date: {today_str}
"""
        action_note = "Send this reminder letter directly to the ward officer or present it during weekly Prajavani / Grievance Day."

    return EscalationResponse(
        tracking_id=tracking_id,
        escalation_type=escalation_type,
        days_overdue=max(0, days_elapsed - 7),
        authority_name=authority,
        subject_line=subject,
        letter_body=body,
        statutory_act_quoted=act,
        action_note=action_note
    )
