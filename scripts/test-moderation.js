const { moderate } = require('../utils/moderation.js');
const tests = [
  "Professeur, je n'ai pas compris la leçon, fuck this",
  'FUUUUCK this sh1t, f*ck f u c k',
  'Ce cours est de la merde, espèce de connard !',
  'wach nta 7mar? sir t9awed a zamel',
  'يا حمار هاد الدرس خايب',
  // must stay clean:
  'Je suis en retard pour le devoir. Calcul de tg(x) avec C = 10 mF, résultat 455.',
  'The pros and cons of the class: I pass the assessment. Le calcul est technique et unique.',
  'Comment communiquer le compte rendu ? Je dispute la réputation du computer. f_k(x) et f.k',
  'هل الحيوان يتنفس؟ شكرا أستاذ',
  'Bonjour! Merci beaucoup!!! As-tu la solution $x$ ?',
];
for (const t of tests) { const r = moderate(t); console.log((r.clean ? 'CLEAN ' : `BAD(${r.count}) `) + r.text); }
