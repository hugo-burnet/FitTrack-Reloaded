import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chargeSeance, chargesParJour, zoneAcwr, monotonieStrain, serieCharge, pilotageCharge,
  chargesHebdo, semainesMontantes,
  ACWR_BAS, ACWR_HAUT, ACWR_RISQUE,
} from '../js/charge.js';

/* helper : date ISO décalée de n jours par rapport à une référence */
const REF = '2026-06-20';
function jour(n, ref = REF){ const d = new Date(ref + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
/* séance dont le tonnage (charge externe) vaut exactement `charge` */
const seance = (date, charge) => ({ date, exercices: [{ nom: 'X', series: [{ charge, reps: 1 }] }] });

test('chargeSeance : tonnage = xpSeance (unilatéral ×2)', () => {
  assert.equal(chargeSeance(seance('2026-01-01', 500)), 500);
  assert.equal(chargeSeance({ date: 'd', exercices: [{ nom: 'U', unilateral: true, series: [{ charge: 100, reps: 5 }] }] }), 1000);
  assert.equal(chargeSeance(null), 0);
});

test('chargesParJour : additionne les séances d\'un même jour', () => {
  const m = chargesParJour([seance('2026-01-01', 300), seance('2026-01-01', 200), seance('2026-01-02', 100)]);
  assert.deepEqual(m, { '2026-01-01': 500, '2026-01-02': 100 });
});

test('zoneAcwr : bornes 0,8 / 1,3 / 1,5', () => {
  assert.equal(zoneAcwr(null), 'inconnue');
  assert.equal(zoneAcwr(0.5), 'sous-charge');
  assert.equal(zoneAcwr(ACWR_BAS), 'optimale');      // 0,8 inclus dans optimale
  assert.equal(zoneAcwr(0.79), 'sous-charge');
  assert.equal(zoneAcwr(1.0), 'optimale');
  assert.equal(zoneAcwr(ACWR_HAUT), 'optimale');     // 1,3 inclus
  assert.equal(zoneAcwr(1.4), 'limite');
  assert.equal(zoneAcwr(ACWR_RISQUE), 'limite');     // 1,5 inclus
  assert.equal(zoneAcwr(1.6), 'risque');
});

test('pilotageCharge : charge stable au long cours → ACWR ≈ 1 (zone optimale)', () => {
  const seances = [];
  for(let i = 59; i >= 0; i--) seances.push(seance(jour(-i), 100));   // 100/jour pendant 60 j
  const p = pilotageCharge(seances, REF);
  assert.ok(Math.abs(p.acwr - 1) < 0.05, `ACWR attendu ≈ 1, obtenu ${p.acwr}`);
  assert.equal(p.zone, 'optimale');
  assert.equal(p.nbSeances, 7);
});

test('pilotageCharge : pic de charge récent → ACWR élevé (zone risque)', () => {
  const seances = [];
  for(let i = 40; i >= 1; i--) seances.push(seance(jour(-i), 100));   // 40 j à 100
  seances.push(seance(REF, 2000));                                     // pic le jour de réf
  const p = pilotageCharge(seances, REF);
  assert.ok(p.acwr > ACWR_RISQUE, `ACWR attendu > ${ACWR_RISQUE}, obtenu ${p.acwr}`);
  assert.equal(p.zone, 'risque');
  assert.ok(p.aigue > p.chronique);
});

test('pilotageCharge : aucune séance → tout neutre (acwr null)', () => {
  const p = pilotageCharge([], REF);
  assert.equal(p.acwr, null);
  assert.equal(p.zone, 'inconnue');
  assert.equal(p.chargeHebdo, 0);
});

test('monotonieStrain : 7 jours identiques → monotonie indéfinie ; 1 grosse séance → calcul Foster', () => {
  const stable = [];
  for(let i = 6; i >= 0; i--) stable.push(seance(jour(-i), 100));
  assert.equal(monotonieStrain(stable, REF).monotonie, null);   // écart-type nul

  const pic = [seance(REF, 700)];                                // 6 jours de repos + 1 séance
  const ms = monotonieStrain(pic, REF);
  assert.equal(ms.chargeHebdo, 700);
  assert.ok(Math.abs(ms.monotonie - 0.408) < 0.01, `monotonie ${ms.monotonie}`);
  assert.ok(Math.abs(ms.strain - 700 * ms.monotonie) < 1e-6);
});

test('serieCharge : points dans la fenêtre, dernière valeur = photo pilotage', () => {
  const seances = [];
  for(let i = 30; i >= 0; i--) seances.push(seance(jour(-i), 100));
  const s = serieCharge(seances, REF, 14);
  assert.equal(s.length, 14);
  assert.equal(s[s.length - 1].date, REF);
  assert.ok(s.every(p => 'aigue' in p && 'chronique' in p));
  // cohérence avec pilotageCharge (même EWMA finale)
  const p = pilotageCharge(seances, REF);
  assert.ok(Math.abs(s[s.length - 1].aigue - p.aigue) < 1e-9);
});

/* ---- chargesHebdo / semainesMontantes (F2 deload) ---- */
test('chargesHebdo : 4 blocs de 7 j terminant à refISO, ancienne → récente', () => {
  // une séance par semaine, tonnage croissant 100/200/300/400
  const seances = [seance(jour(-21), 100), seance(jour(-14), 200), seance(jour(-7), 300), seance(jour(0), 400)];
  const h = chargesHebdo(seances, REF, 4);
  assert.equal(h.length, 4);
  assert.deepEqual(h.map(w => w.charge), [100, 200, 300, 400]);
  assert.equal(h[3].finSemaine, REF);
});
test('chargesHebdo : jours d\'une même semaine cumulés ; semaine vide = 0', () => {
  const seances = [seance(jour(-1), 100), seance(jour(-3), 50)];   // tous dans la semaine 0
  const h = chargesHebdo(seances, REF, 4);
  assert.deepEqual(h.map(w => w.charge), [0, 0, 0, 150]);
});
test('semainesMontantes : 4 semaines croissantes → 3 hausses', () => {
  assert.equal(semainesMontantes([{charge:100},{charge:200},{charge:300},{charge:400}]), 3);
});
test('semainesMontantes : une baisse casse la série (compte depuis la fin)', () => {
  assert.equal(semainesMontantes([{charge:100},{charge:90},{charge:200},{charge:300}]), 2);
});
test('semainesMontantes : semaine à 0 casse la série', () => {
  assert.equal(semainesMontantes([{charge:100},{charge:0},{charge:300}]), 0);
});
