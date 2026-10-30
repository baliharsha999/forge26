/**
 * Nagarik AI - Universal Civic Portal Adapter
 * Fallback adapter utilizing semantic heuristics to inspect and fill any standard
 * municipal, state, or central public service portal (.gov.in, .nic.in, civic forms).
 */
class GenericCivicAdapter extends BasePortalAdapter {
  constructor() {
    super("Public Service Portal (Universal)", [".gov.in", ".nic.in", "grievance", "complaint", "sahaaya", "sevasindhu", "prajavani"]);
  }

  /**
   * Helper to find an input element by fuzzy label/attribute match
   */
  findElementByKeywords(keywords, tagTypes = ["input", "textarea", "select"]) {
    // 1. Search by label text association
    const labels = Array.from(document.querySelectorAll("label"));
    for (const label of labels) {
      const text = (label.innerText || "").toLowerCase();
      if (keywords.some(k => text.includes(k))) {
        if (label.htmlFor) {
          const target = document.getElementById(label.htmlFor);
          if (target) return target;
        }
        const nested = label.querySelector(tagTypes.join(", "));
        if (nested) return nested;
      }
    }

    // 2. Search by input attributes (id, name, placeholder, aria-label)
    for (const tag of tagTypes) {
      const elements = Array.from(document.querySelectorAll(tag));
      for (const el of elements) {
        if (el.type === "hidden" || el.style.display === "none") continue;
        const attrStr = `${el.id} ${el.name} ${el.placeholder || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
        if (keywords.some(k => attrStr.includes(k))) {
          return el;
        }
      }
    }

    return null;
  }

  async inspect() {
    const fields = [];

    // Description / Grievance
    const descEl = this.findElementByKeywords(["grievance", "complaint", "description", "details", "problem", "issue", "petition"], ["textarea", "input"]);
    if (descEl) {
      fields.push({
        key: 'description',
        label: 'Grievance / Problem Description',
        selector: descEl.id ? `#${descEl.id}` : 'textarea',
        required: true,
        exists: true,
        value: (descEl.value || '').trim(),
        isFilled: (descEl.value || '').trim().length > 0
      });
    }

    // Citizen Name
    const nameEl = this.findElementByKeywords(["name", "citizen", "applicant", "fullname"], ["input"]);
    if (nameEl) {
      fields.push({
        key: 'citizen_name',
        label: 'Citizen Full Name',
        selector: nameEl.id ? `#${nameEl.id}` : 'input[name*="name" i]',
        required: true,
        exists: true,
        value: (nameEl.value || '').trim(),
        isFilled: (nameEl.value || '').trim().length > 0
      });
    }

    // Mobile / Contact
    const phoneEl = this.findElementByKeywords(["mobile", "phone", "contact", "cell"], ["input"]);
    if (phoneEl) {
      fields.push({
        key: 'citizen_phone',
        label: 'Contact Mobile Number',
        selector: phoneEl.id ? `#${phoneEl.id}` : 'input[type="tel"]',
        required: true,
        exists: true,
        value: (phoneEl.value || '').trim(),
        isFilled: (phoneEl.value || '').trim().length > 0
      });
    }

    // Location / Address
    const locEl = this.findElementByKeywords(["location", "address", "ward", "landmark", "street", "city", "village"], ["input", "textarea"]);
    if (locEl) {
      fields.push({
        key: 'location',
        label: 'Location / Landmark',
        selector: locEl.id ? `#${locEl.id}` : 'input',
        required: true,
        exists: true,
        value: (locEl.value || '').trim(),
        isFilled: (locEl.value || '').trim().length > 0
      });
    }

    // Photo / Attachment
    const fileEl = document.querySelector("input[type='file']");
    if (fileEl) {
      fields.push({
        key: 'photo',
        label: 'Evidence Document / Photo',
        selector: 'input[type="file"]',
        required: false,
        exists: true,
        value: fileEl.value ? 'File attached' : '',
        isFilled: !!fileEl.value
      });
    }

    const totalRequired = fields.filter(f => f.required).length;
    const filledRequired = fields.filter(f => f.required && f.isFilled).length;

    const hasForm = fields.length > 0;

    return {
      portalName: this.name,
      fields: fields,
      totalRequired: totalRequired,
      filledRequired: filledRequired,
      hasForm: hasForm,
      pageState: hasForm ? "FORM_ACTIVE" : "NO_FORM_DETECTED",
      isFullyFilled: hasForm && totalRequired > 0 && totalRequired === filledRequired
    };
  }

  async fillSingleField(key, value) {
    if (!value && key !== 'photo') return { success: false, error: 'Empty value' };

    let el = null;
    if (key === 'description') {
      el = this.findElementByKeywords(["grievance", "complaint", "description", "details", "problem", "issue", "petition"], ["textarea", "input"]);
    } else if (key === 'citizen_name') {
      el = this.findElementByKeywords(["name", "citizen", "applicant", "fullname"], ["input"]);
    } else if (key === 'citizen_phone') {
      el = this.findElementByKeywords(["mobile", "phone", "contact", "cell"], ["input"]);
    } else if (key === 'location') {
      el = this.findElementByKeywords(["location", "address", "ward", "landmark", "street", "city", "village"], ["input", "textarea"]);
      if (!el) {
        // Fallback: append to description textarea if no dedicated location input
        const descEl = this.findElementByKeywords(["grievance", "complaint", "description"], ["textarea"]);
        if (descEl) {
          const current = descEl.value || '';
          const updated = current.includes(value) ? current : `${current}\n\n[Location / Landmark: ${value}]`.trim();
          this.setValueWithEvents(descEl, updated);
          return { success: true, key };
        }
      }
    } else if (key === 'photo') {
      const fileInput = document.querySelector("input[type='file']");
      if (fileInput && value) {
        this.setFileInputWithDataTransfer(fileInput, value, 'evidence.png');
        return { success: true, key };
      }
    }

    if (el) {
      this.setValueWithEvents(el, value);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { success: true, key };
    }

    return { success: false, error: `Could not locate field for ${key}` };
  }

  async fill(formData, onProgress) {
    const report = (msg) => {
      if (typeof onProgress === "function") onProgress(msg);
    };

    report("Scanning civic page structure...");

    const descEl = this.findElementByKeywords(["grievance", "complaint", "description"], ["textarea", "input"]);
    if (descEl) {
      this.setValueWithEvents(descEl, formData.description || "");
      report("Filled grievance description");
    }

    const nameEl = this.findElementByKeywords(["name", "citizen", "applicant"], ["input"]);
    if (nameEl && formData.citizen_name) {
      this.setValueWithEvents(nameEl, formData.citizen_name);
      report("Filled citizen name");
    }

    const phoneEl = this.findElementByKeywords(["mobile", "phone"], ["input"]);
    if (phoneEl && formData.citizen_phone) {
      this.setValueWithEvents(phoneEl, formData.citizen_phone);
      report("Filled phone number");
    }

    return {
      success: true,
      readyToSubmit: false,
      notice: "Nagarik AI populated available civic fields. Please review and complete your submission."
    };
  }

  async readTrackingId() {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(?:Registration No|Regn No|Grievance No|Complaint No|Token No)[:\s]+([A-Z0-9\/_-]+)/i);
    return match ? match[1].trim() : null;
  }
}

window.GenericCivicAdapter = GenericCivicAdapter;
