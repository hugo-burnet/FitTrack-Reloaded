/* ================= BASE D'ALIMENTS CURÉE (E2) =================
   Base embarquée, 100 % hors-ligne, zéro dépendance. Chaque aliment porte ses
   macros complètes (E3) par 100 g, sauf les rares aliments « unité » (whey/banane/
   chocolat) hérités du plan d'origine — leurs clés sont figées car le PLAN et la
   liste de COURSES les référencent.

   Curation > exhaustivité : aliments courants, catégorisés, valeurs réalistes
   (±10 %, comme toute table nutritionnelle). Extensible vers ~250-400 sans changer
   la forme. L'éditeur d'aliments perso (etat.aliments.perso) complète cette base.

   `g(nom, cat, prot, gluc, lip, fib, flex?)` : fabrique un aliment par 100 g et
   DÉRIVE les kcal par Atwater (4·prot + 4·gluc + 9·lip), ce qui garantit la
   cohérence interne (pas de kcal qui contredit les macros). Les boissons
   alcoolisées sont volontairement absentes (l'alcool casse Atwater). */
const g = (nom, cat, prot, gluc, lip, fib, flex) => {
  const a = { nom, cat, kcal100: Math.round(4*prot + 4*gluc + 9*lip),
              prot100: prot, gluc100: gluc, lip100: lip, fib100: fib };
  if(flex) a.flex = true;
  return a;
};

/* ordre d'affichage des catégories (filtre de l'UI) */
export const ORDRE_CATEGORIES = [
  'Féculents', 'Légumineuses', 'Viandes', 'Poissons', 'Œufs & laitages',
  'Fruits', 'Légumes', 'Oléagineux', 'Matières grasses', 'Sucré',
  'Boissons', 'Plats', 'Compléments',
];

export const ALIMENTS_BASE = {
  /* ----- aliments historiques du plan (clés FIGÉES, valeurs d'origine conservées) ----- */
  avoine:  {nom:"Flocons d'avoine",            cat:'Féculents',        kcal100:380, prot100:13,  gluc100:60, lip100:7,  fib100:10,  flex:true},
  riz:     {nom:"Riz (cru)",                   cat:'Féculents',        kcal100:350, prot100:7,   gluc100:78, lip100:1,  fib100:1.3, flex:true},
  poulet:  {nom:"Haut de cuisse poulet (cru)", cat:'Viandes',          kcal100:130, prot100:19,  gluc100:0,  lip100:6,  fib100:0},
  skyr:    {nom:"Skyr nature",                 cat:'Œufs & laitages',  kcal100:63,  prot100:11,  gluc100:4,  lip100:0.2,fib100:0},
  pb:      {nom:"Beurre de cacahuète",         cat:'Oléagineux',       kcal100:600, prot100:25,  gluc100:12, lip100:50, fib100:6},
  pois:    {nom:"Petits pois-carottes",        cat:'Légumes',          kcal100:60,  prot100:3.5, gluc100:8,  lip100:0.5,fib100:4},
  amandes: {nom:"Amandes",                     cat:'Oléagineux',       kcal100:600, prot100:21,  gluc100:10, lip100:50, fib100:12},
  noix:    {nom:"Noix",                         cat:'Oléagineux',       kcal100:650, prot100:15,  gluc100:14, lip100:65, fib100:7},
  whey:    {nom:"Whey",      cat:'Compléments', unite:"shaker",   kcalU:115,   protU:23, glucU:3,    lipU:1.5,  fibU:0},
  banane:  {nom:"Banane",    cat:'Fruits',      unite:"",          kcalU:105,   protU:1.3,glucU:27,   lipU:0.4,  fibU:3},
  choco:   {nom:"Chocolat noir 85%", cat:'Sucré', unite:"carré", kcalU:30, protU:0.5,  glucU:1.5,  lipU:2.5,  fibU:0.6},

  /* ----- Féculents ----- */
  'riz-cuit':     g("Riz cuit",                'Féculents', 2.7, 28, 0.3, 0.4),
  'pates-cru':    g("Pâtes (crues)",           'Féculents', 12.7,75, 1.5, 3),
  'pates-cuit':   g("Pâtes cuites",            'Féculents', 5,  30, 0.9, 1.8),
  'pain-complet': g("Pain complet",            'Féculents', 9,  43, 2.5, 6),
  'pain-blanc':   g("Pain blanc / baguette",   'Féculents', 9,  49, 1.5, 2.7),
  'pain-mie':     g("Pain de mie",             'Féculents', 8,  48, 4,   3),
  pdt:            g("Pomme de terre (cuite)",  'Féculents', 2,  17, 0.1, 1.8),
  'patate-douce': g("Patate douce (cuite)",    'Féculents', 1.6,20, 0.1, 3),
  semoule:        g("Semoule / couscous (cru)",'Féculents', 12, 72, 1.5, 5),
  'quinoa-cru':   g("Quinoa (cru)",            'Féculents', 14, 64, 6,   7),
  'boulgour-cru': g("Boulgour (cru)",          'Féculents', 12, 76, 1.5, 12),
  cornflakes:     g("Corn flakes",             'Féculents', 7,  84, 0.9, 3),
  muesli:         g("Muesli",                  'Féculents', 10, 60, 8,   7),
  'galette-riz':  g("Galette de riz soufflé",  'Féculents', 8,  81, 3,   4),

  /* ----- Légumineuses ----- */
  'lentilles-cuit':       g("Lentilles cuites",      'Légumineuses', 9,  17, 0.4, 8),
  'pois-chiches-cuit':    g("Pois chiches cuits",    'Légumineuses', 9,  27, 2.6, 8),
  'haricots-rouges-cuit': g("Haricots rouges cuits", 'Légumineuses', 9,  20, 0.5, 7),
  'haricots-blancs-cuit': g("Haricots blancs cuits", 'Légumineuses', 9,  20, 0.5, 7),
  'feves-cuit':           g("Fèves cuites",          'Légumineuses', 8,  18, 0.6, 5),
  tofu:                   g("Tofu nature",           'Légumineuses', 12, 1.2,7,   1),
  'tofu-ferme':           g("Tofu ferme",            'Légumineuses', 16, 2,  9,   1),
  tempeh:                 g("Tempeh",                'Légumineuses', 19, 9,  11,  5),
  edamame:                g("Edamame",               'Légumineuses', 11, 9,  5,   5),

  /* ----- Viandes ----- */
  'poulet-blanc':  g("Blanc de poulet (cru)", 'Viandes', 23, 0,   1.5, 0),
  'dinde-blanc':   g("Escalope de dinde",     'Viandes', 22, 0,   1.5, 0),
  'boeuf-hache-5': g("Bœuf haché 5 %",        'Viandes', 21, 0,   5,   0),
  'boeuf-hache-15':g("Bœuf haché 15 %",       'Viandes', 20, 0,   15,  0),
  'steak-boeuf':   g("Steak de bœuf",         'Viandes', 26, 0,   6,   0),
  'porc-filet':    g("Filet mignon de porc",  'Viandes', 21, 0,   4,   0),
  'jambon-blanc':  g("Jambon blanc",          'Viandes', 20, 1,   3,   0),
  'jambon-cru':    g("Jambon cru",            'Viandes', 27, 0.5, 12,  0),
  lardons:         g("Lardons",               'Viandes', 15, 0.5, 28,  0),
  saucisse:        g("Saucisse",              'Viandes', 14, 2,   28,  0),
  veau:            g("Escalope de veau",      'Viandes', 24, 0,   3,   0),
  'canard-magret': g("Magret de canard",      'Viandes', 19, 0,   15,  0),

  /* ----- Poissons & fruits de mer ----- */
  saumon:          g("Saumon",                'Poissons', 20, 0, 13,  0),
  'saumon-fume':   g("Saumon fumé",           'Poissons', 22, 0, 8,   0),
  'thon-naturel':  g("Thon au naturel",       'Poissons', 26, 0, 1,   0),
  'thon-frais':    g("Thon frais",            'Poissons', 24, 0, 5,   0),
  cabillaud:       g("Cabillaud",             'Poissons', 18, 0, 0.7, 0),
  colin:           g("Colin / lieu",          'Poissons', 17, 0, 1,   0),
  sardine:         g("Sardines (égouttées)",  'Poissons', 25, 0, 11,  0),
  maquereau:       g("Maquereau",             'Poissons', 19, 0, 14,  0),
  crevette:        g("Crevettes",             'Poissons', 20, 0, 1,   0),
  moules:          g("Moules",                'Poissons', 12, 4, 2,   0),
  truite:          g("Truite",                'Poissons', 20, 0, 7,   0),
  surimi:          g("Surimi",                'Poissons', 8,  12,1,   0),

  /* ----- Œufs & laitages ----- */
  oeuf:               g("Œuf entier",            'Œufs & laitages', 13, 0.7, 10, 0),
  'blanc-oeuf':       g("Blanc d'œuf",           'Œufs & laitages', 11, 0.7, 0.2,0),
  'fromage-blanc-0':  g("Fromage blanc 0 %",     'Œufs & laitages', 8,  4,   0.2,0),
  'fromage-blanc-3':  g("Fromage blanc 3 %",     'Œufs & laitages', 7.5,4,   3,  0),
  'yaourt-nature':    g("Yaourt nature",         'Œufs & laitages', 4,  5,   1.5,0),
  'yaourt-grec':      g("Yaourt grec",           'Œufs & laitages', 4,  4,   9,  0),
  'petit-suisse':     g("Petit suisse",          'Œufs & laitages', 9,  4,   5,  0),
  'lait-demi':        g("Lait demi-écrémé",      'Œufs & laitages', 3.3,5,   1.6,0),
  'lait-entier':      g("Lait entier",           'Œufs & laitages', 3.2,5,   3.6,0),
  mozzarella:         g("Mozzarella",            'Œufs & laitages', 18, 1,   16, 0),
  comte:              g("Comté",                 'Œufs & laitages', 27, 0,   34, 0),
  emmental:           g("Emmental",              'Œufs & laitages', 28, 0,   30, 0),
  chevre:             g("Fromage de chèvre",     'Œufs & laitages', 19, 1,   25, 0),
  feta:               g("Feta",                  'Œufs & laitages', 14, 1,   21, 0),
  parmesan:           g("Parmesan",              'Œufs & laitages', 36, 0,   29, 0),
  ricotta:            g("Ricotta",               'Œufs & laitages', 11, 3,   13, 0),
  cottage:            g("Cottage cheese",        'Œufs & laitages', 11, 3,   4,  0),
  'creme-fraiche':    g("Crème fraîche 30 %",    'Œufs & laitages', 2.4,3,   30, 0),
  'creme-legere':     g("Crème légère 15 %",     'Œufs & laitages', 3,  4,   15, 0),
  beurre:             g("Beurre",                'Œufs & laitages', 0.7,0.7, 82, 0),

  /* ----- Fruits ----- */
  pomme:        g("Pomme",         'Fruits', 0.3, 12, 0.2, 2.4),
  poire:        g("Poire",         'Fruits', 0.4, 12, 0.1, 3),
  orange:       g("Orange",        'Fruits', 0.9, 9,  0.1, 2.4),
  clementine:   g("Clémentine",    'Fruits', 0.8, 10, 0.2, 1.7),
  fraise:       g("Fraises",       'Fruits', 0.7, 6,  0.3, 2),
  framboise:    g("Framboises",    'Fruits', 1.2, 5,  0.7, 7),
  myrtille:     g("Myrtilles",     'Fruits', 0.7, 12, 0.3, 2.4),
  raisin:       g("Raisin",        'Fruits', 0.7, 16, 0.2, 0.9),
  kiwi:         g("Kiwi",          'Fruits', 1.1, 11, 0.5, 3),
  ananas:       g("Ananas",        'Fruits', 0.5, 12, 0.1, 1.4),
  mangue:       g("Mangue",        'Fruits', 0.8, 15, 0.4, 1.6),
  peche:        g("Pêche",         'Fruits', 0.9, 9,  0.2, 1.5),
  abricot:      g("Abricot",       'Fruits', 1.4, 9,  0.4, 2),
  pasteque:     g("Pastèque",      'Fruits', 0.6, 8,  0.2, 0.4),
  melon:        g("Melon",         'Fruits', 0.8, 8,  0.2, 0.9),
  cerise:       g("Cerises",       'Fruits', 1,   13, 0.3, 1.6),
  avocat:       g("Avocat",        'Fruits', 2,   1,  15,  7),
  datte:        g("Dattes",        'Fruits', 2.5, 63, 0.4, 8),
  'figue-seche':g("Figues sèches", 'Fruits', 3,   48, 1,   10),
  'raisin-sec': g("Raisins secs",  'Fruits', 3,   71, 0.5, 4),
  pruneau:      g("Pruneaux",      'Fruits', 2,   57, 0.4, 7),
  'abricot-sec':g("Abricots secs", 'Fruits', 3,   53, 0.5, 7),

  /* ----- Légumes ----- */
  brocoli:       g("Brocoli",          'Légumes', 2.8, 4,  0.4, 3),
  'haricot-vert':g("Haricots verts",   'Légumes', 1.8, 5,  0.2, 3),
  carotte:       g("Carotte",          'Légumes', 0.9, 7,  0.2, 2.8),
  courgette:     g("Courgette",        'Légumes', 1.2, 3,  0.3, 1),
  tomate:        g("Tomate",           'Légumes', 0.9, 3,  0.2, 1.2),
  concombre:     g("Concombre",        'Légumes', 0.6, 2,  0.1, 0.5),
  poivron:       g("Poivron",          'Légumes', 1,   5,  0.3, 2),
  epinard:       g("Épinards",         'Légumes', 2.9, 1.4,0.4, 2.2),
  salade:        g("Salade verte",     'Légumes', 1.2, 1.5,0.2, 1.3),
  'chou-fleur':  g("Chou-fleur",       'Légumes', 2,   3,  0.3, 2),
  champignon:    g("Champignons",      'Légumes', 3,   1,  0.3, 1),
  aubergine:     g("Aubergine",        'Légumes', 1,   3,  0.2, 3),
  oignon:        g("Oignon",           'Légumes', 1.1, 8,  0.1, 1.7),
  'mais-doux':   g("Maïs doux",        'Légumes', 3,   19, 1.5, 3),
  betterave:     g("Betterave",        'Légumes', 1.6, 7,  0.2, 2.8),
  'petit-pois':  g("Petits pois",      'Légumes', 5,   11, 0.4, 5),
  poireau:       g("Poireau",          'Légumes', 1.5, 6,  0.3, 2),
  potiron:       g("Potiron / courge", 'Légumes', 1,   5,  0.1, 1.5),

  /* ----- Oléagineux & graines ----- */
  noisette:          g("Noisettes",          'Oléagineux', 15, 7,  61, 10),
  cajou:             g("Noix de cajou",      'Oléagineux', 18, 30, 44, 3),
  pistache:          g("Pistaches",          'Oléagineux', 20, 28, 45, 10),
  'noix-pecan':      g("Noix de pécan",      'Oléagineux', 9,  4,  72, 10),
  'graine-courge':   g("Graines de courge",  'Oléagineux', 30, 11, 49, 6),
  'graine-tournesol':g("Graines de tournesol",'Oléagineux',21, 20, 51, 9),
  'graine-chia':     g("Graines de chia",    'Oléagineux', 17, 42, 31, 34),
  'graine-lin':      g("Graines de lin",     'Oléagineux', 18, 29, 42, 27),
  'puree-amande':    g("Purée d'amande",     'Oléagineux', 25, 10, 55, 10),

  /* ----- Matières grasses ----- */
  'huile-olive': g("Huile d'olive", 'Matières grasses', 0, 0,   100, 0),
  'huile-colza': g("Huile de colza",'Matières grasses', 0, 0,   100, 0),
  'huile-coco':  g("Huile de coco", 'Matières grasses', 0, 0,   100, 0),
  margarine:     g("Margarine",     'Matières grasses', 0, 0.5, 80,  0),

  /* ----- Sucré & snacks ----- */
  miel:           g("Miel",                   'Sucré', 0.3, 82, 0,   0),
  sucre:          g("Sucre blanc",            'Sucré', 0,   100,0,   0),
  'sirop-erable': g("Sirop d'érable",         'Sucré', 0,   67, 0,   0),
  confiture:      g("Confiture",              'Sucré', 0.4, 60, 0.1, 1),
  'choco-lait':   g("Chocolat au lait",       'Sucré', 7,   57, 32,  2),
  'pate-tartiner':g("Pâte à tartiner choco",  'Sucré', 6,   57, 31,  0),
  biscuit:        g("Biscuit sec",            'Sucré', 7,   70, 15,  2),
  cookie:         g("Cookie",                 'Sucré', 6,   64, 24,  2),
  madeleine:      g("Madeleine",              'Sucré', 6,   55, 22,  1),
  chips:          g("Chips",                  'Sucré', 6,   50, 34,  4),
  'glace-vanille':g("Glace vanille",          'Sucré', 4,   24, 11,  0),
  'compote':      g("Compote de pomme ss",    'Sucré', 0.4, 12, 0.1, 1.2),

  /* ----- Boissons (sans alcool) ----- */
  'jus-orange':   g("Jus d'orange",           'Boissons', 0.7, 10, 0.2, 0.2),
  'jus-pomme':    g("Jus de pomme",           'Boissons', 0.1, 11, 0.1, 0.1),
  'soda-cola':    g("Soda (type cola)",       'Boissons', 0,   11, 0,   0),
  'lait-amande':  g("Boisson d'amande ss",    'Boissons', 0.5, 0.1,1.1, 0.2),

  /* ----- Plats composés (valeurs indicatives par 100 g) ----- */
  pizza:           g("Pizza margherita",       'Plats', 11, 30, 10, 2),
  burger:          g("Burger",                 'Plats', 14, 20, 15, 1.5),
  lasagnes:        g("Lasagnes",               'Plats', 8,  12, 7,  1),
  quiche:          g("Quiche lorraine",        'Plats', 10, 20, 18, 1),
  sushi:           g("Sushi",                  'Plats', 7,  30, 3,  1),
  'sandwich-jb':   g("Sandwich jambon-beurre", 'Plats', 11, 35, 12, 2),
  frites:          g("Frites",                 'Plats', 3.4,41, 15, 4),
  nuggets:         g("Nuggets de poulet",      'Plats', 15, 16, 15, 1),
  'pates-bolo':    g("Pâtes bolognaise",       'Plats', 6,  15, 5,  1.5),
  'riz-cantonais': g("Riz cantonais",          'Plats', 6,  20, 6,  1),
  ratatouille:     g("Ratatouille",            'Plats', 1.3,6,  3,  2),
  houmous:         g("Houmous",                'Plats', 8,  14, 17, 6),
  guacamole:       g("Guacamole",              'Plats', 2,  5,  15, 5),
  'soupe-legumes': g("Soupe de légumes",       'Plats', 1.5,6,  1,  1.5),

  /* ----- Compléments ----- */
  'whey-iso':       g("Whey isolate (poudre)",  'Compléments', 85, 5,  1, 0),
  caseine:          g("Caséine (poudre)",       'Compléments', 78, 8,  2, 0),
  'proteine-veg':   g("Protéine végétale (poudre)",'Compléments',75,8,  5, 5),
  maltodextrine:    g("Maltodextrine",          'Compléments', 0,  95, 0, 0),
  creatine:         g("Créatine",               'Compléments', 0,  0,  0, 0),
  'barre-prot':     g("Barre protéinée",        'Compléments', 30, 40, 12,5),
};
