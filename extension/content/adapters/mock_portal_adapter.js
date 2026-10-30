/**
 * Mock Municipal Portal Adapter for JanSetu Lite
 * Supports http://localhost:8000/portal* and http://127.0.0.1:8000/portal*
 */
class MockPortalAdapter extends BasePortalAdapter {
  constructor() {
    super("Mock Municipal Corporation Portal", ["/portal", "localhost:8000/portal", "127.0.0.1:8000/portal"]);
  }

  async fill(formData, onProgress) {
    const missingSelectors = [];

    // Helper progress reporter
    const report = (msg) => {
      if (typeof onProgress === "function") onProgress(msg);
    };

    // 1. Citizen Name
    const nameEl = document.getElementById("citizen-name");
    if (nameEl) {
      this.setValueWithEvents(nameEl, formData.citizen_name || "Ananya Rao");
      report("Filled Citizen Name");
    } else {
      missingSelectors.push("#citizen-name");
    }
    await new Promise(r => setTimeout(r, 150));

    // 2. Mobile Phone
    const phoneEl = document.getElementById("citizen-phone");
    if (phoneEl) {
      this.setValueWithEvents(phoneEl, formData.citizen_phone || "9876543210");
      report("Filled Contact Phone");
    } else {
      missingSelectors.push("#citizen-phone");
    }
    await new Promise(r => setTimeout(r, 150));

    // 3. Department
    const deptEl = document.getElementById("department-select");
    if (deptEl) {
      // Find closest matching option using bidirectional substring & keyword overlap
      let matched = false;
      const deptLower = (formData.department || "").toLowerCase();
      for (let opt of deptEl.options) {
        const optLower = opt.value.toLowerCase();
        if (optLower.includes(deptLower) || deptLower.includes(optLower)) {
          deptEl.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const words = deptLower.split(/[\s\-_&,]+/).filter(w => w.length > 3);
        for (let opt of deptEl.options) {
          const optLower = opt.value.toLowerCase();
          if (words.some(w => optLower.includes(w))) {
            deptEl.value = opt.value;
            matched = true;
            break;
          }
        }
      }
      if (!matched && deptEl.options.length > 0) {
        deptEl.selectedIndex = 0;
      }
      deptEl.dispatchEvent(new Event("change", { bubbles: true }));
      deptEl.classList.add("jansetu-highlight");
      report("Selected Municipal Department");
    } else {
      missingSelectors.push("#department-select");
    }
    await new Promise(r => setTimeout(r, 150));

    // 4. Category
    const catEl = document.getElementById("category-select");
    if (catEl) {
      this.setValueWithEvents(catEl, formData.category || "General Civic Complaint");
      report("Filled Complaint Category");
    } else {
      missingSelectors.push("#category-select");
    }
    await new Promise(r => setTimeout(r, 150));

    // 5. Urgency
    const urgEl = document.getElementById("urgency-select");
    if (urgEl) {
      urgEl.value = (formData.urgency_level || "HIGH").toUpperCase();
      urgEl.dispatchEvent(new Event("change", { bubbles: true }));
      urgEl.classList.add("jansetu-highlight");
      report("Set Urgency Level");
    } else {
      missingSelectors.push("#urgency-select");
    }
    await new Promise(r => setTimeout(r, 150));

    // 6. Location
    const locEl = document.getElementById("location-input");
    if (locEl) {
      this.setValueWithEvents(locEl, formData.location || "Hyderabad Ward 12");
      report("Filled Incident Location & Landmark");
    } else {
      missingSelectors.push("#location-input");
    }
    await new Promise(r => setTimeout(r, 150));

    // 7. Description / Formal Petition
    const descEl = document.getElementById("description-textarea");
    if (descEl) {
      this.setValueWithEvents(descEl, formData.description || "");
      report("Injected Formal Petition Text");
    } else {
      missingSelectors.push("#description-textarea");
    }
    await new Promise(r => setTimeout(r, 150));

    // 8. Photo Upload via DataTransfer
    if (formData.photo_base64) {
      const fileEl = document.getElementById("photo-upload");
      if (fileEl) {
        const attached = this.setFileInputWithDataTransfer(fileEl, formData.photo_base64, "complaint_proof.png");
        if (attached) {
          report("Attached Photo Evidence via DataTransfer");
        }
      }
    }

    if (missingSelectors.length > 0) {
      return {
        success: false,
        error: "LAYOUT_CHANGED",
        missingSelectors: missingSelectors
      };
    }

    return {
      success: true,
      readyToSubmit: true
    };
  }

  async readTrackingId() {
    const el = document.getElementById("tracking-id");
    if (el && el.innerText.trim()) {
      return el.innerText.trim();
    }
    return null;
  }

  /**
   * Inspects the active page DOM to detect what fields exist,
   * whether they are empty or filled, and which ones are mandatory.
   */
  async inspect() {
    const fieldDefinitions = [
      { key: 'citizen_name', label: 'Citizen Full Name', selector: '#citizen-name', required: true },
      { key: 'citizen_phone', label: 'Contact Mobile Number', selector: '#citizen-phone', required: true },
      { key: 'department', label: 'Responsible Department', selector: '#department-select', required: true },
      { key: 'category', label: 'Issue Category', selector: '#category-select', required: true },
      { key: 'urgency_level', label: 'Urgency Level', selector: '#urgency-select', required: true },
      { key: 'location', label: 'Exact Location / Ward / Landmark', selector: '#location-input', required: true },
      { key: 'description', label: 'Detailed Description of Problem', selector: '#description-textarea', required: true },
      { key: 'photo', label: 'Photographic Evidence', selector: '#photo-upload', required: false }
    ];

    const fields = fieldDefinitions.map(def => {
      const el = document.querySelector(def.selector);
      const exists = !!el;
      let val = '';
      if (el) {
        val = el.tagName === 'SELECT' ? (el.value || '') : (el.value || el.innerText || '');
      }
      const isFilled = exists && val.trim().length > 0;
      return {
        key: def.key,
        label: def.label,
        selector: def.selector,
        required: def.required,
        exists: exists,
        value: val.trim(),
        isFilled: isFilled
      };
    });

    const totalRequired = fields.filter(f => f.required).length;
    const filledRequired = fields.filter(f => f.required && f.isFilled).length;

    return {
      portalName: this.name,
      fields: fields,
      totalRequired: totalRequired,
      filledRequired: filledRequired,
      isFullyFilled: totalRequired > 0 && totalRequired === filledRequired
    };
  }

  /**
   * Fills an individual field on the active portal tab and scrolls it into view.
   */
  async fillSingleField(key, value) {
    if (!value && key !== 'photo') return { success: false, error: 'Empty value' };

    if (key === 'citizen_name') {
      const el = document.getElementById('citizen-name');
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'citizen_phone') {
      const el = document.getElementById('citizen-phone');
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'department') {
      const deptEl = document.getElementById('department-select');
      if (deptEl) {
        let matched = false;
        const deptLower = (value || '').toLowerCase();
        for (let opt of deptEl.options) {
          const optLower = opt.value.toLowerCase();
          if (optLower.includes(deptLower) || deptLower.includes(optLower)) {
            deptEl.value = opt.value;
            matched = true;
            break;
          }
        }
        if (!matched) {
          const words = deptLower.split(/[\s\-_&,]+/).filter(w => w.length > 3);
          for (let opt of deptEl.options) {
            const optLower = opt.value.toLowerCase();
            if (words.some(w => optLower.includes(w))) {
              deptEl.value = opt.value;
              matched = true;
              break;
            }
          }
        }
        if (!matched && deptEl.options.length > 1) {
          deptEl.selectedIndex = 1;
        }
        deptEl.dispatchEvent(new Event('change', { bubbles: true }));
        deptEl.classList.add('jansetu-highlight');
        deptEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'category') {
      const el = document.getElementById('category-select');
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'urgency_level') {
      const el = document.getElementById('urgency-select');
      if (el) {
        el.value = (value || 'HIGH').toUpperCase();
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.classList.add('jansetu-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'location') {
      const el = document.getElementById('location-input');
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'description') {
      const el = document.getElementById('description-textarea');
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    } else if (key === 'photo') {
      const el = document.getElementById('photo-upload');
      if (el && value) {
        this.setFileInputWithDataTransfer(el, value, 'evidence.png');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key: key };
      }
    }

    return { success: false, error: 'Element not found for key: ' + key };
  }

  /**
   * Fills multiple fields sequentially and reports progress.
   */
  async fillFields(fieldsMap) {
    for (const [key, val] of Object.entries(fieldsMap)) {
      if (val !== undefined && val !== null && val !== '') {
        await this.fillSingleField(key, val);
        await new Promise(r => setTimeout(r, 120));
      }
    }
    return { success: true };
  }
}

window.MockPortalAdapter = MockPortalAdapter;
