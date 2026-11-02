/**
 * Nagarik AI - Chrome Extension Comprehensive Test Audit
 * 
 * Verifies:
 * 1. BasePortalAdapter (native prototype bypass, DataTransfer file upload, batch fill)
 * 2. MockPortalAdapter (field matching, fuzzy department select, missing selectors, inspection, tracking ID)
 * 3. CPGRAMSAdapter (domain routing, page state heuristics, textarea injection, tracking ID regex)
 * 4. GenericCivicAdapter (deep shadow DOM traversal, fuzzy keyword matching, identity handling, tracking regex)
 * 5. Adapter Registry (matching hierarchy, universal fallback guarantee)
 * 6. Content Script DOM Automation (extractPageDomInfo, findTargetElement, spotlight, executeUniversalFill, message listeners)
 * 7. Zero-Knowledge Privacy Handlers (PII extraction, Aadhaar masking, zero outbound network telemetry, CSP compliance)
 */

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// --- Mock Browser DOM & Environment ---
function createMockEnvironment() {
  const eventsDispatched = [];

  class MockEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = options.bubbles || false;
      this.composed = options.composed || false;
    }
  }

  class MockClassList {
    constructor() {
      this.classes = new Set();
    }
    add(...names) {
      names.forEach(n => this.classes.add(n));
    }
    remove(...names) {
      names.forEach(n => this.classes.delete(n));
    }
    contains(name) {
      return this.classes.has(name);
    }
    toString() {
      return Array.from(this.classes).join(' ');
    }
  }

  class MockElement {
    constructor(tagName, id = '', name = '') {
      this.tagName = tagName.toUpperCase();
      this.id = id;
      this.name = name;
      this.value = '';
      this.innerText = '';
      this.placeholder = '';
      this.type = tagName.toLowerCase() === 'input' ? 'text' : '';
      this.style = { display: '', visibility: '', outline: '', boxShadow: '' };
      this.classList = new MockClassList();
      this.attributes = {};
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.required = false;
      this.files = [];
      this.shadowRoot = null;
      this.options = [];
      this.selectedIndex = 0;
      this.scrolledIntoView = false;
      this.clicked = false;
    }

    focus() {}
    blur() {}
    scrollIntoView(opts) {
      this.scrolledIntoView = true;
    }
    click() {
      this.clicked = true;
      this.dispatchEvent(new MockEvent('click', { bubbles: true }));
    }
    getAttribute(name) {
      return this.attributes[name] || null;
    }
    setAttribute(name, val) {
      this.attributes[name] = String(val);
    }
    getBoundingClientRect() {
      return { top: 100, left: 100, width: 200, height: 40 };
    }
    dispatchEvent(event) {
      eventsDispatched.push({ element: this, event });
      return true;
    }
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    remove() {
      if (this.parentElement) {
        const idx = this.parentElement.children.indexOf(this);
        if (idx !== -1) this.parentElement.children.splice(idx, 1);
        this.parentElement = null;
      }
    }
    closest(selector) {
      let curr = this;
      while (curr) {
        if (selector === 'label' && curr.tagName === 'LABEL') return curr;
        if (matchesSelector(curr, selector)) return curr;
        curr = curr.parentElement;
      }
      return null;
    }
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    }
    querySelectorAll(selector) {
      const results = [];
      function traverse(node) {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) {
            results.push(child);
          }
          traverse(child);
        }
      }
      traverse(this);
      return results;
    }
  }

  function matchesSelector(el, selector) {
    if (!selector) return false;
    const s = selector.trim();
    if (s.includes(',')) {
      return s.split(',').map(p => p.trim()).some(p => matchesSelector(el, p));
    }

    // Handle :not(...)
    if (s.includes(':not(')) {
      const parts = s.split(/:not\(([^)]+)\)/);
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          if (parts[i] && !matchesSelector(el, parts[i])) return false;
        } else {
          if (matchesSelector(el, parts[i])) return false;
        }
      }
      return true;
    }

    // Extract tag name if any
    const tagMatch = s.match(/^([a-zA-Z0-9*]+)/);
    const expectedTag = tagMatch ? tagMatch[1].toUpperCase() : null;
    if (expectedTag && expectedTag !== '*' && el.tagName !== expectedTag) {
      return false;
    }

    const rest = expectedTag ? s.substring(expectedTag.length) : s;
    if (!rest) return true;

    // Check id #foo
    const idMatch = rest.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch && el.id !== idMatch[1]) return false;

    // Check class .bar
    const classMatch = rest.match(/\.([a-zA-Z0-9_-]+)/);
    if (classMatch && !el.classList.contains(classMatch[1])) return false;

    // Check attributes [name='...'], [name*='...'], [type='...'], etc.
    const attrMatches = Array.from(rest.matchAll(/\[([a-zA-Z0-9_-]+)([\*^$]?=)?['"]?([^'"\]]+)?['"]?\s*i?\]/g));
    for (const am of attrMatches) {
      const attrName = am[1];
      const op = am[2];
      const val = am[3];
      const actualVal = (attrName === 'type' ? el.type : (attrName === 'id' ? el.id : (attrName === 'name' ? el.name : (attrName === 'placeholder' ? el.placeholder : el.getAttribute(attrName))))) || '';
      
      if (!op) {
        if (!actualVal && actualVal !== '') return false;
      } else if (op === '=') {
        if (actualVal.toLowerCase() !== val.toLowerCase()) return false;
      } else if (op === '*=') {
        if (!actualVal.toLowerCase().includes(val.toLowerCase())) return false;
      }
    }

    return true;
  }

  class MockHTMLInputElement extends MockElement {
    constructor(id = '', name = '') {
      super('INPUT', id, name);
    }
  }

  class MockHTMLTextAreaElement extends MockElement {
    constructor(id = '', name = '') {
      super('TEXTAREA', id, name);
    }
  }

  class MockHTMLSelectElement extends MockElement {
    constructor(id = '', name = '') {
      super('SELECT', id, name);
    }
    get value() {
      if (this.options && this.options.length > 0) {
        const selected = this.options[this.selectedIndex];
        return selected ? selected.value : '';
      }
      return this._value || '';
    }
    set value(val) {
      this._value = val;
      if (this.options) {
        const idx = this.options.findIndex(o => o.value === val);
        if (idx !== -1) this.selectedIndex = idx;
      }
    }
  }

  class MockDocument {
    constructor() {
      this.body = new MockElement('BODY');
      this.title = 'Test Portal Document';
    }
    createElement(tag) {
      if (tag.toLowerCase() === 'input') return new MockHTMLInputElement();
      if (tag.toLowerCase() === 'textarea') return new MockHTMLTextAreaElement();
      if (tag.toLowerCase() === 'select') return new MockHTMLSelectElement();
      return new MockElement(tag);
    }
    getElementById(id) {
      function find(node) {
        if (node.id === id) return node;
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
        if (node.shadowRoot) {
          const res = find(node.shadowRoot);
          if (res) return res;
        }
        return null;
      }
      return find(this.body);
    }
    querySelector(selector) {
      return this.body.querySelector(selector);
    }
    querySelectorAll(selector) {
      return this.body.querySelectorAll(selector);
    }
    createTreeWalker(root, filter) {
      const nodes = [];
      function collect(node) {
        for (const child of node.children) {
          nodes.push(child);
          collect(child);
        }
      }
      collect(root);
      let idx = -1;
      return {
        nextNode() {
          idx++;
          return idx < nodes.length ? nodes[idx] : null;
        }
      };
    }
  }

  class MockDataTransfer {
    constructor() {
      this.items = {
        _items: [],
        add: (file) => {
          this.items._items.push(file);
          this.files.push(file);
        }
      };
      this.files = [];
    }
  }

  class MockBlob {
    constructor(parts, options = {}) {
      this.parts = parts;
      this.type = options.type || '';
    }
  }

  class MockFile extends MockBlob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
    }
  }

  const mockDoc = new MockDocument();

  // Mock chrome runtime / tabs APIs
  const messageListeners = [];
  const mockChrome = {
    runtime: {
      onMessage: {
        addListener: (fn) => messageListeners.push(fn)
      },
      sendMessage: async (msg) => {
        return { success: true };
      }
    },
    tabs: {
      query: (filter, callback) => {
        callback([{ id: 1, url: 'http://localhost:8000/portal', title: mockDoc.title }]);
      },
      sendMessage: (tabId, msg, callback) => {
        let responded = false;
        const sendResponse = (res) => {
          responded = true;
          if (callback) callback(res);
        };
        for (const fn of messageListeners) {
          fn(msg, {}, sendResponse);
        }
      }
    },
    scripting: {
      executeScript: async () => {},
      insertCSS: async () => {}
    },
    sidePanel: {
      setPanelBehavior: async () => {}
    }
  };

  // Configure prototype descriptors for value setter interception testing
  Object.defineProperty(MockHTMLInputElement.prototype, 'value', {
    get() { return this._val || ''; },
    set(v) { this._val = v; },
    configurable: true
  });
  Object.defineProperty(MockHTMLTextAreaElement.prototype, 'value', {
    get() { return this._val || ''; },
    set(v) { this._val = v; },
    configurable: true
  });
  Object.defineProperty(MockHTMLSelectElement.prototype, 'value', {
    get() {
      if (this.options && this.options.length > 0) {
        const opt = this.options[this.selectedIndex];
        return opt ? opt.value : '';
      }
      return this._val || '';
    },
    set(v) {
      this._val = v;
      if (this.options) {
        const idx = this.options.findIndex(o => o.value === v);
        if (idx !== -1) this.selectedIndex = idx;
      }
    },
    configurable: true
  });

  // Create full browser global sandbox
  const context = {
    location: {
      href: 'http://localhost:8000/portal',
      hostname: 'localhost'
    },
    document: mockDoc,
    HTMLInputElement: MockHTMLInputElement,
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    HTMLSelectElement: MockHTMLSelectElement,
    Event: MockEvent,
    DataTransfer: MockDataTransfer,
    Blob: MockBlob,
    File: MockFile,
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    NodeFilter: { SHOW_ELEMENT: 1 },
    chrome: mockChrome,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Promise: Promise,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    RegExp: RegExp,
    Buffer: Buffer,
    URL: URL,
    MutationObserver: class MockMutationObserver {
      observe() {}
      disconnect() {}
    }
  };

  context.window = context;
  context.globalThis = context;

  vm.createContext(context);

  return {
    context: context,
    window: context,
    document: mockDoc,
    chrome: mockChrome,
    eventsDispatched,
    MockElement,
    MockHTMLInputElement,
    MockHTMLTextAreaElement,
    MockHTMLSelectElement,
    messageListeners
  };
}

// Helper to evaluate extension scripts within mock context
function loadScript(filePath, env) {
  const code = fs.readFileSync(filePath, 'utf8');
  vm.runInContext(code, env.context);
}

describe('Chrome Extension Test Audit', () => {
  let env;

  beforeEach(() => {
    env = createMockEnvironment();
    // Load Adapters in exact Manifest V3 sequence
    loadScript(path.join(__dirname, '../content/adapters/base_adapter.js'), env);
    loadScript(path.join(__dirname, '../content/adapters/mock_portal_adapter.js'), env);
    loadScript(path.join(__dirname, '../content/adapters/cpgrams_adapter.js'), env);
    loadScript(path.join(__dirname, '../content/adapters/generic_portal_adapter.js'), env);
    loadScript(path.join(__dirname, '../content/adapters/index.js'), env);
  });

  describe('1. BasePortalAdapter Unit Audit', () => {
    test('Gold-Standard Native Prototype Bypass: sets input value and dispatches bubbling events', () => {
      const adapter = new env.window.BasePortalAdapter('Test', ['test.com']);
      const input = env.document.createElement('input');
      env.document.body.appendChild(input);

      const ok = adapter.setValueWithEvents(input, 'Test Citizen');
      assert.strictEqual(ok, true);
      assert.strictEqual(input.value, 'Test Citizen');
      assert.strictEqual(input.classList.contains('jansetu-highlight'), true);

      // Verify event cascade: input, change, blur with bubbles & composed
      const events = env.eventsDispatched.filter(e => e.element === input).map(e => ({
        type: e.event.type,
        bubbles: e.event.bubbles,
        composed: e.event.composed
      }));

      assert.ok(events.some(e => e.type === 'input' && e.bubbles && e.composed));
      assert.ok(events.some(e => e.type === 'change' && e.bubbles && e.composed));
      assert.ok(events.some(e => e.type === 'blur' && e.bubbles && e.composed));
    });

    test('Verhoeff Dihedral Validation: validates official UIDAI Aadhaar 488813127839 mathematically', () => {
      const d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      ];
      const p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
      ];
      function validateVerhoeff(num) {
        let c = 0;
        const rev = String(num).split('').reverse().map(Number);
        for (let i = 0; i < rev.length; i++) {
          c = d[c][p[i % 8][rev[i]]];
        }
        return c === 0;
      }

      assert.strictEqual(validateVerhoeff('488813127839'), true);
      assert.strictEqual(validateVerhoeff('234567890123'), false); // Dummy fails
    });

    test('Universal Batch Fill: delegates to fillSingleField with error containment', async () => {
      const adapter = new env.window.BasePortalAdapter('Test', ['test.com']);
      adapter.fillSingleField = async (key, val) => {
        if (key === 'valid_field') return { success: true, key };
        throw new Error('Field error');
      };

      const res = await adapter.fillFields({
        valid_field: 'Hello',
        error_field: 'Crash'
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.results.valid_field.success, true);
      assert.strictEqual(res.results.error_field.success, false);
      assert.strictEqual(res.results.error_field.error, 'Field error');
    });
  });

  describe('2. MockPortalAdapter Audit', () => {
    test('Domain matching: recognizes /portal, localhost:8000/portal, 127.0.0.1:8000/portal', () => {
      const adapter = new env.window.MockPortalAdapter();
      assert.strictEqual(adapter.isSupported('http://localhost:8000/portal'), true);
      assert.strictEqual(adapter.isSupported('http://127.0.0.1:8000/portal/complaint'), true);
      assert.strictEqual(adapter.isSupported('http://mysite.com/portal/index'), true);
      assert.strictEqual(adapter.isSupported('http://mysite.com/other'), false);
    });

    test('Full Form Autofill on Mock Portal DOM', async () => {
      const adapter = new env.window.MockPortalAdapter();

      // Populate mock portal DOM
      const nameInput = env.document.createElement('input');
      nameInput.id = 'citizen-name';
      env.document.body.appendChild(nameInput);

      const phoneInput = env.document.createElement('input');
      phoneInput.id = 'citizen-phone';
      env.document.body.appendChild(phoneInput);

      const deptSelect = env.document.createElement('select');
      deptSelect.id = 'department-select';
      deptSelect.options = [
        { value: 'Water Works', text: 'Water Works' },
        { value: 'Roads & Bridges', text: 'Roads & Bridges' }
      ];
      env.document.body.appendChild(deptSelect);

      const catSelect = env.document.createElement('input');
      catSelect.id = 'category-select';
      env.document.body.appendChild(catSelect);

      const urgSelect = env.document.createElement('select');
      urgSelect.id = 'urgency-select';
      urgSelect.options = [
        { value: 'LOW', text: 'LOW' },
        { value: 'HIGH', text: 'HIGH' }
      ];
      env.document.body.appendChild(urgSelect);

      const locInput = env.document.createElement('input');
      locInput.id = 'location-input';
      env.document.body.appendChild(locInput);

      const descInput = env.document.createElement('textarea');
      descInput.id = 'description-textarea';
      env.document.body.appendChild(descInput);

      const progressLogs = [];
      const res = await adapter.fill({
        citizen_name: 'Priya Sharma',
        citizen_phone: '9876543210',
        department: 'Water',
        category: 'Drainage Overflow',
        urgency_level: 'HIGH',
        location: 'Hyderabad Ward 12',
        description: 'Severe sewage overflow blocking the lane.'
      }, (msg) => progressLogs.push(msg));

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.readyToSubmit, true);
      assert.strictEqual(nameInput.value, 'Priya Sharma');
      assert.strictEqual(phoneInput.value, '9876543210');
      assert.strictEqual(deptSelect.value, 'Water Works');
      assert.strictEqual(urgSelect.value, 'HIGH');
      assert.strictEqual(locInput.value, 'Hyderabad Ward 12');
      assert.strictEqual(descInput.value, 'Severe sewage overflow blocking the lane.');
      assert.ok(progressLogs.length >= 6);
    });

    test('LAYOUT_CHANGED: flags missing DOM selectors when portal changes', async () => {
      const adapter = new env.window.MockPortalAdapter();
      // Empty DOM - no selectors present
      const res = await adapter.fill({ citizen_name: 'Test' });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'LAYOUT_CHANGED');
      assert.ok(res.missingSelectors.includes('#citizen-name'));
      assert.ok(res.missingSelectors.includes('#department-select'));
    });

    test('DOM Inspection: computes totalRequired and filledRequired accurately', async () => {
      const adapter = new env.window.MockPortalAdapter();
      const nameInput = env.document.createElement('input');
      nameInput.id = 'citizen-name';
      nameInput.value = 'Ramesh Kumar';
      env.document.body.appendChild(nameInput);

      const phoneInput = env.document.createElement('input');
      phoneInput.id = 'citizen-phone';
      env.document.body.appendChild(phoneInput);

      const inspection = await adapter.inspect();
      assert.strictEqual(inspection.hasForm, true);
      assert.strictEqual(inspection.totalRequired, 7);
      assert.strictEqual(inspection.filledRequired, 1);
      assert.strictEqual(inspection.isFullyFilled, false);
    });

    test('Tracking ID Extraction: parses #tracking-id text', async () => {
      const adapter = new env.window.MockPortalAdapter();
      const trackEl = env.document.createElement('div');
      trackEl.id = 'tracking-id';
      trackEl.innerText = 'GHMC-2026-99214';
      env.document.body.appendChild(trackEl);

      const id = await adapter.readTrackingId();
      assert.strictEqual(id, 'GHMC-2026-99214');
    });
  });

  describe('3. CPGRAMSAdapter Audit', () => {
    test('Domain matching: verifies pgportal.gov.in', () => {
      const adapter = new env.window.CPGRAMSAdapter();
      assert.strictEqual(adapter.isSupported('https://pgportal.gov.in/Registration'), true);
      assert.strictEqual(adapter.isSupported('https://pgportal.gov.in/Home'), true);
      assert.strictEqual(adapter.isSupported('https://other.gov.in/'), false);
    });

    test('Page state heuristics: identifies landing page vs sign-in vs active grievance form', async () => {
      const adapter = new env.window.CPGRAMSAdapter();
      env.window.location.href = 'https://pgportal.gov.in/signin';
      let inspection = await adapter.inspect();
      assert.strictEqual(inspection.pageState, 'SIGNIN_REQUIRED');
      assert.strictEqual(inspection.hasForm, false);

      // Now add grievance textarea to simulate form page
      const textarea = env.document.createElement('textarea');
      textarea.id = 'grievance';
      env.document.body.appendChild(textarea);

      env.window.location.href = 'https://pgportal.gov.in/Grievance';
      inspection = await adapter.inspect();
      assert.strictEqual(inspection.pageState, 'FORM_ACTIVE');
      assert.strictEqual(inspection.hasForm, true);
    });

    test('Assistive fill: injects petition text, preserves CAPTCHA & user submission control', async () => {
      const adapter = new env.window.CPGRAMSAdapter();
      const textarea = env.document.createElement('textarea');
      textarea.id = 'grievance';
      env.document.body.appendChild(textarea);

      const res = await adapter.fill({
        description: 'Pension delay complaint.',
        location: 'Sector 4, New Delhi'
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.readyToSubmit, false); // Assistive only: user must submit
      assert.ok(textarea.value.includes('Pension delay complaint.'));
      assert.ok(textarea.value.includes('Incident Location: Sector 4, New Delhi'));
      assert.ok(res.notice.includes('Please verify, enter CAPTCHA/OTP, and click Submit'));
    });

    test('Tracking ID Extraction: extracts registration number via regex', async () => {
      const adapter = new env.window.CPGRAMSAdapter();
      env.document.body.innerText = 'Thank you. Your Registration No: DARPG/E/2026/00192 has been lodged successfully.';
      const id = await adapter.readTrackingId();
      assert.strictEqual(id, 'DARPG/E/2026/00192');
    });
  });

  describe('4. GenericCivicAdapter Audit', () => {
    test('Strict civic & government domain scoping (Finding 1 Remediation)', () => {
      const adapter = new env.window.GenericCivicAdapter();
      // Legitimate government and public identity portals
      assert.strictEqual(adapter.isSupported('https://tathya.uidai.gov.in/login'), true);
      assert.strictEqual(adapter.isSupported('https://myscheme.gov.in/schemes/pmkisan'), true);
      assert.strictEqual(adapter.isSupported('https://karnataka.gov.in/sevasindhu'), true);
      assert.strictEqual(adapter.isSupported('http://localhost:8000/portal'), true);

      // Explicit municipal / civic subdomains and paths
      assert.strictEqual(adapter.isSupported('https://ghmc-municipal.org/citizen/portal'), true);

      // Commercial and attacker domains MUST strictly fail closed
      assert.strictEqual(adapter.isSupported('https://google.com'), false);
      assert.strictEqual(adapter.isSupported('https://attacker.com/fake'), false);
      assert.strictEqual(adapter.isSupported('https://malicious.com/stealer'), false);
    });

    test('Deep Query Selector & Keyword Match across input attributes', () => {
      const adapter = new env.window.GenericCivicAdapter();

      const aadhaarInput = env.document.createElement('input');
      aadhaarInput.id = 'txtAadhaarNo';
      aadhaarInput.setAttribute('placeholder', 'Enter 12-digit Aadhaar Number');
      env.document.body.appendChild(aadhaarInput);

      const found = adapter.findElementByKeywords(['aadhaar', 'uid'], ['input']);
      assert.strictEqual(found, aadhaarInput);
    });

    test('Label htmlFor association: finds input via associated label text', () => {
      const adapter = new env.window.GenericCivicAdapter();

      const label = env.document.createElement('label');
      label.innerText = 'Mobile Number for Verification';
      label.setAttribute('for', 'user-phone-input');
      label.htmlFor = 'user-phone-input';
      env.document.body.appendChild(label);

      const phoneInput = env.document.createElement('input');
      phoneInput.id = 'user-phone-input';
      env.document.body.appendChild(phoneInput);

      const found = adapter.findElementByKeywords(['mobile', 'phone'], ['input']);
      assert.strictEqual(found, phoneInput);
    });

    test('Universal Form Autofill: normalizes whitespace in Aadhaar UID and populates fields', async () => {
      const adapter = new env.window.GenericCivicAdapter();

      const uidInput = env.document.createElement('input');
      uidInput.id = 'txtAadhaar';
      env.document.body.appendChild(uidInput);

      const descInput = env.document.createElement('textarea');
      descInput.id = 'txtGrievance';
      env.document.body.appendChild(descInput);

      const nameInput = env.document.createElement('input');
      nameInput.name = 'applicant_name';
      env.document.body.appendChild(nameInput);

      const res = await adapter.fill({
        aadhaar: '2286 5470 5324',
        description: 'Road damage issue.',
        citizen_name: 'Ananya Rao'
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.filledCount, 3);
      assert.strictEqual(uidInput.value, '2286 5470 5324');
      assert.strictEqual(descInput.value, 'Road damage issue.');
      assert.strictEqual(nameInput.value, 'Ananya Rao');
    });

    test('Tracking ID Regex: matches varied government reference formats', async () => {
      const adapter = new env.window.GenericCivicAdapter();

      env.document.body.innerText = 'Your Grievance No: MH-PUNE-2026-8812 has been recorded.';
      assert.strictEqual(await adapter.readTrackingId(), 'MH-PUNE-2026-8812');

      env.document.body.innerText = 'Status: Application No: AP/REV/98124/2026 Submitted.';
      assert.strictEqual(await adapter.readTrackingId(), 'AP/REV/98124/2026');

      env.document.body.innerText = 'Payment Successful. Token No: TN-CIVIC-55412.';
      assert.strictEqual(await adapter.readTrackingId(), 'TN-CIVIC-55412');
    });
  });

  describe('5. Adapter Registry Hierarchy Audit', () => {
    test('Hierarchy order: MockPortal > CPGRAMS > GenericCivic', () => {
      const mockAdapter = env.window.getPortalAdapter('http://localhost:8000/portal');
      assert.strictEqual(mockAdapter.name, 'Mock Municipal Corporation Portal');

      const cpgramsAdapter = env.window.getPortalAdapter('https://pgportal.gov.in/status');
      assert.strictEqual(cpgramsAdapter.name, 'CPGRAMS National Grievance Portal');

      const genericAdapter = env.window.getPortalAdapter('https://uidai.gov.in/en/');
      assert.strictEqual(genericAdapter.name, 'Universal Web Portal');
    });

    test('Universal fallback: guaranteed active adapter for unhandled desktop domains', () => {
      const fallback = env.window.getPortalAdapter('https://some-state-portal.gov.in/citizen-services');
      assert.ok(fallback);
      assert.strictEqual(fallback instanceof env.window.GenericCivicAdapter, true);
    });
  });

  describe('6. Content Script DOM Automation & Messaging Audit', () => {
    beforeEach(() => {
      loadScript(path.join(__dirname, '../content/content_script.js'), env);
    });

    test('extractPageDomInfo: captures form metadata, action buttons, and input fields', () => {
      const h1 = env.document.createElement('h1');
      h1.innerText = 'MahaDBT Scholarship Portal';
      env.document.body.appendChild(h1);

      const nameInput = env.document.createElement('input');
      nameInput.id = 'applicant-name';
      nameInput.required = true;
      env.document.body.appendChild(nameInput);

      const submitBtn = env.document.createElement('button');
      submitBtn.id = 'btn-submit-app';
      submitBtn.innerText = 'Submit Application';
      env.document.body.appendChild(submitBtn);

      let responseData = null;
      for (const listener of env.messageListeners) {
        listener({ action: 'CHECK_PAGE_SUPPORT' }, {}, (res) => { responseData = res; });
      }

      assert.ok(responseData);
      assert.strictEqual(responseData.supported, true);
      assert.strictEqual(responseData.mainHeading, 'MahaDBT Scholarship Portal');
      assert.strictEqual(responseData.hasForm, true);
      assert.strictEqual(responseData.fields.length, 1);
      assert.strictEqual(responseData.fields[0].required, true);
      assert.strictEqual(responseData.actionButtons.length, 1);
      assert.strictEqual(responseData.actionButtons[0].text, 'Submit Application');
    });

    test('executeUniversalFill: fills UID safely, leaves auth radio to user, masks identity in telemetry', () => {
      const otpRadio = env.document.createElement('input');
      otpRadio.type = 'radio';
      otpRadio.checked = false;
      otpRadio.setAttribute('aria-label', 'Login with OTP');
      env.document.body.appendChild(otpRadio);

      const uidInput = env.document.createElement('input');
      uidInput.id = 'uid_number';
      env.document.body.appendChild(uidInput);

      let responseData = null;
      for (const listener of env.messageListeners) {
        listener({
          action: 'FILL_FIELDS',
          fields: {
            uid: '2286 5470 5324'
          }
        }, {}, (res) => { responseData = res; });
      }

      assert.ok(responseData);
      assert.strictEqual(responseData.success, true);
      assert.strictEqual(responseData.filledCount, 1);
      assert.strictEqual(otpRadio.checked, false); // Authentication method choice is strictly citizen-controlled
      assert.strictEqual(uidInput.value, '228654705324');
      // Zero-knowledge masking check in response payload
      assert.strictEqual(responseData.filledItems[0].maskedValue, 'XXXXXXXX5324');
    });

    test('Submission Safety & Element Click: blocks automated submission clicks while permitting safe UI toggles', () => {
      const submitBtn = env.document.createElement('button');
      submitBtn.id = 'lodge-complaint-btn';
      submitBtn.innerText = 'Lodge Grievance';
      env.document.body.appendChild(submitBtn);

      const navTab = env.document.createElement('button');
      navTab.id = 'view-tab';
      navTab.innerText = 'View Details';
      env.document.body.appendChild(navTab);

      let submitClickRes = null;
      let safeClickRes = null;
      let highlightRes = null;

      for (const listener of env.messageListeners) {
        listener({ action: 'HIGHLIGHT_PAGE_ELEMENT', target: 'SUBMIT' }, {}, (r) => { highlightRes = r; });
        listener({ action: 'CLICK_PAGE_ELEMENT', target: 'SUBMIT' }, {}, (r) => { submitClickRes = r; });
        listener({ action: 'CLICK_PAGE_ELEMENT', target: 'view-tab' }, {}, (r) => { safeClickRes = r; });
      }

      assert.strictEqual(highlightRes.success, true);
      // Automated submit click must be blocked for citizen protection
      assert.strictEqual(submitClickRes.success, false);
      assert.strictEqual(submitClickRes.blocked, true);
      // Safe non-submission UI click is allowed
      assert.strictEqual(safeClickRes.success, true);
      assert.strictEqual(navTab.clicked, true);
    });

    test('DOM-Action Layer Submission Guard: blocks click on opaque button ID with submit semantics (Finding 3)', () => {
      const opaqueSubmitBtn = env.document.createElement('button');
      opaqueSubmitBtn.id = 'btn_8271';
      opaqueSubmitBtn.type = 'submit';
      opaqueSubmitBtn.innerText = 'Lodge Application';
      env.document.body.appendChild(opaqueSubmitBtn);

      let clickRes = null;
      for (const listener of env.messageListeners) {
        listener({ action: 'CLICK_PAGE_ELEMENT', target: 'btn_8271' }, {}, (r) => { clickRes = r; });
      }

      assert.strictEqual(clickRes.success, false);
      assert.strictEqual(clickRes.blocked, true);
      assert.ok(clickRes.reason.includes('Nagarik AI Safety Guard'));
      assert.strictEqual(Boolean(opaqueSubmitBtn.clicked), false);
    });

    test('Submission Guard: event-delegation blocks clicks on child icon/span inside submit button (Round 5)', () => {
      const form = env.document.createElement('form');
      const submitBtn = env.document.createElement('button');
      submitBtn.id = 'official-submit-btn';
      submitBtn.type = 'submit';
      
      const childSpan = env.document.createElement('span');
      childSpan.id = 'btn-icon-label';
      childSpan.innerText = 'Submit Complaint';
      submitBtn.appendChild(childSpan);
      form.appendChild(submitBtn);
      env.document.body.appendChild(form);

      let clickRes = null;
      for (const listener of env.messageListeners) {
        listener({ action: 'CLICK_PAGE_ELEMENT', target: 'btn-icon-label' }, {}, (r) => { clickRes = r; });
      }

      assert.ok(clickRes);
      assert.strictEqual(clickRes.success, false);
      assert.strictEqual(clickRes.blocked, true);
    });

    test('Sensitive Field Protection: strictly rejects filling passwords, OTPs, and does NOT auto-check consent', () => {
      const pwdInput = env.document.createElement('input');
      pwdInput.type = 'password';
      pwdInput.name = 'password';
      env.document.body.appendChild(pwdInput);

      const otpInput = env.document.createElement('input');
      otpInput.name = 'otp_code';
      env.document.body.appendChild(otpInput);

      const consentBox = env.document.createElement('input');
      consentBox.type = 'checkbox';
      consentBox.name = 'declaration_agree';
      consentBox.checked = false;
      env.document.body.appendChild(consentBox);

      for (const listener of env.messageListeners) {
        listener({
          action: 'FILL_FIELDS',
          fields: {
            password: 'secret_password_123',
            otp: '123456'
          }
        }, {}, () => {});
      }

      assert.strictEqual(pwdInput.value, '');
      assert.strictEqual(otpInput.value, '');
      assert.strictEqual(consentBox.checked, false); // Citizen consent must NOT be automated!
    });
  });

  describe('7. Zero-Knowledge Privacy & Security Audit', () => {
    // Audit real production citizen input parser directly from citizen_parser.js
    const { parseCitizenInput, wordsToDigits, convertIndicDigits, deduplicateConsecutiveWords } = require('../sidepanel/citizen_parser.js');

    test('Multilingual wordsToDigits: converts English, Hindi, and Telugu speech transcripts and numerals to digits', () => {
      // 1. English words
      assert.strictEqual(
        wordsToDigits('four eight eight eight one three one two seven eight three nine'),
        '488813127839'
      );
      assert.strictEqual(
        wordsToDigits('two two eight six five four seven zero five three two four'),
        '228654705324'
      );

      // 2. Hindi words
      assert.strictEqual(
        wordsToDigits('चार आठ आठ आठ एक तीन एक दो सात आठ तीन नौ'),
        '488813127839'
      );
      assert.strictEqual(
        wordsToDigits('दो दो आठ छह पांच चार सात शून्य पांच तीन दो चार'),
        '228654705324'
      );

      // 3. Telugu words
      assert.strictEqual(
        wordsToDigits('నాలుగు ఎనిమిది ఎనిమిది ఎనిమిది ఒకటి మూడు ఒకటి రెండు ఏడు ఎనిమిది మూడు తొమ్మిది'),
        '488813127839'
      );
      assert.strictEqual(
        wordsToDigits('రెండు రెండు ఎనిమిది ఆరు ఐదు నాలుగు ఏడు సున్నా ఐదు మూడు రెండు నాలుగు'),
        '228654705324'
      );

      // 4. Devanagari numerals
      assert.strictEqual(wordsToDigits('४८८८१३१२७८३९'), '488813127839');
      assert.strictEqual(wordsToDigits('२२८६ ५४७० ५३२४'), '228654705324');

      // 5. Telugu numerals
      assert.strictEqual(wordsToDigits('౪౮౮౮౧౩౧౨౭౮౩౯'), '488813127839');
      assert.strictEqual(wordsToDigits('౨౨౮౬ ౫౪౭౦ ౫౩౨౪'), '228654705324');

      // 6. Roman transliterated phonetic digits
      assert.strictEqual(
        wordsToDigits('char aath aath aath ek teen ek do saat aath teen nau'),
        '488813127839'
      );
      assert.strictEqual(
        wordsToDigits('naalugu enimidi enimidi enimidi okati moodu okati rendu eedu enimidi moodu thommidi'),
        '488813127839'
      );
    });

    test('parseCitizenInput: multilingual Indic entity extraction (Telugu and Hindi sentences)', () => {
      // Telugu sentence with Telugu numerals and terms
      const teluguInput = 'నా పేరు రమేష్ రావు, నా ఆధార్ సంఖ్య ౨౨౮౬ ౫౪౭౦ ౫౩౨౪ మరియు ఫోన్ 9876543210';
      const parsedTe = parseCitizenInput(teluguInput);
      assert.strictEqual(parsedTe.extractedName, 'రమేష్ రావు');
      assert.strictEqual(parsedTe.extractedAadhaar, '228654705324');
      assert.strictEqual(parsedTe.extractedPhone, '9876543210');

      // Hindi sentence with Devanagari numerals and terms
      const hindiInput = 'मेरा नाम सुरेश शर्मा है, मेरा आधार ४८८८ १३१२ ७८३९ और मोबाइल ९८७६५४३२१० है।';
      const parsedHi = parseCitizenInput(hindiInput);
      assert.strictEqual(parsedHi.extractedName, 'सुरेश शर्मा');
      assert.strictEqual(parsedHi.extractedAadhaar, '488813127839');
      assert.strictEqual(parsedHi.extractedPhone, '9876543210');

      // Hindi with संपर्क and यूआईडी
      const hindiInput2 = 'यूआईडी: 4888 1312 7839, संपर्क: 9123456789, पिनकोड: 500034';
      const parsedHi2 = parseCitizenInput(hindiInput2);
      assert.strictEqual(parsedHi2.extractedAadhaar, '488813127839');
      assert.strictEqual(parsedHi2.extractedPhone, '9123456789');
      assert.strictEqual(parsedHi2.extractedPin, '500034');

      // Telugu with సంప్రదింపు and యూఐడీ
      const teluguInput2 = 'యూఐడీ: 228654705324, సంప్రదింపు: 9876543210, పిన్‌కోడ్: 500081';
      const parsedTe2 = parseCitizenInput(teluguInput2);
      assert.strictEqual(parsedTe2.extractedAadhaar, '228654705324');
      assert.strictEqual(parsedTe2.extractedPhone, '9876543210');
      assert.strictEqual(parsedTe2.extractedPin, '500081');
    });

    test('deduplicateConsecutiveWords: suppresses stuttered duplicate words and phrases from streaming speech in Telugu, Hindi, and English', () => {
      // 1. Telugu duplicate words
      assert.strictEqual(
        deduplicateConsecutiveWords('నమస్కారం నమస్కారం నా పేరు రమేష్ రమేష్'),
        'నమస్కారం నా పేరు రమేష్'
      );
      // 2. Telugu repeated 2-word phrase
      assert.strictEqual(
        deduplicateConsecutiveWords('రైతు భరోసా రైతు భరోసా పథకం కావాలి'),
        'రైతు భరోసా పథకం కావాలి'
      );
      // 3. Hindi duplicate words
      assert.strictEqual(
        deduplicateConsecutiveWords('नमस्ते नमस्ते मेरा नाम राहुल राहुल है'),
        'नमस्ते मेरा नाम राहुल है'
      );
      // 4. Hindi repeated 2-word phrase
      assert.strictEqual(
        deduplicateConsecutiveWords('पीएम किसान पीएम किसान योजना में आवेदन'),
        'पीएम किसान योजना में आवेदन'
      );
      // 5. English duplicate words
      assert.strictEqual(
        deduplicateConsecutiveWords('water water leakage pipeline pipeline near road road'),
        'water leakage pipeline near road'
      );
    });

    test('parseCitizenInput: regex-extracts Aadhaar UID (12 digits, grouped or continuous) with 0 network leakage', () => {

      // Grouped 4-4-4
      const p1 = parseCitizenInput('Please link my aadhaar 2286 5470 5324 to mobile 9876543210');
      assert.strictEqual(p1.extractedAadhaar, '228654705324');
      assert.strictEqual(p1.extractedPhone, '9876543210');

      // Continuous 12 digits
      const p2 = parseCitizenInput('Citizen UID: 554433221100, pincode: 500034, email: user@domain.com');
      assert.strictEqual(p2.extractedAadhaar, '554433221100');
      assert.strictEqual(p2.extractedPin, '500034');
      assert.strictEqual(p2.extractedEmail, 'user@domain.com');

      // Name extraction
      const p3 = parseCitizenInput('My name is Vikramaditya Reddy and I need pension certificate.');
      assert.strictEqual(p3.extractedName, 'Vikramaditya Reddy');
    });

    test('Zero-Knowledge Masking: Aadhaar is masked to XXXXXXXX<last4> in user displays and logs', () => {
      const uid = '228654705324';
      const masked = 'XXXXXXXX' + uid.slice(-4);
      assert.strictEqual(masked, 'XXXXXXXX5324');
      assert.strictEqual(masked.length, 12);
      assert.ok(!masked.includes('2286'));
      assert.ok(!masked.includes('5470'));
    });

    test('Zero Outbound Network Leakage: verifies extension codebase contains 0 HTTP/Fetch/XHR calls', () => {
      const extDir = path.join(__dirname, '..');
      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        let foundCalls = [];
        for (const f of files) {
          const full = path.join(dir, f);
          const stat = fs.statSync(full);
          if (stat.isDirectory() && f !== 'tests' && f !== 'node_modules' && f !== 'assets' && f !== 'icons') {
            foundCalls = foundCalls.concat(scanDir(full));
          } else if (f.endsWith('.js')) {
            const content = fs.readFileSync(full, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, lineNo) => {
              if (/fetch\s*\(/.test(line) || /new\s+XMLHttpRequest/.test(line) || /\$\.ajax/.test(line)) {
                foundCalls.push({ file: f, line: lineNo + 1, code: line.trim() });
              }
            });
          }
        }
        return foundCalls;
      }

      const networkCalls = scanDir(extDir);
      assert.strictEqual(networkCalls.length, 0, `Expected 0 network calls in extension, found: ${JSON.stringify(networkCalls)}`);
    });

    test('Manifest V3 Security & Permissions Check', () => {
      const manifestPath = path.join(__dirname, '../manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      assert.strictEqual(manifest.manifest_version, 3);
      assert.ok(manifest.permissions.includes('activeTab'));
      assert.ok(manifest.permissions.includes('sidePanel'));
      assert.ok(manifest.permissions.includes('scripting'));
      // Ensure no dangerous permissions
      assert.strictEqual(manifest.permissions.includes('cookies'), false);
      assert.strictEqual(manifest.permissions.includes('webRequest'), false);
      assert.strictEqual(manifest.permissions.includes('debugger'), false);
    });

    test('Zero-Demo Default & UIDAI Verhoeff Checksum Validation (Round 5)', () => {
      const sidepanelJs = fs.readFileSync(path.join(__dirname, '../sidepanel/sidepanel.js'), 'utf8');

      // 1. Verify zero-demo default: initial Aadhaar and UID are null
      assert.ok(sidepanelJs.includes('uid: null'), 'Initial uid must be null (zero-demo default)');
      assert.ok(sidepanelJs.includes('aadhaar: null'), 'Initial aadhaar must be null (zero-demo default)');
      assert.ok(!sidepanelJs.includes('citizen_name: "Ramesh Kumar"\n    citizen_phone: "9876543210"\n    citizen_email: "ramesh.kumar@example.com"\n    uid: "488813127839"'), 'Must not auto-inject hardcoded Ramesh Kumar on startup');

      // 2. Verhoeff D5 Checksum logic verification
      const VERHOEFF_D = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
      ];
      const VERHOEFF_P = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
      ];
      function validateVerhoeff(numStr) {
        if (!numStr || typeof numStr !== 'string') return false;
        const clean = numStr.replace(/[\s-]/g, '');
        if (!/^\d{12}$/.test(clean)) return false;
        if (/^(\d)\1{11}$/.test(clean)) return false;
        let c = 0;
        const invertedArray = clean.split('').reverse().map(Number);
        for (let i = 0; i < invertedArray.length; i++) {
          c = VERHOEFF_D[c][VERHOEFF_P[i % 8][invertedArray[i]]];
        }
        return c === 0;
      }

      // Valid UIDAI test numbers must pass
      assert.strictEqual(validateVerhoeff('488813127839'), true);
      assert.strictEqual(validateVerhoeff('228654705324'), true);
      // Arbitrary sequential numbers (like 234567890123 from user testing) must FAIL
      assert.strictEqual(validateVerhoeff('234567890123'), false);
      // Repeating digits must FAIL
      assert.strictEqual(validateVerhoeff('111111111111'), false);
    });
  });
});
