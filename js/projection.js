/* ================= PROJECTION DE PROGRESSION (fonctions pures, V4-F2) =================
   Comble le livrable §E.1 du brief (audit/phase-4) : rendre la progression tangible.
   On extrapole la tendance de l'e1RM d'un exercice par régression linéaire (moindres
   carrés) sur le temps, ce qui donne :

     - une PENTE en kg/semaine (vitesse de progression) ;
     - une mesure de FIABILITÉ (r² + erreur-type de la pente = variabilité, §B.6) ;
     - une ETA pour un objectif (« +5 kg ≈ 6 semaines »), encadrée d'une BANDE
       d'incertitude dérivée de l'erreur-type de la pente.

   Le temps est exprimé en SEMAINES depuis le premier point (échelle lisible des pentes).
   Pur et sans DOM (testable comme stats/progression/charge). */

import { meilleurE1rm } from './progression.js';

const ddmm = iso => new Date(iso + 'T12:00:00');
function semainesEntre(aISO, bISO){ return (ddmm(bISO) - ddmm(aISO)) / (7 * 86400000); }

/* points (date, e1rm) d'un exercice = meilleur e1RM par séance le contenant, triés par date.
   Une seule mesure par jour (la meilleure) pour ne pas surpondérer les jours à 2 séances. */
export function serieE1rm(seances, nom){
  const parJour = {};
  (seances || []).forEach(s => {
    if(!s || !Array.isArray(s.exercices) || typeof s.date !== 'string') return;
    const ex = s.exercices.find(e => e.nom === nom);
    if(!ex) return;
    const e1 = meilleurE1rm(ex.series);
    if(e1 == null) return;
    if(parJour[s.date] == null || e1 > parJour[s.date]) parJour[s.date] = e1;
  });
  return Object.keys(parJour).sort().map(date => ({ date, e1rm: parJour[date] }));
}

/* régression linéaire (moindres carrés) y = pente·x + ordonnee sur [{x,y}].
   Renvoie pente, ordonnee, r² (qualité d'ajustement) et sePente (erreur-type de la pente,
   = incertitude). null si < 2 points ou x tous identiques. */
export function regressionLineaire(points){
  const n = (points || []).length;
  if(n < 2) return null;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  points.forEach(p => { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; });
  if(sxx === 0) return null;
  const pente = sxy / sxx;
  const ordonnee = my - pente * mx;
  const sse = Math.max(0, syy - pente * sxy);          /* somme des carrés des résidus */
  const r2 = syy > 0 ? Math.max(0, 1 - sse / syy) : 1;
  /* erreur-type de la pente : sqrt( (sse/(n-2)) / sxx ) ; nulle si ajustement parfait ou n=2 */
  const sePente = n > 2 ? Math.sqrt((sse / (n - 2)) / sxx) : 0;
  return { pente, ordonnee, r2, sePente, n };
}

/* projection de l'e1RM d'un exercice : pente kg/semaine, niveau actuel ajusté, fiabilité.
   `fenetreJours` borne l'historique pris en compte (tendance récente, défaut 84 j ≈ 12 sem). */
export function projeterExercice(seances, nom, refISO = null, fenetreJours = 84){
  let pts = serieE1rm(seances, nom);
  if(refISO){
    const ddmmRef = ddmm(refISO);
    const debut = new Date(ddmmRef); debut.setDate(debut.getDate() - (fenetreJours - 1));
    pts = pts.filter(p => ddmm(p.date) >= debut && ddmm(p.date) <= ddmmRef);
  }
  if(pts.length < 2) return { fiable: false, nbPoints: pts.length, pente: null, r2: null, e1rmActuel: pts.length ? pts[pts.length - 1].e1rm : null };
  const t0 = pts[0].date;
  const reg = regressionLineaire(pts.map(p => ({ x: semainesEntre(t0, p.date), y: p.e1rm })));
  if(!reg) return { fiable: false, nbPoints: pts.length, pente: null, r2: null, e1rmActuel: pts[pts.length - 1].e1rm };
  /* niveau « actuel » = valeur ajustée au dernier point (lisse le bruit du dernier relevé) */
  const xDernier = semainesEntre(t0, pts[pts.length - 1].date);
  const e1rmAjuste = reg.ordonnee + reg.pente * xDernier;
  /* fiable : ≥ 4 points ET ajustement pas trop bruité (r² ≥ 0,3) */
  const fiable = pts.length >= 4 && reg.r2 >= 0.3;
  return {
    fiable, nbPoints: pts.length,
    pente: reg.pente, r2: reg.r2, sePente: reg.sePente,
    e1rmActuel: pts[pts.length - 1].e1rm, e1rmAjuste,
    confiance: fiable ? 'fiable' : 'indicatif',
  };
}

/* ETA (semaines) pour gagner `gainKg` d'e1RM au rythme projeté, avec bande d'incertitude.
   - pente ≤ 0 → progression nulle/négative : pas d'ETA (la projection ne « finit » pas).
   - bande : on fait varier la pente de ±sePente (bornée > 0) → fourchette de semaines.
   Renvoie { semaines, min, max, tendance } ; min/max peuvent être null (borne ouverte). */
export function etaObjectif(projection, gainKg){
  if(!projection || projection.pente == null || !(gainKg > 0)){
    return { semaines: null, min: null, max: null, tendance: projection && projection.pente <= 0 ? 'plat' : 'inconnu' };
  }
  if(projection.pente <= 0) return { semaines: null, min: null, max: null, tendance: 'plat' };
  const semaines = gainKg / projection.pente;
  const se = projection.sePente || 0;
  const penteHaute = projection.pente + se;             /* progression optimiste → ETA mini */
  const penteBasse = projection.pente - se;             /* progression pessimiste → ETA maxi */
  const min = gainKg / penteHaute;
  const max = penteBasse > 0 ? gainKg / penteBasse : null;   /* borne basse ≤ 0 → ETA non bornée */
  return { semaines, min, max, tendance: 'hausse' };
}
