/**
 * FreePad Accent Transformer & Voice Stylizer
 * Fait par zioti - 100% Zero VB-Cable
 */

export const ACCENTS = [
  {
    id: 'none',
    name: 'Français Standard',
    flag: '🇫🇷',
    category: 'standard',
    engineLang: 'fr',
    description: 'Voix française claire et naturelle (Google TTS Féminin Culte)',
    samplePhrase: 'Bonjour tout le monde, comment allez-vous aujourd\'hui ?',
    transform: (t) => t
  },
  {
    id: 'congolese',
    name: 'Accent Congolais / Africain',
    flag: '🇨🇬',
    category: 'accents',
    engineLang: 'fr',
    description: 'Voix chaleureuse, chantante, "r" appuyés et expressions cultes',
    samplePhrase: 'Eh ya ! Bonjourr mon frrère ! C\'est comment là-bas, tu vas bien ou bien ?',
    transform: (t) => {
      let res = t;
      // Roulage des r
      res = res.replace(/r{1,2}/gi, (m) => m.toLowerCase() === 'r' ? 'rr' : 'rrr');
      // Expressions
      res = res.replace(/\bbonjour\b/gi, 'bonjourr mon frrère');
      res = res.replace(/\bsalut\b/gi, 'eh ya salut là-bas');
      res = res.replace(/\bmon ami\b/gi, 'mon frrère mwana');
      res = res.replace(/\bbeaucoup\b/gi, 'trop beaucoup');
      res = res.replace(/\bmerci\b/gi, 'merrci beaucoup dé');
      res = res.replace(/\bje suis\b/gi, 'moi je suis');
      res = res.replace(/\btu es\b/gi, 'toi tu es');
      res = res.replace(/\b(c'est|c est)\s+vrai\b/gi, 'c\'est réel dé');
      res = res.replace(/\b(grave|fort)\b/gi, 'trop fort');
      return `Eh ya ! ${res} Tu vois un peu là-bas ? Faut pas fâcher dé !`;
    }
  },
  {
    id: 'italian',
    name: 'Accent Italien',
    flag: '🇮🇹',
    category: 'accents',
    engineLang: 'it', // Engine italien qui prononce avec accent chantant !
    description: 'Intonation chantante, Mamma mia, Ma qué, voyelles expressives',
    samplePhrase: 'Mamma mia ! Ma qué bella giornata, c\'est magnifique !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bje\b/gi, 'yé');
      res = res.replace(/\bj'/gi, 'y\'');
      res = res.replace(/\btu\b/gi, 'tou');
      res = res.replace(/\bbonjour\b/gi, 'buongiorno');
      res = res.replace(/\bmerci\b/gi, 'grazie mille');
      res = res.replace(/\bc'est\b/gi, 'c\'est-a');
      res = res.replace(/\btrès\b/gi, 'molto');
      res = res.replace(/\bmon ami\b/gi, 'mio amico');
      res = res.replace(/\bmon frère\b/gi, 'mio fratello');
      return `Mamma mia ! Ma qué, ${res} ! Prego !`;
    }
  },
  {
    id: 'german',
    name: 'Accent Allemand',
    flag: '🇩🇪',
    category: 'accents',
    engineLang: 'de', // Engine allemand qui prononce le français avec accent germanique
    description: 'Consonnes dures, gutturales, autoritaire et comique',
    samplePhrase: 'Achtung ! Ponjour, ya c\'est très clarr, natürlich !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bbonjour\b/gi, 'ponchour');
      res = res.replace(/\bje\b/gi, 'ye');
      res = res.replace(/\bj'/gi, 'ch\'');
      res = res.replace(/\bbien\b/gi, 'pien');
      res = res.replace(/\btrès\b/gi, 'sehr');
      res = res.replace(/\bmerci\b/gi, 'danke schön');
      res = res.replace(/\bvous\b/gi, 'fous');
      res = res.replace(/\bici\b/gi, 'hierr');
      res = res.replace(/\bvrai\b/gi, 'wahr');
      return `Achtung ! Ja, ${res}, natürlich !`;
    }
  },
  {
    id: 'chinese',
    name: 'Accent Chinois',
    flag: '🇨🇳',
    category: 'accents',
    engineLang: 'zh-CN', // Engine chinois prononçant le texte
    description: 'Remplacement des "r" par "l", rythme vif et saccadé',
    samplePhrase: 'Ni hao ! Tlès bien mon ami, toi tlès tlès folt !',
    transform: (t) => {
      let res = t;
      // Remplacer r par l
      res = res.replace(/r/gi, (m) => m === 'R' ? 'L' : 'l');
      res = res.replace(/\bbonjour\b/gi, 'ni hao bonlour');
      res = res.replace(/\bmerci\b/gi, 'xiexie melci');
      res = res.replace(/\btrès\b/gi, 'tlès');
      res = res.replace(/\bfort\b/gi, 'folt');
      res = res.replace(/\bvrai\b/gi, 'vlai');
      return `Ni hao ! ${res}, la vérité c'est tlès bon ça !`;
    }
  },
  {
    id: 'russian',
    name: 'Accent Russe / Goulag',
    flag: '🇷🇺',
    category: 'accents',
    engineLang: 'ru', // Engine russe
    description: 'Voix grave, "r" ultra-roulés, direct goulag camarade',
    samplePhrase: 'Da ! Bonchourr camarade, toi direct goulag blyat !',
    transform: (t) => {
      let res = t;
      res = res.replace(/r{1,2}/gi, 'rrr');
      res = res.replace(/\bbonjour\b/gi, 'bonchourr kamarade');
      res = res.replace(/\bsalut\b/gi, 'priviet kamarade');
      res = res.replace(/\bmerci\b/gi, 'spasibo');
      res = res.replace(/\bmon ami\b/gi, 'kamarade');
      res = res.replace(/\btu es\b/gi, 'toi tu es');
      res = res.replace(/\bje suis\b/gi, 'moi je suis');
      return `Da ! ${res} ! Direction goulag, blyat !`;
    }
  },
  {
    id: 'quebec',
    name: 'Accent Québécois',
    flag: '🇨🇦',
    category: 'accents',
    engineLang: 'fr',
    description: 'Tabarnak, mon chum, tiguidou, c\'est ben l\'fun',
    samplePhrase: 'Allô mon chum ! Ça va-tu bien icitte ? C\'est ben tiguidou !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bbonjour\b/gi, 'allô mon chum');
      res = res.replace(/\bsalut\b/gi, 'allô là');
      res = res.replace(/\bici\b/gi, 'icitte');
      res = res.replace(/\bpas du tout\b/gi, 'pantoute');
      res = res.replace(/\bc'est super\b/gi, 'c\'est ben l\'fun');
      res = res.replace(/\btrès bien\b/gi, 'ben tiguidou');
      res = res.replace(/\bmon ami\b/gi, 'mon chum');
      return `Allô mon chum ! ${res} ! Tabarnak, c\'est ben tiguidou !`;
    }
  },
  {
    id: 'marseille',
    name: 'Accent Marseillais / Sud',
    flag: '🇫🇷',
    category: 'accents',
    engineLang: 'fr',
    description: 'Oh peuchère, le sang, putain con, fada du Vieux-Port',
    samplePhrase: 'Oh peuchère ! Mais t\'es complètement fada mon sang, putain con !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bbonjour\b/gi, 'oh salut le sang');
      res = res.replace(/\bfou\b/gi, 'complètement fada');
      res = res.replace(/\bmon ami\b/gi, 'mon collègue le sang');
      res = res.replace(/\bmon frère\b/gi, 'mon gaté le sang');
      res = res.replace(/\btrès bien\b/gi, 'au top peuchère');
      return `Oh peuchère ! ${res} ! Mais putain con, c\'est gavé bien !`;
    }
  },
  {
    id: 'british',
    name: 'Accent Anglais / British',
    flag: '🇬🇧',
    category: 'accents',
    engineLang: 'en', // Engine anglais lisant le texte
    description: 'Touriste anglais qui tente de parler français avec classe',
    samplePhrase: 'Oh my god ! Bonjoure, c\'est absolutely magnificent, very good !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bbonjour\b/gi, 'bonjoure');
      res = res.replace(/\bmerci\b/gi, 'thank you vèry much');
      res = res.replace(/\btrès\b/gi, 'vèry');
      res = res.replace(/\boui\b/gi, 'yes of course');
      res = res.replace(/\bnon\b/gi, 'no way');
      return `Oh my god ! ${res}, it is splendid indeed !`;
    }
  },
  {
    id: 'arabic',
    name: 'Accent Maghrébin',
    flag: '🇲🇦',
    category: 'accents',
    engineLang: 'fr',
    description: 'Wallah, mon khouya, c\'est sah, le reuf',
    samplePhrase: 'Wallah mon khouya, tu me crois pas ou quoi ? C\'est réel sah !',
    transform: (t) => {
      let res = t;
      res = res.replace(/\bbonjour\b/gi, 'salam aleykoum mon khouya');
      res = res.replace(/\bsalut\b/gi, 'salam mon reuf');
      res = res.replace(/\bmon ami\b/gi, 'mon khouya');
      res = res.replace(/\bmon frère\b/gi, 'mon reuf le sang');
      res = res.replace(/\bvrai\b/gi, 'sah');
      res = res.replace(/\bmerci\b/gi, 'choukrane barakallah oufik');
      return `Wallah mon khouya ! ${res} ! C\'est sah to the sah !`;
    }
  },
  {
    id: 'anime',
    name: 'Voix Anime / Shonen',
    flag: '🇯🇵',
    category: 'accents',
    engineLang: 'ja',
    description: 'Voix japonaise shonen dramatique (Nani ?! Baka ! Sugoi !)',
    samplePhrase: 'Nani ?! Omae wa mou shindeiru, baka sugoi !',
    transform: (t) => `Nani ?! ${t} ! Baka, sugoi !`
  }
];

export const WORLD_LANGUAGES = [
  { code: 'fr', name: 'Français (Fille Culte)', flag: '🇫🇷' },
  { code: 'en', name: 'Anglais (English - US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'Anglais (UK British)', flag: '🇬🇧' },
  { code: 'ja', name: 'Japonais (日本語 Anime)', flag: '🇯🇵' },
  { code: 'es', name: 'Espagnol (Español)', flag: '🇪🇸' },
  { code: 'de', name: 'Allemand (Deutsch)', flag: '🇩🇪' },
  { code: 'it', name: 'Italien (Italiano)', flag: '🇮🇹' },
  { code: 'ru', name: 'Russe (Русский)', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabe (العربية)', flag: '🇸🇦' },
  { code: 'zh-CN', name: 'Chinois (中文 Mandarin)', flag: '🇨🇳' },
  { code: 'ko', name: 'Coréen (한국어 K-Pop)', flag: '🇰🇷' },
  { code: 'pt', name: 'Portugais (Português)', flag: '🇧🇷' },
  { code: 'nl', name: 'Néerlandais (Nederlands)', flag: '🇳🇱' },
  { code: 'pl', name: 'Polonais (Polski)', flag: '🇵🇱' },
  { code: 'tr', name: 'Turc (Türkçe)', flag: '🇹🇷' },
  { code: 'sv', name: 'Suédois (Svenska)', flag: '🇸🇪' },
  { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'el', name: 'Grec (Ελληνικά)', flag: '🇬🇷' },
  { code: 'vi', name: 'Vietnamien (Tiếng Việt)', flag: '🇻🇳' }
];
