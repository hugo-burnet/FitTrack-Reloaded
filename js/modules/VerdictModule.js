import { $, echap, ilYaJours, fmtDate } from '../utils.js';
import { moyennesHebdo, rythmeMensuel, tendanceTaille, tendanceBras, brasStagne } from '../stats.js';
import { decisionVerdict, SCENARIOS, OBJECTIFS_VERDICT } from '../verdict.js';
import { protCible } from '../nutrition.js';
import { adherenceHebdo, bilanForce } from '../bilan.js';
import { pilotageCharge, serieCharge } from '../charge.js';
import { scoreRisk, scoreCompliance, alerteSurcharge, alerteSousCharge } from '../scores.js';
import { optCommun } from '../charts.js';

/* ================= VERDICT : l'arbre de décision (rendu) ================= */
export class VerdictModule {
  constructor(store, app){ this.store = store; this.app = app; this.chCharge = null; }

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
    this.renderCharge();
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
