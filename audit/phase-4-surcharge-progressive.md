# PHASE 4 — Focus : Gestion de la Surcharge Progressive (PRIORITAIRE)

> Partie centrale du brief. Chaque proposition est **argumentée · justifiée · priorisée · chiffrée**.
> Échelle coût : **S** ≈ ½-1 j · **M** ≈ 2-4 j · **L** ≈ 1-2 sem (moteur pur + UI + tests).
> Priorité : **P0** (socle, débloque le reste) · **P1** (fort) · **P2** (confort) · **P3** (plus tard).
> Synchro = hors périmètre.

---

## A. Analyse de l'existant

### A.1 Comment la charge est calculée
**Il n'existe pas de notion de « charge » au sens préparation physique.** Ce qui existe :
- **Volume par exercice/séance** = `Σ charge × reps` (×2 si unilatéral ; gainage = `durée × reps × forfait`). Calculé **à la volée** dans `dessinerProgression()` et dans `xp.js` — jamais stocké, jamais agrégé au niveau séance/semaine.
- **XP** = volume gaté par la progression (0 si pas mieux que la fois précédente).
- **e1RM** (Epley plafonné à 12 reps) comme proxy d'intensité.

→ Aucune **charge de séance** (session load), aucune **charge hebdomadaire**, aucune **charge interne** (effort réel). Le volume est calculé *par exercice pour l'affichage*, pas comme métrique de pilotage globale.

### A.2 Comment la progression est suivie
- **`recommander()`** : double progression par exercice (reps dans la fourchette → +1 palier de charge quand le haut de fourchette est tenu sur **toutes** les séries ; deload si on tombe sous le bas). Solide et bien testé.
- **`statsExo()`** : niveau = nb de PR de charge ; record de charge.
- **`bilanForce()`** : compare le dernier e1RM au précédent par exercice → compte les exos en **déclin** (alerte « force en baisse » si ≥ 2) — sur fenêtre récente (≤ 21 j).
- **XP / niveaux** global + par exercice.

→ Progression **fine au niveau exercice**, mais **aucune lecture macro** (trajectoire globale, cycles, tendance de fond) et **pas de détection de stagnation** (seulement le déclin).

### A.3 Comment la récupération est prise en compte
- **Quasi rien.** Repos *intra-séance* (RestTimer + repos conseillé déduit de la fourchette de reps) et wake lock.
- **Aucune donnée inter-séances** : pas de sommeil, pas de courbatures, pas de RIR/RPE réel (le RIR est une note statique du programme), pas de délai depuis la dernière sollicitation d'un groupe musculaire.
- Le Verdict *recommande* « vérifie ton sommeil » **sans aucune donnée de sommeil**.

### A.4 Limites du modèle actuel
1. **Vision en silo par exercice** — pas d'image consolidée de la charge ni de la fatigue.
2. **Pas d'entrée de récupération** — impossible de calculer un readiness fiable.
3. **Pas de gestion de cycles / périodisation** — ni accumulation, ni deload programmé/détecté.
4. **Réactif, pas préventif** — on détecte le déclin *après coup* ; aucune anticipation de surcharge/sous-charge.
5. **Stagnation aveugle** — force plate prolongée non signalée.
6. **Pas de mesure d'effort** — sans RIR/RPE réel, la « charge interne » est inaccessible.
7. **Coût de calcul** — tout est recalculé au rendu (O(n²) sur l'XP), incompatible avec des métriques temporelles lourdes sans mémoïsation.

---

## B. Nouveaux indicateurs

> **Prérequis transversal (P0) : une `chargeSeance` stockée par séance.** On la calcule à l'enregistrement, on ne la recalcule plus. Deux niveaux :
> - **Charge externe (dispo immédiatement)** = tonnage `Σ charge×reps` (gainage/poids du corps déjà gérés dans le code). Aucun nouvel input.
> - **Charge interne (recommandée)** = **sRPE** = `RPE_séance (0-10) × durée (min)` *(méthode Foster, référence en prépa physique)*. Nécessite de capter **RPE de séance + durée** (2 champs, coût **S**). À défaut, proxy interne = `tonnage × facteur_intensité` (intensité = e1RM moyen / e1RM max récent), ou `tonnage × (1 + pénalité_RIR)`.

### B.1 Charge aiguë (acute) — **P0 · S**
Moyenne exponentielle (EWMA) de la charge sur **~7 j** (constante τ≈7). *Justif :* EWMA pondère les séances récentes plus finement qu'une somme glissante brute (Williams 2017). Représente la fatigue/forme à court terme.

### B.2 Charge chronique (chronic) — **P0 · S**
EWMA sur **~28 j** (τ≈28). *Justif :* représente la « condition » installée, la capacité de travail. Base de comparaison de l'aiguë.

### B.3 Ratio aigu/chronique (ACWR) — **P0 · S**
`ACWR = aiguë / chronique`. **Zone optimale ≈ 0,8–1,3** ; **risque élevé > 1,5** ; **sous-charge < 0,8**. *Justif :* indicateur le plus établi du risque de blessure/surmenage lié aux pics de charge. **Pierre angulaire des alertes (section D).** Coût marginal une fois B.1/B.2 en place.

### B.4 Fatigue cumulative (modèle Fitness-Fatigue) — **P1 · M**
Modèle de Banister : `Forme (CTL) = EWMA lente`, `Fatigue (ATL) = EWMA rapide`, `Form/TSB = Forme − Fatigue`. *Justif :* sépare « je suis en forme » de « je suis fatigué » ; un TSB très négatif = surmenage, très positif = désentraînement/peaking. Réutilise B.1/B.2 (mêmes EWMA, exploitées différemment).

### B.5 Stress d'entraînement (monotonie & strain de Foster) — **P1 · S**
`Monotonie = moyenne(charge quotidienne 7j) / écart-type(charge 7j)` · `Strain = charge_hebdo × monotonie`. *Justif :* une charge élevée **et** monotone (toujours pareil, sans jour léger) prédit fatigue/maladie mieux que la charge seule. Très bon marché à calculer.

### B.6 Variabilité de progression — **P2 · M**
Par exercice : pente de régression de l'e1RM + **stabilité** de cette pente (CV des deltas, ou R² de la régression). *Justif :* distingue une vraie progression d'un bruit ; alimente la détection de stagnation (D.2) et la projection (E.1).

---

## C. Nouveaux scores (0–100, lisibles, composites)

> Chaque score = combinaison pondérée et **bornée** d'indicateurs, avec **dégradé de confiance** (affiché « indicatif » tant que les données d'entrée manquent). Tous logés dans un moteur pur testable.

### C.1 Readiness Score (prospectif : « peux-tu y aller fort aujourd'hui ? ») — **P1 · M**
Entrées : sommeil récent, courbatures, TSB/fatigue (B.4), ACWR (pas trop haut), délai depuis la dernière sollicitation du groupe. Sortie : 0-100 + reco (« feu vert / allège / repos »). *Justif :* le livrable décisionnel n°1 du brief ; oriente la séance du jour. **Dépend de** la capture sommeil/courbatures (Phase 3).

### C.2 Recovery Score (rétrospectif : « es-tu récupéré ? ») — **P1 · S/M**
Entrées : dette de sommeil, courbatures, temps depuis dernière séance du groupe, ATL. *Justif :* complément du readiness, plus simple ; calculable partiellement dès qu'on a le sommeil.

### C.3 Risk Score (surmenage/blessure) — **P0/P1 · S**
Entrées : ACWR hors zone (B.3), monotonie/strain élevés (B.5), TSB très négatif (B.4), déclin de force (`bilanForce` existant). *Justif :* synthétise les signaux d'alerte en une jauge unique ; **réutilise du code existant** → faisable tôt et pas cher.

### C.4 Progression Score (progresses-tu vraiment ?) — **P1 · M**
Entrées : tendance e1RM (B.6), tendance de volume, fréquence de PR, % d'exos en hausse. *Justif :* mesure l'efficacité réelle de l'entraînement, indépendamment de l'effort fourni ; pivot de la détection de stagnation.

### C.5 Compliance Score (assiduité/adhérence) — **P0 · S**
Entrées : séances réalisées / planifiées, jours protéines à la cible, jours kcal dans la fourchette. *Justif :* les autres scores n'ont de sens que si l'adhérence est connue ; **données déjà disponibles** (séances, `journalRepas`) → très bon marché. Étend l'« adhérence hebdo » existante.

---

## D. Systèmes intelligents (alertes & recommandations)

### D.1 Alerte de surcharge — **P0 · S**
Déclencheur : `ACWR > 1,5` **ou** strain anormalement haut **ou** Risk Score élevé. Message + reco (« semaine d'allègement »). *Justif :* prévention proactive, le manque le plus criant aujourd'hui (le modèle actuel ne voit que le déclin *a posteriori*).

### D.2 Alerte de stagnation — **P1 · M**
Déclencheur : Progression Score plat sur N semaines / e1RM sans PR sur un exercice depuis X séances malgré une bonne adhérence. Reco : varier (technique, tempo, deload, changement d'exo). *Justif :* comble l'angle mort « ni déclin ni progrès ».

### D.3 Alerte de sous-charge — **P1 · S**
Déclencheur : `ACWR < 0,8` durablement + bonne récupération → « tu peux pousser ». *Justif :* la surcharge progressive, c'est aussi ne pas sous-charger.

### D.4 Recommandations automatiques — **P1/P2 · M**
- **Deload programmé/détecté** : après K semaines de charge montante + fatigue haute + progression qui plafonne → proposer une semaine à ~50-60 % de volume.
- **Ajustement de volume** par groupe musculaire (sous/sur-sollicité vs repères 10-20 séries/sem).
- **Reco de charge** déjà semi-présente (`recommander`) → l'enrichir du contexte readiness (ne pas suggérer +charge un jour « rouge »).
*Justif :* transforme les scores en actions ; relie Phase 4 ↔ le Verdict (qui devient multi-objectif).

---

## E. Nouvelles visualisations

### E.1 Projection de progression — **P1 · M**
Extrapolation de la régression e1RM/volume → **ETA d'un objectif** (« +5 kg au développé ≈ 6 semaines au rythme actuel »), avec bande d'incertitude (B.6). *Justif :* rend la progression tangible et motivante ; demandé explicitement par le brief.

### E.2 Courbes de charge — **P0/P1 · M**
Aiguë vs chronique dans le temps + **bandes de risque ACWR** (vert 0,8-1,3 / rouge > 1,5). Optionnel : courbe Fitness-Fatigue-Form (B.4). *Justif :* visualisation directe du pilotage de charge ; cœur du focus.

### E.3 Analyse des cycles — **P2 · M/L**
Détection automatique des blocs (accumulation / deload) à partir de la charge hebdo ; vue « périodisation réelle vs intentionnelle ». *Justif :* aide à structurer sur le moyen terme (mésocycles).

### E.4 Corrélations — **P2 · M**
Nuages de points : sommeil ↔ force, kcal ↔ rythme de poids, volume ↔ e1RM (rendements décroissants), adhérence ↔ progression. *Justif :* fait émerger les leviers personnels de l'utilisateur ; nécessite que les entrées (sommeil, macros) soient captées.

---

## F. Plan de mise en œuvre priorisé (résumé)

| Lot | Contenu | Priorité | Coût | Prérequis |
|---|---|---|---|---|
| **F0 — Socle charge** | `chargeSeance` stockée (externe + sRPE), aiguë/chronique/ACWR, Compliance & Risk scores, alerte surcharge, courbe de charge | **P0** | **M** (L avec UI) | capter RPE séance + durée (S) ; mémoïsation des agrégats (corrige T3) |
| **F1 — Récupération & readiness** | capter sommeil/courbatures + RIR réel ; Readiness/Recovery/Progression scores ; alertes stagnation/sous-charge ; fatigue (Fitness-Fatigue) ; monotonie/strain | **P1** | **L** | F0 ; champs de saisie (Phase 3) |
| **F2 — Recommandations & projection** | deload auto, ajustement de volume, reco contextualisée ; projection de progression ; variabilité | **P1/P2** | **M** | F0+F1 |
| **F3 — Cycles & corrélations** | analyse de cycles, corrélations | **P2** | **M/L** | données accumulées sur durée |

### Principes d'implémentation
- **Tout en moteurs purs** (`charge.js`, `readiness.js`, `scores.js`…) dans la lignée de `stats/progression/xp` → **testables** (les tests sont la force du projet).
- **Calcul à l'écriture, pas au rendu** : stocker `chargeSeance` à l'enregistrement, mémoïser les agrégats temporels (résout la dette O(n²), Phase 1 T3).
- **Dégradé gracieux** : chaque score s'affiche en « indicatif » et se fiabilise à mesure que les entrées (sommeil, RPE, macros) sont renseignées — jamais de blocage.
- **Réutiliser l'existant** : `bilanForce`, `e1rm`, le volume, l'adhérence hebdo sont déjà là → Risk/Compliance livrables tôt et à bas coût.

---

## Synthèse Phase 4

Le modèle actuel est **excellent à l'échelle micro** (double progression par exercice, XP gaté) mais **aveugle à l'échelle macro** : pas de charge consolidée, pas de récupération, pas de cycles, purement réactif. Le brief demande exactement de combler ce niveau.

**Le déblocage tient en deux gestes peu coûteux :** (1) **stocker une charge de séance** (tonnage immédiat + sRPE si on capte RPE+durée) et (2) **capter 2-3 entrées de récupération** (sommeil, courbatures, RIR réel). À partir de là, **ACWR → scores (Risk/Readiness/Recovery/Progression/Compliance) → alertes (surcharge/stagnation/sous-charge) → recommandations (deload, volume) → visualisations (charge, projection, cycles)** se construisent en cascade, en moteurs purs testables. **F0 est le lot à plus fort rendement** : il réutilise massivement le code existant et corrige au passage la dette de recalcul (T3).
