# LIVRABLES FINAUX — Carnet Recompo

> Synthèse des Phases 1-6. Référence : `phase-1`…`phase-6` + `exigences-utilisateur` dans ce dossier.
> **Aucun fichier de l'application n'a été modifié.** Périmètre synchro = **gelé** (`fusion.js` = réserve à valider).
> Complexité : **S** ≈ ½-1 j · **M** ≈ 2-4 j · **L** ≈ 1-2 sem.

---

## 1. Checklist exhaustive des améliorations

### Stabilité & dette technique
- [ ] **Corriger T1** — `toutEffacer()` recrée un état incomplet (`plan` absent → crash onglet Repas).
  - *Impact :* bug réel · *Complexité :* S · *Priorité :* **Must**
- [ ] **Fabrique `defaultState()` unique** partagée par `charger()` et `toutEffacer()`.
  - *Impact :* supprime une duplication source de bugs · S · **Must**
- [ ] **Tests `fusion.js` + `sanitize.js`** (collisions date/id, formes malformées, idempotence).
  - *Impact :* filet sur le code le plus critique non testé · M · **Must**
- [ ] **Sélecteurs mémoïsés** (agrégats XP/charge calculés à l'écriture, pas au rendu) — corrige T3.
  - *Impact :* scalabilité, fin du O(n²) · M · **Should**
- [ ] **Rendu ciblé + charts en `update()`** au lieu de `renderAll`/`destroy()` — corrige T2.
  - *Impact :* perf/fluidité mobile, fin du flicker · M · **Should**
- [ ] **Bus d'événements** remplaçant `app.module.xxx` — corrige T5.
  - *Impact :* découplage, testabilité · M · **Should**
- [ ] **Éclater `MuscuModule`** (741 l.) en saisie/éditeur/progression/recap.
  - *Impact :* maintenabilité · M · **Should**
- [ ] **Wrapper `charts` injectable** (supprimer le global `Chart` implicite) + factoriser `meilleurE1rm` et l'arrondi flex — corrige T6.
  - *Impact :* propreté · S · **Could**
- [ ] **Versionnement de schéma + migrations** explicites et testées.
  - *Impact :* prérequis de toute évolution du modèle · M · **Must** (avant E1-E5)

### Nutrition (E1-E4)
- [ ] **E3 — Macros complètes** par aliment (kcal+prot+gluc+lip+fibres) + migration.
  - *Impact :* fondation nutrition · M · **Must**
- [ ] **E2 — Base d'aliments curée** (~300, catégorisée) + **éditeur d'aliments perso**.
  - *Impact :* lève le blocage « trop peu d'aliments » · L · **Must**
- [ ] **E1 — Multi-menus** `plansAlim[]`/`planAlimActif` + éditeur (modèle Muscu).
  - *Impact :* changer de programme alimentaire sans friction · M · **Must**
- [ ] **E4 — Plats composés** (recette réutilisable, macros dérivées).
  - *Impact :* saisie quotidienne rapide · M · **Should**
- [ ] **Flex généralisé & optionnel** (marquer librement les aliments ajustables).
  - *Impact :* menus libres sans casser l'auto-ajustement · S/M · **Should**
- [ ] **Comblement multi-macros** (pas seulement protéines).
  - *Impact :* aide à boucler la journée · S · **Could**
- [ ] **« Comme la dernière fois » nutrition** (journée/repas type).
  - *Impact :* friction · S · **Could**
- [ ] **Tendances kcal/macros** (le `journalRepas` contient déjà la donnée).
  - *Impact :* feedback nutrition · M · **Should**

### Calculateur de besoins (E5)
- [ ] **Profil** : stature, âge, sexe (écran dédié) + lever la collision « taille » vs tour de taille.
  - *Impact :* prérequis dur · S · **Must**
- [ ] **Objectif explicite** : masse / sèche / recompo (+ cible datée optionnelle).
  - *Impact :* pilote calculateur ET verdict · S · **Must**
- [ ] **Moteur `besoins.js`** : BMR (Mifflin-St Jeor) → TDEE (activité dérivée des programmes muscu) → ajustement objectif → split macros.
  - *Impact :* cœur de E5, supprime l'arbitraire du 2545 kcal · M · **Must**
- [ ] **Cible = sortie calculée** (surcharge manuelle possible) + recalage TDEE sur le poids réel.
  - *Impact :* boucle auto-ajustée · M · **Should**

### Verdict
- [ ] **Verdict multi-objectif** (seuils adaptés masse/sèche/recompo).
  - *Impact :* débloque les autres objectifs · M · **Must**
- [ ] **Consigne en kcal/macros** (plus « 30 g de riz », cassé hors plan par défaut).
  - *Impact :* cohérence avec E1-E5 · S · **Should**
- [ ] **Expliciter les zones grises** (« pas d'action car… »).
  - *Impact :* lisibilité · S · **Could**

### Muscu / Surcharge progressive (Phase 4)
- [ ] **`chargeSeance` stockée** (tonnage externe immédiat + sRPE si RPE+durée captés).
  - *Impact :* socle de toute la gestion de charge · M · **Must**
- [ ] **ACWR** (aiguë/chronique EWMA) + bandes de risque.
  - *Impact :* prévention surcharge · S (après socle) · **Must**
- [ ] **Scores composites** : Compliance & Risk (données déjà là), puis Readiness/Recovery/Progression.
  - *Impact :* aide à la décision · M · **Should**
- [ ] **RIR/RPE réel par série**.
  - *Impact :* débloque charge interne + readiness · S · **Should**
- [ ] **Capture récupération** : sommeil, courbatures, énergie (`checkins`).
  - *Impact :* fiabilise readiness/recovery · S · **Should**
- [ ] **Alertes** surcharge / stagnation / sous-charge.
  - *Impact :* proactivité · M · **Should**
- [ ] **Recommandations** : deload détecté/programmé, ajustement de volume, reco contextualisée par readiness.
  - *Impact :* autorégulation · M · **Could**
- [ ] **Fitness-Fatigue (CTL/ATL/TSB)** + monotonie/strain (Foster).
  - *Impact :* lecture macro de la forme · M · **Could**
- [ ] **Tag groupe musculaire** par exercice + volume/groupe vs repères.
  - *Impact :* équilibrage · M · **Could**
- [ ] **Projection de progression** (ETA d'un objectif de charge).
  - *Impact :* motivation/objectifs · M · **Could**
- [ ] **Signal de force** combinant volume + e1RM (corrige M2).
  - *Impact :* moins de bruit en isolation · S · **Could**

### Visualisation & UX
- [ ] **Dashboard d'accueil unifié** (readiness, cibles macros restantes, prochaine séance, alertes).
  - *Impact :* hub naturel de l'app · M · **Should**
- [ ] **Undo non bloquant** sur suppressions (pesée/mensuration/séance) — corrige U1.
  - *Impact :* prévention perte de données · S · **Must**
- [ ] **Confirmation sur suppressions destructrices** restantes.
  - *Impact :* sécurité · S · **Should**
- [ ] **Heatmap d'assiduité** (séances + nutrition).
  - *Impact :* engagement · M · **Could**
- [ ] **Comparaison de périodes** + **mur des PR** datés.
  - *Impact :* recul · M · **Could**
- [ ] **Vue corrélations** (sommeil↔force, kcal↔poids…).
  - *Impact :* leviers personnels · M · **Could**
- [ ] **% masse grasse** (saisi ou estimé Navy).
  - *Impact :* meilleure lecture recompo · S · **Could**
- [ ] **Onboarding guidé** (profil + objectif au 1er lancement).
  - *Impact :* active E5 dès le départ · S · **Should**

### Automatisations
- [ ] **Revue hebdomadaire automatique** (synthèse force/nutrition/charge/readiness).
  - *Impact :* valeur récurrente · M · **Could**
- [ ] **Suggestion de menu/plat** selon cibles restantes + objectif.
  - *Impact :* confort · M · **Won't (V4+)**
- [ ] **Plan de la semaine généré** (séances + menus + courses).
  - *Impact :* fort mais ambitieux · L · **Won't (V4+)**

### Synchro (GELÉ — pour mémoire seulement)
- [ ] *(réserve)* Étendre `fusion.js` aux nouvelles collections — **à valider explicitement**, hors périmètre par défaut.

---

## 2. Liste des incohérences (Problème · Impact · Solution)

| # | Problème | Impact | Solution |
|---|---|---|---|
| **T1** | `toutEffacer()` reconstruit un état sans `plan` | Crash onglet Repas après reset (jusqu'au reload) | `defaultState()` unique |
| **T2** | `renderAll` + recréation des charts à chaque écriture | Flicker, perte de réactivité mobile | Rendu ciblé + `Chart.update()` |
| **T3** | XP recalculé O(n²) au rendu | Dégradation avec l'historique | Sélecteurs mémoïsés / calcul à l'écriture |
| **T4** | `fusion.js`/`sanitize.js` critiques non testés | Corruption silencieuse possible à l'import/sync | Tests dédiés |
| **T5** | Couplage `app.module.xxx` en dur | Maintenabilité, testabilité | Bus d'événements |
| **T6** | `Chart` global implicite, duplications (`meilleurE1rm`, arrondi flex) | Propreté, couplage caché | Wrapper injectable + factorisation |
| **M1** | `moyennesHebdo` n'est pas « ISO » malgré le commentaire | Commentaire trompeur | Corriger commentaire / aligner |
| **M2** | Signal force bruité en hautes reps (Epley plafonné 12) | Faux négatifs en isolation | Combiner volume + e1RM |
| **M3** | `brasStagne` suppose des relevés mensuels (raisonne en index) | Bruit si relevés rapprochés | Deltas datés (≥ N jours) |
| **M4** | Trous dans l'arbre de verdict (zones grises) | Utilisateur ne comprend pas l'inaction | Expliciter / documenter |
| **U1** | Suppressions sans confirmation ni undo | Perte de données d'un tap | Undo non bloquant |
| **U2** | Deux remises à zéro hétérogènes (repas auto / courses manuel) | Confusion potentielle | Expliciter dans l'UI |
| **U3** | Surcharge cognitive onglet Muscu | Charge mentale (public expert, toléré) | Progressive disclosure |
| **P1** | Hypothèse mono-utilisateur | Bloque la vision pluriannuelle | Frontière profil/contexte dès v3 |
| **P2** | Readiness/recovery sans données source | Fonctions visées inatteignables | Capter profil/RIR/sommeil/macros |
| **N1** | « taille » = tour de taille ≠ stature (E5) | Ambiguïté de modèle | Renommer/distinguer dès v3 |
| **N2** | Verdict mono-objectif, conseils en grammes de riz | Cassé hors recompo / hors plan par défaut | Verdict multi-objectif en macros |

---

## 3. Priorisation MoSCoW

### Must Have
- T1 + `defaultState()` ; versionnement de schéma + migrations ; tests fusion/sanitize.
- **E3** macros complètes ; **E2** base d'aliments + perso ; **E1** multi-menus.
- **E5** : profil + objectif explicite + moteur `besoins.js`.
- **Verdict multi-objectif**.
- **Socle charge** (`chargeSeance` + **ACWR**).
- **Undo** sur suppression.

### Should Have
- Sélecteurs mémoïsés ; rendu ciblé/charts ; bus d'événements ; éclatement `MuscuModule`.
- **E4** plats composés ; flex généralisé ; tendances kcal/macros.
- Cible auto-ajustée (recalage TDEE) ; consigne verdict en macros.
- Scores Compliance/Risk puis Readiness/Recovery/Progression ; RIR réel ; capture récupération ; alertes.
- **Dashboard d'accueil** ; onboarding ; confirmations destructrices.

### Could Have
- Recommandations (deload, volume) ; Fitness-Fatigue + Foster ; tag groupe musculaire ; projection.
- Heatmap, comparaison de périodes, mur des PR, corrélations, % masse grasse.
- Comblement multi-macros, « comme la dernière fois » nutrition, signal force combiné, zones grises explicites, M1/M3/T6/U2/U3.

### Won't Have (cette refonte)
- OpenFoodFacts + scan code-barres (couche en ligne — V4+).
- Génération automatique du plan de semaine ; suggestions de menu avancées.
- Multi-utilisateur réel (préparé par l'archi, pas livré).
- Photos de progression (exclu historiquement).
- Toute modification du **protocole de synchro** (gelé).

---

## 4. Roadmap

### V2 — Stabilisation
*But : base saine, zéro régression, prêt à évoluer.*
- T1 + `defaultState()` unique.
- Tests `fusion.js` / `sanitize.js`.
- Versionnement de schéma + cadre de migrations.
- Undo sur suppressions ; corrections rapides M1/M3.
*Sortie : aucune nouvelle fonctionnalité visible, mais socle fiable et migrable.*

### V3 — Modularisation
*But : architecture cible + fondations nutrition & profil.*
- Plomberie iso-fonctionnelle : sélecteurs mémoïsés (T3), rendu ciblé + charts (T2), bus (T5), éclatement `MuscuModule`.
- Modèle de données v3 (profil, objectif, macros complètes, chargeSeance).
- **E5** : calculateur `besoins.js` + écran profil/objectif + onboarding.
- **E3 → E2 → E1 → E4** : macros, base d'aliments + perso, multi-menus, plats.
- **Verdict multi-objectif** ; courses dérivées des menus actifs.
*Sortie : nutrition réellement personnalisable + cible calculée + code modulaire.*

### V4 — Intelligence & Analyse
*But : pilotage de charge et aide à la décision.*
- Socle charge complet : ACWR, sRPE, monotonie/strain, Fitness-Fatigue.
- Scores (Compliance/Risk → Readiness/Recovery/Progression) ; RIR + récupération.
- Alertes (surcharge/stagnation/sous-charge) + recommandations (deload/volume/autorégulation).
- **Dashboard d'accueil** ; projection ; heatmap ; comparaison de périodes ; corrélations.
- *(Optionnel, en ligne)* OpenFoodFacts + scan.
*Sortie : l'app anticipe, score, alerte et recommande.*

---

## 5. Vision Produit (12-24 mois)

**Aujourd'hui**, Carnet Recompo est un excellent *carnet prescriptif* mono-objectif : il dit quoi manger (un plan figé) et comment progresser (par exercice), et tranche une fois par mois sur la recompo.

**Dans 12-24 mois**, il devient un **coach personnel complet, hors-ligne et sans dépendance**, organisé autour d'une **boucle fermée** :

> **Profil + objectif** (masse / sèche / recompo) → le **calculateur** déduit la cible kcal/macros à partir de la stature, du poids, de l'âge et de **l'activité réelle tirée des séances** → l'utilisateur **compose ses menus** dans une vraie base d'aliments (avec ses propres aliments et ses plats) → il **s'entraîne**, et chaque séance alimente une **mesure de charge** (ACWR, fatigue, readiness) → l'app **score, alerte et recommande** (deload, +volume, ajustement calorique) → le **Verdict**, désormais multi-objectif, **recale la cible** sur le réel → la boucle se referme.

Concrètement, l'app idéale :
- ouvre sur un **dashboard « état du jour »** : readiness, cibles macros restantes, prochaine séance, alertes de charge ;
- **personnalise** tout (plus de 2545 kcal codé en dur, plus de plan unique) tout en gardant la **simplicité de saisie** d'un tap ;
- **anticipe** au lieu de constater (surcharge, stagnation, sous-charge, dérive du TDEE) ;
- reste **fidèle à son ADN** : aucune dépendance, démarrage hors-ligne, données possédées par l'utilisateur, synchro Gist intacte, et un **moteur métier 100 % pur et testé** comme garant de confiance ;
- est **prête pour le multi-utilisateur** (frontière profil isolée) sans avoir sacrifié sa nervosité mono-utilisateur.

La promesse passe de **« dis-moi quoi faire ce mois-ci »** à **« pilote ma recomposition au quotidien, et préviens-moi avant que je me trompe »** — sans jamais devenir une usine à gaz.

---

## Prochaine étape (règle finale du brief)

L'audit et tous les livrables sont produits. **Aucun fichier de l'app n'a été modifié.** Conformément à la règle finale, les modifications ne démarreront qu'**après ta validation explicite**.

Recommandation de démarrage : **V2 (stabilisation)** — T1, `defaultState()`, tests fusion/sanitize, versionnement de schéma — à faible risque, qui débloque proprement tout le reste.
