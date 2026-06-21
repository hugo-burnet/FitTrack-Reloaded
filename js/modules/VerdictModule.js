import { $, echap, ilYaJours, fmtDate, aujourdHui } from '../utils.js';
import { moyennesHebdo, rythmeMensuel, tendanceTaille, tendanceBras, brasStagne } from '../stats.js';
import { decisionVerdict, SCENARIOS, OBJECTIFS_VERDICT } from '../verdict.js';
import { protCible } from '../nutrition.js';
import { adherenceHebdo, bilanForce } from '../bilan.js';
import { pilotageCharge, serieCharge } from '../charge.js';
import { scoreRisk, scoreCompliance, alerteSurcharge, alerteSousCharge, alerteStagnation } from '../scores.js';
import { readinessDuJour, recoveryDuJour, scoreProgression, etatJourPour, deloadDuJour } from '../readiness.js';
import { volumeParGroupe } from '../volume.js';
import { optCommun } from '../charts.js';

/* ================= VERDICT : l'arbre de décision (rendu) ================= */
export class VerdictModule {
  constructor(store, app){
    this.store = store; this.app = app; this.chCharge = null;
    /* saisie de la récup du jour (V4-F1) → écrit etat.etatsJour puis re-rend */
    const save = $('recup-save');
    if(save) save.addEventListener('click', () => this.enregistrerRecup());
  }

  get etat(){ return this.store.etat; }

  /* objectif courant (sèche/recompo/masse), validé ; pilote l'arbre de décision (V3.5) */
  objectif(){
    const t = this.etat.objectif && this.etat.objectif.type;
    return OBJECTIFS_VERDICT.includes(t) ? t : 'recompo';
  }

  render(){
    const box = $('verdict-box');
    const tampon = $('verdict-tampon');
    const expl = $('verdict-expl');
    const data = $('verdict-data');
    const rythme = rythmeMensuel(this.etat.poids);
    const dTaille = tendanceTaille(this.etat.mensurations);
    const dBras = tendanceBras(this.etat.mensurations);
    const nbSem = moyennesHebdo(this.etat.poids).length;
    const objectif = this.objectif();

    const { cls, t, e } = decisionVerdict({
      rythme, dTaille, dBras, nbSem, brasStagne: brasStagne(this.etat.mensurations), objectif,
    });
    box.className = 'verdict '+cls;
    tampon.textContent = t;
    expl.textContent = e;
    let html='';
    if(rythme!==null) html += `<span>Rythme <b>${(rythme>=0?'+':'')+rythme.toFixed(2)} kg/mois</b></span>`;
    if(dTaille!==null) html += `<span>Taille <b>${(dTaille>=0?'+':'')+dTaille.toFixed(1)} cm</b></span>`;
    if(dBras!==null) html += `<span>Bras <b>${(dBras>=0?'+':'')+dBras.toFixed(1)} cm</b></span>`;
    data.innerHTML = html;

    this.renderScenarios(objectif);
    this.renderSemaine(rythme);
    this.renderReadiness();
    this.renderCharge();
    this.renderDeload();
    this.renderVolume();
  }

  /* ---- deload détecté (V4-F2) : semaine d'allègement quand charge↑ + fatigue + plateau ---- */
  renderDeload(){
    const box = $('deload-alerte'); if(!box) return;
    const d = deloadDuJour(this.etat);
    if(d.actif){
      box.className = 'verdict ' + d.cls;
      $('deload-alerte-t').textContent = d.titre;
      $('deload-alerte-e').textContent = d.e;
    } else box.className = 'verdict cache';
  }

  /* ---- volume par groupe musculaire (V4-F2) : séries/sem vs repères 10-20 ---- */
  renderVolume(){
    const el = $('volume-liste'); if(!el) return;
    const v = volumeParGroupe(this.etat.seances, aujourdHui(), 7);
    if(!v.total){ el.innerHTML = '<p class="note" style="margin:0">Aucune séance ces 7 derniers jours — entraîne-toi pour activer le suivi du volume.</p>'; return; }
    const cls = { sous: 'info', ok: 'ok', sur: 'alerte' };
    const grille = v.parGroupe.map(g =>
      `<div class="vol-ligne"><span class="vol-nom">${echap(g.groupe)}</span>`
      + `<span class="vol-val mono ${cls[g.etat] || ''}">${g.series} série${g.series > 1 ? 's' : ''}</span></div>`).join('');
    const conseils = v.ajustements.length
      ? '<ul class="vol-conseils">' + v.ajustements.map(a => `<li class="${cls[a.etat] || ''}">${echap(a.message)}</li>`).join('') + '</ul>'
      : '<p class="note" style="margin:8px 0 0;color:var(--ok)">✓ Volumes dans les repères sur les groupes principaux entraînés.</p>';
    el.innerHTML = `<div class="vol-grille">${grille}</div>${conseils}`;
  }

  /* ---- récup & readiness (V4-F1) : saisie du jour + scores Readiness/Recovery/Progression + stagnation ---- */
  renderReadiness(){
    const etat = this.etat;
    const seances = etat.seances;
    /* préremplit la saisie avec l'état du jour d'aujourd'hui (si déjà renseigné), sans écraser une frappe en cours */
    const ejAuj = etatJourPour(etat.etatsJour, aujourdHui());
    const frais = ejAuj && ejAuj.date === aujourdHui() ? ejAuj : null;
    const inS = $('recup-sommeil'), inC = $('recup-courb');
    if(inS && document.activeElement !== inS) inS.value = frais && frais.sommeil != null ? frais.sommeil : '';
    if(inC && document.activeElement !== inC) inC.value = frais && frais.courbatures != null ? frais.courbatures : '';

    const rd = readinessDuJour(etat);
    const rec = recoveryDuJour(etat);
    const prog = scoreProgression(seances);

    /* feu + reco */
    const pastille = $('rd-pastille'), lib = $('rd-libelle'), reco = $('rd-reco');
    pastille.className = 'rd-pastille' + (rd.feu && rd.feu !== 'inconnu' ? ' ' + rd.feu : '');
    const feuLib = { vert: 'Feu vert', orange: 'Allège', rouge: 'Repos / technique', inconnu: 'Forme du jour' };
    lib.textContent = rd.score == null ? 'Renseigne ton sommeil et tes courbatures pour estimer ta forme du jour.'
                                       : `${feuLib[rd.feu]} — readiness ${rd.score}/100`;
    reco.textContent = rd.score == null ? '' : rd.reco;

    /* jauges */
    const feuCls = { vert: 'vert', orange: 'orange', rouge: 'rouge' };
    $('rd-readiness').textContent = rd.score == null ? '—' : rd.score;
    const subRd = $('rd-readiness-sub');
    subRd.textContent = rd.score == null ? 'données à venir' : `${feuLib[rd.feu]}${rd.confiance === 'indicatif' ? ' · indicatif' : ''}`;
    subRd.className = 'charge-sub ' + (feuCls[rd.feu] || '');

    $('rd-recovery').textContent = rec.score == null ? '—' : rec.score;
    $('rd-recovery-sub').textContent = rec.score == null ? 'données à venir' : `${rec.niveau}${rec.confiance === 'indicatif' ? ' · indicatif' : ''}`;

    $('rd-progression').textContent = prog.score == null ? '—' : prog.score;
    const subPr = $('rd-progression-sub');
    subPr.textContent = prog.score == null ? 'données à venir' : `${prog.niveau}${prog.confiance === 'indicatif' ? ' · indicatif' : ''}`;
    subPr.className = 'charge-sub ' + (prog.niveau === 'progresse' ? 'ok' : prog.niveau === 'régresse' ? 'alerte' : '');

    /* alerte de stagnation : gate sur l'assiduité (réutilise scoreCompliance) */
    const compliance = this.complianceCourante();
    const bonneAdherence = compliance != null && compliance >= 60;
    const stag = alerteStagnation({ niveauProgression: prog.niveau, prs: prog.prs, bonneAdherence });
    const boxS = $('stagnation-alerte');
    if(stag.actif){
      boxS.className = 'verdict ' + stag.cls;
      $('stagnation-t').textContent = stag.titre;
      $('stagnation-e').textContent = stag.e;
    } else { boxS.className = 'verdict cache'; }
  }

  /* score d'assiduité courant (0-100) ou null — partagé readiness/charge */
  complianceCourante(){
    const seances = this.etat.seances;
    const p = pilotageCharge(seances);
    const prog = this.etat.programmes.find(x => x.id === this.etat.programmeActif) || this.etat.programmes[0];
    const planifiees = prog && Array.isArray(prog.jours) ? prog.jours.length : 0;
    const cutoff = ilYaJours(6);
    const { joursProt } = adherenceHebdo(this.etat.journalRepas, seances, protCible(this.etat.objectifKcal), cutoff);
    return scoreCompliance({ seancesRealisees: p.nbSeances, seancesPlanifiees: planifiees, joursProt, joursKcal: this.joursKcalCible(cutoff) }).score;
  }

  /* enregistre la récup du jour (sommeil/courbatures) dans etat.etatsJour, par date (upsert) */
  enregistrerRecup(){
    const sV = $('recup-sommeil').value, cV = $('recup-courb').value;
    const sommeil = sV === '' ? null : Math.max(0, Math.min(24, parseFloat(sV)));
    const courbatures = cV === '' ? null : Math.max(0, Math.min(10, parseInt(cV, 10)));
    const date = aujourdHui();
    if(!Array.isArray(this.etat.etatsJour)) this.etat.etatsJour = [];
    const ej = this.etat.etatsJour;
    const i = ej.findIndex(e => e.date === date);
    const entree = {
      date,
      sommeil: Number.isFinite(sommeil) ? sommeil : null,
      courbatures: Number.isFinite(courbatures) ? courbatures : null,
    };
    if(i >= 0) ej[i] = entree; else ej.push(entree);
    this.etat.etatsJour = ej.slice().sort((a, b) => a.date.localeCompare(b.date));   /* nouvelle réf → mémoïsation invalidée */
    this.store.sauver();
    this.render();
  }

  /* ---- pilotage de la charge (V4-F0) : aiguë/chronique/ACWR + scores + alerte + courbe ---- */
  renderCharge(){
    const seances = this.etat.seances;
    const p = pilotageCharge(seances);
    const f = bilanForce(seances, ilYaJours(21));

    /* scores */
    const risk = scoreRisk({ acwr: p.acwr, monotonie: p.monotonie, declinForce: f.declin, totalForce: f.total });
    const prog = this.etat.programmes.find(x => x.id === this.etat.programmeActif) || this.etat.programmes[0];
    const planifiees = prog && Array.isArray(prog.jours) ? prog.jours.length : 0;
    const cutoff = ilYaJours(6);
    const { joursProt } = adherenceHebdo(this.etat.journalRepas, seances, protCible(this.etat.objectifKcal), cutoff);
    const joursKcal = this.joursKcalCible(cutoff);
    const compliance = scoreCompliance({ seancesRealisees: p.nbSeances, seancesPlanifiees: planifiees, joursProt, joursKcal });

    /* alerte (surcharge prioritaire, sinon sous-charge) */
    const alerte = (() => {
      const a = alerteSurcharge({ acwr: p.acwr, monotonie: p.monotonie, risk: risk.score });
      if(a.actif) return a;
      return alerteSousCharge({ acwr: p.acwr });
    })();
    const boxA = $('charge-alerte');
    if(alerte.actif){
      boxA.className = 'verdict ' + alerte.cls;
      $('charge-alerte-t').textContent = alerte.titre;
      $('charge-alerte-e').textContent = alerte.e;
    } else boxA.classList.add('cache');

    /* jauges */
    const zlib = { optimale:'zone optimale', 'sous-charge':'sous-charge', limite:'à surveiller', risque:'risque élevé', inconnue:'—' };
    const zcls = { optimale:'ok', 'sous-charge':'info', limite:'warn', risque:'alerte', inconnue:'' };
    $('ch-acwr').textContent = p.acwr == null ? '—' : p.acwr.toFixed(2);
    const elZone = $('ch-zone'); elZone.textContent = zlib[p.zone] || '—';
    elZone.className = 'charge-sub ' + (zcls[p.zone] || '');
    $('ch-risk').textContent = risk.score == null ? '—' : risk.score;
    $('ch-risk-sub').textContent = risk.score == null ? 'données à venir' : `${risk.niveau}${risk.confiance === 'indicatif' ? ' · indicatif' : ''}`;
    $('ch-compliance').textContent = compliance.score == null ? '—' : compliance.score;
    $('ch-compliance-sub').textContent = compliance.score == null ? 'données à venir' : `assidu${compliance.confiance === 'indicatif' ? ' · indicatif' : ''}`;
    $('ch-detail').textContent = p.acwr == null
      ? 'Enregistre des séances pour activer le pilotage de charge.'
      : `Aiguë ${Math.round(p.aigue)} · chronique ${Math.round(p.chronique)} · charge 7 j ${Math.round(p.chargeHebdo)}${p.monotonie != null ? ` · monotonie ${p.monotonie.toFixed(1)}` : ''}`;

    this.dessinerCharge(serieCharge(seances));
  }

  /* jours (depuis cutoff) où le total kcal du journal tombe dans ±10 % de l'objectif */
  joursKcalCible(cutoff){
    const cible = this.etat.objectifKcal;
    if(!cible) return 0;
    const parJour = {};
    (this.etat.journalRepas || []).forEach(e => { if(e.date >= cutoff) parJour[e.date] = (parJour[e.date] || 0) + (e.kcal || 0); });
    return Object.values(parJour).filter(k => k >= cible * 0.9 && k <= cible * 1.1).length;
  }

  dessinerCharge(serie){
    const ctx = $('graph-charge'); if(!ctx) return;
    const labels = serie.map(p => fmtDate(p.date));
    const aigue = serie.map(p => Math.round(p.aigue));
    const chronique = serie.map(p => Math.round(p.chronique));
    if(this.chCharge){
      this.chCharge.data.labels = labels;
      this.chCharge.data.datasets[0].data = aigue;
      this.chCharge.data.datasets[1].data = chronique;
      this.chCharge.update();
    } else {
      this.chCharge = new Chart(ctx, { type:'line', data:{ labels, datasets:[
        { label:'Aiguë (7 j)', data:aigue, borderColor:'#4d7ef0', backgroundColor:'#4d7ef0', borderWidth:2.5, pointRadius:0, tension:.3 },
        { label:'Chronique (28 j)', data:chronique, borderColor:'#9aa1ab', backgroundColor:'#9aa1ab', borderWidth:2, pointRadius:0, tension:.3 },
      ]}, options: optCommun });
    }
  }

  /* cartes « scénario » adaptées à l'objectif courant + badge objectif */
  renderScenarios(objectif){
    const lib = { seche:'Sèche', recompo:'Recompo', masse:'Prise de masse' }[objectif];
    const badge = $('verdict-obj'); if(badge) badge.textContent = lib;
    const ul = $('scenarios'); if(!ul) return;
    ul.innerHTML = (SCENARIOS[objectif] || SCENARIOS.recompo).map(s =>
      `<li class="sc ${s.cls}">
        <div class="sc-cond"><span class="cond-p">${echap(s.p)}</span><span class="cond-t">${echap(s.t)}</span></div>
        <div class="sc-verdict">${echap(s.v)}</div>
      </li>`).join('');
  }

  /* ---- reads hebdo entre deux verdicts mensuels (specs 4.4) ---- */
  renderSemaine(rythme){
    /* tendance lissée : on réutilise le rythme mensuel déjà calculé */
    const tr = $('sem-trend'), trs = $('sem-trend-sub');
    if(rythme!=null){
      tr.textContent = (rythme>=0?'+':'') + rythme.toFixed(2);
      trs.textContent = rythme>0.5 ? 'kg/mois · prise' : rythme< -0.5 ? 'kg/mois · perte' : 'kg/mois · stable';
    } else { tr.textContent='—'; trs.textContent='≥ 2 sem. de pesées'; }

    /* adhérence : protéines à la cible + séances sur 7 jours glissants */
    const cutoff = ilYaJours(6);   /* aujourd'hui inclus → fenêtre de 7 jours */
    const { joursProt, nbSeances } = adherenceHebdo(
      this.etat.journalRepas, this.etat.seances, protCible(this.etat.objectifKcal), cutoff);
    const ep = $('sem-prot'); ep.textContent = `${joursProt} / 7`;
    ep.className = 'sem-val mono ' + (joursProt>=5 ? 'up bon' : joursProt>=3 ? 'flat' : 'up');
    $('sem-seances').textContent = String(nbSeances);

    /* signal de force : e1RM qui décroche sur plusieurs exercices récents (≤ 21 j) */
    const f = bilanForce(this.etat.seances, ilYaJours(21));
    const sf = $('sem-force');
    if(f.declin >= 2){
      const noms = f.exosDeclin.slice(0,3).map(echap).join(', ');
      sf.className = 'sem-force alerte';
      sf.innerHTML = `⚠ Force en baisse sur <b>${f.declin} exercices</b> (${noms}${f.exosDeclin.length>3?'…':''}) — signal précoce possible de sous-alimentation ou de récupération insuffisante. Vérifie sommeil & apport calorique avant de creuser le déficit.`;
    } else if(f.total >= 2 && f.hausse >= f.total/2){
      sf.className = 'sem-force ok';
      sf.innerHTML = `💪 Force stable ou en hausse (${f.hausse}/${f.total} exercices) — récupération OK, le déficit est soutenable.`;
    } else { sf.className='sem-force'; sf.textContent=''; }
  }
}
