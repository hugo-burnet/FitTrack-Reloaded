/* ================= ANALYSE DE CYCLES (fonctions pures, V4-F3) =================
   Livrable §E.3 du brief : détecter la périodisation RÉELLE à partir de la charge hebdo
   (tonnage). On segmente les semaines en blocs :

     - 'accumulation' : la charge monte (semaine ≥ +5 % vs la précédente) ;
     - 'deload'       : chute marquée (≤ 70 % du pic récent) — semaine d'allègement ;
     - 'maintien'     : ni l'un ni l'autre (charge stable).

   On en tire la phase courante, l'ancienneté du dernier deload et le nombre de cycles
   accumulation→deload terminés. Pur et sans DOM ; s'appuie sur charge.chargesHebdo. */

import { aujourdHui } from './utils.js';
import { chargesHebdo } from './charge.js';

export const SEUIL_HAUSSE = 1.05;   /* +5 % vs semaine précédente → accumulation */
export const SEUIL_DELOAD = 0.70;   /* ≤ 70 % du pic récent → deload */

/* phase de chaque semaine (tableau aligné sur `hebdo`), selon la charge des semaines passées.
   Première semaine = 'demarrage'. Le pic récent = max des 3 semaines précédentes. */
export function phasesHebdo(hebdo){
  const ch = hebdo.map(w => w.charge);
  return ch.map((c, i) => {
    if(i === 0) return 'demarrage';
    const pic = Math.max(...ch.slice(Math.max(0, i - 3), i));   /* pic des 3 semaines d'avant */
    if(pic > 0 && c <= SEUIL_DELOAD * pic) return 'deload';
    if(c >= SEUIL_HAUSSE * ch[i - 1]) return 'accumulation';
    return 'maintien';
  });
}

/* compresse une suite de phases hebdo en blocs consécutifs de même phase */
export function compresserBlocs(hebdo, phases){
  const blocs = [];
  phases.forEach((p, i) => {
    const dernier = blocs[blocs.length - 1];
    if(dernier && dernier.type === p){
      dernier.fin = hebdo[i].finSemaine; dernier.nbSemaines++;
    } else {
      blocs.push({ type: p, debut: hebdo[i].finSemaine, fin: hebdo[i].finSemaine, nbSemaines: 1 });
    }
  });
  return blocs;
}

/* analyse de cycles sur les `nbSemaines` dernières semaines (par défaut 12).
   Renvoie { hebdo, phases, blocs, phaseActuelle, semainesDansPhase, semainesDepuisDeload, nbCycles }.
   Ignore les semaines de tête sans charge (avant la 1re séance) pour ne pas fausser les blocs. */
export function analyserCycles(seances, refISO = aujourdHui(), nbSemaines = 12){
  let hebdo = chargesHebdo(seances, refISO, nbSemaines);
  /* retire les semaines vides EN TÊTE (avant tout entraînement) ; garde les creux internes */
  const premier = hebdo.findIndex(w => w.charge > 0);
  hebdo = premier < 0 ? [] : hebdo.slice(premier);
  if(!hebdo.length){
    return { hebdo: [], phases: [], blocs: [], phaseActuelle: 'inconnue', semainesDansPhase: 0, semainesDepuisDeload: null, nbCycles: 0 };
  }
  const phases = phasesHebdo(hebdo);
  const blocs = compresserBlocs(hebdo, phases);
  const dernier = blocs[blocs.length - 1];
  /* semaines écoulées depuis le DÉBUT du dernier deload (null si aucun deload sur la fenêtre) */
  let semainesDepuisDeload = null;
  for(let i = phases.length - 1; i >= 0; i--){
    if(phases[i] === 'deload'){ semainesDepuisDeload = phases.length - 1 - i; break; }
  }
  /* un cycle = un bloc d'accumulation suivi (plus tard) d'un deload */
  let nbCycles = 0, accuVue = false;
  phases.forEach(p => {
    if(p === 'accumulation') accuVue = true;
    else if(p === 'deload' && accuVue){ nbCycles++; accuVue = false; }
  });
  return {
    hebdo, phases, blocs,
    phaseActuelle: dernier.type,
    semainesDansPhase: dernier.nbSemaines,
    semainesDepuisDeload, nbCycles,
  };
}
