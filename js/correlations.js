/* ================= CORRÉLATIONS (fonctions pures, V4-F3) =================
   Livrable §E.4 du brief : faire émerger les leviers personnels de l'utilisateur en croisant
   ses données — nuages de points + coefficient de corrélation de Pearson, lus en clair.
   Relations construites (uniquement celles dont les entrées sont captées) :

     - sommeil ↔ courbatures (état du jour) ;
     - volume de séance ↔ 1RM estimé, par exercice (rendements) ;
     - apport kcal hebdo ↔ variation de poids (semaine suivante).

   Chaque relation est gatée par un minimum de points ; sous ce seuil, on ne l'expose pas
   (corrélation non fiable). Pur et sans DOM. */

import { aujourdHui } from './utils.js';
import { meilleurE1rm } from './progression.js';
import { moyennesHebdo } from './stats.js';

export const MIN_POINTS = 5;   /* en-deçà, une corrélation n'est pas exposée */

/* coefficient de Pearson sur [{x,y}] : { r, n }. r = null si < 3 points valides ou variance nulle. */
export function correlation(points){
  const pts = (points || []).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if(n < 3) return { r: null, n };
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  pts.forEach(p => { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; });
  if(sxx === 0 || syy === 0) return { r: null, n };
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

/* force d'une corrélation, indépendante du signe */
export function interpreter(r){
  if(r == null) return 'indéterminée';
  const a = Math.abs(r);
  if(a < 0.2) return 'négligeable';
  if(a < 0.4) return 'faible';
  if(a < 0.6) return 'modérée';
  if(a < 0.8) return 'forte';
  return 'très forte';
}

/* tonnage d'un exercice dans une séance (gainage = durée×reps ; unilatéral ×2) */
function tonnageExo(ex){
  const v = (ex.series || []).reduce((a, s) => a + (s.duree != null ? s.duree * (s.reps || 0) : (s.charge || 0) * s.reps), 0);
  return ex.unilateral ? v * 2 : v;
}

/* ---- builders : { cle, titre, xlabel, ylabel, points } ---- */

/* sommeil (h) ↔ courbatures (0-10) du même jour */
export function pairesSommeilCourbatures(etatsJour){
  const points = (etatsJour || [])
    .filter(e => e && typeof e.sommeil === 'number' && typeof e.courbatures === 'number')
    .map(e => ({ x: e.sommeil, y: e.courbatures }));
  return { cle: 'sommeil-courbatures', titre: 'Sommeil → courbatures', xlabel: 'Sommeil (h)', ylabel: 'Courbatures (0-10)', points };
}

/* volume de séance (tonnage) ↔ 1RM estimé, pour un exercice donné */
export function pairesVolumeForce(seances, nom){
  const points = [];
  (seances || []).forEach(s => {
    const ex = (s.exercices || []).find(e => e.nom === nom);
    if(!ex) return;
    const e1 = meilleurE1rm(ex.series);
    const vol = tonnageExo(ex);
    if(e1 != null && vol > 0) points.push({ x: vol, y: e1, date: s.date });
  });
  return { cle: 'volume-force', titre: `Volume → 1RM estimé (${nom})`, xlabel: 'Volume séance', ylabel: '1RM estimé (kg)', points };
}

/* apport kcal moyen d'une semaine ↔ variation de poids de la semaine SUIVANTE.
   Semaines = blocs de 7 j ancrés sur la 1re pesée (même découpage que moyennesHebdo). */
export function pairesKcalPoids(journalRepas, poids){
  const moy = moyennesHebdo(poids || []);
  if(moy.length < 2 || !(poids || []).length) return { cle: 'kcal-poids', titre: 'Apport kcal → variation de poids', xlabel: 'kcal/jour (moy. sem.)', ylabel: 'Δ poids sem. suivante (kg)', points: [] };
  const t0 = new Date(poids[0].date + 'T12:00:00').getTime();
  /* kcal moyen par semaine (index aligné sur moyennesHebdo) */
  const kcalParJourSem = {};
  (journalRepas || []).forEach(e => {
    if(!e || typeof e.date !== 'string') return;
    const i = Math.floor((new Date(e.date + 'T12:00:00').getTime() - t0) / (7 * 864e5));
    if(i < 0) return;
    (kcalParJourSem[i] = kcalParJourSem[i] || {});
    kcalParJourSem[i][e.date] = (kcalParJourSem[i][e.date] || 0) + (e.kcal || 0);
  });
  const kgParSem = {}; moy.forEach(m => { kgParSem[m.sem] = m.kg; });
  const points = [];
  moy.forEach(m => {
    const jours = kcalParJourSem[m.sem];
    const kgSuiv = kgParSem[m.sem + 1];
    if(!jours || kgSuiv == null) return;
    const vals = Object.values(jours);
    const kcalMoy = vals.reduce((a, x) => a + x, 0) / vals.length;
    if(kcalMoy > 0) points.push({ x: Math.round(kcalMoy), y: Math.round((kgSuiv - m.kg) * 100) / 100 });
  });
  return { cle: 'kcal-poids', titre: 'Apport kcal → variation de poids', xlabel: 'kcal/jour (moy. sem.)', ylabel: 'Δ poids sem. suivante (kg)', points };
}

/* phrase d'insight selon la relation, le signe et la force de r */
export function decrireCorrelation(cle, r){
  const force = interpreter(r);
  if(r == null) return 'Pas assez de données pour conclure.';
  const sens = r >= 0 ? 'positif' : 'négatif';
  if(force === 'négligeable') return 'Aucun lien net sur tes données.';
  const m = {
    'sommeil-courbatures': r < 0
      ? `Lien ${force} : plus tu dors, moins tu as de courbatures.`
      : `Lien ${force} mais ${sens} (inattendu) : tes courbatures n'augmentent pas avec moins de sommeil sur ces données.`,
    'volume-force': r > 0
      ? `Lien ${force} : tes séances à plus haut volume coïncident avec un meilleur 1RM.`
      : `Lien ${force} ${sens} : au-delà d'un point, plus de volume ne s'accompagne pas de plus de force (rendements décroissants).`,
    'kcal-poids': r > 0
      ? `Lien ${force} : plus tu manges une semaine, plus le poids monte la semaine suivante.`
      : `Lien ${force} ${sens} : la relation kcal → poids est contre-intuitive ici (revois la régularité des pesées).`,
  };
  return m[cle] || `Corrélation ${force} (${sens}).`;
}

/* ---- orchestrateur : assemble les relations exploitables (≥ MIN_POINTS) ---- */

/* exercice ayant le plus de séances chiffrées (pour la relation volume↔force) */
function exoLePlusSuivi(seances){
  const compte = {};
  (seances || []).forEach(s => (s.exercices || []).forEach(ex => {
    if(meilleurE1rm(ex.series) != null) compte[ex.nom] = (compte[ex.nom] || 0) + 1;
  }));
  let best = null, n = 0;
  Object.keys(compte).forEach(nom => { if(compte[nom] > n){ n = compte[nom]; best = nom; } });
  return best;
}

/* renvoie les relations exploitables : [{cle, titre, xlabel, ylabel, points, r, n, interpretation, insight}] */
export function correlationsDisponibles(etat, refISO = aujourdHui()){
  void refISO;   /* réservé : on pourra borner sur une fenêtre récente plus tard */
  const candidats = [pairesSommeilCourbatures(etat && etat.etatsJour)];
  const nom = exoLePlusSuivi(etat && etat.seances);
  if(nom) candidats.push(pairesVolumeForce(etat.seances, nom));
  candidats.push(pairesKcalPoids(etat && etat.journalRepas, etat && etat.poids));

  return candidats
    .filter(c => c.points.length >= MIN_POINTS)
    .map(c => {
      const { r, n } = correlation(c.points);
      return { ...c, r, n, interpretation: interpreter(r), insight: decrireCorrelation(c.cle, r) };
    })
    .filter(c => c.r != null)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));   /* plus parlante en tête */
}
