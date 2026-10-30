/**
 * Nagarik AI - CPGRAMS Portal Adapter
 * Supports Central Public Grievance Redressal and Monitoring System (https://pgportal.gov.in/*)
 * Note: Assistive Fill-Only, NEVER bypasses CAPTCHA/OTP or auto-submits on real government portals.
 */
class CPGRAMSAdapter extends BasePortalAdapter {
  constructor() {
    super("CPGRAMS National Grievance Portal", ["pgportal.gov.in"]);
  }

  /**
   * Semantic inspection of CPGRAMS DOM
   */
  async inspect() {
    const fields = [];
    const url = window.location.href.toLowerCase();

    // CPGRAMS grievance description textarea
    const textarea = document.querySelector("textarea#grievance, textarea[name*='grievance' i], textarea[id*='grievance' i], textarea");
    if (textarea) {
      fields.push({
        key: 'description',
        label: 'Grievance Description / Petition',
        selector: 'textarea',
        required: true,
        exists: true,
        value: textarea.value.trim(),
        isFilled: textarea.value.trim().length > 0
      });
    }

    // Name input if present on unauthenticated/registration stages
    const nameInput = document.querySelector("input[name*='name' i], input#name, input[placeholder*='name' i]");
    if (nameInput) {
      fields.push({
        key: 'citizen_name',
        label: 'Citizen Name',
        selector: nameInput.id ? `#${nameInput.id}` : "input[name*='name' i]",
        required: true,
        exists: true,
        value: nameInput.value.trim(),
        isFilled: nameInput.value.trim().length > 0
      });
    }

    // Mobile input
    const mobileInput = document.querySelector("input[type='tel'], input[name*='mobile' i], input[placeholder*='mobile' i]");
    if (mobileInput) {
      fields.push({
        key: 'citizen_phone',
        label: 'Mobile Number',
        selector: mobileInput.id ? `#${mobileInput.id}` : "input[type='tel']",
        required: true,
        exists: true,
        value: mobileInput.value.trim(),
        isFilled: mobileInput.value.trim().length > 0
      });
    }

    // File upload (Document / Photo evidence)
    const fileInput = document.querySelector("input[type='file']");
    if (fileInput) {
      fields.push({
        key: 'photo',
        label: 'Supporting Document / Evidence',
        selector: "input[type='file']",
        required: false,
        exists: true,
        value: fileInput.value ? 'File attached' : '',
        isFilled: !!fileInput.value
      });
    }

    const hasForm = fields.length > 0;
    const isLandingPage = url.endsWith("pgportal.gov.in/") || 
                          url.endsWith("pgportal.gov.in") || 
                          url.includes("/home") && !url.includes("lodge");
    const isSignInPage = url.includes("/signin") || url.includes("/login");

    const totalRequired = fields.filter(f => f.required).length;
    const filledRequired = fields.filter(f => f.required && f.isFilled).length;

    return {
      portalName: this.name,
      fields: fields,
      totalRequired: totalRequired,
      filledRequired: filledRequired,
      hasForm: hasForm,
      isLandingPage: isLandingPage,
      isSignInPage: isSignInPage,
      isFullyFilled: hasForm && totalRequired > 0 && totalRequired === filledRequired,
      pageState: hasForm ? "FORM_ACTIVE" : (isSignInPage ? "SIGNIN_REQUIRED" : (isLandingPage ? "LANDING_PAGE" : "NO_FORM_DETECTED"))
    };
  }

  /**
   * Fills an individual field on the active portal tab
   */
  async fillSingleField(key, value) {
    if (!value && key !== 'photo') return { success: false, error: 'Empty value' };

    if (key === 'description') {
      const el = document.querySelector("textarea#grievance, textarea[name*='grievance' i], textarea");
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key };
      }
    } else if (key === 'citizen_name') {
      const el = document.querySelector("input[name*='name' i], input#name, input[placeholder*='name' i]");
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key };
      }
    } else if (key === 'citizen_phone') {
      const el = document.querySelector("input[type='tel'], input[name*='mobile' i], input[placeholder*='mobile' i]");
      if (el) {
        this.setValueWithEvents(el, value);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, key };
      }
    } else if (key === 'location') {
      // Append location to description if no dedicated location input exists
      const el = document.querySelector("textarea#grievance, textarea[name*='grievance' i], textarea");
      if (el) {
        const current = el.value || '';
        const updated = current.includes(value) ? current : `${current}\n\n[Incident Location / Landmark: ${value}]`.trim();
        this.setValueWithEvents(el, updated);
        return { success: true, key };
      }
    } else if (key === 'photo') {
      const fileInput = document.querySelector("input[type='file']");
      if (fileInput && value) {
        this.setFileInputWithDataTransfer(fileInput, value, 'evidence.png');
        return { success: true, key };
      }
    }

    return { 
      success: false, 
      error: 'Form field not present on current page. Form may require login first.',
      requiresForm: true
    };
  }

  async fill(formData, onProgress) {
    const report = (msg) => {
      if (typeof onProgress === "function") onProgress(msg);
    };

    report("Scanning CPGRAMS portal structure...");

    const textarea = document.querySelector("textarea#grievance, textarea[name*='grievance' i], textarea");
    if (textarea) {
      let fullText = formData.description || "";
      if (formData.location) {
        fullText += `\n\nIncident Location: ${formData.location}`;
      }
      this.setValueWithEvents(textarea, fullText);
      report("Filled CPGRAMS Grievance Description");
      return {
        success: true,
        readyToSubmit: false,
        notice: "Nagarik AI has populated your petition. Please verify, enter CAPTCHA/OTP, and click Submit."
      };
    } else {
      return {
        success: false,
        error: "NO_GRIEVANCE_FORM_ON_PAGE",
        message: "You are on the CPGRAMS landing page. Please Sign In and open the grievance form to populate fields."
      };
    }
  }

  async readTrackingId() {
    const bodyText = document.body.innerText;
    const match = bodyText.match(/(?:Registration No|Regn No|Grievance No)[:\s]+([A-Z0-9\/_-]+)/i);
    if (match) {
      return match[1].trim();
    }
    return null;
  }
}

window.CPGRAMSAdapter = CPGRAMSAdapter;
