/* ================= GÉNÉRATEUR & AJUSTEUR DE MENUS (fonctions pures) =================
   Deux usages, même solveur :
     - genererMenu  : bâtit un menu NEUF (depuis un pool d'aliments faciles + goûts) ;
     - ajusterMenu  : corrige EN PLACE un menu existant (rééchelonne les portions de SES
                      aliments, sans en changer la composition).

   Pourquoi : le plan historique fixe les portions → seuls les glucides s'ajustent, donc
   les PROTÉINES et lipides ne suivent jamais la cible. Ici on résout les 3 macros à la fois.

   Principe : comme la cible vérifie kcal = 4·prot + 4·gluc + 9·lip (besoins.js), atteindre
   prot/gluc/lip atteint les kcal. DESCENTE DE COORDONNÉES : à chaque passe, on met à l'échelle
   les aliments d'un rôle pour combler l'écart de SA macro, en bornant les portions à des
   quantités mangeables. Déterministe, sans DOM, testable.

   Dégradé gracieux : si les bornes ne permettent pas une cible, on renvoie le meilleur menu
   possible + une note de saturation (jamais d'échec, jamais de NaN). `aliments` injectable
   (catalogue fusionné base+perso) → fonctionne aussi avec les aliments perso. */

import { ALIMENTS } from './data.js';
import { kcalItem, protItem, glucItem, lipItem, fibItem } from './nutrition.js';
import { POOL_GENERATEUR, REPAS_STRUCTURE, PREP_FACILES } from './data/generateur-pool.js';

const ROLES = ['prot', 'gluc', 'lip', 'fibre'];
const MAX_PAR_ROLE = { prot: 3, gluc: 2, lip: 2, fibre: 2 };

/* macros d'une portion `q` d'un aliment (g, ou unités pour whey/banane) */
function macrosItem(cle, q, aliments = ALIMENTS){
  if(!aliments[cle]) return { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  return { kcal: kcalItem(cle, q, aliments), prot: protItem(cle, q, aliments), gluc: glucItem(cle, q, aliments), lip: lipItem(cle, q, aliments), fib: fibItem(cle, q, aliments) };
}
/* densité de la macro du rôle, par unité de portion (1 g ou 1 unité) */
function densiteRole(role, cle, aliments){
  const m = macrosItem(cle, 1, aliments);
  return role === 'prot' ? m.prot : role === 'gluc' ? m.gluc : role === 'lip' ? m.lip : m.fib;
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function arrondir(e, q){ return clamp(Math.round(q / e.pas) * e.pas, e.min, e.max); }

/* ---- solveur partagé : `entries` portent leur propre quantité `q` (clé non unique tolérée) ----
   roles = { prot:[entries], gluc:[…], lip:[…], fibre:[…] } ⊆ allEntries (les fixes restent hors rôles). */
function totalMacro(entries, macro, aliments){ return entries.reduce((a, e) => a + macrosItem(e.cle, e.q, aliments)[macro], 0); }
function ajusterRole(roleFoods, allEntries, macro, cible, aliments){
  const contrib = totalMacro(roleFoods, macro, aliments);
  if(contrib <= 0) return;
  const total = totalMacro(allEntries, macro, aliments);
  const f = (contrib + (cible - total)) / contrib;
  roleFoods.forEach(e => { e.q = arrondir(e, e.q * f); });
}
function resoudre(roles, allEntries, cibles, aliments){
  for(let i = 0; i < 40; i++){
    ajusterRole(roles.prot, allEntries, 'prot', cibles.prot, aliments);
    ajusterRole(roles.lip,  allEntries, 'lip',  cibles.lip,  aliments);
    ajusterRole(roles.gluc, allEntries, 'gluc', cibles.gluc, aliments);
  }
  if(cibles.fib > 0 && roles.fibre.length) ajusterRole(roles.fibre, allEntries, 'fib', cibles.fib, aliments);
  for(let i = 0; i < 8; i++){
    ajusterRole(roles.prot, allEntries, 'prot', cibles.prot, aliments);
    ajusterRole(roles.lip,  allEntries, 'lip',  cibles.lip,  aliments);
    ajusterRole(roles.gluc, allEntries, 'gluc', cibles.gluc, aliments);
  }
}

/* bilan complet + écarts + saturations (> 10 % d'écart sur une macro) */
function bilan(allEntries, cibles, aliments){
  const macros = { kcal: 0, prot: 0, gluc: 0, lip: 0, fib: 0 };
  allEntries.forEach(e => { const m = macrosItem(e.cle, e.q, aliments); for(const k in macros) macros[k] += m[k]; });
  for(const k in macros) macros[k] = Math.round(macros[k]);
  const ecarts = {
    kcal: macros.kcal - Math.round(cibles.kcal || 0), prot: macros.prot - Math.round(cibles.prot || 0),
    gluc: macros.gluc - Math.round(cibles.gluc || 0), lip: macros.lip - Math.round(cibles.lip || 0),
    fib: macros.fib - Math.round(cibles.fib || 0),
  };
  const saturations = [];
  const depasse = (cle, ref) => ref > 0 && Math.abs(ecarts[cle]) / ref > 0.1;
  if(depasse('prot', cibles.prot)) saturations.push('protéines');
  if(depasse('gluc', cibles.gluc)) saturations.push('glucides');
  if(depasse('lip', cibles.lip)) saturations.push('lipides');
  if(cibles.fib > 0 && ecarts.fib < -Math.max(3, cibles.fib * 0.15)) saturations.push('fibres');
  return { macros, ecarts, saturations };
}

/* ================= GÉNÉRATION (menu neuf depuis le pool) ================= */
function selectionner(pool, { aimes, evites, faciliteSeulement }){
  let dispo = pool.filter(e => ALIMENTS[e.cle]);
  if(faciliteSeulement) dispo = dispo.filter(e => PREP_FACILES.includes(e.prep));
  if(evites && evites.size) dispo = dispo.filter(e => !evites.has(e.cle));

  const choisis = {}; const notes = [];
  ROLES.forEach(role => {
    let cand = dispo.filter(e => e.role === role);
    if(!cand.length){
      cand = pool.filter(e => e.role === role && ALIMENTS[e.cle]);
      if(cand.length) notes.push(`Rôle « ${role} » indisponible avec tes filtres : repli sur le pool.`);
    }
    const aime = e => aimes.has(e.cle);
    cand = [...cand.filter(aime), ...cand.filter(e => !aime(e))];
    choisis[role] = cand.slice(0, MAX_PAR_ROLE[role]);
    const reste = cand.slice(MAX_PAR_ROLE[role]);
    choisis[role]._reste = [...reste.filter(aime), ...reste.filter(e => !aime(e)).sort((a, b) => densiteRole(role, b.cle, ALIMENTS) - densiteRole(role, a.cle, ALIMENTS))];
  });
  return { choisis, notes };
}
function assurerCapacite(role, foods, cible){
  let cap = foods.reduce((a, e) => a + densiteRole(role, e.cle, ALIMENTS) * e.max, 0);
  while(cap < cible && foods._reste && foods._reste.length){
    const e = foods._reste.shift(); foods.push(e); cap += densiteRole(role, e.cle, ALIMENTS) * e.max;
  }
}

/* genererMenu(cibles, options) → { repas[], macros, cibles, ecarts, notes, saturations } */
export function genererMenu(cibles, options = {}){
  const pool = options.pool || POOL_GENERATEUR;
  const aimes = new Set(options.aimes || []);
  const evites = new Set(options.evites || []);
  const { choisis, notes } = selectionner(pool, { aimes, evites, faciliteSeulement: !!options.faciliteSeulement });
  assurerCapacite('prot', choisis.prot, cibles.prot);
  assurerCapacite('gluc', choisis.gluc, cibles.gluc);
  assurerCapacite('lip',  choisis.lip,  cibles.lip);

  /* une entrée de solveur par aliment du pool sélectionné (porte sa quantité + ses bornes + ses slots) */
  const mkEntry = (e, role) => ({ cle: e.cle, role, q: arrondir(e, e.base), min: e.min, max: e.max, pas: e.pas, slots: e.slots });
  const roles = { prot: [], gluc: [], lip: [], fibre: [] };
  ROLES.forEach(role => choisis[role].forEach(e => roles[role].push(mkEntry(e, role))));
  const all = [...roles.prot, ...roles.gluc, ...roles.lip, ...roles.fibre];
  resoudre(roles, all, cibles, ALIMENTS);

  /* répartition : chaque aliment va dans le slot le moins rempli parmi ses slots */
  const repas = REPAS_STRUCTURE.map(r => ({ id: r.id, nom: r.nom, items: [] }));
  const parId = Object.fromEntries(repas.map(r => [r.id, r]));
  all.forEach(e => {
    if(!(e.q > 0)) return;
    const slots = (e.slots || []).filter(s => parId[s]);
    const cible = slots.length ? slots.map(s => parId[s]).sort((a, b) => a.items.length - b.items.length)[0] : repas[0];
    cible.items.push([e.cle, e.q]);
  });
  return { repas: repas.filter(r => r.items.length), ...bilan(all, cibles, ALIMENTS), cibles, notes };
}

/* ================= AJUSTEMENT EN PLACE (menu existant) ================= */
/* rôle d'un aliment = macro dominante en kcal (prot/gluc/lip) ; null si sans énergie (laissé fixe) */
function roleDe(cle, aliments){
  const m = macrosItem(cle, 1, aliments);
  const kp = 4 * m.prot, kg = 4 * m.gluc, kl = 9 * m.lip;
  if(kp + kg + kl <= 0) return null;
  if(kp >= kg && kp >= kl) return 'prot';
  if(kl >= kp && kl >= kg) return 'lip';
  return 'gluc';
}
/* bornes de portion : celles du pool si l'aliment y est, sinon génériques (garde l'aliment présent) */
function bornes(cle, q, aliments){
  const p = POOL_GENERATEUR.find(e => e.cle === cle);
  if(p) return { min: p.min, max: p.max, pas: p.pas };
  const unite = aliments[cle] && aliments[cle].unite !== undefined;
  const pas = unite ? 1 : 5;
  return { min: unite ? 1 : 10, max: unite ? Math.max(q * 3, 4) : Math.max(q * 3, 300), pas };
}

/* ajusterMenu(repas, cibles, aliments?) → { repas[], macros, cibles, ecarts, notes, saturations }
   Garde la composition du menu, rééchelonne seulement les portions de SES aliments. */
export function ajusterMenu(repas, cibles, aliments = ALIMENTS){
  const all = []; const roles = { prot: [], gluc: [], lip: [], fibre: [] };
  (repas || []).forEach(r => (r.items || []).forEach(([cle, q]) => {
    const role = aliments[cle] ? roleDe(cle, aliments) : null;
    if(!role){ all.push({ cle, q, fixe: true }); return; }   /* aliment sans macro ou inconnu : laissé tel quel */
    const e = { cle, role, q, ...bornes(cle, q, aliments) };
    all.push(e); roles[role].push(e);
  }));
  resoudre(roles, all, cibles, aliments);

  const out = (repas || []).map(r => ({
    id: r.id, nom: r.nom,
    items: (r.items || []).map(([cle, q0]) => {
      const e = all.find(x => x.cle === cle && !x._pris && (x.q !== undefined));
      if(e && !e.fixe){ e._pris = true; return [cle, e.q]; }
      return [cle, q0];
    }).filter(([, q]) => q > 0),
  })).filter(r => r.items.length);

  const notes = roles.prot.length && roles.gluc.length && roles.lip.length
    ? [] : ['Ce menu manque d\'une source pour un macro : ajoute un aliment puis réajuste.'];
  return { repas: out, ...bilan(all, cibles, aliments), cibles, notes };
}
