# PHASE 1 — Audit Complet · Carnet Recompo (`_Archives`)

> Audit réalisé le 2026-06-20. **Aucun fichier de l'application n'a été modifié.**
> Périmètre exclu (contrainte absolue) : tout le système de **synchronisation** (`Sync.js`, `gist.js`, modèles/flux de synchro). Mentionné mais jamais proposé à la refonte.

---

## 1. Compréhension du produit

**Finalité réelle.** « Carnet Recompo » est un **assistant personnel de recomposition corporelle** (perdre du gras / gagner du muscle simultanément), pas un simple tracker. Sa singularité : transformer une masse de données hétérogènes (pesées, mensurations, nutrition, séances) en **une consigne unique et actionnable** (« −150 kcal sur le riz », « monte à 42,5 kg »). Produit *prescriptif*, pas seulement descriptif — il tranche à la place de l'utilisateur. C'est sa vraie valeur.

**Usages principaux.**
- Saisie quotidienne légère : cocher ses repas, noter une séance de muscu.
- Consultation décisionnelle : lire le « Verdict » (mensuel) et le bilan « Cette semaine » (hebdo).
- Pilotage de la surcharge progressive : à chaque exercice, savoir s'il faut monter la charge, gratter des reps, consolider ou décharger.

**Usages secondaires.** Pesée hebdomadaire, relevé mensuel de mensurations, génération de la liste de courses dérivée du plan, export/sauvegarde.

**Profils utilisateurs implicites.** Un **utilisateur unique, avancé et discipliné** (RIR, Epley, double progression, taille contractée/relâchée). Manifestement le développeur lui-même (« bible PPLUL », plan à 2545 kcal, tutoiement). Le produit est *taillé pour une personne*.

**Hypothèses de conception initiales.**
1. **Mono-utilisateur absolu** : un seul état global, un seul Gist, aucune notion de compte.
2. **Zéro friction** : pas de build/npm/backend ; IndexedDB + synchro Gist chiffrée.
3. **La taille dit la vérité** : le tour de taille arbitre entre muscle et gras (axiome métier central).
4. **Prudence > réactivité** : aucun verdict avant 3 moyennes hebdo.
5. **Le plan est un défaut, la réalité est le journal** : modèle « cible + écart ».

**Résumé.** PWA vanilla, mobile-first, hors-ligne, mono-utilisateur, conçue comme un *instrument de mesure et d'aide à la décision*. Force : l'opinion forte (verdict prescriptif, surcharge « 0 doute », XP gaté par la vraie progression). Limites structurelles : hypothèse mono-utilisateur, et couche d'affichage (« Modules ») surchargée, alors que la couche métier (moteurs purs) est propre et testée.

---

## 2. Cartographie fonctionnelle

### 2.1 Modules (responsabilités & dépendances)

| Module | Responsabilité | Dépend de |
|---|---|---|
| `App.js` | Routeur d'onglets, orchestration du rendu, reset minuit, écran de récupération | Store, Sync, 6 Modules |
| `Store.js` | Source unique de vérité, persistance IndexedDB+localStorage, migrations, reset-jour | idb, data, sanitize, utils |
| `idb.js` | Wrapper IndexedDB clé/valeur | — |
| `Sync.js` / `gist.js` | **Synchro Gist (HORS PÉRIMÈTRE)** | fusion, gist, idb |
| `fusion.js` | Réconciliation d'état par date/id (import **et** sync) | sanitize, utils |
| `sanitize.js` | Validation/purge des formes invalides | data |
| `data.js` | Constantes : aliments, plan, programme PPLUL, courses | — |
| `utils.js` | Dates, format, slug, échappement, helpers DOM | — |
| Moteurs purs (testés) | `stats` · `progression` · `xp` · `nutrition` · `verdict` · `bilan` | s'appuient sur stats |
| `charts.js` | Config Chart.js partagée | global `Chart` |
| `RestTimer.js` | Chrono de repos (audio/vibration/wake) | — |
| `ui.js` | Toasts + modales (remplace alert/confirm/prompt) | utils |
| `modules/*` | 6 classes d'onglet (bind/render) | moteurs + Store |

### 2.2 Fonctionnalités

- **Principales :** Verdict recompo · Plan repas cible+écart · Muscu surcharge progressive · Mensurations/pesées + courbes · Liste de courses dérivée · Synchro/Export.
- **Secondaires :** Bilan hebdo (adhérence protéines + séances + signal de force) · Système XP/niveaux (global + par exercice) · Éditeur de programmes · Chrono de repos auto · Wake lock · Comblement protéique · Téléchargement auto post-séance.
- **Cachées / peu visibles :** Brouillon de séance auto · « Comme la dernière fois » · Réorganisation d'aliments (portée *plan* vs *aujourd'hui*) · Décochage minuit (3 mécanismes) · Migration McGill big 3 → 3 gainages · Écran de récupération + export de secours · Détail repliable des séances précédentes.

### 2.3 Flux utilisateurs

- **Création** : pesée/relevé (Mesures) → saisie séance (Muscu, brouillon) → cochage repas / hors-plan (Repas).
- **Consultation** : bandeau global → Verdict + « Cette semaine » → courbes (exercice / poids / mensurations).
- **Analyse** : rythme kg/mois × tendance taille/bras → verdict ; e1RM/volume ; adhérence + signal de force.
- **Décision** : carte Verdict (consigne unique) ; barre d'objectif par exercice ; comblement protéique.
- **Historisation** : séances jamais réinitialisées ; journal repas « réellement mangé » ; export JSON exhaustif ; synchro Gist par fusion.

---

## 3. Cartographie technique

### 3.1 Architecture actuelle

POO vanilla en modules ES, **sans build**. `Store` (état+persistance) → `App` (routeur) → 6 `Modules` (`bind()` une fois, `render()` reconstruit le DOM). **Délégation d'évènements partout**, zéro `onclick` inline. **Logique métier isolée en moteurs purs** testables — point fort majeur.

**Flux de données :** mutation → `store.sauver()` → écrit IndexedDB+localStorage, émet `change` → Sync push débouncé. Rendu *pull* : `render()` relit `store.etat`.

**Gestion d'état :** un seul objet `store.etat`, persisté en bloc (JSON intégral à chaque `sauver`). État d'UI réparti dans les instances de Module.

### 3.2 Qualité du code

**Forts :** moteurs purs petits/nommés/commentés-sur-le-pourquoi/testés (42 tests) ; `sanitize.js` + `fusion.js` défense en profondeur ; `echap()` systématique ; accessibilité soignée ; gestion d'erreurs de stockage + écran de récupération ; cohérence stylistique.

**Faibles :**
- **`MuscuModule.js` (741 lignes) = objet-dieu** : rendu, édition programmes, brouillons, wake lock, graphiques, historique, recap, XP, permutations. Viole la responsabilité unique.
- **Couplage transverse via `App`** : `this.app.muscu.jourSelectionne`, `this.app.donnees.exporterJSON()`, `this.app.sync`. Pas d'interface.
- **Recalcul intégral à chaque rendu** : `renderAll()` à chaque sauvegarde, **détruit/recrée tous les graphiques** ; XP en O(séances×exos), O(exos²×séances) dans le formulaire de séance.
- **Duplication** : `meilleurE1rm` (progression.js + privé dans xp.js) ; arrondi flex `Math.round(q*f/5)*5` (nutrition.js ×2 + RepasModule) ; état par défaut (Store.charger + DonneesModule.toutEffacer).

### 3.3 Dette technique & zones à risque

- **Anti-patterns :** god object ; re-render global + recréation de Chart ; logique « du jour » (reset minuit) dans `Store`.
- **Composants critiques :** `Store` ; `fusion.js` (corruption silencieuse possible, **non testé**) ; `sanitize.js` (non testé).
- **Dépendance problématique :** `Chart` en **global implicite** (`new Chart(...)` jamais importé).
- **Scalabilité :** sérialisation JSON intégrale à chaque mutation + recalcul O(n²) du XP → dégradation quand l'historique grandit.

---

## 4. Détection des incohérences

Format : **Description · Gravité · Impact utilisateur · Impact technique · Correction.**

### Technique

**T1 — `toutEffacer()` reconstruit un état incomplet (BUG RÉEL).**
`DonneesModule.toutEffacer()` recrée `store.etat` à la main sans `plan`, `repas.planJour`, `courses.jours`, `autoExport`. Or `RepasModule.plan()` = `repas.planJour || etat.plan` → **`undefined`**, puis `plan.map(...)` dans `render()`.
- Gravité : **Élevée** (déclenchement rare). · Utilisateur : onglet Repas plante après remise à zéro, jusqu'au rechargement (où `charger()` réinjecte les défauts). · Technique : deux endroits connaissent la forme de l'état.
- Correction : **fabrique d'état par défaut unique** partagée avec `Store.charger`, ou appeler `charger()` après reset.

**T2 — Re-render global + recréation des graphiques à chaque sauvegarde.**
- Gravité : Moyenne. · Utilisateur : flicker, perte de réactivité mobile. · Technique : O(tout) par micro-action.
- Correction : rendu ciblé, `Chart.update()` au lieu de `destroy()/new`, invalidation sélective.

**T3 — Recalcul XP non mémoïsé, O(n²).**
- Gravité : Moyenne (croît avec l'historique). · Correction : cache d'agrégats invalidé à l'écriture, ou pré-calcul incrémental à l'enregistrement.

**T4 — `fusion.js` et `sanitize.js` critiques mais non testés.**
- Gravité : Moyenne-élevée (corruption silencieuse à l'import/sync). · Correction : tests dédiés (collisions date/id, formes malformées, idempotence).

**T5 — Couplage `app.module.xxx` en dur.**
- Gravité : Faible-moyenne. · Correction : bus d'évènements / interfaces explicites, injection.

**T6 — `Chart` global implicite, duplications.**
- Gravité : Faible. · Correction : wrapper `charts` injectable ; factoriser helpers partagés.

### Métier

**M1 — `moyennesHebdo` n'est pas « ISO » malgré le commentaire** (blocs de 7 jours depuis la 1re pesée). Gravité : Faible. · Correction : corriger le commentaire ou aligner sur des semaines réelles.

**M2 — Signal « force en baisse » bruité en hautes reps** (Epley plafonné à 12). Gravité : Faible. · Correction : combiner volume + e1RM dans `bilanForce` (déjà fait pour l'XP).

**M3 — `brasStagne` suppose des relevés mensuels sans le garantir** (raisonne en index, pas en dates). Gravité : Faible. · Correction : deltas datés (≥ N jours).

**M4 — Trous dans l'arbre de verdict** (ex. rythme ∈ ]0,3;0,5] + taille stable → « Zone grise »). Intentionnel mais non explicité. Gravité : Faible. · Correction : documenter / afficher « pourquoi pas d'action ».

### UX

**U1 — Suppressions sans confirmation ni undo** (pesée, mensuration, séance). Gravité : Moyenne. · Correction : confirmation légère ou toast « Annuler ».

**U2 — Deux remises à zéro hétérogènes** (repas auto à minuit, courses manuel). Gravité : Faible. · Correction : expliciter dans l'UI.

**U3 — Surcharge cognitive onglet Muscu.** Gravité : Faible-moyenne (public expert). · Correction : progressive disclosure.

### Produit

**P1 — Hypothèse mono-utilisateur incompatible avec une cible pluriannuelle.** Un seul état, pas de profil/compte, plan/objectif codés autour d'une personne. Gravité : **Structurelle** (sujet central de la refonte). · Correction : frontière « profil/contexte » dès la modélisation (sans toucher au périmètre synchro).

**P2 — Fonctionnalités sous-exploitées par absence de données d'entrée.** Le readiness/recovery visé (Phase 4) n'a aucune source : pas de sommeil, RPE/RIR réel (RIR = note statique), fatigue, cardio. Récupération non modélisée. Gravité : Moyenne. · Correction : à traiter en Phases 3/4.

---

## Synthèse Phase 1

Application **saine au cœur, fragile à la périphérie** : moteurs métier purs, testés, bien pensés ; couche d'affichage (`MuscuModule`) trop chargée, recalculs non optimisés ; état mono-utilisateur = vraie contrainte pour la vision pluriannuelle.

**Bilan chiffré :** 1 bug réel (**T1**), ~3 dettes structurelles (god object, re-render/charts, scalabilité XP/persistance), ~4 incohérences métier mineures, ~3 frictions UX, 1 contrainte produit structurante (mono-utilisateur).

**Prochaines étapes possibles :** Phase 2 (analyse critique par fonctionnalité) · Phase 4 (focus prioritaire surcharge progressive) · tout l'audit d'affilée puis validation avant toute modification de code.
