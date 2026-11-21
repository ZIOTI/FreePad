/**
 * FreePad Voice Engine Catalog & Multilingual Registry
 * Fait par zioti - 100% Zero VB-Cable
 * 
 * Aucune injection de mot stéréotypé ou argot : les vraies voix neurales
 * prononcent le texte exact de l'utilisateur avec l'accent naturel et humain.
 */

// Moteurs vocaux disponibles
export const VOICE_ENGINES = [
  {
    id: 'neural',
    name: 'Voix IA Microsoft Neural HD',
    badge: 'Recommandé (Studio)',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: 'Voix humaines réalistes de studio, souffle naturel, 100% gratuit, aucun compte requis'
  },
  {
    id: 'google',
    name: 'Google Traduction (Classique)',
    badge: 'Voix Standard',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'La voix robotique classique de Google Traduction (si vous préférez ce style)'
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs Pro',
    badge: 'Clé API Pro',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Vos voix personnalisées et clonées avec votre propre clé ElevenLabs'
  }
];

// Catalogue des Voix IA Neurales Microsoft (Qualité Studio, 100% Gratuites)
export const NEURAL_VOICES = [
  // --- 1. Voix Françaises Studio ---
  {
    id: 'fr-henri',
    name: 'Henri',
    subtitle: 'Homme Studio Pro',
    flag: '🇫🇷',
    gender: 'homme',
    category: 'fr_standard',
    edgeVoice: 'fr-FR-HenriNeural',
    description: 'Voix d\'homme posée, claire et ultra-naturelle',
    samplePhrase: 'Salut tout le monde, comment vous allez aujourd\'hui ?'
  },
  {
    id: 'fr-denise',
    name: 'Denise',
    subtitle: 'Femme Studio Douce',
    flag: '🇫🇷',
    gender: 'femme',
    category: 'fr_standard',
    edgeVoice: 'fr-FR-DeniseNeural',
    description: 'Voix féminine chaleureuse, posée et très fluide',
    samplePhrase: 'Bonjour à tous, bienvenue sur le stream !'
  },
  {
    id: 'fr-vivienne',
    name: 'Vivienne',
    subtitle: 'Femme Expressive HD',
    flag: '🇫🇷',
    gender: 'femme',
    category: 'fr_standard',
    edgeVoice: 'fr-FR-VivienneMultilingualNeural',
    description: 'Voix féminine expressive, moderne et dynamique',
    samplePhrase: 'Attention les gars, ça va commencer maintenant !'
  },
  {
    id: 'fr-remy',
    name: 'Remy',
    subtitle: 'Homme Gamer / Dynamique',
    flag: '🇫🇷',
    gender: 'homme',
    category: 'fr_standard',
    edgeVoice: 'fr-FR-RemyMultilingualNeural',
    description: 'Voix jeune et énergique, parfaite pour le gaming Discord',
    samplePhrase: 'Bien joué l\'équipe, on a tout déchiré sur ce coup !'
  },
  {
    id: 'fr-eloise',
    name: 'Éloïse',
    subtitle: 'Femme Jeune & Dynamique',
    flag: '🇫🇷',
    gender: 'femme',
    category: 'fr_standard',
    edgeVoice: 'fr-FR-EloiseNeural',
    description: 'Voix jeune, vive et très claire',
    samplePhrase: 'On se retrouve tout de suite pour la suite de la partie.'
  },

  // --- 2. Accents Francophones ---
  {
    id: 'ca-antoine',
    name: 'Antoine',
    subtitle: 'Accent Québécois (Homme)',
    flag: '🇨🇦',
    gender: 'homme',
    category: 'fr_accents',
    edgeVoice: 'fr-CA-AntoineNeural',
    description: 'Véritable accent canadien / québécois masculin naturel',
    samplePhrase: 'Salut les amis ! Comment ça va aujourd\'hui ?'
  },
  {
    id: 'ca-sylvie',
    name: 'Sylvie',
    subtitle: 'Accent Québécois (Femme)',
    flag: '🇨🇦',
    gender: 'femme',
    category: 'fr_accents',
    edgeVoice: 'fr-CA-SylvieNeural',
    description: 'Véritable accent québécois féminin authentique',
    samplePhrase: 'Bonjour tout le monde ! J\'espère que vous passez une belle journée.'
  },
  {
    id: 'be-gerard',
    name: 'Gérard',
    subtitle: 'Accent Belge (Homme)',
    flag: '🇧🇪',
    gender: 'homme',
    category: 'fr_accents',
    edgeVoice: 'fr-BE-GerardNeural',
    description: 'Accent belge masculin naturel et chaleureux',
    samplePhrase: 'Allez, on y va tout de suite, c\'est parti !'
  },
  {
    id: 'be-charline',
    name: 'Charline',
    subtitle: 'Accent Belge (Femme)',
    flag: '🇧🇪',
    gender: 'femme',
    category: 'fr_accents',
    edgeVoice: 'fr-BE-CharlineNeural',
    description: 'Accent belge féminin clair et posé',
    samplePhrase: 'Bonjour à tous, j\'espère que vous allez bien.'
  },
  {
    id: 'ch-fabrice',
    name: 'Fabrice',
    subtitle: 'Accent Suisse (Homme)',
    flag: '🇨🇭',
    gender: 'homme',
    category: 'fr_accents',
    edgeVoice: 'fr-CH-FabriceNeural',
    description: 'Accent suisse romand masculin posé et net',
    samplePhrase: 'On prend le temps de bien faire les choses, tranquillement.'
  },
  {
    id: 'ch-ariane',
    name: 'Ariane',
    subtitle: 'Accent Suisse (Femme)',
    flag: '🇨🇭',
    gender: 'femme',
    category: 'fr_accents',
    edgeVoice: 'fr-CH-ArianeNeural',
    description: 'Accent suisse romand féminin doux et précis',
    samplePhrase: 'Bonjour tout le monde, bienvenue parmi nous.'
  },

  // --- 3. Accents Internationaux (Prononce le français avec l'accent naturel sans mot ajouté) ---
  {
    id: 'it-giuseppe',
    name: 'Giuseppe',
    subtitle: 'Accent Italien',
    flag: '🇮🇹',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'it-IT-GiuseppeMultilingualNeural',
    description: 'Voix italienne naturelle parlant français avec l\'accent d\'Italie',
    samplePhrase: 'Bonjour les amis, c\'est magnifique de vous retrouver.'
  },
  {
    id: 'de-christoph',
    name: 'Christoph',
    subtitle: 'Accent Allemand',
    flag: '🇩🇪',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'de-DE-ChristophNeural',
    description: 'Voix allemande naturelle avec l\'accent germanique prononcé',
    samplePhrase: 'Bonjour à tous, on commence la partie sans attendre.'
  },
  {
    id: 'gb-ryan',
    name: 'Ryan',
    subtitle: 'Accent Anglais / British',
    flag: '🇬🇧',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'en-GB-RyanNeural',
    description: 'Voix britannique distinguée parlant français avec accent UK',
    samplePhrase: 'Bonjour tout le monde, ravi d\'être avec vous ce soir.'
  },
  {
    id: 'us-guy',
    name: 'Guy',
    subtitle: 'Accent Américain',
    flag: '🇺🇸',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'en-US-GuyNeural',
    description: 'Accent américain naturel parlant français',
    samplePhrase: 'Salut tout le monde ! C\'est trop cool d\'être ici.'
  },
  {
    id: 'es-alvaro',
    name: 'Alvaro',
    subtitle: 'Accent Espagnol',
    flag: '🇪🇸',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'es-ES-AlvaroNeural',
    description: 'Voix espagnole chaleureuse et chantante',
    samplePhrase: 'Bonjour mes amis, comment vous allez aujourd\'hui ?'
  },
  {
    id: 'ru-dmitry',
    name: 'Dmitry',
    subtitle: 'Accent Russe',
    flag: '🇷🇺',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'ru-RU-DmitryNeural',
    description: 'Voix russe grave avec un accent d\'Europe de l\'Est naturel',
    samplePhrase: 'Bonjour les camarades, attention devant vous.'
  },
  {
    id: 'zh-yunxi',
    name: 'Yunxi',
    subtitle: 'Accent Chinois / Asiatique',
    flag: '🇨🇳',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'zh-CN-YunxiNeural',
    description: 'Voix asiatique parlant français avec accent',
    samplePhrase: 'Bonjour mes amis, très heureux d\'être là.'
  },
  {
    id: 'ja-keita',
    name: 'Keita',
    subtitle: 'Accent Japonais',
    flag: '🇯🇵',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'ja-JP-KeitaNeural',
    description: 'Voix japonaise parlant français avec intonations nippones',
    samplePhrase: 'Bonjour à tous, enchanté de faire votre connaissance.'
  },
  {
    id: 'ar-shakir',
    name: 'Shakir',
    subtitle: 'Accent Arabe',
    flag: '🇸🇦',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'ar-EG-ShakirNeural',
    description: 'Voix du Moyen-Orient parlant français avec accent oriental',
    samplePhrase: 'Bonjour à tous, bienvenue chez nous aujourd\'hui.'
  },
  {
    id: 'af-rafiki',
    name: 'Rafiki',
    subtitle: 'Accent Africain',
    flag: '🌍',
    gender: 'homme',
    category: 'intl_accents',
    edgeVoice: 'sw-KE-RafikiNeural',
    description: 'Voix africaine chaleureuse parlant français avec accent',
    samplePhrase: 'Bonjour mon ami, comment ça va aujourd\'hui ?'
  }
];

// Catalogue Voix Google Traduction (Optionnel pour ceux qui aiment la voix classique)
export const GOOGLE_VOICES = [
  {
    id: 'google-fr',
    name: 'Google Traduction (Français)',
    subtitle: 'Voix Féminine Classique',
    flag: '🇫🇷',
    googleLang: 'fr',
    description: 'La voix robotique culte de Google Traduction en français'
  },
  {
    id: 'google-it',
    name: 'Google Traduction (Italien)',
    subtitle: 'Accent Italien Classique',
    flag: '🇮🇹',
    googleLang: 'it',
    description: 'Moteur italien de Google qui prononce le texte en accent chantant'
  },
  {
    id: 'google-de',
    name: 'Google Traduction (Allemand)',
    subtitle: 'Accent Allemand Classique',
    flag: '🇩🇪',
    googleLang: 'de',
    description: 'Moteur allemand de Google'
  },
  {
    id: 'google-en',
    name: 'Google Traduction (Anglais)',
    subtitle: 'Accent Anglais / UK',
    flag: '🇬🇧',
    googleLang: 'en',
    description: 'Moteur anglais de Google'
  },
  {
    id: 'google-es',
    name: 'Google Traduction (Espagnol)',
    subtitle: 'Accent Espagnol Classique',
    flag: '🇪🇸',
    googleLang: 'es',
    description: 'Moteur espagnol de Google'
  },
  {
    id: 'google-ru',
    name: 'Google Traduction (Russe)',
    subtitle: 'Accent Russe Classique',
    flag: '🇷🇺',
    googleLang: 'ru',
    description: 'Moteur russe de Google'
  },
  {
    id: 'google-ja',
    name: 'Google Traduction (Japonais)',
    subtitle: 'Accent Japonais Classique',
    flag: '🇯🇵',
    googleLang: 'ja',
    description: 'Moteur japonais de Google'
  },
  {
    id: 'google-zh',
    name: 'Google Traduction (Chinois)',
    subtitle: 'Accent Chinois Classique',
    flag: '🇨🇳',
    googleLang: 'zh-CN',
    description: 'Moteur chinois de Google'
  }
];

// Langues pour la traduction instantanée (50+ langues du monde)
export const WORLD_LANGUAGES = [
  { code: 'ja', name: 'Japonais', flag: '🇯🇵', edgeVoice: 'ja-JP-NanamiNeural' },
  { code: 'en', name: 'Anglais (US)', flag: '🇺🇸', edgeVoice: 'en-US-JennyNeural' },
  { code: 'en-GB', name: 'Anglais (UK)', flag: '🇬🇧', edgeVoice: 'en-GB-SoniaNeural' },
  { code: 'es', name: 'Espagnol', flag: '🇪🇸', edgeVoice: 'es-ES-ElviraNeural' },
  { code: 'de', name: 'Allemand', flag: '🇩🇪', edgeVoice: 'de-DE-KatjaNeural' },
  { code: 'it', name: 'Italien', flag: '🇮🇹', edgeVoice: 'it-IT-ElsaNeural' },
  { code: 'ru', name: 'Russe', flag: '🇷🇺', edgeVoice: 'ru-RU-SvetlanaNeural' },
  { code: 'zh-CN', name: 'Chinois (Mandarin)', flag: '🇨🇳', edgeVoice: 'zh-CN-XiaoxiaoNeural' },
  { code: 'ar', name: 'Arabe', flag: '🇸🇦', edgeVoice: 'ar-EG-SalmaNeural' },
  { code: 'ko', name: 'Coréen', flag: '🇰🇷', edgeVoice: 'ko-KR-SunHiNeural' },
  { code: 'pt', name: 'Portugais (Brésil)', flag: '🇧🇷', edgeVoice: 'pt-BR-FranciscaNeural' },
  { code: 'nl', name: 'Néerlandais', flag: '🇳🇱', edgeVoice: 'nl-NL-ColetteNeural' },
  { code: 'pl', name: 'Polonais', flag: '🇵🇱', edgeVoice: 'pl-PL-AgnieszkaNeural' },
  { code: 'tr', name: 'Turc', flag: '🇹🇷', edgeVoice: 'tr-TR-EmelNeural' },
  { code: 'sv', name: 'Suédois', flag: '🇸🇪', edgeVoice: 'sv-SE-SofieNeural' },
  { code: 'el', name: 'Grec', flag: '🇬🇷', edgeVoice: 'el-GR-AthinaNeural' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳', edgeVoice: 'hi-IN-SwaraNeural' },
  { code: 'th', name: 'Thaï', flag: '🇹🇭', edgeVoice: 'th-TH-PremwadeeNeural' },
  { code: 'vi', name: 'Vietnamien', flag: '🇻🇳', edgeVoice: 'vi-VN-HoaiMyNeural' },
  { code: 'uk', name: 'Ukrainien', flag: '🇺🇦', edgeVoice: 'uk-UA-PolinaNeural' }
];

// Backward-compatibility export
export const ACCENTS = NEURAL_VOICES;
