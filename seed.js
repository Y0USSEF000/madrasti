// Fills the database with demo Moroccan curriculum data.  Run: npm.cmd run seed
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, stopMongod } = require('./db');
const M = require('./models');

const day = 86400000;
const ago = (d) => new Date(Date.now() - d * day);
const inDays = (d) => new Date(Date.now() + d * day);

const lessonText = (title, intro, points) => `## Introduction
${intro}

## L'essentiel du cours
${points.map((p) => `- ${p}`).join('\n')}

## Méthode
Lisez le cours, refaites les exemples sans regarder la correction, puis faites les exercices d'application. Notez vos questions et posez-les au professeur dans l'espace "Ask the teacher".

## À retenir
**${title}** est une partie importante du programme. Révisez-la régulièrement pour le contrôle continu et l'examen.`;

const CURRICULUM = [
  {
    teacher: { name: 'Karim Benali', email: 'teacher@madrasti.ma', subject: 'Mathématiques', school: 'Lycée Moulay Youssef', city: 'Rabat' },
    courses: [
      {
        title: 'Mathématiques — 2ème Bac Sciences Physiques', subject: 'Mathématiques', level: '2ème Année Bac', color: '#0f766e',
        description: "Programme officiel de mathématiques de la 2ème année du Baccalauréat, filière Sciences Physiques : analyse, suites, nombres complexes et probabilités. Préparation à l'examen national.",
        lessons: [
          ['Limites et continuité', "On étudie le comportement d'une fonction au voisinage d'un point et à l'infini.", ['Limites usuelles et opérations sur les limites', 'Continuité en un point et sur un intervalle', 'Théorème des valeurs intermédiaires (TVI)', 'Fonction réciproque d\'une fonction continue strictement monotone', 'La fonction racine n-ième']],
          ['Dérivation et étude de fonctions', 'La dérivée permet d\'étudier les variations et de tracer la courbe d\'une fonction.', ['Dérivabilité en un point, interprétation géométrique', 'Dérivée de la fonction réciproque', 'Concavité, points d\'inflexion', 'Branches infinies et asymptotes', 'Plan d\'étude complet d\'une fonction']],
          ['Suites numériques', 'Les suites modélisent des phénomènes discrets.', ['Suites arithmétiques et géométriques', 'Suites majorées, minorées, monotones', 'Convergence d\'une suite', 'Suites de la forme u(n+1) = f(u(n))']],
          ['Fonctions logarithmes', 'La fonction ln est la primitive de 1/x sur ]0,+∞[ qui s\'annule en 1.', ['Définition et propriétés algébriques de ln', 'Limites usuelles', 'Étude de la fonction ln', 'Logarithme de base a']],
          ['Fonctions exponentielles', 'La fonction exp est la réciproque de ln.', ['Définition et propriétés', 'Dérivée de exp(u)', 'Limites usuelles', 'Équations différentielles y\' = ay + b']],
          ['Nombres complexes', 'Les nombres complexes permettent de résoudre toutes les équations du second degré.', ['Forme algébrique, conjugué, module', 'Forme trigonométrique et exponentielle', 'Équations du second degré dans C', 'Interprétation géométrique : rotations et translations']],
          ['Calcul intégral', 'L\'intégrale permet de calculer des aires.', ['Primitives usuelles', 'Intégrale d\'une fonction continue', 'Intégration par parties', 'Calcul d\'aires et de volumes']],
        ],
        assignments: [
          ['Devoir maison 1 : Étude d\'une fonction', 'Étudier la fonction f(x) = x - 1 + ln(x)/x. Donner le domaine, les limites, les variations et tracer la courbe. Rédiger proprement et envoyer une photo ou un PDF.', -10, 20],
          ['Série d\'exercices : Suites numériques', 'Résoudre les exercices 1 à 4 sur les suites récurrentes (voir le fichier du cours). Justifiez chaque étape.', 4, 20],
          ['Exercice : Nombres complexes', 'Résoudre dans C l\'équation z² - 2z + 4 = 0 puis écrire les solutions sous forme trigonométrique.', 12, 10],
        ],
        quizzes: [
          ['Quiz : Limites et continuité', 'Vérifiez vos connaissances sur les limites usuelles.', [
            ['lim (x→+∞) ln(x)/x = ?', ['+∞', '0', '1', '-∞'], 1],
            ['lim (x→0) sin(x)/x = ?', ['0', '+∞', '1', 'n\'existe pas'], 2],
            ['Le TVI s\'applique à une fonction…', ['dérivable seulement', 'continue sur un intervalle [a,b]', 'croissante seulement', 'paire'], 1],
            ['lim (x→+∞) eˣ/x = ?', ['0', '1', '+∞', 'e'], 2],
          ]],
          ['Quiz : Logarithme et exponentielle', 'Propriétés de ln et exp.', [
            ['ln(a × b) = ?', ['ln(a) × ln(b)', 'ln(a) + ln(b)', 'ln(a) - ln(b)', 'a ln(b)'], 1],
            ['La dérivée de e^(2x) est…', ['e^(2x)', '2e^(2x)', '2x e^(2x)', 'e^x'], 1],
            ['ln(1) = ?', ['1', 'e', '0', 'non défini'], 2],
          ]],
        ],
      },
      {
        title: 'Mathématiques — 3ème Année Collège', subject: 'Mathématiques', level: '3ème Année Collège', color: '#2563eb',
        description: 'Programme de mathématiques de la 3ème année du collège : géométrie, calcul littéral, équations et statistiques. Préparation à l\'examen régional.',
        lessons: [
          ['Théorème de Thalès', 'Le théorème de Thalès relie les longueurs dans deux triangles emboîtés.', ['Énoncé direct du théorème', 'Réciproque du théorème de Thalès', 'Applications : calcul de longueurs']],
          ['Théorème de Pythagore', 'Dans un triangle rectangle, le carré de l\'hypoténuse est égal à la somme des carrés des deux autres côtés.', ['Énoncé et réciproque', 'Calcul de longueurs', 'Démontrer qu\'un triangle est rectangle']],
          ['Équations et inéquations du premier degré', 'Résoudre une équation, c\'est trouver toutes les valeurs de l\'inconnue.', ['Équations ax + b = 0', 'Équations produit', 'Inéquations et représentation sur une droite', 'Mise en équation de problèmes']],
          ['Statistiques', 'Les statistiques permettent d\'organiser et d\'analyser des données.', ['Effectif, fréquence', 'Moyenne arithmétique', 'Médiane et mode', 'Diagrammes']],
        ],
        assignments: [['Exercices : Thalès et Pythagore', 'Faire les exercices 3, 5 et 7 de la page 112 du manuel.', 6, 20]],
        quizzes: [['Quiz : Pythagore', 'Questions rapides.', [
          ['Dans un triangle rectangle de côtés 3 et 4, l\'hypoténuse mesure…', ['5', '7', '6', '12'], 0],
          ['La réciproque de Pythagore sert à…', ['calculer une aire', 'démontrer qu\'un triangle est rectangle', 'calculer un angle', 'tracer un cercle'], 1],
        ]]],
      },
    ],
  },
  {
    teacher: { name: 'Samira El Idrissi', email: 'samira@madrasti.ma', subject: 'Physique-Chimie', school: 'Lycée Ibn Sina', city: 'Casablanca' },
    courses: [{
      title: 'Physique-Chimie — 2ème Bac PC', subject: 'Physique-Chimie', level: '2ème Année Bac', color: '#b45309',
      description: 'Ondes, transformations nucléaires, électricité (RC, RL, RLC), mécanique de Newton et chimie (cinétique, équilibres, piles). Programme national marocain.',
      lessons: [
        ['Ondes mécaniques progressives', 'Une onde mécanique est la propagation d\'une perturbation dans un milieu matériel sans transport de matière.', ['Ondes transversales et longitudinales', 'Célérité d\'une onde', 'Retard temporel τ = d / v', 'Ondes périodiques : période, longueur d\'onde λ = v·T']],
        ['Décroissance radioactive', 'Certains noyaux sont instables et se désintègrent spontanément.', ['Composition du noyau, isotopes', 'Radioactivité α, β-, β+ et γ', 'Loi de décroissance N(t) = N₀ e^(-λt)', 'Demi-vie t½ = ln2 / λ', 'Datation au carbone 14']],
        ['Dipôle RC', 'Le condensateur stocke de l\'énergie électrique.', ['Relation q = C·u', 'Charge et décharge du condensateur', 'Constante de temps τ = RC', 'Énergie emmagasinée E = ½ C u²']],
        ['Dipôle RL', 'La bobine s\'oppose aux variations du courant.', ['Tension aux bornes d\'une bobine', 'Établissement et rupture du courant', 'Constante de temps τ = L/R']],
        ['Lois de Newton', 'Les lois de Newton décrivent le mouvement d\'un corps soumis à des forces.', ['Référentiel galiléen', 'Deuxième loi de Newton ΣF = m·a', 'Chute verticale d\'un solide', 'Mouvement d\'un projectile']],
        ['Transformations lentes et rapides', 'Certaines réactions chimiques durent quelques secondes, d\'autres plusieurs heures.', ['Facteurs cinétiques : température, concentration', 'Suivi temporel d\'une transformation', 'Vitesse volumique de réaction', 'Temps de demi-réaction']],
      ],
      assignments: [
        ['TP : Charge d\'un condensateur', 'À partir des mesures du TP, tracer u(t), déterminer τ graphiquement et en déduire C. Joindre le graphique.', -3, 20],
        ['Exercices : Radioactivité', 'Exercices de type examen national sur la datation et la loi de décroissance.', 8, 20],
      ],
      quizzes: [['Quiz : Ondes et radioactivité', 'Cours en 5 questions.', [
        ['Une onde mécanique transporte…', ['de la matière', 'de l\'énergie sans transport de matière', 'des électrons', 'de la lumière'], 1],
        ['La demi-vie t½ est égale à…', ['λ / ln2', 'ln2 / λ', 'N₀ / 2', '1 / λ'], 1],
        ['Une particule α est un noyau de…', ['hydrogène', 'hélium', 'carbone', 'lithium'], 1],
        ['La constante de temps d\'un dipôle RC est…', ['R/C', 'C/R', 'RC', 'R + C'], 2],
        ['Le son est une onde…', ['transversale', 'longitudinale', 'électromagnétique', 'lumineuse'], 1],
      ]]],
    }],
  },
  {
    teacher: { name: 'Hassan Ouazzani', email: 'hassan@madrasti.ma', subject: 'SVT', school: 'Lycée Al Khawarizmi', city: 'Fès' },
    courses: [{
      title: 'SVT — 2ème Bac Sciences de la Vie et de la Terre', subject: 'SVT', level: '2ème Année Bac', color: '#15803d',
      description: 'Consommation de la matière organique et flux d\'énergie, information génétique, génétique humaine et géologie des chaînes de montagnes.',
      lessons: [
        ['Libération de l\'énergie emmagasinée dans la matière organique', 'La cellule produit de l\'ATP par respiration ou fermentation.', ['La glycolyse dans le hyaloplasme', 'Le cycle de Krebs dans la mitochondrie', 'La chaîne respiratoire et la phosphorylation oxydative', 'La fermentation alcoolique et lactique', 'Bilan énergétique']],
        ['Rôle du muscle squelettique strié dans la conversion de l\'énergie', 'Le muscle transforme l\'énergie chimique en énergie mécanique.', ['Structure du muscle strié', 'Mécanisme de la contraction', 'Voies de régénération de l\'ATP']],
        ['Nature et mécanisme de l\'expression de l\'information génétique', 'L\'ADN porte l\'information génétique.', ['Structure de l\'ADN', 'Réplication', 'Transcription et traduction', 'Le code génétique']],
        ['Les chaînes de montagnes récentes', 'Les chaînes de montagnes témoignent de la convergence des plaques.', ['Chaînes de subduction', 'Chaînes de collision', 'Chaînes d\'obduction', 'Métamorphisme et granitisation']],
      ],
      assignments: [['Exposé : la respiration cellulaire', 'Préparer un résumé illustré (2 pages max) des étapes de la respiration cellulaire.', 10, 20]],
      quizzes: [['Quiz : Respiration cellulaire', 'Bases du métabolisme énergétique.', [
        ['La glycolyse se déroule dans…', ['la mitochondrie', 'le hyaloplasme', 'le noyau', 'le ribosome'], 1],
        ['La respiration d\'une molécule de glucose produit environ…', ['2 ATP', '36-38 ATP', '100 ATP', '4 ATP'], 1],
        ['La fermentation lactique produit…', ['de l\'éthanol', 'de l\'acide lactique', 'du CO₂ uniquement', 'de l\'O₂'], 1],
      ]]],
    }],
  },
  {
    teacher: { name: 'Nadia Amrani', email: 'nadia@madrasti.ma', subject: 'Français', school: 'Lycée Lalla Aicha', city: 'Marrakech' },
    courses: [
      {
        title: 'Français — 1ère Année Bac', subject: 'Français', level: '1ère Année Bac', color: '#be123c',
        description: 'Œuvres au programme de l\'examen régional : Le Dernier Jour d\'un condamné, Antigone, Il était une fois un vieux couple heureux. Production écrite et langue.',
        lessons: [
          ['Le Dernier Jour d\'un condamné — Victor Hugo', 'Un roman à thèse contre la peine de mort, écrit sous forme de journal intime.', ['Contexte historique et auteur', 'Structure du roman', 'Le registre pathétique', 'L\'argumentation contre la peine de mort']],
          ['Antigone — Jean Anouilh', 'Une tragédie moderne reprise du mythe grec.', ['Le genre tragique', 'Les personnages : Antigone et Créon', 'Le rôle du Chœur et du Prologue', 'Thèmes : le devoir, la liberté, le pouvoir']],
          ['Il était une fois un vieux couple heureux — Mohammed Khaïr-Eddine', 'Un roman marocain sur la vie d\'un vieux couple dans un village du Sud.', ['L\'auteur et la littérature marocaine d\'expression française', 'L\'espace : le village berbère', 'Le temps et la mémoire', 'Tradition et modernité']],
          ['Production écrite : le texte argumentatif', 'Défendre une thèse avec des arguments et des exemples.', ['Thèse, arguments, exemples', 'Les connecteurs logiques', 'Plan d\'un texte argumentatif']],
        ],
        assignments: [['Production écrite : Pour ou contre la peine de mort ?', 'Rédigez un texte argumentatif de 20 lignes en vous appuyant sur l\'œuvre de Victor Hugo.', 5, 20]],
        quizzes: [['Quiz : Les œuvres au programme', 'Connaissance des œuvres.', [
          ['Qui a écrit "Antigone" (1944) ?', ['Victor Hugo', 'Jean Anouilh', 'Molière', 'Albert Camus'], 1],
          ['"Le Dernier Jour d\'un condamné" est écrit sous forme de…', ['pièce de théâtre', 'journal intime', 'poème', 'lettres'], 1],
          ['Mohammed Khaïr-Eddine est un écrivain…', ['français', 'marocain', 'algérien', 'belge'], 1],
        ]]],
      },
      {
        title: 'Philosophie — 2ème Année Bac', subject: 'Philosophie', level: '2ème Année Bac', color: '#7c3aed',
        description: 'Les quatre axes du programme : la condition humaine, la connaissance, la politique et la morale. Méthodologie de la dissertation.',
        lessons: [
          ['La condition humaine : la personne', 'Qu\'est-ce qui fonde l\'identité personnelle ?', ['Personne et identité', 'Personne en tant que valeur', 'Personne entre nécessité et liberté']],
          ['La connaissance : la théorie et l\'expérience', 'Quel est le rapport entre la raison et le réel ?', ['L\'expérience et l\'expérimentation', 'La rationalité scientifique', 'Le critère de scientificité']],
          ['La politique : l\'État', 'Quelle est la légitimité de l\'État ?', ['Légitimité et finalité de l\'État', 'Nature du pouvoir politique', 'L\'État entre la force et le droit']],
          ['Méthodologie : analyser un sujet', 'Comment réussir l\'épreuve de philosophie au Bac.', ['Comprendre la question', 'Problématiser', 'Construire l\'analyse et la discussion', 'Rédiger la synthèse']],
        ],
        assignments: [['Dissertation : la personne et la liberté', 'Sujet : "La personne est-elle libre ou soumise à des déterminismes ?" Analysez et discutez.', 9, 20]],
        quizzes: [],
      },
    ],
  },
  {
    teacher: { name: 'Fatima Zahra Alaoui', email: 'fatima@madrasti.ma', subject: 'Mathématiques', school: 'École Al Massira', city: 'Tanger' },
    courses: [{
      title: 'Mathématiques — 6ème Année Primaire', subject: 'Mathématiques', level: '6ème Année Primaire', color: '#0891b2',
      description: 'Les fractions, les nombres décimaux, la proportionnalité, les périmètres et les aires. Préparation au certificat d\'études primaires.',
      lessons: [
        ['Les fractions', 'Une fraction représente une partie d\'un tout.', ['Lire et écrire une fraction', 'Comparer des fractions', 'Additionner des fractions']],
        ['Les nombres décimaux', 'Les nombres décimaux ont une partie entière et une partie décimale.', ['Lire et écrire des décimaux', 'Comparer et ranger', 'Les 4 opérations']],
        ['La proportionnalité', 'Deux grandeurs sont proportionnelles si on passe de l\'une à l\'autre en multipliant par le même nombre.', ['Tableau de proportionnalité', 'Les pourcentages', 'L\'échelle d\'une carte']],
        ['Périmètres et aires', 'Mesurer le contour et la surface d\'une figure.', ['Périmètre du carré, du rectangle, du cercle', 'Aire du carré, du rectangle, du triangle', 'Aire du disque']],
      ],
      assignments: [['Exercices : les fractions', 'Faire les exercices de la fiche jointe.', 3, 10]],
      quizzes: [['Quiz : Fractions et décimaux', 'Petit quiz.', [
        ['1/2 + 1/4 = ?', ['2/6', '3/4', '1/6', '2/4'], 1],
        ['0,5 est égal à…', ['1/5', '1/2', '5', '1/50'], 1],
      ]]],
    }],
  },
];

const STUDENTS = [
  { name: 'Yassine El Amrani', email: 'student@madrasti.ma', level: '2ème Année Bac', city: 'Rabat', profile: 0.85 },
  { name: 'Salma Bennani', email: 'salma@madrasti.ma', level: '2ème Année Bac', city: 'Casablanca', profile: 0.95 },
  { name: 'Omar Tazi', email: 'omar@madrasti.ma', level: '2ème Année Bac', city: 'Fès', profile: 0.45 },
  { name: 'Imane Chraibi', email: 'imane@madrasti.ma', level: '2ème Année Bac', city: 'Meknès', profile: 0.7 },
  { name: 'Mehdi Berrada', email: 'mehdi@madrasti.ma', level: '2ème Année Bac', city: 'Agadir', profile: 0.3 },
  { name: 'Aya Lahlou', email: 'aya@madrasti.ma', level: '1ère Année Bac', city: 'Marrakech', profile: 0.8 },
  { name: 'Hamza Idrissi', email: 'hamza@madrasti.ma', level: '3ème Année Collège', city: 'Tétouan', profile: 0.6 },
  { name: 'Khadija Fassi', email: 'khadija@madrasti.ma', level: '2ème Année Bac', city: 'Oujda', profile: 0.75 },
];

// Simple seeded random so the demo data is the same each time
let seed = 42;
const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

async function run() {
  await connectDB();
  await Promise.all(Object.entries(M).filter(([name]) => name !== 'School').map(([, Model]) => Model.deleteMany({})));
  await require('./utils/schools').ensureSchools();
  const hash = await bcrypt.hash('password123', 10);

  const students = await M.User.insertMany(STUDENTS.map(({ profile, ...s }) => ({ ...s, role: 'student', password: hash, verified: true })));
  const profileOf = Object.fromEntries(STUDENTS.map((s, i) => [String(students[i]._id), s.profile]));

  for (const block of CURRICULUM) {
    const teacher = await M.User.create({ ...block.teacher, role: 'teacher', password: hash, verified: true });
    for (const c of block.courses) {
      const course = await M.Course.create({ title: c.title, subject: c.subject, level: c.level, color: c.color, description: c.description, teacher: teacher._id, createdAt: ago(60) });
      const lessons = await M.Lesson.insertMany(c.lessons.map(([title, intro, points], i) => ({
        course: course._id, title, order: i + 1, duration: 45 + (i % 3) * 15,
        status: i === c.lessons.length - 1 && block === CURRICULUM[0] && c === block.courses[0] ? 'draft' : 'published',
        objectives: points.slice(0, 3).map((p) => `Maîtriser : ${p.charAt(0).toLowerCase()}${p.slice(1)}`),
        content: lessonText(title, intro, points),
      })));
      const published = lessons.filter((l) => l.status === 'published');
      const assignments = await M.Assignment.insertMany(c.assignments.map(([title, instructions, due, max]) => ({ course: course._id, title, instructions, dueDate: inDays(due), maxPoints: max })));
      const quizzes = await M.Quiz.insertMany(c.quizzes.map(([title, description, qs]) => ({
        course: course._id, title, description, timeLimit: 15, dueDate: inDays(7),
        questions: qs.map(([text, options, correct]) => ({ text, options, correct, points: 1 })),
      })));

      // Enroll students of the right level
      const enrolled = students.filter((s) => s.level === c.level);
      for (const s of enrolled) {
        const p = profileOf[String(s._id)];
        const nDone = Math.round(published.length * Math.min(1, p + rand() * 0.2));
        await M.Enrollment.create({ student: s._id, course: course._id, completedLessons: published.slice(0, nDone).map((l) => l._id), lastActivity: ago(Math.round((1 - p) * 20 * rand())), createdAt: ago(45) });
        for (const a of assignments) {
          const isPast = a.dueDate < new Date();
          if (!(isPast ? rand() < p + 0.3 : rand() < p - 0.3)) continue;
          const graded = isPast && rand() < 0.75;
          const grade = Math.max(0, Math.min(a.maxPoints, Math.round(a.maxPoints * (p * 0.8 + rand() * 0.25) * 2) / 2));
          await M.Submission.create({
            assignment: a._id, student: s._id, text: 'Voici mon travail. J\'ai rédigé toutes les réponses demandées.',
            submittedAt: isPast ? new Date(a.dueDate.getTime() - day) : ago(1), status: graded ? 'graded' : 'submitted',
            grade: graded ? grade : undefined, gradedAt: graded ? ago(2) : undefined,
            feedback: graded ? (grade >= a.maxPoints * 0.7 ? 'Très bon travail, rédaction claire. Continuez ainsi !' : 'Des erreurs de méthode. Revoyez le cours et refaites les exemples.') : undefined,
          });
        }
        for (const q of quizzes) {
          if (rand() > p + 0.2) continue;
          const answers = q.questions.map((qq) => (rand() < p + 0.1 ? qq.correct : (qq.correct + 1) % qq.options.length));
          const score = answers.filter((a, i) => a === q.questions[i].correct).length;
          await M.QuizAttempt.create({ quiz: q._id, student: s._id, answers, score, total: q.questions.length, submittedAt: ago(Math.round(rand() * 10)) });
        }
      }
      await M.Announcement.create({ course: course._id, author: teacher._id, title: 'Bienvenue dans le cours !', body: `Bonjour à tous. Tous les cours de "${c.title}" sont disponibles ici à tout moment. Envoyez vos devoirs avant la date limite et n'hésitez pas à poser vos questions.`, createdAt: ago(30) });
      if (assignments[1]) await M.Announcement.create({ course: course._id, author: teacher._id, title: `Rappel : ${assignments[1].title}`, body: 'N\'oubliez pas de rendre ce travail avant la date limite. Bon courage !', createdAt: ago(2) });
      if (enrolled[0]) {
        await M.Question.create({ course: course._id, student: enrolled[0]._id, text: `Professeur, pouvez-vous réexpliquer la partie "${c.lessons[0][2][1]}" ? Je n'ai pas bien compris l'exemple.`, answer: 'Bien sûr ! Relisez l\'exemple 2 du cours, puis refaites l\'exercice 1. On le corrigera ensemble en classe.', answeredAt: ago(3), createdAt: ago(4) });
      }
      if (enrolled[2]) {
        await M.Question.create({ course: course._id, student: enrolled[2]._id, text: `Est-ce que la leçon "${c.lessons[1][0]}" sera dans le contrôle ?`, createdAt: ago(1) });
      }
    }
  }
  console.log('Seed done. Demo accounts (password: password123):');
  console.log('  Teacher: teacher@madrasti.ma   Student: student@madrasti.ma');
  await stopMongod();
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
