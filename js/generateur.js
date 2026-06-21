/* ================= GÉNÉRATEUR DE MENUS ADAPTÉS (fonctions pures) =================
   Construit un menu (repas + portions) qui vise une cible complète {kcal, prot, gluc,
   lip, fib}, à partir d'un pool d'aliments « faciles » et des goûts de l'utilisateur.

   Pourquoi : le plan historique fixe les portions → seuls les glucides s'ajustent, donc
   les PROTÉINES et lipides ne suivent jamais la cible (sur-livraison de protéines, cf.
   audit nutrition). Ici on résout les 3 macros à la fois.

   Principe : comme la cible vérifie kcal = 4·prot + 4·gluc + 9·lip (besoins.js), atteindre
   prot/gluc/lip atteint les kcal. On le fait par DESCENTE DE COORDONNÉES : à chaque passe on
   met à l'échelle les aliments d'un rôle pour combler l'écart de SA macro, en bornant les
   portions à des quantités mangeables. Déterministe, sans DOM, testable comme les autres moteurs.

   Dégradé gracieux : si les bornes ne permettent pas d'atteindre une cible, on renvoie le
   meilleur menu possible + une note de saturation (jamais d'échec, jamais de NaN). */

import { ALIMENTS } from './data.js';
import { kcalItem, protItem, glucItem, lipItem, fibItem } from './nutrition.js';
import { POOL_GENERATEUR, REPAS_STRUCTURE, PREP_FACILES } from './data/generateur-pool.js';

const ROLES = ['prot', 'gluc', 'lip', 'fibre'];
const MAX_PAR_ROLE = { prot: 3, gluc: 2, lip: 2, fibre: 2 };

/* macros d'une portion `q` d'un aliment (g, ou unités pour whey/banane) */
function macrosItem(cle, q){
  return { kcal: kcalItem(cle, q), prot: protItem(cle, q), gluc: glucItem(cle, q), lip: lipItem(cle, q), fib: fibItem(cle, q) };
}
/* densité de la macro du rôle, par unité de portion (1 g ou 1 unité) */
function densiteRole(e){
  const m = macrosItem(e.cle, 1);
  return e.role === 'prot' ? m.prot : e.role === 'gluc' ? m.gluc : e.role === 'lip' ? m.lip : m.fib;
}
/* capacité max d'un aliment pour sa macro de rôle (à portion max) */
function capaciteRole(e){ return densiteRole(e) * e.max; }

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function arrondir(e, q){ return clamp(Math.round(q / e.pas) * e.pas, e.min, e.max); }

/* ---- sélection des aliments par rôle (goûts + facilité + capacité suffisante) ---- */
function selectionner(pool, { aimes, evites, faciliteSeulement }){
  let dispo = pool.filter(e => ALIMENTS[e.cle]);                                   /* clé connue */
  if(faciliteSeulement) dispo = dispo.filter(e => PREP_FACILES.includes(e.prep));
  if(evites && evites.size) dispo = dispo.filter(e => !evites.has(e.cle));

  const choisis = {}; const notes = [];
  ROLES.forEach(role => {
    let cand = dispo.filter(e => e.role === role);
    if(!cand.length){                                                              /* tout filtré (évités) → repli sur le pool brut */
      cand = pool.filter(e => e.role === role && ALIMENTS[e.cle]);
      if(cand.length) notes.push(`Rôle « ${role} » indisponible avec tes filtres : repli sur le pool.`);
    }
    /* `aimes` = PRÉFÉRENCE (pas un filtre dur) : aliments aimés d'abord, le reste en repli
       pour garantir d'atteindre la cible même si peu d'aliments sont aimés. */
    const aime = e => aimes.has(e.cle);
    cand = [...cand.filter(aime), ...cand.filter(e => !aime(e))];
    choisis[role] = cand.slice(0, MAX_PAR_ROLE[role]);
    /* repli pour la capacité : aimés restants d'abord, puis le reste trié par densité */
    const reste = cand.slice(MAX_PAR_ROLE[role]);
    choisis[role]._reste = [...reste.filter(aime), ...reste.filter(e => !aime(e)).sort((a, b) => densiteRole(b) - densiteRole(a))];
  });
  return { choisis, notes };
}

/* garantit assez de capacité pour la cible d'une macro en ajoutant des aliments denses du rôle */
function assurerCapacite(foods, cible){
  let cap = foods.reduce((a, e) => a + capaciteRole(e), 0);
  while(cap < cible && foods._reste && foods._reste.length){
    const e = foods._reste.shift();
    foods.push(e); cap += capaciteRole(e);
  }
  return cap;
}

function totalMacros(portions){
  const t = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  for(const cle in portions){ const m = macrosItem(cle, portions[cle]); for(const k in t) t[k] += m[k]; }
  return t;
}

/* met à l'échelle les aliments d'un rôle pour combler l'écart sur `macro` (puis borne/arrondit) */
function ajusterRole(foods, portions, macro, cible){
  const contrib = foods.reduce((a, e) => a + macrosItem(e.cle, portions[e.cle])[macro], 0);
  if(contrib <= 0) return;
  const total = Object.keys(portions).reduce((a, cle) => a + macrosItem(cle, portions[cle])[macro], 0);
  const facteur = (contrib + (cible - total)) / contrib;
  foods.forEach(e => { portions[e.cle] = arrondir(e, portions[e.cle] * facteur); });
}

/* ================= API ================= */
/* genererMenu(cibles, options) → { repas[], macros, cibles, ecarts, notes, saturations }
   cibles  : { kcal, prot, gluc, lip, fib }
   options : { aimes:string[], evites:string[], faciliteSeulement:bool, pool? } */
export function genererMenu(cibles, options = {}){
  const pool = options.pool || POOL_GENERATEUR;
  const aimes = new Set(options.aimes || []);
  const evites = new Set(options.evites || []);
  const { choisis, notes } = selectionner(pool, { aimes, evites, faciliteSeulement: !!options.faciliteSeulement });

  /* capacité suffisante pour prot/gluc/lip (fibre = bonus, pas de garantie) */
  assurerCapacite(choisis.prot, cibles.prot);
  assurerCapacite(choisis.gluc, cibles.gluc);
  assurerCapacite(choisis.lip, cibles.lip);

  const tous = [...choisis.prot, ...choisis.gluc, ...choisis.lip, ...choisis.fibre];
  const portions = {};
  tous.forEach(e => { portions[e.cle] = arrondir(e, e.base); });

  /* descente de coordonnées : prot → lip → gluc, plusieurs passes, puis un coup de fibre */
  for(let i = 0; i < 40; i++){
    ajusterRole(choisis.prot, portions, 'prot', cibles.prot);
    ajusterRole(choisis.lip,  portions, 'lip',  cibles.lip);
    ajusterRole(choisis.gluc, portions, 'gluc', cibles.gluc);
  }
  if(cibles.fib > 0) ajusterRole(choisis.fibre, portions, 'fib', cibles.fib);
  /* re-stabilise les 3 macros après l'ajout de fibres */
  for(let i = 0; i < 8; i++){
    ajusterRole(choisis.prot, portions, 'prot', cibles.prot);
    ajusterRole(choisis.lip,  portions, 'lip',  cibles.lip);
    ajusterRole(choisis.gluc, portions, 'gluc', cibles.gluc);
  }

  /* répartition dans les repas : chaque aliment va dans le slot le moins rempli parmi ses slots */
  const repas = REPAS_STRUCTURE.map(r => ({ id: r.id, nom: r.nom, items: [] }));
  const repasParId = Object.fromEntries(repas.map(r => [r.id, r]));
  tous.forEach(e => {
    const q = portions[e.cle];
    if(!(q > 0)) return;                                   /* portion nulle (aliment optionnel) → omis */
    const slots = (e.slots || []).filter(s => repasParId[s]);
    const cible = slots.length
      ? slots.map(s => repasParId[s]).sort((a, b) => a.items.length - b.items.length)[0]
      : repas[0];
    cible.items.push([e.cle, q]);
  });
  const repasNonVides = repas.filter(r => r.items.length);

  /* bilan : macros atteintes, écarts, saturations */
  const macros = totalMacros(portions);
  ['kcal', 'prot', 'gluc', 'lip', 'fib'].forEach(k => macros[k] = Math.round(macros[k]));
  const ecarts = {
    kcal: macros.kcal - Math.round(cibles.kcal), prot: macros.prot - Math.round(cibles.prot),
    gluc: macros.gluc - Math.round(cibles.gluc), lip: macros.lip - Math.round(cibles.lip),
    fib: macros.fib - Math.round(cibles.fib || 0),
  };
  const saturations = [];
  const seuil = (cle, ref) => ref > 0 && Math.abs(ecarts[cle]) / ref > 0.1;          /* > 10 % d'écart */
  if(seuil('prot', cibles.prot)) saturations.push('protéines');
  if(seuil('gluc', cibles.gluc)) saturations.push('glucides');
  if(seuil('lip', cibles.lip)) saturations.push('lipides');
  if(cibles.fib > 0 && ecarts.fib < -Math.max(3, cibles.fib * 0.15)) saturations.push('fibres');

  return { repas: repasNonVides, macros, cibles, ecarts, notes, saturations };
}
