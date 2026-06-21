/* ================= MOTEUR MUSCU : perf & agrégation (fonctions pures) =================
   Extrait de MuscuModule (passe hygiénique) : lecture/formatage des performances,
   préremplissage « comme la dernière fois », réordonnancement d'exercices, recap de
   séance et série de progression. Aucun accès au DOM — `seances`/`programmes` sont
   passés en paramètre. MuscuModule ne garde plus que le bind/render et la persistance. */

import { e1rm } from './stats.js';
import { meilleurE1rm, meilleureCharge, meilleurTemps, tempsSousTension } from './progression.js';
import { xpTotal, xpGagneExercice, infosNiveau, niveauPourXp } from './xp.js';

/* ---- lecture des performances ---- */

/* dernière perf notée pour un exercice (par nom), la plus récente de l'historique */
export function dernierePerf(seances, nom){
  for(let i = seances.length - 1; i >= 0; i--){
    const ex = seances[i].exercices.find(e => e.nom === nom);
    if(ex) return { date: seances[i].date, series: ex.series, unilateral: ex.unilateral };
  }
  return null;
}

/* perf de l'occurrence précédant strictement `date` (pour les deltas / recap) */
export function perfPrecedente(seances, date, nom){
  let prev = null;
  seances.forEach(s => { if(s.date < date){ const e = s.exercices.find(x => x.nom === nom); if(e) prev = e; } });
  return prev;
}

/* n dernières séances contenant cet exercice, la plus récente en premier */
export function historiqueExo(seances, nom, n = 3){
  const out = [];
  for(let i = seances.length - 1; i >= 0 && out.length < n; i--){
    const s = seances[i];
    const ex = s.exercices.find(e => e.nom === nom);
    if(ex) out.push({ date: s.date, series: ex.series, unilateral: ex.unilateral, jourNom: s.jourNom });
  }
  return out;
}

/* tous les noms d'exercices connus (programmes + séances), triés alpha (fr) */
export function tousLesExos(programmes, seances){
  const set = new Set();
  programmes.forEach(p => p.jours.forEach(j => j.exercices.forEach(e => { if(e.nom) set.add(e.nom); })));
  seances.forEach(s => s.exercices.forEach(e => set.add(e.nom)));
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

/* ---- formatage d'une perf (charges droites/variables, gainage en temps) ---- */
export function fmtPerf(series, unilateral){
  if(!series || !series.length) return '';
  const cote = unilateral ? '/côté' : '';
  /* gainage : on affiche des temps de maintien, pas des charges (« 30 s · 3/3/3 ») */
  if(series[0] && series[0].duree != null){
    const durees = series.map(s => s.duree);
    const memeDuree = durees.every(d => d === durees[0]);
    if(memeDuree){
      const d = durees[0];
      return (d != null ? d + ' s' + (cote ? ' ' + cote : '') + ' · ' : '') + series.map(s => s.reps).join('/');
    }
    return series.map(s => (s.duree != null ? s.duree + 's×' : '') + s.reps).join(' · ') + (unilateral ? ' /côté' : '');
  }
  const charges = series.map(s => s.charge);
  const memeCharge = charges.every(c => c === charges[0]);
  if(memeCharge){
    /* séries droites : forme compacte « 40 kg · 10/9/8 » */
    const c = charges[0];
    return (c != null ? c + ' kg' + cote + ' · ' : '') + series.map(s => s.reps).join('/');
  }
  /* charges variables : détail série par série « 40×10 · 38×9 · 35×8 » (la charge max ne suffit pas) */
  return series.map(s => (s.charge != null ? s.charge + '×' : '') + s.reps).join(' · ') + (unilateral ? ' /côté' : '');
}

/* ---- préremplissage « comme la dernière fois » ----
   Construit l'objet brouillon (date + blocs/unis indexés par exercice) depuis la dernière
   perf de chaque exercice du jour. Pour le gainage, le 1er champ porte le temps (s). */
export function brouillonDerniere(seances, jour, date){
  const blocs = [], unis = [];
  jour.exercices.forEach((ex, ei) => {
    const last = dernierePerf(seances, ex.nom);
    blocs[ei] = last ? last.series.map(s => ({
      charge: ex.gainage ? (s.duree != null ? String(s.duree) : '') : (s.charge != null ? String(s.charge) : ''),
      reps: s.reps != null ? String(s.reps) : '',
    })) : [];
    unis[ei] = last && last.unilateral != null ? !!last.unilateral : !!ex.unilateral;
  });
  return { date, blocs, unis };
}

/* ---- réordonnancement d'un exercice (ei ↔ ei+dir) ----
   Permute dans `exos` et, si fourni, dans les tableaux du brouillon (blocs/unis sont
   indexés par position → ils doivent suivre). Mutation en place ; renvoie true si permuté. */
export function permuterExo(exos, draft, ei, dir){
  const j = ei + dir;
  if(j < 0 || j >= exos.length) return false;
  const swap = a => { if(Array.isArray(a)){ const t = a[ei]; a[ei] = a[j]; a[j] = t; } };
  swap(exos);
  if(draft){ swap(draft.blocs); swap(draft.unis); }
  return true;
}

/* ---- recap de séance : deltas vs occurrence précédente (hausses ET baisses) + XP ----
   `seances` = historique AVANT insertion de la séance courante (date+jour exclus du
   baseline XP pour qu'une ré-édition ne double-compte pas). */
export function construireRecap(seances, date, jour, exercices){
  const lignes = exercices.map(exo => {
    const perf = fmtPerf(exo.series, exo.unilateral);   /* détail réel des séries (charges variables incluses) */
    const prev = perfPrecedente(seances, date, exo.nom);
    /* gainage : on compare le temps de maintien et le temps sous tension, pas une charge */
    if(exo.gainage){
      const tNow = meilleurTemps(exo.series), tutNow = tempsSousTension(exo.series);
      if(!prev) return { nom: exo.nom, gainage: true, statut: 'nouveau', perf };
      const tPrev = meilleurTemps(prev.series), tutPrev = tempsSousTension(prev.series);
      const dT = (tNow != null && tPrev != null) ? tNow - tPrev : null;
      let ton = 'flat';
      if(tutNow > tutPrev + 1e-9) ton = 'up'; else if(tutNow < tutPrev - 1e-9) ton = 'down';
      return { nom: exo.nom, gainage: true, statut: 'compare', perf, dT, ton };
    }
    const e1Now = meilleurE1rm(exo.series), cNow = meilleureCharge(exo.series);
    if(!prev) return { nom: exo.nom, statut: 'nouveau', perf, cNow, e1Now };
    const e1Prev = meilleurE1rm(prev.series), cPrev = meilleureCharge(prev.series);
    const dE1 = (e1Now != null && e1Prev != null) ? e1Now - e1Prev : null;
    const dC = (cNow != null && cPrev != null) ? cNow - cPrev : null;
    let ton = 'flat';
    if(dE1 != null){ if(dE1 > 0.1) ton = 'up'; else if(dE1 < -0.1) ton = 'down'; }
    return { nom: exo.nom, statut: 'compare', perf, cNow, cPrev, dC, e1Now, e1Prev, dE1, ton };
  });
  const monte = lignes.filter(l => l.ton === 'up').length;
  const baisse = lignes.filter(l => l.ton === 'down').length;
  const base = seances.filter(s => !(s.date === date && s.jourId === jour.id));
  const avant = xpTotal(base);
  let xpGagne = 0, ameliores = 0;
  exercices.forEach(exo => {
    const g = xpGagneExercice(exo, perfPrecedente(seances, date, exo.nom));
    if(g > 0){ xpGagne += g; ameliores++; }
  });
  const niv = infosNiveau(avant + xpGagne);
  const levelUp = niv.niveau - niveauPourXp(avant);
  return { date, jourNom: jour.nom, lignes, monte, baisse, xpGagne, ameliores, total: exercices.length, niv, levelUp };
}

/* ---- série de progression d'un exercice (1RM estimé Epley + volume, ou temps si gainage) ----
   Renvoie les points triés par date avec leur tendance (vs point précédent) ; le module
   ne fait plus que dessiner le graphe. */
export function serieProgression(seances, nom){
  const estGainage = seances.some(s => { const e = s.exercices.find(x => x.nom === nom); return e && e.series.some(se => se.duree != null); });
  const pts = [];
  seances.forEach(s => {
    const ex = s.exercices.find(e => e.nom === nom);
    if(!ex) return;
    let best = null, vol = 0;
    ex.series.forEach(se => {
      if(se.duree != null){                            /* gainage : meilleur temps + temps sous tension */
        vol += se.duree * (se.reps || 0);
        if(best == null || se.duree > best) best = se.duree;
      } else {
        vol += (se.charge || 0) * se.reps;
        const e = e1rm(se.charge, se.reps);  /* 1RM estimé = par côté pour l'unilatéral (charge d'un côté) */
        if(e != null && (best == null || e > best)) best = e;
      }
    });
    if(ex.unilateral) vol *= 2;            /* volume total = les deux côtés */
    pts.push({ date: s.date, e1rm: best, vol });
  });
  pts.sort((a, b) => a.date.localeCompare(b.date));
  /* tendance d'un point vs le précédent : la mesure monte / baisse / stable (ou indéfinie) */
  pts.forEach((p, i) => {
    if(i === 0 || p.e1rm == null || pts[i - 1].e1rm == null) p.tendance = 'none';
    else if(p.e1rm > pts[i - 1].e1rm + 0.05) p.tendance = 'up';
    else if(p.e1rm < pts[i - 1].e1rm - 0.05) p.tendance = 'down';
    else p.tendance = 'flat';
  });
  return {
    estGainage, pts,
    labelMesure: estGainage ? 'Temps max (s)' : '1RM estimé (kg)',
    labelVol: estGainage ? 'Temps sous tension (s·reps)' : 'Volume (kg·reps)',
  };
}
