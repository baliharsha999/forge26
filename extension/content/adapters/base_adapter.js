/**
 * Nagarik AI - Base Portal Adapter
 * Defines the contract and gold-standard DOM event emulation for all municipal and public portals.
 */
class BasePortalAdapter {
  constructor(name, domainPatterns) {
    this.name = name;
    this.domainPatterns = domainPatterns;
  }

  isSupported(url) {
    return this.domainPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Gold-Standard Value Setter:
   * Bypasses React 16+, Vue, and Angular internal value interception,
   * fires input, change, and blur events with bubble/composed flags.
   */
  setValueWithEvents(element, value) {
    if (!element) return false;
    element.focus();

    // Call native prototype setters to bypass framework state proxies
    const inputProto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const textareaProto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    const selectProto = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;

    if (element.tagName === "INPUT" && inputProto) {
      inputProto.call(element, value);
    } else if (element.tagName === "TEXTAREA" && textareaProto) {
      textareaProto.call(element, value);
    } else if (element.tagName === "SELECT" && selectProto) {
      selectProto.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    element.classList.add("jansetu-highlight");
    return true;
  }

  /**
   * Universal batch filler: loops through each key in fieldsMap
   * and delegates to concrete fillSingleField(key, value)
   */
  async fillFields(fieldsMap) {
    if (!fieldsMap || typeof fieldsMap !== "object") {
      return { success: false, error: "Invalid fields map" };
    }
    const results = {};
    let atLeastOneSuccess = false;

    for (const [key, value] of Object.entries(fieldsMap)) {
      if (typeof this.fillSingleField === "function") {
        try {
          const res = await this.fillSingleField(key, value);
          results[key] = res;
          if (res && res.success) atLeastOneSuccess = true;
        } catch (err) {
          results[key] = { success: false, error: err.message };
        }
      }
    }

    return {
      success: atLeastOneSuccess,
      results: results,
      notice: atLeastOneSuccess ? "Nagarik AI populated available fields." : "No matching fields found on current page."
    };
  }

  async fill(formData, onProgress) {
    throw new Error("Method fill() must be implemented by concrete PortalAdapter");
  }

  async readTrackingId() {
    throw new Error("Method readTrackingId() must be implemented by concrete PortalAdapter");
  }
}

window.BasePortalAdapter = BasePortalAdapter;
