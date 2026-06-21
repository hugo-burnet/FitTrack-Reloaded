/* ================= RÉCUPÉRATION & READINESS (fonctions pures, V4-F1) =================
   Comble l'angle mort « récupération » de l'app (cf. audit/phase-4 §C/§F1). Trois scores
   composites 0-100, lisibles et bornés, avec dégradé de confiance (« indicatif » tant que
   les entrées manquent — jamais de blocage), dans la lignée de scores.js :

     - Readiness (prospectif)   : « peux-tu y aller fort AUJOURD'HUI ? » — sommeil, courbatures,
                                   forme (TSB), ACWR, délai depuis la dernière sollicitation.
     - Recovery  (rétrospectif) : « es-tu récupéré ? » — sommeil, courbatures, délai depuis la
                                   dernière séance, fatigue installée (ATL).
     - Progression              : « progresses-tu vraiment ? » — % d'exos en hausse, PR récents,
                                   tendance de volume (réutilise bilanForce / e1RM).

   Modèle Fitness-Fatigue (Banister) : on RÉUTILISE les EWMA de charge.js — fitness = charge
   chronique (lente τ28), fatigue = charge aiguë (rapide τ7), forme/TSB = fitness − fatigue.
   Forme > 0 = fraîcheur/peaking ; forme très négatif = surmenage.

   Charge interne sRPE (Foster) = RPE_séance × durée(min) : exposée ici (chargeInterneSeance),
   captée en option sur la séance ; affinera la charge en F2. La charge ACWR reste externe (F0).

   Pur et sans DOM (testable comme stats/xp/charge/scores). */

import { jourLocal, aujourdHui } from './utils.js';
import { pilotageCharge, chargesHebdo, semainesMontantes, ACWR_BAS, ACWR_HAUT, ACWR_RISQUE } from './charge.js';
import { bilanForce } from './bilan.js';
import { meilleurE1rm } from './progression.js';
import { detecterDeload } from './scores.js';
import { xpSeance } from './xp.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ddmm = iso => new Date(iso + 'T12:00:00');
function ajouterJours(iso, n){ const d = ddmm(iso); d.setDate(d.getDate() + n); return jourLocal(d); }
function joursEntre(aISO, bISO){ return Math.round((ddmm(bISO) - ddmm(aISO)) / 86400000); }

/* charge interne d'une séance (Foster sRPE = RPE × durée min) ; null si effort non capté */
export function chargeInterneSeance(s){
  if(!s || typeof s.rpe !== 'number' || typeof s.duree !== 'number' || s.duree <= 0) return null;
  return s.rpe * s.duree;
}

/* ---- modèle Fitness-Fatigue (Banister), dérivé des EWMA de charge.js ----
   fitness = chronique (capacité installée) · fatigue = aiguë (récente) · forme = fitness − fatigue. */
export function fitnessFatigue(seances, refISO = aujourdHui()){
  const p = pilotageCharge(seances, refISO);
  return { fitness: p.chronique, fatigue: p.aigue, forme: p.chronique - p.aigue };
}

/* ================= NOTES ÉLÉMENTAIRES (0-1, null si entrée absente) =================
   Heuristiques calibrées sur des repères de prépa physique ; chacune monotone et bornée. */

/* sommeil : 4 h → 0, 8 h → 1 (linéaire borné) */
export function noteSommeil(h){ return (typeof h === 'number') ? clamp((h - 4) / 4) : null; }
/* courbatures 0-10 : 0 → 1, 10 → 0 */
export function noteCourbatures(c){ return (typeof c === 'number') ? clamp((10 - c) / 10) : null; }
/* forme (TSB) relative à la condition : forme nulle → 0,5 ; ±25 % de la condition → 1 / 0 */
export function noteForme(forme, fitness){
  if(typeof forme !== 'number' || !(fitness > 0)) return null;
  return clamp(0.5 + 2 * (forme / fitness));
}
/* ACWR vu côté « peux-tu pousser » : zone basse/optimale → 1, limite → 0,6, risque → 0,2 */
export function noteAcwrReadiness(acwr){
  if(typeof acwr !== 'number') return null;
  if(acwr > ACWR_RISQUE) return 0.2;
  if(acwr > ACWR_HAUT) return 0.6;
  return 1;
}
/* délai (jours) depuis la dernière sollicitation : plus c'est loin, plus on est frais */
export function noteDelai(j){
  if(typeof j !== 'number' || j < 0) return null;
  return clamp(0.35 + 0.22 * j);   /* 0 j → 0,35 · 1 → 0,57 · 2 → 0,79 · ≥3 → 1 */
}
/* fatigue installée (ATL) relative à la condition : ratio 0,7 → 1 (frais), 1,5 → 0 (chargé) */
export function noteFatigue(fatigue, fitness){
  if(typeof fatigue !== 'number' || !(fitness > 0)) return null;
  return clamp(1 - (fatigue / fitness - 0.7) / 0.8);
}

/* combine des parts [valeur0-1, poids] en ignorant les null ; renormalise sur les présentes */
function combiner(parts){
  const ok = parts.filter(p => p && p[0] != null);
  if(!ok.length) return null;
  const poids = ok.reduce((a, [, w]) => a + w, 0);
  return { val: ok.reduce((a, [v, w]) => a + v * w, 0) / poids, nb: ok.length };
}

/* ================= SCORE READINESS (prospectif) =================
   Entrées brutes (toutes optionnelles) : sommeil(h), courbatures(0-10), forme & fitness (TSB),
   acwr, delaiSollicitation(j). Sortie 0-100 + feu (vert/orange/rouge) + reco + confiance. */
export function scoreReadiness({ sommeil = null, courbatures = null, forme = null, fitness = null, acwr = null, delaiSollicitation = null } = {}){
  const c = combiner([
    [noteSommeil(sommeil), 0.30],
    [noteCourbatures(courbatures), 0.25],
    [noteForme(forme, fitness), 0.20],
    [noteAcwrReadiness(acwr), 0.15],
    [noteDelai(delaiSollicitation), 0.10],
  ]);
  if(!c) return { score: null, feu: 'inconnu', reco: 'Renseigne ton sommeil et tes courbatures pour estimer ta forme du jour.', confiance: 'indisponible' };
  const score = Math.round(100 * c.val);
  /* feu : vert ≥ 70 (vas-y), orange 45-69 (allège), rouge < 45 (repos/technique) */
  const feu = score >= 70 ? 'vert' : score >= 45 ? 'orange' : 'rouge';
  const reco = feu === 'vert' ? 'Feu vert : tu peux viser une séance solide, voire pousser un peu.'
             : feu === 'orange' ? 'Allège : garde du volume mais baisse l\'intensité (1-2 reps en réserve de plus).'
             : 'Lève le pied : récup, technique ou repos plutôt qu\'une séance lourde.';
  /* fiable si sommeil + courbatures + (forme OU acwr) sont présents */
  const base = noteSommeil(sommeil) != null && noteCourbatures(courbatures) != null;
  const confiance = base && c.nb >= 3 ? 'fiable' : 'indicatif';
  return { score, feu, reco, confiance };
}

/* ================= SCORE RECOVERY (rétrospectif) =================
   Es-tu récupéré ? sommeil(h), courbatures(0-10), delaiDerniereSeance(j), fatigue & fitness (ATL). */
export function scoreRecovery({ sommeil = null, courbatures = null, delaiDerniereSeance = null, fatigue = null, fitness = null } = {}){
  const c = combiner([
    [noteSommeil(sommeil), 0.35],
    [noteCourbatures(courbatures), 0.30],
    [noteDelai(delaiDerniereSeance), 0.20],
    [noteFatigue(fatigue, fitness), 0.15],
  ]);
  if(!c) return { score: null, niveau: 'inconnu', confiance: 'indisponible' };
  const score = Math.round(100 * c.val);
  const niveau = score >= 70 ? 'récupéré' : score >= 45 ? 'partiel' : 'fatigué';
  const base = noteSommeil(sommeil) != null && noteCourbatures(courbatures) != null;
  const confiance = base && c.nb >= 3 ? 'fiable' : 'indicatif';
  return { score, niveau, confiance };
}

/* ================= PROGRESSION =================
   Tendances par exercice sur une fenêtre : % en hausse (bilanForce), fréquence de PR e1RM,
   tendance de volume (séances récentes vs précédentes). Pivot de la détection de stagnation. */

/* nombre de PR e1RM (nouveau record) sur la fenêtre, et nb de séances de la fenêtre */
function prRecents(seances, cutoff){
  const recordParExo = {}; let prs = 0;
  const tri = (seances || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const sFenetre = new Set();
  tri.forEach(s => {
    if(!Array.isArray(s.exercices)) return;
    if(s.date >= cutoff) sFenetre.add(s.date + '|' + s.jourId);
    s.exercices.forEach(ex => {
      const e1 = meilleurE1rm(ex.series);
      if(e1 == null) return;
      const rec = recordParExo[ex.nom];
      if(rec == null || e1 > rec + 0.1){
        recordParExo[ex.nom] = e1;
        if(rec != null && s.date >= cutoff) prs++;   /* PR = dépasse l'ancien record, dans la fenêtre */
      }
    });
  });
  return { prs, nbSeances: sFenetre.size };
}

/* tendance de volume : tonnage moyen/séance de la 2e moitié vs 1re moitié de la fenêtre.
   > +5 % → hausse(1), < −5 % → baisse(0), sinon plat(0,5). null si trop peu de séances. */
function tendanceVolume(seances, cutoff){
  const f = (seances || []).filter(s => s.date >= cutoff && Array.isArray(s.exercices))
                           .sort((a, b) => a.date.localeCompare(b.date));
  if(f.length < 4) return null;
  const mid = Math.floor(f.length / 2);
  const moy = arr => arr.reduce((a, s) => a + xpSeance(s.exercices), 0) / arr.length;
  const v1 = moy(f.slice(0, mid)), v2 = moy(f.slice(mid));
  if(!(v1 > 0)) return null;
  const d = (v2 - v1) / v1;
  return d > 0.05 ? 1 : d < -0.05 ? 0 : 0.5;
}

export function scoreProgression(seances, refISO = aujourdHui(), fenetreJours = 42){
  const cutoff = ajouterJours(refISO, -(fenetreJours - 1));
  const bf = bilanForce(seances, cutoff);
  const { prs, nbSeances } = prRecents(seances, cutoff);
  const tv = tendanceVolume(seances, cutoff);

  const ratioHausse = bf.total > 0 ? (bf.hausse - bf.declin / 2) / bf.total : null;   /* déclin compte en négatif (×½) */
  const tauxPR = nbSeances > 0 ? clamp(prs / nbSeances) : null;                        /* ~1 PR/séance → plafond */

  const c = combiner([
    [ratioHausse != null ? clamp(ratioHausse) : null, 0.45],
    [tauxPR, 0.30],
    [tv, 0.25],
  ]);
  if(!c) return { score: null, niveau: 'inconnu', confiance: 'indisponible', total: bf.total, prs, nbSeances };
  const score = Math.round(100 * c.val);
  const niveau = score >= 60 ? 'progresse' : score >= 35 ? 'stagne' : 'régresse';
  const confiance = (bf.total >= 3 && nbSeances >= 4) ? 'fiable' : 'indicatif';
  return { score, niveau, confiance, total: bf.total, hausse: bf.hausse, declin: bf.declin, prs, nbSeances };
}

/* ================= RECO DE CHARGE CONTEXTUALISÉE (D.4) =================
   Tempère la recommandation de progression (progression.recommander) selon le feu
   readiness du jour : on ne suggère JAMAIS de monter la charge un jour « rouge », et on
   invite à la prudence un jour « orange ». Pur : prend la reco + le feu, renvoie une reco
   enrichie (`noteReadiness`, `tempere`) sans perdre l'info d'origine (cible, message). */
export function recoContextuelle(reco, feu){
  if(!reco) return reco;
  const base = { ...reco, tempere: false, noteReadiness: null };
  if(feu === 'rouge'){
    if(reco.statut === 'monter')
      return { ...base, tempere: true, ton: 'neutre',
        noteReadiness: 'Jour rouge (forme basse) : ne monte pas la charge aujourd\'hui. Refais la même charge proprement (ou technique/récup) — tu prendras le palier un jour vert.' };
    return { ...base, noteReadiness: 'Jour rouge : garde de la réserve, privilégie la qualité d\'exécution.' };
  }
  if(feu === 'orange' && reco.statut === 'monter')
    return { ...base, tempere: true,
      noteReadiness: 'Jour orange : si tu montes, garde 1-2 reps en réserve et valide la technique avant de confirmer le palier.' };
  if(feu === 'vert' && reco.statut === 'monter')
    return { ...base, noteReadiness: 'Jour vert : c\'est le bon moment pour tenter le palier.' };
  return base;
}

/* ================= ORCHESTRATEURS (lisent l'état, restent purs) =================
   Extraient les entrées des collections d'état et appellent les scorers. Le DOM appelle ceux-ci. */

/* dernier état du jour renseigné à la date `refISO` (ou le plus récent avant) */
export function etatJourPour(etatsJour, refISO = aujourdHui()){
  const candidats = (etatsJour || []).filter(e => e && e.date && e.date <= refISO).sort((a, b) => a.date.localeCompare(b.date));
  return candidats.length ? candidats[candidats.length - 1] : null;
}

/* délai (jours) depuis la dernière séance ≤ refISO ; null si aucune */
export function delaiDerniereSeance(seances, refISO = aujourdHui()){
  const dates = (seances || []).filter(s => s && s.date && s.date <= refISO).map(s => s.date).sort();
  return dates.length ? joursEntre(dates[dates.length - 1], refISO) : null;
}

/* readiness du jour à partir de l'état complet (sommeil/courbatures du jour, charge, ACWR) */
export function readinessDuJour(etat, refISO = aujourdHui()){
  const ej = etatJourPour(etat && etat.etatsJour, refISO);
  const seances = etat && etat.seances;
  const ff = fitnessFatigue(seances, refISO);
  const p = pilotageCharge(seances, refISO);
  /* on n'utilise l'état du jour que s'il date d'aujourd'hui (sinon courbatures/sommeil périmés) */
  const frais = ej && ej.date === refISO ? ej : {};
  return scoreReadiness({
    sommeil: frais.sommeil ?? null,
    courbatures: frais.courbatures ?? null,
    forme: ff.forme, fitness: ff.fitness,
    acwr: p.acwr,
    delaiSollicitation: delaiDerniereSeance(seances, refISO),
  });
}

/* deload du jour : assemble les signaux (charge montante, forme/ACWR, progression) et
   délègue au détecteur pur. `progression` = sortie de scoreProgression (réutilisée par l'UI
   pour ne pas recalculer). Renvoie {actif, ...} façon alerte. */
export function deloadDuJour(etat, refISO = aujourdHui(), progression = null){
  const seances = etat && etat.seances;
  const ff = fitnessFatigue(seances, refISO);
  const p = pilotageCharge(seances, refISO);
  const hebdo = chargesHebdo(seances, refISO, 4);
  const prog = progression || scoreProgression(seances, refISO);
  return detecterDeload({
    semainesMontantes: semainesMontantes(hebdo),
    forme: ff.forme, fitness: ff.fitness, acwr: p.acwr,
    niveauProgression: prog && prog.niveau,
    chargeHebdoActuelle: hebdo.length ? hebdo[hebdo.length - 1].charge : null,
  });
}

/* recovery du jour à partir de l'état complet */
export function recoveryDuJour(etat, refISO = aujourdHui()){
  const ej = etatJourPour(etat && etat.etatsJour, refISO);
  const seances = etat && etat.seances;
  const ff = fitnessFatigue(seances, refISO);
  const frais = ej && ej.date === refISO ? ej : {};
  return scoreRecovery({
    sommeil: frais.sommeil ?? null,
    courbatures: frais.courbatures ?? null,
    delaiDerniereSeance: delaiDerniereSeance(seances, refISO),
    fatigue: ff.fatigue, fitness: ff.fitness,
  });
}
