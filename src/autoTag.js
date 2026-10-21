// ── Auto-tagging ──────────────────────────────────────────────────────────────
// Lightweight, fully client-side keyword matching used to pre-fill tags/behavior
// from a journal entry's transcript (voice or typed). No network calls, no ML —
// just word-boundary, accent-insensitive keyword lists per language. Intentionally
// conservative: when nothing clears the bar, it returns nothing rather than guess.

// Per-language keyword lists, keyed by the 11 free-text-detectable default tag ids.
// morning/afternoon/evening/night are derived from the clock (getTimeOfDayTag), not
// text, and "replaced" is derived from whether the replacement field is filled —
// both are handled by the caller, not here.
export const TAG_LEXICON = {
  en: {
    anxiety: ['anxious', 'anxiety', 'nervous', 'worried', 'worry', 'panic', 'panicking', 'on edge', 'overwhelmed'],
    stress: ['stressed', 'stress', 'stressful', 'overworked', 'pressure'],
    sadness: ['sad', 'sadness', 'down', 'depressed', 'crying', 'cried', 'hopeless'],
    anger: ['angry', 'anger', 'furious', 'mad', 'rage', 'irritated', 'frustrated', 'pissed'],
    loneliness: ['lonely', 'loneliness', 'isolated', 'nobody to talk to'],
    boredom: ['bored', 'boredom', 'nothing to do', 'restless'],
    social: ['party', 'friends', 'with people', 'social', 'gathering', 'crowd'],
    alone: ['alone', 'by myself', 'on my own', 'solo'],
    work: ['work', 'job', 'office', 'boss', 'coworker', 'shift'],
    home: ['home', 'house', 'apartment'],
    strongcraving: ['craving', 'cravings', 'urge', 'urges', 'tempted', 'temptation', "can't resist", 'impulse'],
  },
  fr: {
    anxiety: ['anxieux', 'anxieuse', 'anxiété', 'nerveux', 'nerveuse', 'inquiet', 'inquiète', 'panique', 'angoisse', 'angoissée'],
    stress: ['stressé', 'stressée', 'stress', 'pression', 'débordée', 'débordé'],
    sadness: ['triste', 'tristesse', 'déprimé', 'déprimée', 'pleure', 'pleuré', 'cafard'],
    anger: ['fâché', 'fâchée', 'colère', 'énervé', 'énervée', 'furieux', 'furieuse', 'rage', 'irrité', 'irritée'],
    loneliness: ['solitude', 'isolé', 'isolée', 'personne à qui parler'],
    boredom: ['ennui', "m'ennuie", 'rien à faire'],
    social: ['amis', 'fête', 'soirée', 'monde', 'groupe', 'sortie'],
    alone: ['seul', 'seule', 'tout seul', 'toute seule'],
    work: ['travail', 'boulot', 'bureau', 'patron', 'collègue', 'quart'],
    home: ['maison', 'chez moi', 'appartement'],
    strongcraving: ['envie forte', 'craving', 'pulsion', 'tentée', 'tenté', 'tentation', 'résister'],
  },
  es: {
    anxiety: ['ansioso', 'ansiosa', 'ansiedad', 'nervioso', 'nerviosa', 'preocupado', 'preocupada', 'pánico'],
    stress: ['estresado', 'estresada', 'estrés', 'presión', 'agobiada', 'agobiado'],
    sadness: ['triste', 'tristeza', 'deprimido', 'deprimida', 'llorando', 'lloré'],
    anger: ['enojado', 'enojada', 'enfadado', 'enfadada', 'furioso', 'furiosa', 'rabia', 'irritado', 'irritada'],
    loneliness: ['soledad', 'aislado', 'aislada', 'nadie con quien hablar'],
    boredom: ['aburrido', 'aburrida', 'aburrimiento', 'nada que hacer'],
    social: ['amigos', 'fiesta', 'gente', 'grupo', 'salida'],
    alone: ['solo', 'sola', 'por mi cuenta'],
    work: ['trabajo', 'oficina', 'jefe', 'compañero', 'turno'],
    home: ['casa', 'en casa'],
    strongcraving: ['ganas', 'antojo', 'tentación', 'tentada', 'tentado', 'impulso', 'resistir'],
  },
};

// Synonyms for the 8 onboarding-suggested behavior concepts, used to raise recall
// when the transcript uses a word that isn't literally in the stored behavior label.
export const BEHAVIOR_CONCEPT_SYNONYMS = {
  en: {
    smoking: ['cigarette', 'smoke', 'smoking', 'vape', 'vaping'],
    impulseBuying: ['bought', 'buy', 'shopping', 'purchase', 'ordered online'],
    junkFood: ['junk food', 'fast food', 'binge', 'snacking', 'chips', 'candy'],
    alcohol: ['drink', 'drank', 'alcohol', 'beer', 'wine', 'drunk'],
    socialMedia: ['scrolling', 'instagram', 'tiktok', 'phone', 'social media'],
    videoGames: ['gaming', 'video game', 'video games', 'console'],
    nailBiting: ['nails', 'biting my nails', 'bit my nails'],
    procrastination: ['procrastinating', 'procrastinated', 'put it off', 'avoided'],
  },
  fr: {
    smoking: ['cigarette', 'fumer', 'fumé', 'vapoter', 'vapote'],
    impulseBuying: ['acheté', 'acheter', 'magasinage', 'achat', 'commandé en ligne'],
    junkFood: ['malbouffe', 'restauration rapide', 'grignoté', 'croustilles', 'bonbons'],
    alcohol: ['boire', 'bu', 'alcool', 'bière', 'vin', 'saoul', 'ivre'],
    socialMedia: ['défiler', 'instagram', 'tiktok', 'téléphone', 'réseaux sociaux'],
    videoGames: ['jeux vidéo', 'jeu vidéo', 'console'],
    nailBiting: ['ongles', "rongé mes ongles", "ronge mes ongles"],
    procrastination: ['procrastiné', 'procrastine', 'remis à plus tard', 'évité'],
  },
  es: {
    smoking: ['cigarrillo', 'fumar', 'fumé', 'vapear'],
    impulseBuying: ['compré', 'comprar', 'compras', 'pedido en línea'],
    junkFood: ['comida chatarra', 'comida rápida', 'picoteo', 'papas fritas', 'dulces'],
    alcohol: ['beber', 'bebí', 'alcohol', 'cerveza', 'vino', 'borracho', 'borracha'],
    socialMedia: ['desplazando', 'instagram', 'tiktok', 'teléfono', 'redes sociales'],
    videoGames: ['videojuego', 'videojuegos', 'consola'],
    nailBiting: ['uñas', 'morderme las uñas', 'me mordí las uñas'],
    procrastination: ['procrastinando', 'procrastiné', 'lo dejé para después', 'evité'],
  },
};

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundaryMatch(haystackNormalized, phrase) {
  const needle = normalize(phrase);
  if (!needle) return false;
  const re = new RegExp(`(^|[^\\p{L}])${escapeRegExp(needle)}([^\\p{L}]|$)`, 'u');
  return re.test(haystackNormalized);
}

/** Returns the array of tag ids whose keyword list has at least one hit in the transcript. */
export function matchTags(transcript, lang) {
  const lexicon = TAG_LEXICON[lang] || TAG_LEXICON.en;
  const haystack = normalize(transcript);
  if (!haystack.trim()) return [];
  const hits = [];
  for (const [tagId, keywords] of Object.entries(lexicon)) {
    if (keywords.some(kw => wordBoundaryMatch(haystack, kw))) hits.push(tagId);
  }
  return hits;
}

/**
 * Guesses which existing behavior the transcript is about. Scores each behavior by
 * (a) overlap of its own label's significant words (length >= 4) with the transcript,
 * plus (b) a boost when the behavior's label matches one of the known translated
 * onboarding labels (any supported language) and the transcript contains one of that
 * concept's synonyms in `lang`. Returns a single behavior id only when there's a clear,
 * unique top scorer — never guesses on a tie or a zero score.
 */
export function matchBehavior(transcript, behaviors, lang, onboardingBehaviorLabels) {
  const haystack = normalize(transcript);
  if (!haystack.trim() || !behaviors?.length) return null;

  const conceptIdForLabel = (label) => {
    const normalizedLabel = normalize(label);
    for (const labels of Object.values(onboardingBehaviorLabels || {})) {
      for (const [conceptId, text] of Object.entries(labels || {})) {
        if (normalize(text) === normalizedLabel) return conceptId;
      }
    }
    return null;
  };

  const scored = behaviors.map(b => {
    let score = 0;
    const words = normalize(b.label).split(/\s+/).filter(w => w.length >= 4);
    words.forEach(w => { if (wordBoundaryMatch(haystack, w)) score += 1; });

    const conceptId = conceptIdForLabel(b.label);
    if (conceptId) {
      const synonyms = BEHAVIOR_CONCEPT_SYNONYMS[lang]?.[conceptId] || [];
      if (synonyms.some(syn => wordBoundaryMatch(haystack, syn))) score += 2;
    }
    return { id: b.id, score };
  }).filter(x => x.score > 0);

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score === scored[1].score) return null; // ambiguous tie, don't guess
  return scored[0].id;
}

/** Deduces morning/afternoon/evening/night from the local clock, not from text. */
export function getTimeOfDayTag(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}
