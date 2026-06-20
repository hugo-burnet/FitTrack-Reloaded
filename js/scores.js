/* ================= SCORES COMPOSITES (fonctions pures, V4-F0) =================
   Scores 0-100 lisibles, bornés, avec dégradé de confiance (cf. audit/phase-4 §C).
   F0 livre les deux scores « pas chers » qui réutilisent l'existant :
     - Compliance (assiduité) : séances réalisées/planifiées + jours protéines/kcal à la cible ;
     - Risk (surmenage) : ACWR hors zone + monotonie/strain + déclin de force (bilanForce).
   Readiness/Recovery/Progression viendront en F1 (nécessitent sommeil/courbatures/RIR). */

import { ACWR_BAS, ACWR_HAUT, ACWR_RISQUE } from './charge.js';

const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));

/* ---- Compliance : 0-100, plus haut = plus assidu ----
   Pondération : séances 50 %, protéines 30 %, kcal 20 % (sur une fenêtre de 7 j).
   `joursKcal` peut être null (kcal non suivis) → on renormalise sur séances+prot. */
export function scoreCompliance({ seancesRealisees = 0, seancesPlanifiees = 0, joursProt = 0, joursKcal = null, fenetre = 7 }){
  const rSeances = seancesPlanifiees > 0 ? Math.min(1, seancesRealisees / seancesPlanifiees) : null;
  const rProt = fenetre > 0 ? Math.min(1, joursProt / fenetre) : null;
  const rKcal = joursKcal == null ? null : (fenetre > 0 ? Math.min(1, joursKcal / fenetre) : null);

  const parts = [];
  if(rSeances != null) parts.push([rSeances, 0.5]);
  if(rProt != null) parts.push([rProt, 0.3]);
  if(rKcal != null) parts.push([rKcal, 0.2]);
  if(!parts.length) return { score: null, confiance: 'indisponible' };

  const poids = parts.reduce((a, [, w]) => a + w, 0);
  const score = clamp(Math.round(100 * parts.reduce((a, [v, w]) => a + v * w, 0) / poids));
  /* confiance : « fiable » si les 3 composantes sont là, sinon « indicatif » */
  const confiance = parts.length >= 3 ? 'fiable' : 'indicatif';
  return { score, confiance };
}

/* ---- Risk : 0-100, plus haut = plus de risque de surmenage/blessure ----
   Additionne des pénalités bornées : ACWR hors zone, monotonie élevée, déclin de force.
   Chaque entrée manquante (null) ne pénalise pas mais baisse la confiance. */
export function scoreRisk({ acwr = null, monotonie = null, declinForce = 0, totalForce = 0 }){
  let score = 0; let signaux = 0;

  if(acwr != null){
    signaux++;
    if(acwr > ACWR_RISQUE) score += 50;
    else if(acwr > ACWR_HAUT) score += 25;
    else if(acwr < ACWR_BAS) score += 10;   /* sous-charge : risque moindre (désentraînement) */
  }
  if(monotonie != null){
    signaux++;
    if(monotonie > 2) score += 20;
    else if(monotonie > 1.5) score += 10;
  }
  if(totalForce > 0){
    signaux++;
    score += Math.round(30 * Math.min(1, declinForce / totalForce));
  }

  if(!signaux) return { score: null, niveau: 'inconnu', confiance: 'indisponible' };
  score = clamp(score);
  const niveau = score >= 60 ? 'élevé' : score >= 30 ? 'modéré' : 'faible';
  const confiance = signaux >= 3 ? 'fiable' : 'indicatif';
  return { score, niveau, confiance };
}

/* ---- Alerte de surcharge (D.1) : dérivée, testable séparément ----
   Active si ACWR > seuil de risque, OU monotonie très haute, OU Risk score élevé.
   Renvoie {actif, cls, titre, message} — cls aligné sur les classes du Verdict. */
export function alerteSurcharge({ acwr = null, monotonie = null, risk = null }){
  if(acwr != null && acwr > ACWR_RISQUE)
    return { actif: true, cls: 'v-baisse', titre: '⚠ Surcharge — allège',
      e: `Ta charge récente dépasse nettement ta condition (ACWR ${acwr.toFixed(2)} > ${ACWR_RISQUE}). Risque de surmenage/blessure : prévois une semaine d'allègement (~50-60 % du volume) plutôt qu'un nouveau pic.` };
  if(monotonie != null && monotonie > 2)
    return { actif: true, cls: 'v-baisse', titre: '⚠ Charge trop monotone',
      e: `Charge élevée et trop régulière (monotonie ${monotonie.toFixed(1)}) : introduis un vrai jour léger dans la semaine pour casser la monotonie (meilleure récupération).` };
  if(risk != null && risk >= 60)
    return { actif: true, cls: 'v-baisse', titre: '⚠ Risque de surmenage élevé',
      e: `Plusieurs signaux convergent (charge, monotonie, force). Lève le pied quelques jours et soigne le sommeil avant de repousser.` };
  return { actif: false };
}

/* ---- Alerte de sous-charge (D.3) : marge pour pousser ---- */
export function alerteSousCharge({ acwr = null }){
  if(acwr != null && acwr < ACWR_BAS && acwr > 0)
    return { actif: true, cls: 'v-hausse', titre: 'Marge pour pousser',
      e: `Ta charge récente est sous ta condition installée (ACWR ${acwr.toFixed(2)} < ${ACWR_BAS}). Si la récupération est bonne, tu peux ajouter du volume sans risque.` };
  return { actif: false };
}
