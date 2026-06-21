/* ================= POOL DU GÉNÉRATEUR DE MENUS (V-Nutri F1) =================
   Sous-ensemble CURÉ de la base d'aliments, dédié à la génération automatique de menus.
   Chaque entrée ne porte que des MÉTA-données (le rôle, la préparation, le repas cible,
   les bornes de portion) ; les macros sont lues dans ALIMENTS via la clé (source unique).

   Volontairement restreint aux aliments « faciles » (zéro prépa, cuiseur à riz, airfryer)
   et de bonne qualité nutritionnelle, pour que le menu généré reste réellement mangeable.
   L'utilisateur n'y est jamais enfermé : il peut éditer le menu généré ensuite.

   Champs : { cle, role, prep, slots[], base, min, max, pas }
     - role  : 'prot' | 'gluc' | 'lip' | 'fibre' (macro que l'aliment sert en priorité)
     - prep  : 'aucune' (rien à faire) | 'cuiseur' (cuiseur à riz) | 'airfryer'
     - slots : repas où l'aliment a du sens (pdej/dej/coll/diner)
     - base/min/max/pas : portion de départ et bornes (en g, ou en UNITÉS pour whey/banane/œuf) */

export const PREP_FACILES = ['aucune', 'cuiseur', 'airfryer'];

export const REPAS_STRUCTURE = [
  { id: 'pdej',  nom: 'Petit-déjeuner' },
  { id: 'dej',   nom: 'Déjeuner' },
  { id: 'coll',  nom: 'Collation' },
  { id: 'diner', nom: 'Dîner' },
];

export const POOL_GENERATEUR = [
  /* ---- protéines (vraies sources d'abord ; poudres = repli, « shakers si besoin ») ---- */
  { cle: 'poulet-blanc',    role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'skyr',            role: 'prot',  prep: 'aucune',   slots: ['coll', 'diner'],        base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'oeuf',            role: 'prot',  prep: 'airfryer', slots: ['pdej', 'dej'],          base: 100, min: 50,  max: 200, pas: 50 },
  { cle: 'thon-naturel',    role: 'prot',  prep: 'aucune',   slots: ['dej'],                  base: 100, min: 60,  max: 200, pas: 10 },
  { cle: 'dinde-blanc',     role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'fromage-blanc-0', role: 'prot',  prep: 'aucune',   slots: ['coll', 'pdej'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'cabillaud',       role: 'prot',  prep: 'airfryer', slots: ['diner'],                base: 150, min: 80,  max: 250, pas: 10 },
  { cle: 'saumon',          role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 120, min: 80,  max: 220, pas: 10 },
  { cle: 'jambon-blanc',    role: 'prot',  prep: 'aucune',   slots: ['pdej', 'dej'],          base: 50,  min: 30,  max: 120, pas: 10 },
  { cle: 'whey',            role: 'prot',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 1,   min: 0,   max: 2,   pas: 1, unite: true },
  { cle: 'whey-iso',        role: 'prot',  prep: 'aucune',   slots: ['pdej'],                 base: 30,  min: 0,   max: 60,  pas: 5 },
  /* viandes & poissons faciles supplémentaires */
  { cle: 'boeuf-hache-5',   role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'steak-boeuf',     role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 130, min: 80,  max: 250, pas: 10 },
  { cle: 'porc-filet',      role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'truite',          role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 120, min: 80,  max: 220, pas: 10 },
  { cle: 'crevette',        role: 'prot',  prep: 'aucune',   slots: ['dej', 'diner'],         base: 100, min: 60,  max: 200, pas: 10 },
  { cle: 'surimi',          role: 'prot',  prep: 'aucune',   slots: ['coll', 'dej'],          base: 100, min: 50,  max: 200, pas: 10 },
  { cle: 'jambon-cru',      role: 'prot',  prep: 'aucune',   slots: ['pdej', 'dej'],          base: 40,  min: 20,  max: 100, pas: 10 },
  /* laitages riches en protéines */
  { cle: 'yaourt-grec',     role: 'prot',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 150, min: 100, max: 300, pas: 10 },
  { cle: 'fromage-blanc-3', role: 'prot',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'cottage',         role: 'prot',  prep: 'aucune',   slots: ['coll', 'diner'],        base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'petit-suisse',    role: 'prot',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 120, min: 60,  max: 240, pas: 10 },
  { cle: 'blanc-oeuf',      role: 'prot',  prep: 'aucune',   slots: ['pdej', 'dej'],          base: 120, min: 60,  max: 240, pas: 10 },
  { cle: 'caseine',         role: 'prot',  prep: 'aucune',   slots: ['diner'],                base: 30,  min: 0,   max: 60,  pas: 5 },
  /* protéines végétales */
  { cle: 'tofu-ferme',      role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'tempeh',          role: 'prot',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 120, min: 60,  max: 250, pas: 10 },
  { cle: 'edamame',         role: 'prot',  prep: 'aucune',   slots: ['coll', 'dej'],          base: 100, min: 50,  max: 200, pas: 10 },
  { cle: 'proteine-veg',    role: 'prot',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 30,  min: 0,   max: 60,  pas: 5 },

  /* ---- glucides ---- */
  { cle: 'riz',             role: 'gluc',  prep: 'cuiseur',  slots: ['dej', 'diner'],         base: 120, min: 40,  max: 200, pas: 10 },
  { cle: 'patate-douce',    role: 'gluc',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'pdt',             role: 'gluc',  prep: 'airfryer', slots: ['dej', 'diner'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'avoine',          role: 'gluc',  prep: 'aucune',   slots: ['pdej'],                 base: 80,  min: 40,  max: 120, pas: 10 },
  { cle: 'banane',          role: 'gluc',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 1,   min: 0,   max: 2,   pas: 1, unite: true },
  { cle: 'pain-complet',    role: 'gluc',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 60,  min: 30,  max: 120, pas: 10 },
  { cle: 'pain-blanc',      role: 'gluc',  prep: 'aucune',   slots: ['pdej', 'dej'],          base: 60,  min: 30,  max: 120, pas: 10 },
  { cle: 'galette-riz',     role: 'gluc',  prep: 'aucune',   slots: ['coll'],                 base: 30,  min: 0,   max: 60,  pas: 10 },
  { cle: 'miel',            role: 'gluc',  prep: 'aucune',   slots: ['pdej'],                 base: 15,  min: 0,   max: 40,  pas: 5 },
  /* féculents au cuiseur à riz */
  { cle: 'quinoa-cru',      role: 'gluc',  prep: 'cuiseur',  slots: ['dej', 'diner'],         base: 70,  min: 40,  max: 120, pas: 10 },
  { cle: 'boulgour-cru',    role: 'gluc',  prep: 'cuiseur',  slots: ['dej', 'diner'],         base: 70,  min: 40,  max: 120, pas: 10 },
  { cle: 'semoule',         role: 'gluc',  prep: 'cuiseur',  slots: ['dej', 'diner'],         base: 70,  min: 40,  max: 120, pas: 10 },
  { cle: 'pates-cru',       role: 'gluc',  prep: 'cuiseur',  slots: ['dej', 'diner'],         base: 80,  min: 40,  max: 140, pas: 10 },
  /* petit-déj & sucres rapides */
  { cle: 'muesli',          role: 'gluc',  prep: 'aucune',   slots: ['pdej'],                 base: 60,  min: 40,  max: 100, pas: 10 },
  { cle: 'cornflakes',      role: 'gluc',  prep: 'aucune',   slots: ['pdej'],                 base: 50,  min: 30,  max: 90,  pas: 10 },
  { cle: 'datte',           role: 'gluc',  prep: 'aucune',   slots: ['coll'],                 base: 40,  min: 0,   max: 80,  pas: 10 },
  { cle: 'raisin-sec',      role: 'gluc',  prep: 'aucune',   slots: ['pdej', 'coll'],         base: 30,  min: 0,   max: 60,  pas: 10 },
  { cle: 'jus-orange',      role: 'gluc',  prep: 'aucune',   slots: ['pdej'],                 base: 200, min: 0,   max: 300, pas: 50 },

  /* ---- lipides ---- */
  { cle: 'amandes',         role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 30,  min: 10,  max: 60,  pas: 5 },
  { cle: 'pb',              role: 'lip',   prep: 'aucune',   slots: ['pdej', 'coll'],         base: 15,  min: 0,   max: 40,  pas: 5 },
  { cle: 'huile-olive',     role: 'lip',   prep: 'aucune',   slots: ['dej', 'diner'],         base: 10,  min: 0,   max: 30,  pas: 5 },
  { cle: 'huile-colza',     role: 'lip',   prep: 'aucune',   slots: ['dej', 'diner'],         base: 10,  min: 0,   max: 30,  pas: 5 },
  { cle: 'avocat',          role: 'lip',   prep: 'aucune',   slots: ['dej'],                  base: 50,  min: 0,   max: 100, pas: 10 },
  { cle: 'noix',            role: 'lip',   prep: 'aucune',   slots: ['coll', 'diner'],        base: 20,  min: 0,   max: 50,  pas: 5 },
  { cle: 'noisette',        role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 25,  min: 10,  max: 50,  pas: 5 },
  { cle: 'cajou',           role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 25,  min: 10,  max: 50,  pas: 5 },
  { cle: 'pistache',        role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 25,  min: 10,  max: 50,  pas: 5 },
  { cle: 'noix-pecan',      role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 20,  min: 0,   max: 50,  pas: 5 },
  { cle: 'puree-amande',    role: 'lip',   prep: 'aucune',   slots: ['pdej', 'coll'],         base: 20,  min: 0,   max: 40,  pas: 5 },
  { cle: 'graine-courge',   role: 'lip',   prep: 'aucune',   slots: ['coll'],                 base: 15,  min: 0,   max: 40,  pas: 5 },
  { cle: 'graine-chia',     role: 'lip',   prep: 'aucune',   slots: ['pdej'],                 base: 15,  min: 0,   max: 30,  pas: 5 },

  /* ---- fibres (légumes & fruits) ---- */
  { cle: 'pois',            role: 'fibre', prep: 'aucune',   slots: ['dej', 'diner'],         base: 150, min: 80,  max: 250, pas: 10 },
  { cle: 'haricot-vert',    role: 'fibre', prep: 'airfryer', slots: ['dej', 'diner'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'brocoli',         role: 'fibre', prep: 'airfryer', slots: ['diner'],                base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'carotte',         role: 'fibre', prep: 'aucune',   slots: ['dej', 'diner'],         base: 150, min: 80,  max: 300, pas: 10 },
  { cle: 'courgette',       role: 'fibre', prep: 'airfryer', slots: ['dej', 'diner'],         base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'tomate',          role: 'fibre', prep: 'aucune',   slots: ['dej', 'diner'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'concombre',       role: 'fibre', prep: 'aucune',   slots: ['dej', 'diner'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'poivron',         role: 'fibre', prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'epinard',         role: 'fibre', prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'chou-fleur',      role: 'fibre', prep: 'airfryer', slots: ['diner'],                base: 200, min: 100, max: 400, pas: 10 },
  { cle: 'champignon',      role: 'fibre', prep: 'airfryer', slots: ['dej', 'diner'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'salade',          role: 'fibre', prep: 'aucune',   slots: ['dej', 'diner'],         base: 100, min: 0,   max: 200, pas: 10 },
  { cle: 'poireau',         role: 'fibre', prep: 'airfryer', slots: ['diner'],                base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'pomme',           role: 'fibre', prep: 'aucune',   slots: ['coll', 'pdej'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'myrtille',        role: 'fibre', prep: 'aucune',   slots: ['pdej', 'coll'],         base: 100, min: 0,   max: 200, pas: 10 },
  { cle: 'poire',           role: 'fibre', prep: 'aucune',   slots: ['coll', 'pdej'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'orange',          role: 'fibre', prep: 'aucune',   slots: ['coll', 'pdej'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'fraise',          role: 'fibre', prep: 'aucune',   slots: ['pdej', 'coll'],         base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'framboise',       role: 'fibre', prep: 'aucune',   slots: ['pdej', 'coll'],         base: 125, min: 0,   max: 250, pas: 10 },
  { cle: 'kiwi',            role: 'fibre', prep: 'aucune',   slots: ['pdej', 'coll'],         base: 120, min: 0,   max: 240, pas: 10 },
  { cle: 'ananas',          role: 'fibre', prep: 'aucune',   slots: ['coll'],                 base: 150, min: 0,   max: 300, pas: 10 },
  { cle: 'mangue',          role: 'fibre', prep: 'aucune',   slots: ['coll', 'pdej'],         base: 150, min: 0,   max: 300, pas: 10 },
];
