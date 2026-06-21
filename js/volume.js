/* ================= VOLUME PAR GROUPE MUSCULAIRE (fonctions pures, V4-F2) =================
   Livrable §D.4 : signaler les groupes sous- ou sur-sollicités face aux repères de l'hypertrophie
   (~10-20 séries de travail / semaine / groupe, consensus Schoenfeld). Les exercices n'ont pas
   de champ « groupe » (pas de changement de schéma) : on le DÉDUIT du nom par heuristique, avec
   repli 'Autre' quand on n'est pas sûr (on n'émet alors aucun conseil dessus). Pur, sans DOM. */

/* repères de volume hebdomadaire (séries de travail / groupe) */
export const REPERE_MIN = 10;
export const REPERE_MAX = 20;

/* groupes sur lesquels on conseille (repères bien établis) ; Mollets/Abdos/Autre exclus du conseil */
export const GROUPES_PRINCIPAUX = ['Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Quadriceps', 'Ischios', 'Fessiers'];

/* règles ordonnées nom → groupe ; PREMIÈRE correspondance gagne (l'ordre désambiguïse :
   « leg curl » avant « presse », « face pull » avant « tirage », « curl-up » avant « curl »…). */
const REGLES = [
  [/gainage|planche|plank|bird.?dog|curl.?up|crunch|abdo|mcgill|relev[ée] de jambe/i, 'Abdos/Gainage'],
  [/mollet|calf/i, 'Mollets'],
  [/hip thrust|fessier|glute|pont fessier/i, 'Fessiers'],
  [/leg curl|ischio|isch|roumain|rdl|leg.?curl/i, 'Ischios'],
  [/leg extension|presse|squat|fente|bulgare|quad|hack/i, 'Quadriceps'],
  [/face pull|[ée]l[ée]vation|oiseau|delto[iï]de|[ée]paule|shoulder|overhead|militaire|arnold/i, 'Épaules'],
  [/triceps|barre au front|dips|skull|extension.*poulie|kickback/i, 'Triceps'],
  [/curl|biceps/i, 'Biceps'],
  [/rowing|tirage|traction|\brow\b|\bpull\b|\bdos\b|\blat\b|pull.?over/i, 'Dos'],
  [/d[ée]velopp[ée]|chest|\bpec|couch[ée]|inclin[ée]|pompe|[ée]cart[ée]|fly|press/i, 'Pectoraux'],
];

/* groupe musculaire déduit d'un nom d'exercice (heuristique, défaut 'Autre') */
export function groupeExercice(nom){
  const n = String(nom == null ? '' : nom);
  for(const [re, g] of REGLES) if(re.test(n)) return g;
  return 'Autre';
}

const ddmm = iso => new Date(iso + 'T12:00:00');

/* état d'un volume hebdo face aux repères : 'sous' (< min) | 'ok' | 'sur' (> max) */
export function etatVolume(series){
  if(series < REPERE_MIN) return 'sous';
  if(series > REPERE_MAX) return 'sur';
  return 'ok';
}

/* volume de séries de travail par groupe sur les `fenetreJours` derniers jours (refISO inclus).
   Compte le nombre de séries (séries.length) de chaque exercice, classées par groupe.
   Renvoie { fenetre, total, parGroupe:[{groupe,series,etat}] desc, ajustements:[…] }.
   `ajustements` ne retient que les GROUPES_PRINCIPAUX réellement entraînés (séries > 0) hors zone. */
export function volumeParGroupe(seances, refISO, fenetreJours = 7){
  const ref = refISO ? ddmm(refISO) : null;
  const debut = ref ? new Date(ref) : null;
  if(debut) debut.setDate(debut.getDate() - (fenetreJours - 1));

  const parGroupe = {};
  let total = 0;
  (seances || []).forEach(s => {
    if(!s || !Array.isArray(s.exercices) || typeof s.date !== 'string') return;
    if(ref){ const d = ddmm(s.date); if(d < debut || d > ref) return; }
    s.exercices.forEach(ex => {
      const n = Array.isArray(ex.series) ? ex.series.length : 0;
      if(!n) return;
      const g = groupeExercice(ex.nom);
      parGroupe[g] = (parGroupe[g] || 0) + n;
      total += n;
    });
  });

  const liste = Object.keys(parGroupe)
    .map(groupe => ({ groupe, series: parGroupe[groupe], etat: etatVolume(parGroupe[groupe]) }))
    .sort((a, b) => b.series - a.series);

  const ajustements = liste
    .filter(x => GROUPES_PRINCIPAUX.includes(x.groupe) && x.series > 0 && x.etat !== 'ok')
    .map(x => ({ ...x,
      message: x.etat === 'sous'
        ? `${x.groupe} : ${x.series} série${x.series > 1 ? 's' : ''}/sem, sous le repère (${REPERE_MIN}-${REPERE_MAX}). Ajoute 1-2 séries hebdo si la récup suit.`
        : `${x.groupe} : ${x.series} séries/sem, au-dessus du repère (${REPERE_MIN}-${REPERE_MAX}). Souvent inutile — redistribue ce volume ou allège.` }));

  return { fenetre: fenetreJours, total, parGroupe: liste, ajustements };
}
