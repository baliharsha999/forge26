import React, { useState, useEffect } from 'react';
import {
  X, Check, AlertTriangle, Trash2, Eye,
  Languages, Shield, CheckCircle, Sliders
} from 'lucide-react';

export type SettingsLanguage = 'en' | 'hi' | 'te' | 'ta';

interface CivicSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: SettingsLanguage;
  onLanguageChange: (lang: SettingsLanguage) => void;
  onClearHistory: () => void;
  incognito: boolean;
  onToggleIncognito: (enabled: boolean) => void;
}

const TRANSLATIONS: Record<SettingsLanguage, Record<string, string>> = {
  en: {
    pref_badge: "Preferences",
    page_title: "Settings & Accessibility",
    page_subtitle: "Customize your font size, display contrast, language preferences, and conversation privacy.",
    sec_accessibility_title: "Accessibility",
    sec_accessibility_desc: "Adjust visual readability and display contrast",
    label_font_size: "Font Size",
    font_normal: "Normal",
    font_large: "Large",
    font_xlarge: "Extra Large",
    label_high_contrast: "High Contrast Mode",
    desc_high_contrast: "Increase text sharpness and border contrast for easier reading outdoors.",
    sec_language_title: "Language",
    sec_language_desc: "Select your primary language for chat and official forms",
    lang_active_badge: "Active",
    lang_sub_hindi: "Hindi",
    lang_sub_telugu: "Telugu",
    lang_sub_tamil: "Tamil",
    sec_privacy_title: "Privacy & History",
    sec_privacy_desc: "Manage session privacy and local chat storage",
    label_incognito: "Incognito Session",
    desc_incognito: "Do not save any conversation history or form drafts during this session.",
    label_chat_history: "Chat History",
    desc_chat_history: "Permanently delete all saved conversations and advisory logs from this browser.",
    btn_clear_history: "Clear Chat History",
    modal_title: "Irreversible Cache Purge",
    modal_desc: "This operation will eradicate all stored conversation transcripts with AI Sathi and remove your cached entitlement scores. Are you certain you want to proceed?",
    btn_cancel: "Cancel",
    btn_confirm_purge: "Yes, Purge Now",
    toast_font_updated: "Font size updated",
    toast_contrast_on: "High contrast mode enabled",
    toast_contrast_off: "High contrast mode disabled",
    toast_lang_updated: "Language switched to English",
    toast_incognito_on: "Incognito session activated (no data stored)",
    toast_incognito_off: "Incognito session deactivated",
    toast_history_cleared: "Chat history permanently deleted"
  },
  hi: {
    pref_badge: "प्राथमिकताएं",
    page_title: "सेटिंग्स और सुगमता",
    page_subtitle: "अपने फ़ॉन्ट आकार, डिस्प्ले कंट्रास्ट, भाषा प्राथमिकताएं और बातचीत की गोपनीयता को अनुकूलित करें।",
    sec_accessibility_title: "सुगमता (एक्सेसिबिलिटी)",
    sec_accessibility_desc: "दृश्य पठनीयता और डिस्प्ले कंट्रास्ट समायोजित करें",
    label_font_size: "फ़ॉन्ट का आकार",
    font_normal: "सामान्य",
    font_large: "बड़ा",
    font_xlarge: "अति विशाल",
    label_high_contrast: "उच्च कंट्रास्ट मोड",
    desc_high_contrast: "धूप या बाहर आसानी से पढ़ने के लिए टेक्स्ट की स्पष्टता और बॉर्डर कंट्रास्ट बढ़ाएं।",
    sec_language_title: "भाषा चयन",
    sec_language_desc: "चैट और आधिकारिक फ़ॉर्म के लिए अपनी प्राथमिक भाषा चुनें",
    lang_active_badge: "सक्रिय",
    lang_sub_hindi: "हिन्दी",
    lang_sub_telugu: "तेलुगु",
    lang_sub_tamil: "तमिल",
    sec_privacy_title: "गोपनीयता और इतिहास",
    sec_privacy_desc: "सत्र गोपनीयता और स्थानीय चैट संग्रहण प्रबंधित करें",
    label_incognito: "गुप्त (इनकॉग्निटो) सत्र",
    desc_incognito: "इस सत्र के दौरान कोई भी बातचीत इतिहास या फ़ॉर्म ड्राफ्ट न सहेजें।",
    label_chat_history: "चैट इतिहास",
    desc_chat_history: "इस ब्राउज़र से सभी सहेजी गई बातचीत और सलाहकार लॉग को स्थायी रूप से हटाएं।",
    btn_clear_history: "चैट इतिहास साफ़ करें",
    modal_title: "अपरिवर्तनीय कैश निष्कासन",
    modal_desc: "यह क्रिया एआई साथी के साथ सहेजे गए सभी वार्तालाप प्रतिलेखों को मिटा देगी। क्या आप निश्चित रूप से आगे बढ़ना चाहते हैं?",
    btn_cancel: "रद्द करें",
    btn_confirm_purge: "हाँ, अभी हटाएं",
    toast_font_updated: "फ़ॉन्ट का आकार अद्यतित किया गया",
    toast_contrast_on: "उच्च कंट्रास्ट मोड सक्षम किया गया",
    toast_contrast_off: "उच्च कंट्रास्ट मोड अक्षम किया गया",
    toast_lang_updated: "भाषा हिन्दी में बदली गई",
    toast_incognito_on: "इनकॉग्निटो सत्र सक्रिय किया गया",
    toast_incognito_off: "इनकॉग्निटो सत्र बंद किया गया",
    toast_history_cleared: "सभी चैट इतिहास स्थायी रूप से हटा दिया गया"
  },
  te: {
    pref_badge: "ప్రాధాన్యతలు",
    page_title: "సెట్టింగ్‌లు & సౌలభ్యం",
    page_subtitle: "మీ ఫాంట్ సైజు, కాంట్రాస్ట్, భాష ప్రాధాన్యతలు మరియు సంభాషణ గోప్యతను అనుకూలీకరించండి.",
    sec_accessibility_title: "యాక్సెసిబిలిటీ",
    sec_accessibility_desc: "స్పష్టత మరియు కాంట్రాస్ట్‌ను సులభంగా సర్దుబాటు చేయండి",
    label_font_size: "ఫాంట్ పరిమాణం",
    font_normal: "సాధారణం",
    font_large: "పెద్దది",
    font_xlarge: "చాలా పెద్దది",
    label_high_contrast: "హై కాంట్రాస్ట్ మోడ్",
    desc_high_contrast: "సులభంగా చదవడానికి అక్షరాల స్పష్టతను మరియు బార్డర్‌లను మెరుగుపరచండి.",
    sec_language_title: "భాష",
    sec_language_desc: "చాట్ మరియు ఫారాల కోసం మీ ప్రాథమిక భాషను ఎంచుకోండి",
    lang_active_badge: "యాక్టివ్",
    lang_sub_hindi: "హిందీ",
    lang_sub_telugu: "తెలుగు",
    lang_sub_tamil: "తమిళం",
    sec_privacy_title: "గోప్యత & హిస్టరీ",
    sec_privacy_desc: "సెషన్ గోప్యత మరియు లోకల్ చాట్ స్టోరేజ్‌ను నిర్వహించండి",
    label_incognito: "అజ్ఞాత సెషన్ (ఇన్‌కాగ్నిటో)",
    desc_incognito: "ఈ సెషన్ సమయంలో ఏ సంభాషణ చరిత్ర లేదా డ్రాఫ్ట్‌లను సేవ్ చేయవద్దు.",
    label_chat_history: "చాట్ హిస్టరీ",
    desc_chat_history: "ఈ బ్రౌజర్ నుండి అన్ని సేవ్ చేయబడిన సంభాషణలను శాశ్వతంగా తొలగించండి.",
    btn_clear_history: "చాట్ హిస్టరీ తొలగించు",
    modal_title: "చాట్ హిస్టరీ క్లియర్ చేయుట",
    modal_desc: "ఈ చర్య ఏఐ సాథీతో నిల్వ చేసిన అన్ని సంభాషణలను శాశ్వతంగా తొలగిస్తుంది. మీరు కొనసాగించాలనుకుంటున్నారా?",
    btn_cancel: "రద్దు చేయి",
    btn_confirm_purge: "అవును, తొలగించు",
    toast_font_updated: "ఫాంట్ పరిమాణం మార్చబడింది",
    toast_contrast_on: "హై కాంట్రాస్ట్ మోడ్ ఆన్ చేయబడింది",
    toast_contrast_off: "హై కాంట్రాస్ట్ మోడ్ ఆఫ్ చేయబడింది",
    toast_lang_updated: "భాష తెలుగులోకి మార్చబడింది",
    toast_incognito_on: "ఇన్‌కాగ్నిటో సెషన్ ఆన్ చేయబడింది",
    toast_incognito_off: "ఇన్‌కాగ్నిటో సెషన్ ఆఫ్ చేయబడింది",
    toast_history_cleared: "చాట్ హిస్టరీ విజయవంతంగా తొలగించబడింది"
  },
  ta: {
    pref_badge: "விருப்பத்தேர்வுகள்",
    page_title: "அமைப்புகள் & அணுகல்தன்மை",
    page_subtitle: "எழுத்துரு அளவு, மாறுபாடு, மொழி விருப்பங்கள் மற்றும் உரையாடல் தனியுரிமையைத் தனிப்பயனாக்குங்கள்.",
    sec_accessibility_title: "அணுகல்தன்மை",
    sec_accessibility_desc: "காட்சி வாசிப்புத்திறன் மற்றும் மாறுபாட்டைச் சரிசெய்யவும்",
    label_font_size: "எழுத்துரு அளவு",
    font_normal: "இயல்பான",
    font_large: "பெரியது",
    font_xlarge: "மிகப் பெரியது",
    label_high_contrast: "உயர் மாறுபட்ட பயன்முறை",
    desc_high_contrast: "எளிதாக வாசிக்க உரைத் தெளிவு மற்றும் எல்லைக் கோடுகளை அதிகரிக்கவும்.",
    sec_language_title: "மொழி",
    sec_language_desc: "உரையாடல் மற்றும் படிவங்களுக்கான முதன்மை மொழியைத் தேர்ந்தெடுக்கவும்",
    lang_active_badge: "செயலில்",
    lang_sub_hindi: "இந்தி",
    lang_sub_telugu: "தெலுங்கு",
    lang_sub_tamil: "தமிழ்",
    sec_privacy_title: "தனியுரிமை & வரலாறு",
    sec_privacy_desc: "அமர்வு தனியுரிமை மற்றும் உள்ளூர் சேமிப்பகத்தை நிர்வகிக்கவும்",
    label_incognito: "மறைநிலை அமர்வு",
    desc_incognito: "இந்த அமர்வின் போது எந்த உரையாடல் வரலாற்றையும் சேமிக்க வேண்டாம்.",
    label_chat_history: "அரட்டை வரலாறு",
    desc_chat_history: "இந்த உலாவியில் இருந்து சேமிக்கப்பட்ட அனைத்து உரையாடல்களையும் நிரந்தரமாக நீக்கவும்.",
    btn_clear_history: "அரட்டை வரலாற்றை நீக்கு",
    modal_title: "வரலாற்றை நிரந்தரமாக நீக்குதல்",
    modal_desc: "இந்த செயல்பாடு சேமிக்கப்பட்ட அனைத்து உரையாடல்களையும் நீக்கிவிடும். நீங்கள் தொடர விரும்புகிறீர்களா?",
    btn_cancel: "ரத்துசெய்",
    btn_confirm_purge: "ஆம், இப்போது நீக்கு",
    toast_font_updated: "எழுத்துரு அளவு புதுப்பிக்கப்பட்டது",
    toast_contrast_on: "உயர் மாறுபட்ட பயன்முறை இயக்கப்பட்டது",
    toast_contrast_off: "உயர் மாறுபட்ட பயன்முறை முடக்கப்பட்டது",
    toast_lang_updated: "மொழி தமிழுக்கு மாற்றப்பட்டது",
    toast_incognito_on: "மறைநிலை பயன்முறை இயக்கப்பட்டது",
    toast_incognito_off: "மறைநிலை பயன்முறை முடக்கப்பட்டது",
    toast_history_cleared: "அரட்டை வரலாறு நீக்கப்பட்டது"
  }
};

export const CivicSettingsModal: React.FC<CivicSettingsModalProps> = ({
  isOpen,
  onClose,
  selectedLanguage,
  onLanguageChange,
  onClearHistory,
  incognito,
  onToggleIncognito
}) => {
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem('nagarik_font_size') || '100';
  });

  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('nagarik_high_contrast') === 'true';
  });

  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const t = TRANSLATIONS[selectedLanguage] || TRANSLATIONS.en;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  // Font Size logic
  const handleSetFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem('nagarik_font_size', size);
    if (size === '100') {
      document.documentElement.style.fontSize = '16px';
    } else if (size === '125') {
      document.documentElement.style.fontSize = '18px';
    } else if (size === '150') {
      document.documentElement.style.fontSize = '20px';
    }
    triggerToast(t.toast_font_updated);
  };

  // High Contrast logic
  const handleToggleContrast = (checked: boolean) => {
    setHighContrast(checked);
    localStorage.setItem('nagarik_high_contrast', checked ? 'true' : 'false');
    if (checked) {
      document.documentElement.classList.add('high-contrast');
      triggerToast(t.toast_contrast_on);
    } else {
      document.documentElement.classList.remove('high-contrast');
      triggerToast(t.toast_contrast_off);
    }
  };

  // Language change
  const handleSelectLang = (lang: SettingsLanguage) => {
    onLanguageChange(lang);
    localStorage.setItem('nagarik_selected_language', lang);
    const updatedT = TRANSLATIONS[lang] || TRANSLATIONS.en;
    triggerToast(updatedT.toast_lang_updated);
  };

  // Incognito toggle
  const handleIncognito = (checked: boolean) => {
    onToggleIncognito(checked);
    triggerToast(checked ? t.toast_incognito_on : t.toast_incognito_off);
  };

  // Purge chat history
  const handleConfirmPurge = () => {
    onClearHistory();
    setShowPurgeModal(false);
    triggerToast(t.toast_history_cleared);
  };

  useEffect(() => {
    // Initial sync
    const savedSize = localStorage.getItem('nagarik_font_size') || '100';
    if (savedSize === '100') document.documentElement.style.fontSize = '16px';
    else if (savedSize === '125') document.documentElement.style.fontSize = '18px';
    else if (savedSize === '150') document.documentElement.style.fontSize = '20px';

    const savedContrast = localStorage.getItem('nagarik_high_contrast') === 'true';
    if (savedContrast) document.documentElement.classList.add('high-contrast');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#111316] border border-[#282a2e] rounded-3xl overflow-y-auto shadow-2xl p-5 sm:p-8 flex flex-col gap-6 text-[#E8E9F2]">
        
        {/* Header Section */}
        <div className="flex items-start justify-between pb-4 border-b border-[#282a2e]">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#E58C5C] text-xs uppercase tracking-wider font-semibold font-mono">
              <Sliders className="w-4 h-4 text-[#E58C5C]" />
              <span>{t.pref_badge}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#E8E9F2]">
              {t.page_title}
            </h1>
            <p className="text-xs sm:text-sm text-[#8F93B5] max-w-xl">
              {t.page_subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#8F93B5] hover:text-[#E8E9F2] hover:bg-[#1a1c1f] transition-colors"
            title="Close Settings"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Accessibility */}
        <section className="bg-[#1a1c1f] rounded-2xl p-5 sm:p-6 flex flex-col gap-5 border border-[#282a2e] shadow-lg">
          <div className="flex items-center gap-3 pb-2 border-b border-[#282a2e]">
            <div className="w-9 h-9 rounded-xl bg-[#221c17] flex items-center justify-center text-[#E58C5C] border border-[#B8643A]/40 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-[#E8E9F2]">{t.sec_accessibility_title}</h2>
              <span className="text-xs text-[#8F93B5]">{t.sec_accessibility_desc}</span>
            </div>
          </div>

          {/* Font Size Selector */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs sm:text-sm text-[#E8E9F2] font-semibold">{t.label_font_size}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { size: '100', label: t.font_normal, aa: 'Aa', textClass: 'text-base font-bold' },
                { size: '125', label: t.font_large, aa: 'Aa', textClass: 'text-xl font-bold' },
                { size: '150', label: t.font_xlarge, aa: 'Aa', textClass: 'text-2xl font-bold' },
              ].map(opt => {
                const isActive = fontSize === opt.size;
                return (
                  <button
                    key={opt.size}
                    type="button"
                    onClick={() => handleSetFontSize(opt.size)}
                    className={`flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#221c17] text-[#E58C5C] border-[#B8643A] shadow-md scale-[1.02]'
                        : 'bg-[#121417] text-[#8F93B5] border-[#282a2e] hover:bg-[#1e2023] hover:text-[#E8E9F2] hover:border-[#37393d]'
                    }`}
                  >
                    <span className={opt.textClass}>{opt.aa}</span>
                    <span className="text-xs mt-1 font-semibold">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High Contrast Mode Toggle */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-[#121417] rounded-xl border border-[#282a2e]">
            <div className="flex flex-col gap-0.5 max-w-md">
              <span className="text-xs sm:text-sm font-semibold text-[#E8E9F2]">{t.label_high_contrast}</span>
              <p className="text-[11px] sm:text-xs text-[#8F93B5]">{t.desc_high_contrast}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(e) => handleToggleContrast(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-[#282a2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#0B0C1E] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#ffffff] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E58C5C]" />
            </label>
          </div>
        </section>

        {/* Section 2: Language */}
        <section className="bg-[#1a1c1f] rounded-2xl p-5 sm:p-6 flex flex-col gap-5 border border-[#282a2e] shadow-lg">
          <div className="flex items-center gap-3 pb-2 border-b border-[#282a2e]">
            <div className="w-9 h-9 rounded-xl bg-[#221c17] flex items-center justify-center text-[#E58C5C] border border-[#B8643A]/40 shrink-0">
              <Languages className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-[#E8E9F2]">{t.sec_language_title}</h2>
              <span className="text-xs text-[#8F93B5]">{t.sec_language_desc}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { code: 'en' as SettingsLanguage, nativeName: 'English', sub: 'English' },
              { code: 'hi' as SettingsLanguage, nativeName: 'हिन्दी', sub: t.lang_sub_hindi },
              { code: 'te' as SettingsLanguage, nativeName: 'తెలుగు', sub: t.lang_sub_telugu },
              { code: 'ta' as SettingsLanguage, nativeName: 'தமிழ்', sub: t.lang_sub_tamil },
            ].map(lang => {
              const isActive = selectedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLang(lang.code)}
                  className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer shadow-sm ${
                    isActive
                      ? 'bg-[#221c17] text-[#E58C5C] border-[#B8643A] scale-[1.02]'
                      : 'bg-[#121417] text-[#8F93B5] border-[#282a2e] hover:bg-[#1e2023] hover:text-[#E8E9F2] hover:border-[#37393d]'
                  }`}
                >
                  <span className="text-base font-bold text-[#E8E9F2]">{lang.nativeName}</span>
                  {isActive ? (
                    <span className="text-[11px] text-[#E58C5C] font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.lang_active_badge}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#8F93B5]">{lang.sub}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Privacy & History */}
        <section className="bg-[#1a1c1f] rounded-2xl p-5 sm:p-6 flex flex-col gap-5 border border-[#282a2e] shadow-lg">
          <div className="flex items-center gap-3 pb-2 border-b border-[#282a2e]">
            <div className="w-9 h-9 rounded-xl bg-[#221c17] flex items-center justify-center text-[#E58C5C] border border-[#B8643A]/40 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-bold text-[#E8E9F2]">{t.sec_privacy_title}</h2>
              <span className="text-xs text-[#8F93B5]">{t.sec_privacy_desc}</span>
            </div>
          </div>

          {/* Incognito Session Toggle */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-[#121417] rounded-xl border border-[#282a2e]">
            <div className="flex flex-col gap-0.5 max-w-md">
              <span className="text-xs sm:text-sm font-semibold text-[#E8E9F2]">{t.label_incognito}</span>
              <p className="text-[11px] sm:text-xs text-[#8F93B5]">{t.desc_incognito}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
              <input
                type="checkbox"
                checked={incognito}
                onChange={(e) => handleIncognito(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-12 h-7 bg-[#282a2e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#0B0C1E] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-[#ffffff] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E58C5C]" />
            </label>
          </div>

          {/* Clear Chat History */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 sm:p-4 bg-[#121417] rounded-xl border border-[#282a2e]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs sm:text-sm font-semibold text-[#E8E9F2]">{t.label_chat_history}</span>
              <p className="text-[11px] sm:text-xs text-[#8F93B5]">{t.desc_chat_history}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPurgeModal(true)}
              className="shrink-0 py-2.5 px-4 bg-[#93000a]/80 text-[#ffdad6] hover:bg-[#ba1a1a] hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border border-[#ffb4ab]/30"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t.btn_clear_history}</span>
            </button>
          </div>
        </section>

        {/* Purge Confirmation Modal Overlay */}
        {showPurgeModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#0c0e11]/85 backdrop-blur-md animate-fade-in">
            <div className="max-w-md w-full bg-[#1a1c1f] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl border border-[#282a2e]">
              <div className="w-12 h-12 rounded-full bg-[#93000a]/40 border border-[#ffb4ab]/30 text-[#ffb4ab] flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h4 className="text-lg text-[#E8E9F2] font-bold">{t.modal_title}</h4>
                <p className="text-xs sm:text-sm text-[#8F93B5] leading-relaxed">{t.modal_desc}</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(false)}
                  className="py-2 px-4 rounded-xl bg-[#282a2e] text-[#E8E9F2] hover:bg-[#37393d] text-xs font-semibold transition-colors"
                >
                  {t.btn_cancel}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPurge}
                  className="py-2 px-4 rounded-xl bg-[#93000a] text-[#ffdad6] text-xs font-bold hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center gap-1.5 border border-[#ffb4ab]/30"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.btn_confirm_purge}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ephemeral Notification Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-70 bg-[#1e2023] text-[#E8E9F2] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-[#B8643A] animate-fade-in">
            <CheckCircle className="w-5 h-5 text-[#E58C5C]" />
            <span className="text-xs sm:text-sm font-semibold">{toastMessage}</span>
          </div>
        )}

      </div>
    </div>
  );
};
