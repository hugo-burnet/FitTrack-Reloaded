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

### V3.4 — Multi-menus (E1) + Plats composés (E4) 🚧 EN COURS
- [x] **V3.4a** — Multi-menus (E1). Source de vérité : `plansAlim[]` + `planAlimActif` (modèle Muscu `programmes[]`/`programmeActif`) ; l'ancien `etat.plan` disparaît (devient le menu actif). `js/plans.js` (pur) : `menuActif`/`repasActifs`. **Migration schéma 3→4** (wrap `plan`→`plansAlim`, supprime `plan`). `defaults` + `Store._appliquerDefauts` + `assainirPlansAlim`. **`fusion.js` étendu** (validé) : menus par id + `planAlimActif` + repli legacy `plan` + **aliments perso par clé**. RepasModule/CoursesModule refactorés sur `planActif()`/`repasActifs`. UI : carte « Menu » (sélecteur + nouveau/dupliquer/renommer/supprimer ; édition du contenu via « Réorganiser »). **+11 tests** (`plans`, migration 3→4, `assainirPlansAlim`, fusion menus+perso ; `defauts`/`fusion` mis à jour). 173 tests verts. `sw.js` v20.
- [ ] **V3.4b** — Plats composés (E4) : `plats[]` réutilisables, macros dérivées des composants, log d'un plat d'un tap.

### V3.5 — Verdict multi-objectif + Courses dérivées
- `decisionVerdict` paramétré par `objectif.type` ; consigne exprimée en kcal/macros.
- Courses dérivées des menus actifs (et plats).

### Plomberie (entrelacée, à iso-fonctionnel)
- Sélecteurs mémoïsés (T3), rendu ciblé + `Chart.update()` (T2), bus d'événements (T5), éclatement de `MuscuModule` — appliqués au fil des fichiers déjà ouverts pour limiter le risque de régression.

---

## V4 — Intelligence & Analyse (Phase 4)
Charge (sRPE/ACWR/Foster/fitness-fatigue), scores (readiness/recovery/risk/progression/compliance), alertes, recommandations, dashboard, projection. Cf. `phase-4-surcharge-progressive.md`.
