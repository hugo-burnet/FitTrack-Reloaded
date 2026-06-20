/* ================= MOTEUR DE VERDICT (fonction pure) =================
   L'arbre de décision, isolé du DOM pour être testable (specs 5). Désormais
   PARAMÉTRÉ PAR L'OBJECTIF (E5/V3.5) : sèche (déficit), recompo (maintien),
   masse (surplus léger). Chaque objectif a sa lecture du couple poids/taille et
   sa consigne (exprimée en kcal, avec une équivalence concrète riz/banane).

   Garde-fous communs à tous les objectifs :
     - aucun verdict sans rythme (≥ 2 semaines de pesées) ;
     - aucun ajustement avant 3 moyennes hebdo (anti-réactivité) ;
     - le tour de taille est requis : la balance seule ment.
   La branche « bras » exige 2 deltas non positifs (brasStagne), pas un seul. */

export const SEUIL_TAILLE = 0.5;   /* cm — en dessous : bruit de mesure */
export const SEM_MIN = 3;          /* moyennes hebdo requises avant un ajustement */
export const OBJECTIFS_VERDICT = ['seche', 'recompo', 'masse'];

/* ---- recompo : maintien, on chasse le gras sans perdre de muscle (arbre historique) ---- */
function verdictRecompo({ rythme, brasStagne, tailleMonte, tailleBaisse, tailleStable }){
  if(rythme > 0.5 && tailleMonte)
    return { cls:'v-baisse', t:'−150 kcal · sur le riz',
      e:'La balance monte trop vite et la taille suit : tu stockes du gras. Retire 30 g de riz cru au déjeuner. Réévalue dans 4 semaines.' };

  if(rythme < -0.5 && tailleBaisse)
    return { cls:'v-hausse', t:'+150 kcal',
      e:'Déficit trop agressif pour une recompo, et la taille baisse vite : tu risques le muscle. Ajoute 30 g de riz cru ou 1 banane. Réévalue dans 4 semaines.' };

  if(Math.abs(rythme) <= 0.5 && tailleStable && brasStagne)
    return { cls:'v-hausse', t:'+100-150 kcal · bras qui stagne',
      e:'Poids et taille stables, et le bras ne progresse plus sur les 2 derniers relevés : petit surplus, et vérifie sommeil + progression des charges au carnet.' };

  if(rythme >= 0 && rythme <= 0.3 && !tailleMonte)
    return { cls:'v-ok', t:'RAS — Continue',
      e:'Recompo sur les rails : poids maîtrisé (0 à +0,3 kg/mois), taille stable ou en baisse. Ne change rien, ni calories ni programme.' };

  return { cls:'v-neutre', t:'Zone grise — Observe',
    e:'Signal ambigu (légère variation sans confirmation de la taille) : probablement muscle + bruit de mesure. Pas d’ajustement, re-verdict au prochain relevé mensuel.' };
}

/* ---- sèche : on veut perdre du gras (≈ 0,3–1 kg/mois) en gardant le muscle ---- */
function verdictSeche({ rythme, tailleMonte, tailleBaisse }){
  if(rythme < -1.0)
    return { cls:'v-hausse', t:'+150 kcal · perte trop rapide',
      e:'Tu perds plus d’1 kg/mois : trop vite pour préserver le muscle. Ajoute ~150 kcal (30 g de riz cru ou 1 banane) pour ramener la perte vers 0,5 kg/mois. Réévalue dans 4 semaines.' };

  if(rythme <= -0.3 && !tailleMonte)
    return { cls:'v-ok', t:'RAS — Sèche sur les rails',
      e:'Perte régulière (0,3 à 1 kg/mois), taille stable ou en baisse : le gras part au bon rythme. Ne change rien — surtout pas les calories ET le programme en même temps.' };

  if(tailleBaisse)
    return { cls:'v-ok', t:'RAS — le gras part',
      e:'La balance bouge peu mais la taille baisse : tu perds du gras (et tiens le muscle). Continue, c’est exactement le but d’une sèche.' };

  if(rythme > -0.3 && !tailleBaisse)
    return { cls:'v-baisse', t:'−150 kcal · creuser le déficit',
      e:'La perte cale et la taille ne baisse pas : le déficit est trop léger. Retire ~150 kcal (30 g de riz cru au déjeuner). Réévalue dans 4 semaines.' };

  return { cls:'v-neutre', t:'Zone grise — Observe',
    e:'Signal ambigu (variation faible sans confirmation de la taille). Pas d’ajustement : re-verdict au prochain relevé mensuel.' };
}

/* ---- masse : prise lente (≈ 0,2–0,7 kg/mois) en limitant le gras ---- */
function verdictMasse({ rythme, brasStagne, tailleMonte, tailleStable }){
  if(rythme > 0.7 && tailleMonte)
    return { cls:'v-baisse', t:'−150 kcal · prise trop grasse',
      e:'Tu montes vite et la taille suit : le surplus est trop large, tu prends surtout du gras. Retire ~150 kcal (30 g de riz cru). Réévalue dans 4 semaines.' };

  if(rythme >= 0.2 && rythme <= 0.7 && !tailleMonte)
    return { cls:'v-ok', t:'RAS — Prise propre',
      e:'Prise lente (0,2 à 0,7 kg/mois) avec une taille stable : surplus bien dosé, l’essentiel va au muscle. Ne change rien.' };

  if(rythme < 0.2)
    return { cls:'v-hausse', t:'+150 kcal · prise trop lente',
      e:(brasStagne ? 'Le poids ne monte plus et le bras stagne : ' : 'Le poids ne monte pas assez : ')
        + 'ajoute ~150 kcal (30 g de riz cru ou 1 banane) et vérifie la progression des charges. Réévalue dans 4 semaines.' };

  return { cls:'v-neutre', t:'Zone grise — Observe',
    e:'Prise correcte mais taille en hausse : probablement un peu de gras. Pas d’ajustement immédiat, surveille la taille au prochain relevé.' };
}

const ARBRES = { recompo: verdictRecompo, seche: verdictSeche, masse: verdictMasse };

export function decisionVerdict({ rythme, dTaille, dBras, nbSem, brasStagne, objectif = 'recompo' }){
  if(rythme == null)
    return { cls:'v-neutre', t:'Données insuffisantes',
      e:'Entre au moins 2 semaines de pesées et 2 relevés de taille pour obtenir un verdict.' };

  if(nbSem < SEM_MIN)
    return { cls:'v-neutre', t:'Tendance provisoire',
      e:'Encore peu de recul : moins de 3 moyennes hebdomadaires. Continue de te peser — un verdict fiable arrive au 3ᵉ point, pas avant.' };

  if(dTaille == null)
    return { cls:'v-neutre', t:'Taille manquante',
      e:'Le poids seul ne suffit pas : c’est le tour de taille qui dit la vérité. Ajoute un 2ᵉ relevé mensuel.' };

  const tailleMonte  = dTaille >  SEUIL_TAILLE;
  const tailleBaisse = dTaille < -SEUIL_TAILLE;
  const tailleStable = !tailleMonte && !tailleBaisse;

  const arbre = ARBRES[objectif] || verdictRecompo;
  return arbre({ rythme, brasStagne, tailleMonte, tailleBaisse, tailleStable });
}

/* ---- descripteurs des cartes « scénario » par objectif (rendus par VerdictModule) ----
   cls : style de carte (sc-ok | sc-baisse | sc-hausse) ; p : condition poids ;
   t : condition taille/bras ; v : consigne. Cohérents avec l'arbre ci-dessus. */
export const SCENARIOS = {
  recompo: [
    { cls:'sc-ok',     p:'Poids 0 à +0,3 kg/mois', t:'taille stable ou ↓',          v:'Continue — ne change rien' },
    { cls:'sc-baisse', p:'Poids > +0,5 kg/mois',   t:'taille ↑',                    v:'−150 kcal — retire 30 g de riz cru' },
    { cls:'sc-hausse', p:'Poids < −0,5 kg/mois',   t:'taille ↓',                    v:'+150 kcal — ajoute du riz ou 1 banane' },
    { cls:'sc-hausse', p:'Poids stable',           t:'taille stable, bras stagne',  v:'+100-150 kcal' },
  ],
  seche: [
    { cls:'sc-ok',     p:'Poids −0,3 à −1 kg/mois', t:'taille stable ou ↓', v:'Continue — sèche sur les rails' },
    { cls:'sc-baisse', p:'Perte molle (> −0,3)',    t:'taille pas ↓',       v:'−150 kcal — creuse le déficit' },
    { cls:'sc-hausse', p:'Poids < −1 kg/mois',      t:'taille ↓ vite',      v:'+150 kcal — préserve le muscle' },
  ],
  masse: [
    { cls:'sc-ok',     p:'Poids +0,2 à +0,7 kg/mois', t:'taille stable', v:'Continue — prise propre' },
    { cls:'sc-baisse', p:'Poids > +0,7 kg/mois',      t:'taille ↑',      v:'−150 kcal — limite le gras' },
    { cls:'sc-hausse', p:'Poids < +0,2 kg/mois',      t:'bras stagne',   v:'+150 kcal — relance la prise' },
  ],
};
