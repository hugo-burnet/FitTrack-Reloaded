/* ================= PILOTAGE DE LA CHARGE (fonctions pures, V4-F0) =================
   Comble l'angle mort « macro » de l'app : aucune charge consolidée jusqu'ici (cf.
   audit/phase-4). On dérive tout du tonnage de séance déjà calculé (xp.xpSeance) :

     - charge externe d'une séance = tonnage Σ charge×reps (unilatéral ×2, gainage =
       durée×reps×forfait) — AUCUN nouvel input, réutilise le moteur XP existant ;
     - charge aiguë / chronique = moyennes exponentielles (EWMA) à τ≈7 j / τ≈28 j
       (Williams 2017) sur la charge QUOTIDIENNE (jours de repos = 0) ;
     - ACWR = aiguë / chronique → risque de surcharge (zone optimale 0,8–1,3) ;
     - monotonie & strain de Foster sur 7 jours.

   Pur et sans DOM (testable comme stats/xp/verdict). Calcul à la demande ; léger
   (EWMA itère ~n jours bornés). */

import { jourLocal, aujourdHui } from './utils.js';
import { xpSeance } from './xp.js';

export const TAU_AIGU = 7;        /* constante de temps EWMA charge aiguë (jours) */
export const TAU_CHRONIQUE = 28;  /* constante de temps EWMA charge chronique (jours) */

/* bornes ACWR (consensus prépa physique) */
export const ACWR_BAS = 0.8;      /* sous ce seuil : sous-charge */
export const ACWR_HAUT = 1.3;     /* au-dessus : on quitte la zone optimale */
export const ACWR_RISQUE = 1.5;   /* au-dessus : risque élevé (pic de charge) */

const ddmm = iso => new Date(iso + 'T12:00:00');
function ajouterJours(iso, n){ const d = ddmm(iso); d.setDate(d.getDate() + n); return jourLocal(d); }

/* charge externe d'une séance = tonnage (réutilise xp.xpSeance) */
export function chargeSeance(s){ return s && Array.isArray(s.exercices) ? xpSeance(s.exercices) : 0; }

/* charge totale par jour (plusieurs séances le même jour s'additionnent) → { 'AAAA-MM-JJ': charge } */
export function chargesParJour(seances){
  const m = {};
  (seances || []).forEach(s => { if(s && typeof s.date === 'string') m[s.date] = (m[s.date] || 0) + chargeSeance(s); });
  return m;
}

/* zone de risque associée à un ACWR */
export function zoneAcwr(acwr){
  if(acwr == null) return 'inconnue';
  if(acwr < ACWR_BAS) return 'sous-charge';
  if(acwr <= ACWR_HAUT) return 'optimale';
  if(acwr <= ACWR_RISQUE) return 'limite';
  return 'risque';
}

/* moyenne + écart-type (population) d'un tableau */
function moyEcart(v){
  const n = v.length; if(!n) return { moy: 0, ec: 0 };
  const moy = v.reduce((a, x) => a + x, 0) / n;
  const ec = Math.sqrt(v.reduce((a, x) => a + (x - moy) ** 2, 0) / n);
  return { moy, ec };
}

/* charge des 7 derniers jours (jour de référence inclus), repos comptés 0 */
function derniers7(parJour, refISO){
  const v = [];
  for(let i = 6; i >= 0; i--) v.push(parJour[ajouterJours(refISO, -i)] || 0);
  return v;
}

/* monotonie (Foster) = moyenne / écart-type des charges quotidiennes (7 j) ;
   strain = charge hebdo × monotonie. Une charge élevée ET monotone prédit la fatigue. */
export function monotonieStrain(seances, refISO = aujourdHui()){
  const j7 = derniers7(chargesParJour(seances), refISO);
  const hebdo = j7.reduce((a, x) => a + x, 0);
  if(hebdo <= 0) return { monotonie: null, strain: null, chargeHebdo: 0 };
  const { moy, ec } = moyEcart(j7);
  const monotonie = ec > 0 ? moy / ec : null;   /* tout pareil (ec=0) → monotonie indéfinie/très haute */
  return { monotonie, strain: monotonie != null ? hebdo * monotonie : null, chargeHebdo: hebdo };
}

/* itère jour par jour de `debut` à `fin` en maintenant les EWMA aiguë/chronique.
   Amorçage à 0 ; on démarre au plus tôt entre la 1re séance et le début d'affichage
   demandé, pour laisser les EWMA converger. Renvoie la série [{date, aigue, chronique}]. */
function iterEwma(parJour, debut, fin){
  const la = 2 / (TAU_AIGU + 1), lc = 2 / (TAU_CHRONIQUE + 1);
  let a = 0, c = 0; const serie = [];
  for(let d = debut; d <= fin; d = ajouterJours(d, 1)){
    const ch = parJour[d] || 0;
    a = ch * la + a * (1 - la);
    c = ch * lc + c * (1 - lc);
    serie.push({ date: d, aigue: a, chronique: c });
    if(d === fin) break;   /* garde-fou (comparaison de chaînes ISO triables) */
  }
  return serie;
}

/* série temporelle aiguë/chronique sur les `joursAffiches` derniers jours (pour la courbe).
   Les EWMA sont amorcées avant la fenêtre affichée pour ne pas démarrer faussement bas. */
export function serieCharge(seances, refISO = aujourdHui(), joursAffiches = 84){
  const parJour = chargesParJour(seances);
  const dates = Object.keys(parJour).sort();
  if(!dates.length) return [];
  const debutAffiche = ajouterJours(refISO, -(joursAffiches - 1));
  const debut = dates[0] < debutAffiche ? dates[0] : debutAffiche;  /* amorçage avant la fenêtre si données plus anciennes */
  return iterEwma(parJour, debut, refISO).filter(p => p.date >= debutAffiche);
}

/* charge hebdomadaire sur les `nbSemaines` derniers blocs de 7 jours terminant à refISO.
   Renvoie [{finSemaine, charge}] de la plus ANCIENNE à la plus RÉCENTE (sert au deload F2). */
export function chargesHebdo(seances, refISO = aujourdHui(), nbSemaines = 4){
  const parJour = chargesParJour(seances);
  const out = [];
  for(let w = nbSemaines - 1; w >= 0; w--){
    let somme = 0;
    for(let d = 0; d < 7; d++) somme += parJour[ajouterJours(refISO, -(w * 7 + d))] || 0;
    out.push({ finSemaine: ajouterJours(refISO, -(w * 7)), charge: somme });
  }
  return out;
}

/* nb de hausses consécutives de charge hebdo terminant à la dernière semaine (montée
   d'accumulation). 4 semaines strictement croissantes → 3. Semaines à 0 cassent la série. */
export function semainesMontantes(hebdo){
  let k = 0;
  for(let i = (hebdo || []).length - 1; i > 0; i--){
    if(hebdo[i].charge > hebdo[i - 1].charge && hebdo[i - 1].charge > 0) k++;
    else break;
  }
  return k;
}

/* photo de pilotage au jour de référence : aiguë, chronique, ACWR, zone, monotonie/strain.
   acwr/zone valent null/'inconnue' tant que la charge chronique est nulle (pas d'historique). */
export function pilotageCharge(seances, refISO = aujourdHui()){
  const parJour = chargesParJour(seances);
  const dates = Object.keys(parJour).sort();
  const base = { aigue: 0, chronique: 0, acwr: null, zone: 'inconnue', monotonie: null, strain: null, chargeHebdo: 0, nbSeances: 0 };
  if(!dates.length) return base;
  const serie = iterEwma(parJour, dates[0], refISO);
  const dernier = serie[serie.length - 1] || { aigue: 0, chronique: 0 };
  const acwr = dernier.chronique > 0 ? dernier.aigue / dernier.chronique : null;
  const ms = monotonieStrain(seances, refISO);
  const nbSeances = (seances || []).filter(s => s && s.date >= ajouterJours(refISO, -6) && s.date <= refISO).length;
  return {
    aigue: dernier.aigue, chronique: dernier.chronique,
    acwr, zone: zoneAcwr(acwr),
    monotonie: ms.monotonie, strain: ms.strain, chargeHebdo: ms.chargeHebdo,
    nbSeances,
  };
}
