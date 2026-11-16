// Message moderation: finds disrespectful words (English, French, Darija, Arabic)
// and replaces them with ****. Used on student questions before they reach the teacher.

// Whole words (matched after lower-casing and removing accents)
const WORDS = [
  // English
  'fuck', 'fucker', 'fucking', 'fucked', 'fck', 'fuk', 'fuq', 'wtf', 'stfu', 'motherfucker', 'shit', 'shitty', 'bullshit',
  'bitch', 'bitches', 'ass', 'asshole', 'arse', 'arsehole', 'bastard', 'dick', 'dickhead', 'cock', 'pussy', 'cunt', 'slut', 'whore',
  'damn', 'goddamn', 'crap', 'piss', 'pissed', 'idiot', 'idiots', 'moron', 'retarded', 'dumbass', 'jackass', 'douche', 'douchebag', 'wanker', 'twat', 'prick', 'nigga', 'nigger', 'fag', 'faggot',
  // French
  'merde', 'putain', 'putains', 'pute', 'putes', 'con', 'conne', 'connes', 'connard', 'connards', 'connasse', 'salope', 'salopes', 'salaud', 'salop',
  'encule', 'encules', 'enculer', 'enfoire', 'batard', 'batards', 'cul', 'chier', 'chiant', 'chiante', 'nique', 'niquer', 'niquez', 'ntm', 'fdp', 'ftg', 'pd',
  'bordel', 'couille', 'couilles', 'branleur', 'abruti', 'abrutie', 'cretin', 'cretine', 'debile', 'imbecile', 'idiote', 'bouffon', 'tapette', 'petasse', 'pouffiasse', 'foutre', 'vtff',
  // Darija (written with Latin letters and numbers)
  'zamel', 'zaml', 'zwamel', '9a7ba', '9ahba', 'qahba', 'kahba', 'ka7ba', '9hab', '97ab', 'zebi', 'zbi', 'zeb', 'zebbi', 'zob', 'zobi', 'tabon', 'taboun', 'tbon',
  '7mar', 'hmar', '7mara', 'hmara', 'khra', '5ra', 'khrya', 'nik', 'nikmok', 'nikomok', 'n3al', 'n3el', 'tfou', 'terma', 'trami', 'zok', 'zouk',
  '7wa', 'n7wik', 'nhwik', 't7awa', '9lawi', 'qlawi', 'klawi', '9lwa', 't9awed', 'tqawed', '9awed', '9wad', 'kelb', 'klb', 'chmata', 'chmat', 'mkelekh', 'mklkh', 'bhim', 'bhima', 'khanez', 'khanza', '7chouma3lik',
  // Arabic script
  'قحبة', 'قحبه', 'قحاب', 'زامل', 'زوامل', 'زب', 'زبي', 'تبون', 'حمار', 'حمارة', 'خرا', 'خرية', 'نيك', 'ينعل', 'تفو', 'ترمة', 'زك',
  'شرموطة', 'شرموطه', 'عاهرة', 'كس', 'طيز', 'حقير', 'غبي', 'غبية', 'بهيمة', 'بهيم', 'مكلخ', 'خانز', 'تافه', 'منيوك', 'قواد', 'ديوث',
];

// Strong stems: the word is blocked even inside a longer word (fuckkk, emmerdeur, enculééé…)
const STEMS = ['fuck', 'bitch', 'shit', 'asshole', 'connard', 'connass', 'salop', 'encul', 'merde', 'putain', '9a7b', '9ahb', 'qahb', 'zamel', 'nikmo', 'قحب', 'زامل', 'شرموط'];

// Hidden spellings: f*ck, f.u.c.k, sh!t, b*tch, p*te, m*rde
const MASKED = [
  /f[\W_]*u[\W_]*c[\W_]*k/gi,
  /f[*#@!]+c?k/gi,
  /sh[*#@!]+t/gi,
  /b[*#@!]+tch/gi,
  /p[*#@!]+t(e|ain)/gi,
  /m[*#@!]+rde/gi,
];

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ًͯ-ْـ]/g, '');
const norm = (s) => stripAccents(s.toLowerCase());
const leet = (s) => s.replace(/[@4]/g, 'a').replace(/0/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/[$5]/g, 's');
const squeeze = (s, n) => s.replace(/(.)\1{2,}/g, (m, c) => c.repeat(n)); // fuuuuck → fuck

const WORD_SET = new Set(WORDS.map(norm));

function isBad(token) {
  const base = norm(token);
  const forms = new Set([base, squeeze(base, 1), squeeze(base, 2)]);
  // "Leet" spelling (sh1t, @ss) only counts when the token is mostly letters, so numbers like 455 stay untouched
  if ((base.match(/[a-z]/g) || []).length >= 2) { forms.add(leet(base)); forms.add(leet(squeeze(base, 1))); }
  // Arabic: also try without the article "ال" or the prefixes "يا"/"و"
  if (/[؀-ۿ]/.test(base)) {
    for (const p of ['ال', 'يا', 'و', 'يال']) if (base.startsWith(p) && base.length > p.length + 1) forms.add(base.slice(p.length));
  }
  for (const f of forms) {
    if (WORD_SET.has(f)) return true;
    if (f.length > 4 && f.endsWith('s') && WORD_SET.has(f.slice(0, -1))) return true;
    if (STEMS.some((s) => f.includes(s))) return true;
  }
  return false;
}

// Returns { text, clean, count }: text has bad words replaced with ****
function moderate(input) {
  let count = 0;
  let text = String(input || '');
  for (const re of MASKED) text = text.replace(re, () => { count++; return '****'; });
  // A token = letters/digits (any alphabet), may contain @ $ ! used as letters
  text = text.replace(/[\p{L}\p{N}@$!]+/gu, (token) => {
    const core = token.replace(/!+$/, ''); // keep normal "!" at the end of a sentence
    const tail = token.slice(core.length);
    if (core && isBad(core)) { count++; return '****' + tail; }
    return token;
  });
  return { text, clean: count === 0, count };
}

// Full check used before a student message is sent to a teacher
function checkMessage(input) {
  const raw = String(input || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!raw) return { error: 'Write your question' };
  if (raw.length < 5) return { error: 'Your message is too short. Explain your question.' };
  if (raw.length > 1000) return { error: 'Your message is too long (max 1000 characters).' };
  const r = moderate(raw);
  if (!/[\p{L}\p{N}]/u.test(r.text.replace(/\*{4}/g, ''))) return { error: 'Your message only contains disrespectful words. Please write a real question.', count: r.count };
  return { text: r.text, clean: r.clean, count: r.count };
}

module.exports = { moderate, checkMessage };

