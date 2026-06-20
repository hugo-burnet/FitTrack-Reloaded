# PHASE 5 — Benchmark

> Comparaison aux meilleures pratiques de 7 domaines, puis extraction des **concepts réutilisables** pour Carnet Recompo.
> Objectif : importer des *patterns éprouvés*, pas des fonctionnalités plaquées. Chaque concept est relié à une exigence (E1-E5) ou à une phase.

---

## 1. Productivité (Todoist, Things, Notion)
**Bonnes pratiques.** Saisie ultra-rapide (capture < 2 s), langage naturel, « aujourd'hui » comme écran-roi, raccourcis/quick-add, défauts intelligents, undo systématique, zéro friction.
**Vs Carnet Recompo.** Saisie déjà légère (cochage repas, brouillon muscu) ✅. Mais **pas d'undo** (U1), pas d'écran « aujourd'hui » unifié.
**Concepts réutilisables.**
- **Undo non bloquant** (toast « Annuler ») sur toute suppression → corrige U1, infra `ui.js` déjà là (**P0 · S**).
- **Quick-add** : « comme la dernière fois » nutrition (journée type) → étend E4/Phase 3.

## 2. Quantified Self (Apple Health, Oura, Whoop, Gyroscope)
**Bonnes pratiques.** **Un score composite quotidien** comme point d'entrée (Whoop Recovery, Oura Readiness), agrégation multi-sources, tendances long terme, corrélations « ce qui influence quoi », *dégradé gracieux* quand une donnée manque.
**Vs Carnet Recompo.** Données présentes mais **non agrégées en score** ; pas de readiness ; pas de corrélations.
**Concepts réutilisables.**
- **Readiness/Recovery Score en tête d'app** (Whoop/Oura) → C.1/C.2 Phase 4 (**P1**).
- **Vue corrélations** « sommeil ↔ force », « kcal ↔ poids » → E.4 Phase 4.
- **Confidence/“indicatif”** tant que les entrées manquent → principe d'implémentation Phase 4.

## 3. Habit Tracking (Streaks, Habitica, Atomic-Habits apps)
**Bonnes pratiques.** **Streaks** et calendriers d'assiduité (heatmap type GitHub), récompenses liées à la constance, friction minimale, indulgence (1 jour raté ne casse pas tout).
**Vs Carnet Recompo.** **XP gaté par la progression** = déjà supérieur au point de vue (récompense l'effort réel, pas le clic) ✅. Mais pas de **streak/heatmap d'assiduité**.
**Concepts réutilisables.**
- **Heatmap d'assiduité** (séances + adhérence nutrition) → Phase 3 viz (**P2**).
- **Compliance Score** dans l'esprit « constance > intensité » → C.5 Phase 4 (**P0**, données déjà là).
- Garder l'**anti-gaming** de l'XP existant (différenciant — ne pas le diluer).

## 4. Gestion d'objectifs (OKR, Strides, GoalsWizard)
**Bonnes pratiques.** Objectif **explicite et mesurable**, jalons intermédiaires, **projection/ETA** (« à ce rythme, atteint le … »), revue périodique.
**Vs Carnet Recompo.** **L'objectif est implicite** (recompo câblée). Pas de cible chiffrée par l'utilisateur, pas de projection.
**Concepts réutilisables.**
- **Objectif courant explicite** (masse/sèche/recompo) + cible de poids/force datée → prérequis E5, pilote le Verdict multi-objectif (**P0**).
- **Projection/ETA** d'un objectif (poids ou charge) → E.1 Phase 4 (**P1**).
- **Revue hebdo automatique** (« bilan de la semaine ») → Phase 3 automatisation.

## 5. Analyse de performance (Strava, TrainingPeaks, Garmin)
**Bonnes pratiques.** **PMC (Performance Management Chart)** : CTL (fitness) / ATL (fatigue) / TSB (form) ; comparaison de périodes ; records personnels mis en avant ; segments/efforts notables.
**Vs Carnet Recompo.** e1RM/volume par exercice ✅, mais **pas de courbe fitness-fatigue**, pas de comparaison de périodes.
**Concepts réutilisables.**
- **Modèle Fitness-Fatigue-Form** (TrainingPeaks PMC) → B.4 Phase 4 (**P1**).
- **Comparaison ce mois / mois précédent** (force, volume, poids, adhérence) → Phase 3 viz (**P2**).
- **Mur des PR** datés (historiser les records) → Phase 3 donnée.

## 6. Préparation physique (RP Hypertrophy, Juggernaut AI, Boostcamp, Strong)
**Bonnes pratiques.** **RIR/RPE saisi par série**, **volume par groupe musculaire vs landmarks (MEV/MAV/MRV)**, **autorégulation** (charge ajustée à la forme du jour), **deload programmé**, périodisation (mésocycles), double progression (déjà chez nous).
**Vs Carnet Recompo.** Double progression ✅ excellente, mais **RIR statique**, pas de volume/groupe, pas d'autorégulation, pas de deload.
**Concepts réutilisables (les plus impactants).**
- **RIR/RPE réel par série** (RP/Juggernaut) → débloque charge interne + readiness (**P1**, prérequis Phase 4).
- **Volume hebdo par groupe musculaire vs repères 10-20 séries** → métrique + reco d'équilibrage (**P1/P2**).
- **Autorégulation** : moduler la reco de charge selon le Readiness du jour → D.4 Phase 4.
- **Deload détecté/programmé** → D.4 Phase 4.
- *(nécessite de taguer les exercices par groupe musculaire — petite extension du modèle d'exercice.)*

## 7. Gestion de charge (GPS sport co / staff médical : ACWR, Foster)
**Bonnes pratiques.** **sRPE** (RPE × durée), **ACWR** (aigu/chronique, zone 0,8-1,3), **monotonie & strain** (Foster), suivi de la **charge interne vs externe**, alertes de pic de charge.
**Vs Carnet Recompo.** **Totalement absent** — c'est le plus gros gisement, et le cœur du brief.
**Concepts réutilisables.**
- **sRPE + charge externe (tonnage)** stockées par séance → socle F0 Phase 4 (**P0**).
- **ACWR + bandes de risque** → B.3 / E.2 Phase 4 (**P0**).
- **Monotonie/Strain** → B.5 Phase 4 (**P1**).

---

## Synthèse — Concepts réutilisables priorisés

| Concept importé | Source domaine | Relie à | Priorité |
|---|---|---|---|
| Undo non bloquant sur suppression | Productivité | U1 | **P0 · S** |
| Objectif explicite (masse/sèche/recompo) + cible datée | Gestion d'objectifs | E5, Verdict | **P0** |
| sRPE + charge externe par séance | Gestion de charge | F0 Phase 4 | **P0** |
| ACWR + bandes de risque | Gestion de charge | Phase 4 B.3/E.2 | **P0** |
| Compliance Score (constance) | Habit tracking | C.5 Phase 4 | **P0** |
| RIR/RPE réel par série | Prépa physique | charge interne, readiness | **P1** |
| Readiness/Recovery score en tête d'app | Quantified Self | C.1/C.2 Phase 4 | **P1** |
| Modèle Fitness-Fatigue-Form (PMC) | Analyse de perf | B.4 Phase 4 | **P1** |
| Volume/groupe vs landmarks + autorégulation + deload | Prépa physique | D.4 Phase 4 | **P1** |
| Projection/ETA d'objectif | Gestion d'objectifs | E.1 Phase 4 | **P1** |
| Heatmap d'assiduité (streaks) | Habit tracking | Phase 3 viz | **P2** |
| Comparaison de périodes + mur des PR | Analyse de perf | Phase 3 viz | **P2** |
| Vue corrélations | Quantified Self | E.4 Phase 4 | **P2** |
| Revue hebdo automatique | Gestion d'objectifs | Phase 3 auto | **P2** |

---

## Conclusion Phase 5

Carnet Recompo possède **deux atouts que beaucoup d'apps n'ont pas** : un **moteur prescriptif** (le Verdict) et un **engagement anti-gaming** (XP gaté par la progression réelle). Le benchmark confirme que les **lacunes sont concentrées sur deux axes matures ailleurs** :
1. **La gestion de charge** (ACWR/sRPE/Foster, fitness-fatigue) — domaine entier absent, et c'est le focus Phase 4.
2. **L'agrégation en scores composites** façon Quantified Self (readiness en tête d'app) + **l'objectif explicite** façon gestion d'objectifs.

Aucun de ces concepts n'exige de framework ni de dépendance : tous se modélisent en **moteurs purs** cohérents avec l'ADN du projet (offline, zéro build). Le benchmark **ne change pas le cap de la Phase 4**, il le **valide** et y ajoute des touches d'UX éprouvées (undo, heatmap, comparaison de périodes, projection).
