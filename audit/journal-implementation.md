# Journal d'implémentation — FitTrack Reloaded

> Suivi vivant de la refonte (issu de l'audit `phase-1`…`phase-6` + `livrables-finaux`).
> Repo : `github.com/hugo-burnet/FitTrack-Reloaded`. App à la racine ; `_Archives/` = ancien code de référence (gitignoré).
> **Contrainte absolue maintenue** : synchro gelée (`Sync.js`/`gist.js`/protocole). `fusion.js` (partagé import+sync) : seulement testé, jamais modifié sans validation explicite.

---

## ✅ V2 — Stabilisation (livrée le 2026-06-20)

Branche `v2-stabilisation` → mergée dans `main`. Tests : **114 → 138, tous verts**.

| Item | Statut | Détail |
|---|---|---|
| **T1** | ✅ | Fabrique unique `js/defaults.js` (`etatParDefaut`/`coursesParDefaut`), partagée par `Store.charger()` (`_appliquerDefauts`) et `Store.reinitialiser()`. La remise à zéro ne peut plus produire un état incomplet (crash onglet Repas supprimé). |
| **Migrations** | ✅ | `js/migrations.js` (`SCHEMA_ACTUEL=1`, `migrer`) appelé au chargement et après import. Cadre prêt pour v3+, vide en V2. |
| **Undo (U1)** | ✅ | `toastUndo()` (ui.js) + annulation sur suppression pesée / mensuration / séance. CSS `.toast-undo`/`.toast-action`. |
| **Tests** | ✅ | `tests/sanitize.test.js`, `tests/fusion.test.js`, `tests/defauts.test.js`, `tests/migrations.test.js`. |
| **M1** | ✅ | Commentaire trompeur de `moyennesHebdo` corrigé. |
| **PWA** | ✅ | `sw.js` v15 : précache `defaults.js` + `migrations.js`. |
| **M3** | ⏸ différé | `brasStagne` en deltas datés : change un comportement métier testé → hors périmètre stabilisation. |

**Validations** : `npm test` 138/138, graphe d'imports OK (Node), fichiers servis (HTTP 200).

---

## 🔜 V3 — Modularisation + Nutrition (E1-E5)

Découpée en sous-lots livrables indépendamment, chacun testé et committé. Ordre choisi : poser la **fondation calcul (E5)** d'abord (le « liant » qui relie profil → muscu → nutrition → verdict), puis enrichir la nutrition, puis modulariser au fil des fichiers touchés.

### V3.1 — Profil + Objectif + Calculateur de besoins (E5) ✅ FAIT
- [x] Modèle v3 (migration **schéma 1→2**) : `profil {sexe, age, stature}`, `objectif {type, cibleKcal, cibleMacros}`. Garde-fous dans `Store._appliquerDefauts`.
- [x] Moteur pur `js/besoins.js` : BMR (Mifflin-St Jeor) → TDEE (facteur déduit de `frequenceHebdo` des séances) → ajustement objectif (sèche −20 % / recompo 0 / masse +10 %) → split macros (prot g/kg selon objectif, lipides 25 %, glucides = reste, fibres indicatives). **8 tests** (`tests/besoins.test.js`).
- [x] UI **Calculateur** (carte dépliable dans l'onglet Repas) : sexe/âge/taille + objectif (chips) ; poids (dernière moy. hebdo) et activité (séances/sem) déduits ; aperçu live ; « Appliquer » → écrit `objectif` + `objectifKcal` (toujours surchargeable à la main).
- [x] `sw.js` v16. Validé sur démo : 72,5 kg / 178 / 30 ans / 5 séances → TDEE 2920 ; sèche 2336 / recompo 2920 / masse 3212.
- ⚠ Collision « taille » levée : `profil.stature` (cm) ≠ tour de taille des mensurations.

### V3.2 — Macros complètes (E3) ✅ FAIT
- [x] Modèle aliment étendu (`data.js : ALIMENTS`) : `gluc/lip/fib` par 100 g (`gluc100/lip100/fib100`) et par unité (`glucU/lipU/fibU`) pour les 11 aliments. Valeurs cohérentes (test : kcal ≈ 4·prot + 4·gluc + 9·lip ±15 %).
- [x] `nutrition.js` : fonctions pures `glucItem/lipItem/fibItem` (legacy → 0, jamais NaN) + `macrosCible(objectifKcal, plan)` → `{prot, gluc, lip, fib}` (flex ajusté, même arrondi 5 g que `qteAjustee`).
- [x] `RepasModule` : `repasGluc/Lip/Fib`, `cibles()` renvoie les 4 macros ; `journaliserRepas` + `ajouterExtra(Aliment)` stockent `gluc/lip/fib` ; `consomme()` agrège les 4 (anciennes entrées V3.1− comptées 0, sans casser). Hors-plan libre (kcal/prot saisis à la main) : G/L/fib inconnus → 0.
- [x] UI : carte cible affiche la répartition **Glucides / Lipides / Fibres** (consommé / cible, coloré sur l'écart : rouge si dépassé, vert si atteint). `#cible-macros` + CSS `.cible-macros`/`.macro-mini`.
- [x] **4 nouveaux tests** purs (`tests/nutrition.test.js`, total 150 verts). `sw.js` v17 (data.js/nutrition.js déjà précachés).
- ⏸ Flex généralisé optionnel (marquer librement des aliments « ajustables ») : reporté — non bloquant, à traiter avec l'éditeur d'aliments (V3.3).

### V3.3 — Base d'aliments enrichie + perso (E2) ✅ FAIT
- [x] **V3.3a** — Base curée embarquée `js/data/aliments-base.js` (**167 aliments** catégorisés, 13 catégories ; clés du PLAN/COURSES figées, valeurs d'origine conservées). kcal dérivées par Atwater (4·prot+4·gluc+9·lip) → cohérence interne garantie. `js/catalogue.js` (pur) : `catalogue(perso)` fusionne base+perso (perso écrase), `tousAliments`/`categoriesPresentes`/`rechercher` (accent-insensible, filtre catégorie). `data.js : ALIMENTS = ALIMENTS_BASE`. Item-fns de `nutrition.js` reçoivent un `aliments` injectable (défaut base). **+8 tests** (`tests/catalogue.test.js`). `sw.js` v18 (+ 2 fichiers précachés).
- [x] **V3.3b** — État `aliments.perso` (**migration schéma 2→3**, defaults + `Store._appliquerDefauts` + `assainirAlimentsPerso`). Éditeur d'aliments perso (carte « Mes aliments » : ajout/édition/suppression, kcal saisies ou dérivées Atwater). Picker hors-plan repensé : **recherche** (accent-insensible) + **filtre par catégorie**, aliments perso marqués ★ et calculés via le catalogue fusionné. **+4 tests** (migration v2→v3, `assainirAlimentsPerso`). 162 tests verts. `sw.js` v19.
- ✅ **Synchro perso** : extension de `fusion.js` **validée explicitement** (2026-06-20). Les aliments perso se fusionnent désormais par clé (l'entrant gagne) → propagation entre appareils. Fait dans V3.4a.

### V3.4 — Multi-menus (E1) + Plats composés (E4) ✅ FAIT
- [x] **V3.4a** — Multi-menus (E1). Source de vérité : `plansAlim[]` + `planAlimActif` (modèle Muscu `programmes[]`/`programmeActif`) ; l'ancien `etat.plan` disparaît (devient le menu actif). `js/plans.js` (pur) : `menuActif`/`repasActifs`. **Migration schéma 3→4** (wrap `plan`→`plansAlim`, supprime `plan`). `defaults` + `Store._appliquerDefauts` + `assainirPlansAlim`. **`fusion.js` étendu** (validé) : menus par id + `planAlimActif` + repli legacy `plan` + **aliments perso par clé**. RepasModule/CoursesModule refactorés sur `planActif()`/`repasActifs`. UI : carte « Menu » (sélecteur + nouveau/dupliquer/renommer/supprimer ; édition du contenu via « Réorganiser »). **+11 tests** (`plans`, migration 3→4, `assainirPlansAlim`, fusion menus+perso ; `defauts`/`fusion` mis à jour). `sw.js` v20.
- [x] **V3.4b** — Plats composés (E4). `etat.plats = [{id, nom, composants:[[cle,qté]]}]` ; macros dérivées via `nutrition.macrosPlat(composants, aliments)` (catalogue fusionné ; composant inconnu/≤0 ignoré). **Migration schéma 4→5** + `defaults` + `Store` + `assainirPlats` + **fusion `plats` par id**. UI : carte « Mes plats » — éditeur (recherche d'aliments + composants + total live, ajout/édition/suppression) et liste « **+ Au journal** » qui journalise un plat d'un tap (entrée hors-plan agrégeant les 4 macros, items = composants ; l'affichage des extras indique « N aliments »). **+6 tests** (`macrosPlat`, `assainirPlats`, migration 4→5, fusion plats). 178 tests verts. `sw.js` v21.

### V3.5 — Verdict multi-objectif + Courses dérivées ✅ FAIT
- [x] **Verdict multi-objectif** : `decisionVerdict({…, objectif})` dispatche vers 3 arbres (`seche`/`recompo`/`masse`). La **recompo est inchangée** (les 11 tests d'origine restent verts ; arbre extrait dans `verdictRecompo`). Sèche : perte 0,3–1 kg/mois = RAS ; < −1 → +150 (préserver le muscle) ; perte molle + taille pas ↓ → −150 (creuser) ; balance stable mais taille ↓ → « le gras part ». Masse : prise 0,2–0,7 kg/mois = RAS ; > +0,7 + taille ↑ → −150 ; n'avance pas → +150. Consignes en **kcal** (équivalence riz/banane). `SCENARIOS` par objectif exportés.
- [x] **VerdictModule** : passe `objectif` (validé, défaut recompo), rend les **cartes scénario dynamiquement** selon l'objectif + badge objectif (#verdict-obj). Cartes statiques de l'`index.html` remplacées par `#scenarios` rendu en JS.
- [x] **Courses dérivées du menu actif** : effectif depuis V3.4a (`CoursesModule` utilise `repasActifs`) ; quantités recalculées au changement de menu. Note UI clarifiée (« depuis le menu actif »).
- **+8 tests** (sèche/masse + repli objectif inconnu). 186 tests verts. `sw.js` v22.
- ↪ Plats dans les courses : non retenu (les plats sont journalisés à la demande, pas planifiés → pas de dérivation bien définie).

### Plomberie (entrelacée, à iso-fonctionnel) — branche `v3-plomberie`
- [x] **T3 — sélecteurs mémoïsés** : `stats.moyennesHebdo` mémoïsée par référence de tableau (`memoParTableau`, WeakMap). Sûr car les collections d'état sont toujours réassignées à chaque mutation (filter/sort/fusion/sanitize → nouvelle référence ⇒ cache invalidé, jamais de résultat périmé). Dédoublonne ~5 calculs identiques par rendu complet (4 modules + `rythmeMensuel` en interne). **+2 tests** (`stats.test.js`). Iso-fonctionnel.
- [x] **T2 — rendu ciblé / `Chart.update()`** : `MesuresModule.dessinerPoids`/`dessinerMens` mettent à jour le graphe existant (labels + datasets puis `update()`) au lieu de `destroy()`+`new Chart()` à chaque rendu — moins de churn, pas de fuite, transition douce. Vérifié au navigateur (CDP) : ajout/suppression de pesée → même instance de Chart mise à jour (pas recréée). `MuscuModule.chProg` laissé en recreate (redessiné seulement au changement d'exercice ; labels/couleurs variables → recréer reste plus sûr). `sw.js` v24.
- [ ] T5 — bus d'événements ; éclatement de `MuscuModule` : non faits (gardés pour quand le besoin se fera sentir ; risque/bénéfice moins favorable).

---

## Nutri F1 — Générateur de menus adaptés — branche `nutri-generateur-menus`
**Problème** : le plan historique fixe les portions ; seuls les glucides « flexent » vers la
cible kcal → les **protéines/lipides ne suivent jamais l'objectif** (sur-livraison de protéines :
ex. recompo 72,5 kg, cible 145 g mais menu ≈ 197 g) et les kcal saturent hors ~2020-3240 kcal.
**Solution** : un générateur qui résout les 3 macros à la fois, piloté par les goûts.
- [x] **Moteur pur** `js/generateur.js` + pool curé `js/data/generateur-pool.js` (aliments
  faciles : zéro prépa / cuiseur à riz / airfryer, tagués rôle+prépa+repas+bornes). `genererMenu`
  par descente de coordonnées (met chaque rôle à l'échelle pour combler l'écart de SA macro ;
  comme kcal = 4·P + 4·G + 9·L, viser P/G/L vise les kcal). `evites` = filtre dur, `aimes` =
  préférence (complétée si capacité insuffisante), `faciliteSeulement`. Dégradé gracieux
  (saturations signalées, jamais d'échec/NaN). **+8 tests** (`generateur.test.js`).
- [x] **État** (migration **schéma 6→7**) : `etat.preferencesAlim = {aimes[], evites[], faciliteSeulement}`
  (defaults + Store + `assainirPreferencesAlim`). `appliquerBesoins` stockait déjà `objectif.cibleMacros`.
  **+3 tests**.
- [x] **Ajustement en place** : `ajusterMenu(repas, cibles, aliments)` partage le solveur (refondu
  par entrées → gère les clés dupliquées + catalogue perso injectable). Garde la composition du
  menu, rééchelonne seulement les portions. Corrige la sur-livraison de protéines des menus fixes
  (ex. plan historique : 197 → 147 g) ; signale honnêtement les macros non atteignables (bornes).
  **+4 tests**.
- [x] **UI** (onglet Repas, sous le calculateur) : carte « Générer un menu » — cible affichée,
  goûts en chips par rôle (1 tap j'aime / 2 à éviter / 3 neutre), bascule « faciles uniquement »,
  **« Générer un nouveau menu »** (crée « <Objectif> auto » et l'active) **ou « Ajuster le menu
  actuel »** (corrige le menu actif en place), aperçu macros atteintes vs cible.
- [x] **Assistant guidé** (overlay plein écran, 1 question/étape, barre de progression) :
  objectif → cuisiner ? → goûts par catégorie (prot/gluc/lip/fruits&légumes, chips tri-état) →
  récap (cible + résumé) → génère. Auto-avance sur les choix uniques. Réglage manuel replié
  dans un `<details>`. Lit/écrit le MÊME état (objectif + preferencesAlim) → source unique.
- [x] **Sync des goûts** : `fusion.js` étendu (union des aimés/évités entre appareils, l'évité
  gagne, faciliteSeulement à l'entrant ; validé le 2026-06-21). Les menus générés se propagent
  déjà via `plansAlim`. **+1 test** (`fusion.test.js`).
- **228 → 244 tests verts.** `sw.js` v32 (+ generateur.js, generateur-pool.js précachés).
- Vérif navigateur (CDP, cache désactivé) : profil → cible, « j'aime poulet » pris en compte,
  Générer → menu créé/activé, macros à ±2 g de la cible, zéro erreur console.
- ⏳ Pistes : étendre le pool, Q&A guidée (allergies/régimes), corriger aussi les menus
  existants (au lieu de seulement générer).

---

## V4 — Intelligence & Analyse (Phase 4) — branche `v4-analyse`
Cf. `phase-4-surcharge-progressive.md`. Livré par lots (F0 d'abord, le plus fort rendement).

### F0 — Socle charge (P0) ✅ FAIT
- [x] **Moteurs purs** : `js/charge.js` — `chargeSeance` (tonnage via `xp.xpSeance`, aucun nouvel input), `chargesParJour`, EWMA **aiguë (τ=7)** / **chronique (τ=28)**, **ACWR** + zones (`zoneAcwr` : 0,8 / 1,3 / 1,5), **monotonie & strain de Foster** (7 j), `serieCharge` (courbe), `pilotageCharge` (photo). `js/scores.js` — `scoreCompliance` (séances/prot/kcal pondérés + dégradé de confiance), `scoreRisk` (ACWR hors zone + monotonie + déclin `bilanForce`), `alerteSurcharge` / `alerteSousCharge`.
- [x] **Dashboard** (onglet Verdict) : carte « Pilotage de la charge » — ACWR + zone colorée, scores Risque & Assiduité, ligne détail (aiguë/chronique/charge 7 j/monotonie), **alerte surcharge/sous-charge**, **courbe aiguë vs chronique** (Chart créé/mis à jour façon T2). Tout en dégradé gracieux (« données à venir » sans séances).
- [x] **Tests** +17 (`charge.test.js`, `scores.test.js`), 205 verts. `sw.js` v25 (+ charge.js, scores.js précachés). Vérif navigateur (CDP) : ACWR 1.74 → zone risque + alerte, courbe 84 pts, scores cohérents.
- ⏳ **sRPE** (RPE séance × durée) noté optionnel en F0 : non capté ici (charge externe = tonnage suffit pour ACWR) ; à ajouter avec F1 (champs de récup).

### F1 — Récupération & readiness (P1) ✅ FAIT — branche `v4-f1-readiness`
Livré en 4 sous-lots committables, moteurs purs testés d'abord.
- [x] **F1.1 — Capture** (migration **schéma 5→6**) : nouvelle collection `etat.etatsJour`
  `[{date, sommeil(h), courbatures(0-10)}]` (defaults + `Store._appliquerDefauts` +
  `assainirEtatsJour`). Champs d'effort de séance `duree`(min)/`rpe`(0-10) **optionnels**,
  bornés dans `assainirSeance` — ajoutés aux séances **sans migration** : ils voyagent déjà
  via la fusion (séances fusionnées par date+jourId, objet entier) → **`fusion.js` inchangé**.
  `etatsJour` **synchronisé** : extension de `fusion.js` (fusion par `date`, l'entrant gagne,
  comme pesées/mensurations) **validée explicitement le 2026-06-21**. **+5 tests** (capture)
  **+1** (fusion). `sw.js` v27.
- [x] **F1.2 — Moteurs** `js/readiness.js` (purs) : `chargeInterneSeance` (sRPE Foster = RPE×durée),
  `fitnessFatigue` (Banister, **réutilise les EWMA de charge.js** : fitness=chronique, fatigue=aiguë,
  forme=TSB), notes élémentaires 0-1 (sommeil/courbatures/forme/ACWR/délai/fatigue),
  `scoreReadiness` (prospectif, feu vert/orange/rouge), `scoreRecovery` (rétrospectif),
  `scoreProgression` (% exos en hausse via `bilanForce` + PR e1RM + tendance de volume),
  orchestrateurs `readinessDuJour`/`recoveryDuJour`/`etatJourPour`/`delaiDerniereSeance`.
  Dégradé gracieux partout. **+15 tests**. `sw.js` v26 (+ readiness.js précaché).
- [x] **F1.3 — Alertes** (`scores.js`) : `alerteStagnation` (force plate + 0 PR malgré bonne
  assiduité → « change de stimulus ») ; `alerteSousCharge` **enrichie** par le score de récup
  (rétro-compatible : recovery optionnel). **+2 tests**.
- [x] **F1.4 — UI** : onglet Verdict, carte « **Forme du jour** » (saisie sommeil/courbatures du
  jour, feu + reco readiness, jauges Readiness/Récup/Progression, alerte stagnation) ;
  onglet Muscu, champs **Durée/RPE** optionnels (brouillon + séance). Vérif navigateur (CDP,
  cache désactivé) : readiness 95 feu vert après saisie, champs présents, zéro erreur console.
- [x] **F1.5 — Sync `etatsJour`** : `fusion.js` étendu (fusion par `date`, l'entrant gagne ;
  validé le 2026-06-21) → propagation de la récup entre appareils. **+1 test** (`fusion.test.js`).
- **205 → 228 tests verts.** `sw.js` v27.
- ⏳ Reste F2+ : deload auto, ajustement de volume, reco contextualisée, projection de
  progression, cycles & corrélations.

---

## Passe hygiénique — moteurs purs (branche `hygiene-moteurs`) ✅ FAIT
ISO-FONCTIONNEL : on n'éclate pas le comportement, on déplace la **logique métier** des
gros modules vers des fonctions pures testées ; les modules ne gardent que DOM/événements/
persistance. **Synchro et `fusion.js` non touchés.** Méthode par fonction : extraire → test
qui la fige → rebrancher le module → `npm test` vert.

### Lot 1 — `js/repas-logique.js` (extrait de `RepasModule`, 1117 → 1085 l.)
- [x] `qteAjustee` (quantité flex ajustée à l'objectif, arrondi 5 g) ; `macrosRepas` (5 macros
  d'un repas, **remplace** `repasKcal/Prot/Gluc/Lip/Fib`).
- [x] `entreesDuJour` / `extras` / `consomme` (agrégation du journal, legacy-safe) ;
  `entreeJournalRepas` (construction d'une entrée de repas coché).
- [x] `deplacerAliment` (déplacement entre repas, réorganisation) ; `suggestionsProteine`
  (comblement du déficit) ; `supprimerMenu` (CRUD menu avec garde-fou « au moins un »).
- [x] CRUD menus restant (nouveau/dupliquer/renommer/changer) laissé en glue triviale
  (id-gen + clone + persist) : pas de logique testable à extraire.
- **+17 tests** (`tests/repas-logique.test.js`). Imports morts retirés (`facteurFlex`, `protCible`).

### Lot 2 — `js/muscu-perf.js` (extrait de `MuscuModule`, 770 → 647 l.)
- [x] `dernierePerf` / `perfPrecedente` / `historiqueExo` / `tousLesExos` (lecture de l'historique).
- [x] `fmtPerf` (formatage charges droites/variables, gainage en temps).
- [x] `brouillonDerniere` (préremplissage « comme la dernière fois ») ; `permuterExo`
  (réordonnancement exo + brouillon en phase).
- [x] `construireRecap` (deltas vs occurrence précédente + XP/niveau) ; `serieProgression`
  (points 1RM/temps + volume + **tendance** par point ; le module ne fait plus que dessiner).
- **+17 tests** (`tests/muscu-perf.test.js`). Imports morts retirés (`e1rm`, `meilleureCharge`,
  `meilleurTemps`, `tempsSousTension`, `parseFourchette`, `xpGagneExercice`, `niveauPourXp`).

### Vérifs finales
- **244 → 278 tests verts** (+34). Graphe d'imports résolu (38 modules, Node). HTTP 200 sur
  l'app et les 2 nouveaux fichiers. **`sw.js` v32 → v33** (+ `repas-logique.js`, `muscu-perf.js`
  précachés). Vérif navigateur (Chromium CDP, **cache désactivé**) : onglets Repas (cartes repas
  rendues, cible `0 / 2545 kcal`) et Muscu (formulaire de séance rendu sur sélection d'un jour),
  **zéro erreur console**.
- Zéro dépendance, JS vanilla, offline-first conservés.

---

## V4 — F2 « Recommandations & projection » (branche `v4-f2-recommandations`) ✅ FAIT
Cf. `phase-4-surcharge-progressive.md` §D.4 + §E.1. Livré en 5 sous-lots committables, moteurs
purs testés d'abord, UI branchée en fin de lot. Synchro et `fusion.js` non touchés.

### F2.1 — Projection de progression (P1 · §E.1) `js/projection.js`
- [x] `serieE1rm` (points date→meilleur e1RM, 1/jour) ; `regressionLineaire` (pente, ordonnée,
  r², **erreur-type de la pente** = variabilité §B.6) ; `projeterExercice` (pente kg/sem +
  fiabilité ≥4 pts & r²≥0,3, sur fenêtre récente) ; `etaObjectif` (ETA d'un gain +X kg + **bande
  d'incertitude** ±erreur-type, borne ouverte si pente plate). **+13 tests.**

### F2.2 — Deload auto/détecté (P1 · §D.4) `scores.js` + `charge.js` + `readiness.js`
- [x] `charge.js` : `chargesHebdo` (4 blocs de 7 j) + `semainesMontantes`. `scores.js` :
  `detecterDeload` (3 signaux ET : charge hebdo montante + fatigue installée (TSB<0 ou ACWR hors
  zone) + progression qui plafonne → semaine d'allègement ~55 % volume). `readiness.js` :
  `deloadDuJour` (orchestrateur). **+11 tests.**

### F2.3 — Reco de charge contextualisée (P1 · §D.4) `readiness.js`
- [x] `recoContextuelle(reco, feu)` : tempère `recommander()` selon le feu readiness — jamais de
  +charge un jour **rouge** (ton neutralisé + note), prudence **orange**, encouragement **vert** ;
  info d'origine conservée. **+5 tests.**

### F2.4 — Ajustement de volume par groupe (P2 · §D.4) `js/volume.js`
- [x] `groupeExercice` (classifieur nom→groupe heuristique ordonné, repli 'Autre' — **tout le
  programme par défaut classé**, testé) ; `volumeParGroupe` (séries de travail/sem par groupe vs
  repères 10-20, ajustements sur les groupes principaux entraînés hors zone). Aucun changement de
  schéma. **+9 tests.**

### F2.5 — UI + vérifs finales
- [x] **Verdict** : alerte deload (`#deload-alerte`) + carte « Volume par groupe musculaire »
  (`#carte-volume`). **Muscu** : projection sous la courbe (`#prog-projection`, ETA +2,5/+5 kg)
  + reco contextualisée (note `.obj-readiness` dans la carte Objectif). CSS dédié (vol-*, obj-readiness).
- [x] **278 → 316 tests verts** (+38). Graphe d'imports OK (40 modules, Node). HTTP 200.
  **`sw.js` v33 → v34** (+ `projection.js`, `volume.js` précachés).
- [x] **Vérif navigateur** (Chromium CDP, **cache désactivé**) : état vide → cartes en dégradé
  gracieux, zéro erreur. Données semées (12 séances) → projection « +2,67 kg/sem · r² 1,00 ·
  prochaine marche +2,5 kg ≈ 7 j · +5 kg ≈ 2 sem », volume par groupe + conseils. Zéro erreur console.
- ⏳ Reste **F3** : analyse de cycles, corrélations.

---

## V4 — F3 « Cycles & corrélations » (branche `v4-f3-cycles-correlations`) ✅ FAIT
Cf. `phase-4-surcharge-progressive.md` §E.3 + §E.4. 3 sous-lots, moteurs purs testés d'abord.
Synchro et `fusion.js` non touchés.

### F3.1 — Analyse de cycles (P2 · §E.3) `js/cycles.js`
- [x] `phasesHebdo` (accumulation +5 % / deload ≤70 % du pic récent / maintien) +
  `compresserBlocs` ; `analyserCycles` (phase courante, semaines dans la phase, ancienneté
  du dernier deload, nb de cycles accumulation→deload, semaines vides de tête ignorées).
  S'appuie sur `charge.chargesHebdo`. **+8 tests.**

### F3.2 — Corrélations (P2 · §E.4) `js/correlations.js`
- [x] `correlation` (Pearson, r/n, null si <3 pts ou variance nulle) ; `interpreter` (force) ;
  `decrireCorrelation` (insight lisible, sensible au signe). Builders : sommeil↔courbatures,
  volume séance↔1RM estimé (par exercice), kcal hebdo↔Δ poids sem. suivante.
  `correlationsDisponibles` n'expose que les relations ≥5 points, triées par |r|. **+10 tests.**

### F3.3 — UI + vérifs finales
- [x] **Verdict** : carte « Cycles d'entraînement » (`#carte-cycles` : strip hebdo coloré par
  phase + résumé) + carte « Corrélations » (`#carte-correlations` : relations exploitables
  + nuage de points de la plus forte, scatter Chart.js). CSS dédié (cycles-strip/cyc-*, cor-*).
- [x] **316 → 334 tests verts** (+18). Graphe d'imports OK (42 modules). HTTP 200.
  **`sw.js` v34 → v35** (+ `cycles.js`, `correlations.js` précachés).
- [x] **Vérif navigateur** (Chromium CDP, **cache désactivé**) : état vide en dégradé gracieux ;
  données semées → cycles (12 semaines, phases colorées) et corrélations (Volume→1RM r=1,00 ;
  Sommeil→courbatures r=−1,00 + nuage). Zéro erreur console.

**Phase 4 (V4 F0→F3) entièrement livrée.** Le pilotage de charge, la récupération/readiness,
les recommandations (deload, volume, reco contextualisée, projection) et l'analyse (cycles,
corrélations) sont en place, tous en moteurs purs testés et en dégradé gracieux.

---

## Nutri — Pool du générateur étendu (branche `nutri-pool-etendu`) ✅ FAIT
- [x] `js/data/generateur-pool.js` : **28 → 81 aliments** « faciles » (zéro prépa / cuiseur à
  riz / airfryer), tous puisés dans la base curée existante (aucun nouvel aliment, aucune
  macro à maintenir — lues dans ALIMENTS via la clé). Répartition enrichie sur les 4 rôles :
  28 protéines (viandes/poissons faciles, laitages riches, végé), 18 glucides (féculents au
  cuiseur, petit-déj, sucres rapides), 13 lipides (oléagineux & graines), 22 fibres (légumes
  airfryer/crus + fruits). Bénéfice direct : assistant guidé et chips `aime/évite` bien plus
  variés, et meilleure couverture des cibles/goûts par le solveur.
- [x] **Garde-fou** `tests/generateur-pool.test.js` (+7) : chaque entrée référence un aliment
  existant, rôle/prep valides, bornes cohérentes (0 ≤ min ≤ base ≤ max, pas > 0), pas de
  doublon, tag `unite` correct. Cible « irréaliste » du test générateur relevée (~12 000 kcal,
  la capacité du pool ayant augmenté).
- [x] **334 → 341 tests verts.** `sw.js` v35 → v36. Vérif navigateur (CDP, cache désactivé) :
  chips du générateur = 81 (28/18/13/22 par rôle), zéro erreur console.
