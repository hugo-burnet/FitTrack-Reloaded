# PHASE 6 — Architecture Cible

> Conserver l'ADN (vanilla ES modules, **zéro build, zéro dépendance, offline-first**, moteurs purs testés) tout en absorbant E1-E5, les moteurs de charge/readiness (Phase 4) et en corrigeant la dette (god object, couplage, recalcul O(n²), bug T1).
> **Contrainte absolue respectée** : `Sync.js`/`gist.js` et le **protocole de synchro** restent **inchangés**. ⚠ `fusion.js` est partagé entre import et synchro → toute évolution y est signalée comme **« à valider explicitement »** (zone adjacente au périmètre gelé).

---

## 1. Objectifs

- **Modularité** : un fichier = une responsabilité ; casser le god object `MuscuModule`.
- **Maintenabilité** : logique métier en moteurs purs testables ; UI mince qui *rend* l'état.
- **Scalabilité fonctionnelle** : ajouter un score / un menu / un aliment sans toucher au noyau.
- **Extensibilité** : modèle de données versionné + migrations ; frontière « profil/contexte » prête pour le multi-utilisateur ultérieur.
- **Simplicité** : pas de framework, pas de bundler ; on garde le pattern `bind()`/`render()` mais avec **rendu ciblé** et **sélecteurs mémoïsés**.

---

## 2. Diagramme — Architecture ACTUELLE

```
                         ┌────────────┐
                         │   main.js  │
                         └─────┬──────┘
                               ▼
                         ┌────────────┐      ┌──────────────────────────┐
                         │   App.js   │◄────►│ Sync.js ─ gist.js (GELÉ)  │
                         │ routeur +  │      └─────────────┬────────────┘
                         │ renderAll()│                    │ fusion.js (partagé)
                         └─────┬──────┘                    ▼
        ┌────────────┬────────┼────────┬────────────┬───────────┐
        ▼            ▼        ▼        ▼            ▼           ▼
   Mesures      Verdict    Repas     Muscu       Courses     Donnees
   Module       Module     Module   Module★      Module      Module
        │            │        │        │            │           │
        └────────────┴────────┴───┬────┴────────────┴───────────┘
                                   ▼
                            ┌────────────┐   ┌──────────────────────────────┐
                            │  Store.js  │──►│ idb.js (+ localStorage miroir)│
                            │ etat + I/O │   └──────────────────────────────┘
                            │ + migrat.  │
                            └─────┬──────┘
                                  ▼  (moteurs purs, testés)
   stats · progression · xp · nutrition · verdict · bilan · charts · sanitize · data · ui · utils
```
**Problèmes visibles :** `MuscuModule★` surchargé (741 l.) ; `renderAll()` re-rend tout + recrée les charts à chaque écriture ; couplage `app.module.xxx` ; recalcul des agrégats (XP) au rendu ; `Store` mélange persistance + migrations + logique « du jour ».

---

## 3. Diagramme — Architecture CIBLE (en couches)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ COUCHE UI (mince — bind/render ciblé, jamais de calcul métier)             │
│   App (routeur)                                                            │
│   onglets/  Accueil(Dashboard) · Verdict · Repas · Muscu · Mesures ·       │
│             Courses · Donnees · Profil                                     │
│   muscu/    SaisieSeance · EditeurProgrammes · Progression · RecapXP       │  ← MuscuModule éclaté
│   repas/    MenusEditeur · JournalJour · Aliments · Plats · Comblement     │  ← E1-E4
│   ui/       toasts · modales · undo                                        │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ lit des SÉLECTEURS, écrit via des COMMANDES
┌───────────────▼───────────────────────────────────────────────────────────┐
│ COUCHE APPLICATION                                                          │
│   store/  Store (état en mémoire, événements ciblés par tranche)            │
│           selectors/ (mémoïsés, invalidés à l'écriture) → corrige T3        │
│           commands/  (mutations nommées : ajouterSeance, definirObjectif…)  │
│           defaultState() (fabrique unique) → corrige T1                     │
│           persistence (idb + miroir) · schema/migrations (versionné)        │
│   bus/    petit EventTarget (remplace les accès app.module.xxx) → T5        │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ appelle des fonctions PURES
┌───────────────▼───────────────────────────────────────────────────────────┐
│ COUCHE DOMAINE (moteurs purs, testés — le cœur)                            │
│  existants : stats · progression · xp · nutrition · verdict · bilan        │
│  nouveaux  : besoins (BMR/TDEE/macros, E5) · aliments (modèle+DB) ·         │
│              plats (recettes) · charge (sRPE/aiguë/chronique/ACWR/Foster) · │
│              fitnessFatigue (CTL/ATL/TSB) · scores (readiness/recovery/     │
│              risk/progression/compliance) · projection (ETA) · groupes      │
│              (volume par groupe musculaire)                                 │
└───────────────┬───────────────────────────────────────────────────────────┘
                │ s'appuie sur
┌───────────────▼───────────────────────────────────────────────────────────┐
│ DONNÉES & RÉFÉRENTIELS                                                      │
│   data/ aliments-base (curé ~300, catégorisé) · programmes défaut ·         │
│         constantes (formules, repères)                                      │
│   sanitize · fusion(partagé, ⚠) · utils                                     │
├────────────────────────────────────────────────────────────────────────────┤
│   SYNCHRO (GELÉ) : Sync.js · gist.js  ── inchangés                          │
└────────────────────────────────────────────────────────────────────────────┘
```

**Principes clés**
- **UI ne calcule rien** : elle lit des *sélecteurs* (dérivés mémoïsés) et déclenche des *commandes*.
- **Calcul à l'écriture** : `chargeSeance`, agrégats XP/charge stockés/mémoïsés → fin du O(n²) (T3).
- **Rendu ciblé** : événements par tranche d'état (`change:seances`, `change:nutrition`…) → seuls les onglets concernés re-rendent ; charts en `update()` (T2).
- **Bus d'événements** au lieu de `this.app.muscu.xxx` (T5).
- **`defaultState()` unique** consommée par `charger()` ET `toutEffacer()` (T1).

---

## 4. Modèle de données cible (schéma v3, versionné)

```
etat = {
  schema: 3,
  profil:   { stature, age, sexe, ... },                 // NEW (E5) — distinct du tour de taille
  objectif: { type:'masse'|'seche'|'recompo',            // NEW (E5/benchmark)
              cibleKcal, cibleMacros:{p,g,l,fibres},      // sortie du calculateur, surchargée possible
              cublePoids?, echeance? },
  poids: [...], mensurations: [...],                      // inchangés (mensurations.taille = TOUR de taille)

  // --- Nutrition (E1-E4) ---
  aliments:  { base: <référentiel>, perso:[ {id,nom,cat,macros{kcal,p,g,l,fibres}, portions[]} ] },
  plats:     [ {id,nom, items:[[alimentId,qte]], ... } ],   // NEW (E4)
  plansAlim: [ {id,nom, repas:[ {id,nom, items:[[ref,qte,flex?]]} ]} ],  // NEW (E1) ← modèle Muscu
  planAlimActif: <id>,                                       // NEW (E1)
  journalRepas: [...],                                       // + glucides/lipides/fibres (E3)
  repas: { jour, coches, planJour },                        // inchangé (logique du jour)

  // --- Muscu ---
  programmes: [ {..., jours:[ {..., exercices:[ {..., groupe? , pas, gainage,...} ]} ]} ], // + groupe (benchmark)
  programmeActif, seances: [ {..., exercices:[ {..., series:[ {charge,reps,rir?} ]} ],
                              chargeSeance? , rpe? , duree? } ],   // NEW: charge stockée + sRPE (Phase 4)
  brouillons: {...},

  // --- Récupération (Phase 4) ---
  checkins: [ {date, sommeil?, courbatures?, energie?} ],   // NEW

  courses: {...},                                           // dérivé des menus actifs (E1-E4)
  autoExport, dernierEnregistrement
}
```
**Migrations** : `schema:1→2→3` explicites (ex. `objectifKcal` → `objectif.cibleKcal` ; `plan` unique → `plansAlim[0]` ; aliments v2→v3 avec macros complètes). Chaque migration = fonction pure testée.

---

## 5. Interfaces / contrats (exemples)

- **Sélecteurs** (lecture pure, mémoïsée) : `selCibleJour(etat)`, `selConsoJour(etat)`, `selChargeSerie(etat)` (aiguë/chronique/ACWR), `selReadiness(etat,date)`, `selDashboard(etat)`.
- **Commandes** (écriture nommée) : `cmdAjouterSeance(payload)`, `cmdDefinirObjectif(o)`, `cmdRecalculerBesoins()`, `cmdAjouterAlimentPerso(a)`, `cmdSelectionnerMenu(id)`.
- **Moteurs purs** (signatures stables, sans DOM) :
  `besoins.calculer({profil, poids, objectif, activite}) → {kcal, macros}`
  `charge.serie(seances) → {aigue, chronique, acwr, monotonie, strain}`
  `scores.readiness({checkins, charge, force}) → {score, niveau, reco}`
  `projection.eta({serie, cible}) → {semaines, intervalle}`

---

## 6. Plan de migration (étapes · risques · priorités)

> Aligné sur la roadmap (livrable final) : **V2 Stabilisation → V3 Modularisation → V4 Intelligence**.

### Étape 0 — Stabilisation (V2) · **P0**
- Corriger **T1** (`defaultState()` unique).
- Tests sur `fusion.js` / `sanitize.js` (filet avant de bouger le modèle).
- **Risque** : faible. **Bénéfice** : base saine, aucun changement de comportement.

### Étape 1 — Plomberie sans changement fonctionnel (V3) · **P0/P1**
- Introduire **selectors mémoïsés + commands + bus** ; passer `renderAll` → **rendu ciblé** ; charts en `update()`. Corrige **T2/T3/T5**.
- **Éclater `MuscuModule`** en sous-modules (saisie/éditeur/progression/recap).
- **Risque** : moyen (régressions UI possibles) → faire **à iso-fonctionnalité**, écran par écran, en s'appuyant sur les tests des moteurs.

### Étape 2 — Modèle de données v3 + migrations (V3) · **P0 pour E5/E3**
- Ajouter `profil`, `objectif`, macros complètes, `chargeSeance` ; migrations versionnées.
- ⚠ **Risque synchro** : les nouvelles collections transitent dans l'état poussé au Gist (OK), mais `fusion.js` ne sait pas les **réconcilier** (collisions multi-appareils). → proposer des règles de fusion **additives** (par id, même stratégie qu'aujourd'hui) **MAIS** comme `fusion.js` est partagé avec la synchro, **toute modif y est soumise à validation explicite**. Repli sûr : tant que non validé, les nouvelles collections suivent le comportement par défaut (l'état local gagne sur les clés inconnues — pas de perte, fusion fine en attente).

### Étape 3 — Calculateur E5 + nutrition E1-E4 (V3→V4) · **P0/P1**
- Moteurs `besoins`, `aliments`, `plats` ; UI `repas/` refondue ; Verdict **multi-objectif** ; courses dérivées des menus actifs.
- **Risque** : périmètre large → livrer par tranches (d'abord profil+calculateur+macros, puis base d'aliments, puis multi-menus, puis plats).

### Étape 4 — Intelligence de charge (V4) · **P1**
- Moteurs `charge`, `fitnessFatigue`, `scores`, `projection`, `groupes` ; capture RIR/sommeil/courbatures ; **Dashboard d'accueil** ; alertes & recommandations.
- **Risque** : faible techniquement (moteurs purs) ; dépend des données accumulées dans le temps (les courbes se peuplent progressivement).

### Priorités transverses
1. **Ne jamais casser l'offline ni la synchro** (périmètre gelé).
2. **Migrations réversibles et testées** avant tout changement de schéma.
3. **Iso-fonctionnel d'abord** (plomberie), **fonctionnalités ensuite** — pour isoler les régressions.

---

## Synthèse Phase 6

L'architecture cible **ne renie pas l'existant** : elle **généralise ses bonnes idées** (moteurs purs, état unique, bind/render) et **corrige ses défauts** (god object, recalcul au rendu, couplage, état par défaut dupliqué) en introduisant trois mécanismes légers et sans dépendance : **sélecteurs mémoïsés**, **commandes nommées**, **bus d'événements + rendu ciblé**. Le **modèle de données v3 versionné** ouvre la porte à E1-E5 et aux moteurs de charge, tout en gardant la **synchro intacte** (seul `fusion.js`, partagé, fait l'objet d'une réserve explicite à valider). La migration est **séquencée pour livrer de la valeur tôt** (stabilisation → plomberie iso-fonctionnelle → calculateur/nutrition → intelligence de charge), chaque couche restant testable comme l'est aujourd'hui le cœur métier.
