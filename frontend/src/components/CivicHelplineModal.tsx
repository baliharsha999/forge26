import React, { useState } from 'react';
import {
  X, Phone, Shield, Zap, Droplets, Users, HeartHandshake,
  AlertTriangle, ExternalLink, Search, Check, Copy
} from 'lucide-react';

interface HelplineItem {
  number: string;
  nameEn: string;
  nameHi: string;
  nameTe: string;
  category: 'emergency' | 'cyber' | 'women' | 'utilities' | 'health' | 'consumer';
  descriptionEn: string;
  descriptionHi: string;
  descriptionTe: string;
  isTollFree: boolean;
  hours: string;
}

const HELPLINES: HelplineItem[] = [
  {
    number: '112',
    nameEn: 'National Emergency Helpline',
    nameHi: 'राष्ट्रीय आपातकालीन हेल्पलाइन',
    nameTe: 'జాతీయ అత్యవసర హెల్ప్‌లైన్',
    category: 'emergency',
    descriptionEn: 'Single unified emergency number for Police, Fire, and Ambulance across all States and UTs.',
    descriptionHi: 'पुलिस, अग्निशमन और एम्बुलेंस के लिए एकल एकीकृत आपातकालीन नंबर।',
    descriptionTe: 'పోలీస్, ఫైర్ మరియు అంబులెన్స్ కోసం ఏకీకృత అత్యవసర నంబర్.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '1930',
    nameEn: 'Cyber Crime & Financial Fraud',
    nameHi: 'साइबर अपराध एवं वित्तीय धोखाधड़ी हेल्पलाइन',
    nameTe: 'సైబర్ క్రైమ్ & ఆర్థిక మోసాల హెల్ప్‌లైన్',
    category: 'cyber',
    descriptionEn: 'Citizen Financial Cyber Fraud Reporting System to freeze fraudulent transactions immediately.',
    descriptionHi: 'धोखाधड़ी वाले लेनदेन को तुरंत फ्रीज करने के लिए गृह मंत्रालय की वित्तीय साइबर फ्रॉड हेल्पलाइन।',
    descriptionTe: 'మోసపూరిత లావాదేవీలను వెంటనే నిలిపివేయడానికి సిటిజన్ ఫైనాన్షియల్ సైబర్ ఫ్రాడ్ హెల్ప్‌లైన్.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '181',
    nameEn: "Women's Helpline",
    nameHi: 'महिला हेल्पलाइन',
    nameTe: 'మహిళా హెల్ప్‌లైన్',
    category: 'women',
    descriptionEn: '24-hour emergency and non-emergency support, counseling, and shelter assistance for women facing violence.',
    descriptionHi: 'हिंसा या संकट का सामना कर रही महिलाओं के लिए 24 घंटे आपातकालीन सहायता और कानूनी परामर्श।',
    descriptionTe: 'హింసను ఎదుర్కొంటున్న మహిళలకు 24 గంటల అత్యవసర సహాయం మరియు న్యాయ సలహాలు.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '1098',
    nameEn: 'Childline Emergency Service',
    nameHi: 'चाइल्डलाइन आपातकालीन सेवा',
    nameTe: 'చైల్డ్‌లైన్ అత్యవసర సేవ',
    category: 'women',
    descriptionEn: 'Nationwide emergency phone outreach service for children in need of care and protection.',
    descriptionHi: 'देखभाल और सुरक्षा की आवश्यकता वाले बच्चों के लिए देशव्यापी आपातकालीन फोन सेवा।',
    descriptionTe: 'సంరక్షణ అవసరమైన పిల్లల కోసం దేశవ్యాప్త ఉచిత అత్యవసర సహాయ సేవ.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '1912',
    nameEn: 'Electricity Outage & Fire Hazards',
    nameHi: 'विद्युत आपूर्ति एवं ट्रांसफार्मर आपातकालीन',
    nameTe: 'విద్యుత్ సరఫరా & ట్రాన్స్‌ఫార్మర్ ప్రమాదాలు',
    category: 'utilities',
    descriptionEn: 'Direct dispatch for power line breaks, sparking transformers, electrical fires, and blackout complaints.',
    descriptionHi: 'टूटे बिजली के तार, स्पार्क हो रहे ट्रांसफार्मर और ब्लैकआउट शिकायतों के लिए त्वरित डिस्पैच।',
    descriptionTe: 'విద్యుత్ తీగలు తెగిపడటం, ట్రాన్స్‌ఫార్మర్ మంటలు మరియు విద్యుత్ అంతరాయాల కోసం.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '1916',
    nameEn: 'Municipal Water & Sewerage Board',
    nameHi: 'नगर निगम जल आपूर्ति एवं सीवरेज बोर्ड',
    nameTe: 'మున్సిపల్ నీటి సరఫరా & డ్రైనేజ్ బోర్డు',
    category: 'utilities',
    descriptionEn: 'Emergency response for contaminated drinking water supply, pipeline breaches, and drainage overflows.',
    descriptionHi: 'दूषित पेयजल आपूर्ति, मुख्य पाइपलाइन टूटने और जलभराव के लिए नगर निगम सहायता।',
    descriptionTe: 'కలుషిత తాగునీరు, పైప్‌లైన్ లీకేజీలు మరియు డ్రైనేజీ సమస్యల అత్యవసర పరిష్కారం.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '1075',
    nameEn: 'Ayushman Bharat & Health Authority',
    nameHi: 'आयुष्मान भारत एवं राष्ट्रीय स्वास्थ्य प्राधिकरण',
    nameTe: 'ఆయుష్మాన్ భారత్ & ఆరోగ్య హెల్ప్‌లైన్',
    category: 'health',
    descriptionEn: 'Verification of PM-JAY hospital empanelment, cashless claims assistance, and ABHA health ID support.',
    descriptionHi: 'पीएम-जय अस्पताल पैनल में शामिल होने, कैशलेस क्लेम और आभा आईडी से संबंधित राष्ट्रीय सहायता।',
    descriptionTe: 'పీఎం-జేఏవై ఆసుపత్రి వివరాలు మరియు ఉచిత చికిత్స కార్డు సహాయం.',
    isTollFree: true,
    hours: '24x7'
  },
  {
    number: '14567',
    nameEn: 'Elderline — Senior Citizen Helpline',
    nameHi: 'एल्डरलाइन — वरिष्ठ नागरिक सहायता',
    nameTe: 'ఎల్డర్‌లైన్ — వయోవృద్ధుల హెల్ప్‌లైన్',
    category: 'health',
    descriptionEn: 'Assistance for senior citizens regarding elder abuse, legal aid, pension queries, and emotional support.',
    descriptionHi: 'वरिष्ठ नागरिकों के लिए पेंशन, कानूनी सहायता, स्वास्थ्य देखभाल और सुरक्षा मार्गदर्शन।',
    descriptionTe: 'వయోవృద్ధుల పెన్షన్, న్యాయ సహాయం మరియు ఆరోగ్య రక్షణ వివరాల కోసం.',
    isTollFree: true,
    hours: '8 AM - 8 PM'
  },
  {
    number: '1915',
    nameEn: 'National Consumer Helpline (NCH)',
    nameHi: 'राष्ट्रीय उपभोक्ता हेल्पलाइन',
    nameTe: 'జాతీయ వినియోగదారుల హెల్ప్‌లైన్',
    category: 'consumer',
    descriptionEn: 'Ministry of Consumer Affairs portal to lodge complaints against fraudulent e-commerce, banking, and utility bills.',
    descriptionHi: 'धोखाधड़ी, दोषपूर्ण उत्पादों और अनुचित व्यापार व्यवहार के खिलाफ उपभोक्ता शिकायत दर्ज करने हेतु।',
    descriptionTe: 'వ్యాపార మోసాలు, లోపభూయిష్ట వస్తువులు మరియు బ్యాంకింగ్ ఛార్జీలపై ఫిర్యాదు చేయడానికి.',
    isTollFree: true,
    hours: '8 AM - 8 PM'
  }
];

interface CivicHelplineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: 'en' | 'hi' | 'te';
}

export const CivicHelplineModal: React.FC<CivicHelplineModalProps> = ({
  isOpen,
  onClose,
  currentLanguage
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  const filteredHelplines = HELPLINES.filter((h) => {
    const matchesFilter = filter === 'all' || h.category === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      h.number.includes(q) ||
      h.nameEn.toLowerCase().includes(q) ||
      h.nameHi.includes(q) ||
      h.nameTe.includes(q) ||
      h.descriptionEn.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#101216] border border-[#22262f] shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#22262f] bg-[#16191f]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#e2e2e6]">
                  {currentLanguage === 'hi' ? 'नागरिक सहायता — आपातकालीन एवं सार्वजनिक हेल्पलाइन' : (currentLanguage === 'te' ? 'పౌర సహాయ కేంద్రం — అత్యవసర హెల్ప్‌లైన్లు' : 'Nagarik Sahayata — Civic SOS & Helpline Directory')}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Toll-Free 24x7
                </span>
              </div>
              <p className="text-xs text-[#8F93B5] mt-0.5">
                Official verified national and municipal helpline directory with one-tap dialing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8F93B5] hover:text-white hover:bg-[#22262f] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-[#22262f] bg-[#12141a] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search helpline name, number, or keyword..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#0c0e11] border border-[#22262f] text-[#e2e2e6] placeholder-[#8F93B5]/50 focus:outline-none focus:border-[#f2ca50]/70"
              />
              <Search className="w-4 h-4 text-[#8F93B5] absolute left-3 top-2.5" />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'emergency', label: '🚨 Emergency 112' },
                { id: 'cyber', label: '🛡️ Cyber 1930' },
                { id: 'women', label: '👩 Women & Child' },
                { id: 'utilities', label: '⚡ Utilities' },
                { id: 'health', label: '🏥 Healthcare' },
                { id: 'consumer', label: '⚖️ Consumer' }
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                    filter === c.id
                      ? 'bg-[#f2ca50] text-[#0c0e11] shadow-sm'
                      : 'bg-[#1a1d24] text-[#8F93B5] hover:text-[#e2e2e6]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Helplines Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredHelplines.map((item) => {
              const name =
                currentLanguage === 'hi' ? item.nameHi : (currentLanguage === 'te' ? item.nameTe : item.nameEn);
              const desc =
                currentLanguage === 'hi' ? item.descriptionHi : (currentLanguage === 'te' ? item.descriptionTe : item.descriptionEn);

              return (
                <div
                  key={item.number}
                  className="p-4 rounded-xl border border-[#22262f] bg-[#16191f] hover:border-[#f2ca50]/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="text-xl font-extrabold font-mono text-[#f2ca50] tracking-tight">
                        {item.number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#22262f] text-[#8F93B5]">
                          {item.hours}
                        </span>
                        {item.isTollFree && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Toll Free
                          </span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-[#e2e2e6]">{name}</h4>
                    <p className="text-xs text-[#8F93B5] mt-1 leading-relaxed">
                      {desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#22262f]/80">
                    <a
                      href={`tel:${item.number}`}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call {item.number}</span>
                    </a>
                    <button
                      onClick={() => handleCopy(item.number)}
                      className="p-2 rounded-lg bg-[#22262f] text-[#8F93B5] hover:text-white transition-colors"
                      title="Copy phone number"
                    >
                      {copiedNumber === item.number ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
