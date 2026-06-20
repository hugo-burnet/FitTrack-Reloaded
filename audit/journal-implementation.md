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

### V3.1 — Profil + Objectif + Calculateur de besoins (E5) ← EN COURS
- Modèle v3 (migration schéma 1→2) : `profil {stature, age, sexe}`, `objectif {type, cibleKcal, cibleMacros}`.
- Moteur pur `js/besoins.js` : BMR (Mifflin-St Jeor) → TDEE (activité dérivée des séances récentes, repli sur le programme) → ajustement objectif (masse/sèche/recompo) → split macros (prot g/kg, lipides %, glucides = reste). Testé.
- UI **Profil** : saisie stature/âge/sexe + choix d'objectif → affiche TDEE + cible kcal/macros recommandée → « Appliquer ». `objectifKcal` devient une sortie du calculateur (surcharge manuelle conservée).

### V3.2 — Macros complètes (E3)
- Modèle aliment étendu : `glucides/lipides/fibres` (par 100 g et par unité). Migration des aliments existants.
- `nutrition.js` calcule les 4 macros ; `journalRepas` les stocke ; affichage de la répartition P/G/L.
- Flex généralisé & optionnel (aliments « ajustables » librement).

### V3.3 — Base d'aliments enrichie + perso (E2)
- Base curée ~250-400 aliments catégorisés (`data/aliments-base`).
- Éditeur d'aliments perso (`aliments.perso`) ; recherche/filtre par catégorie.

### V3.4 — Multi-menus (E1) + Plats composés (E4)
- `plansAlim[]` + `planAlimActif` (modèle Muscu) + éditeur de menu.
- `plats[]` : recette réutilisable, macros dérivées des composants.

### V3.5 — Verdict multi-objectif + Courses dérivées
- `decisionVerdict` paramétré par `objectif.type` ; consigne exprimée en kcal/macros.
- Courses dérivées des menus actifs (et plats).

### Plomberie (entrelacée, à iso-fonctionnel)
- Sélecteurs mémoïsés (T3), rendu ciblé + `Chart.update()` (T2), bus d'événements (T5), éclatement de `MuscuModule` — appliqués au fil des fichiers déjà ouverts pour limiter le risque de régression.

---

## V4 — Intelligence & Analyse (Phase 4)
Charge (sRPE/ACWR/Foster/fitness-fatigue), scores (readiness/recovery/risk/progression/compliance), alertes, recommandations, dashboard, projection. Cf. `phase-4-surcharge-progressive.md`.
