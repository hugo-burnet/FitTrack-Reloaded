# PHASE 3 — Recherche des Fonctionnalités Manquantes

> Analyse critique : ce que le produit *ne capture pas, ne calcule pas, ne montre pas, ne décide pas, n'automatise pas* — au regard de sa finalité (recompo pilotée) et des exigences verrouillées (E1-E5).
> Les éléments « charge / récupération / surcharge progressive » sont survolés ici et **approfondis en Phase 4** (focus prioritaire).
> Légende valeur : ⭐ utile · ⭐⭐ fort · ⭐⭐⭐ structurant.

---

## 1. Données manquantes

### Progression
- **RIR/RPE réel par série** ⭐⭐⭐ — aujourd'hui le RIR est une *note statique* du programme, jamais mesuré. Sans lui : pas d'effort réel, pas de fatigue, pas de readiness (Phase 4).
- **Tempo / cadence réelle** ⭐ — seul « contraction 2 s » existe en flag statique.
- **Historisation des jalons** ⭐ — montées de niveau, PR datés (le PR est recalculé mais jamais figé dans une timeline).

### Récupération
- **Sommeil** (durée/qualité) ⭐⭐⭐ — totalement absent, alors que le Verdict *recommande déjà* « vérifie ton sommeil » sans aucune donnée.
- **Courbatures / fraîcheur ressentie** (échelle simple) ⭐⭐.
- **Jours de repos / délai depuis la dernière séance d'un groupe musculaire** ⭐⭐ (calculable depuis les séances mais non exploité).
- **Stress / énergie subjective** ⭐ (check-in quotidien léger).

### Charge
- **Charge interne par séance** (volume × intensité × RIR) ⭐⭐⭐ — base de l'aigu/chronique (Phase 4).
- **Agrégat d'activité hebdo** (jours entraînés, volume total) ⭐⭐ — requis aussi par le **calculateur E5**.
- **Cardio / NEAT / pas** ⭐ — aucune dépense hors muscu (impacte le TDEE de E5).

### Contextuelles
- **Profil : stature, âge, sexe** ⭐⭐⭐ — prérequis dur de **E5**. ⚠ « taille » actuel = tour de taille ≠ stature.
- **Objectif courant** (masse / sèche / recompo) ⭐⭐⭐ — pilote E5 *et* le Verdict (qui doit devenir multi-objectif).
- **Macros complètes consommées** (glucides/lipides/fibres) ⭐⭐⭐ — **E3** ; aujourd'hui seules kcal+prot sont journalisées.
- **% masse grasse** (saisi ou estimé Navy) ⭐⭐ — clé pour juger une recompo.
- **Hydratation / pas d'eau, blessures, cycle (si pertinent)** ⭐ (contexte optionnel).

---

## 2. Métriques manquantes

### Tendances
- **Tendance kcal/macros réelles sur 7/30 j** ⭐⭐ — le `journalRepas` contient la donnée, aucune tendance n'en est tirée.
- **Tendance de volume d'entraînement** (par groupe musculaire) ⭐⭐.
- **Adhérence nutrition élargie** ⭐ — aujourd'hui seulement « protéines X/7 » ; étendre à kcal et aux autres macros.

### Ratios
- **Ratio charge aiguë / chronique (ACWR)** ⭐⭐⭐ — *cf. Phase 4*.
- **Protéines en g/kg de poids** ⭐⭐ — plus parlant que des grammes absolus (et cohérent avec E5).
- **Volume par groupe musculaire / semaine** vs repères (10-20 séries) ⭐⭐.
- **Répartition macros en % des kcal** ⭐ (E3).

### Scores composites
- **Readiness / Recovery / Risk / Progression / Compliance** ⭐⭐⭐ — *cf. Phase 4* (cœur du brief). Aucun n'existe.
- **Score de qualité de recompo** (taille ↓/stable + force ↑ + poids maîtrisé) ⭐⭐ — synthèse unique de la trajectoire.

### Corrélations
- **Sommeil ↔ performance/force** ⭐⭐ (dès que le sommeil est capté).
- **Apport calorique ↔ rythme de poids** ⭐⭐ — calibrer le vrai TDEE empiriquement (boucle E5↔réel).
- **Adhérence protéines ↔ progression force** ⭐.
- **Volume ↔ progression e1RM** (rendements décroissants) ⭐.

---

## 3. Visualisations manquantes

### Dashboards
- **Tableau de bord d'accueil unifié** ⭐⭐⭐ — aujourd'hui le 1er écran = Verdict seul. Manque une vue « état du jour » : readiness, cibles macros restantes, prochaine séance, alertes.

### Heatmaps
- **Calendrier d'assiduité** (séances + adhérence nutrition par jour) ⭐⭐ — type « contribution graph ».
- **Heatmap volume par groupe musculaire × semaine** ⭐⭐ — détecte les groupes négligés.

### Évolution temporelle
- **Courbe kcal/macros réelles dans le temps** ⭐⭐ (donnée déjà là).
- **Courbe de charge (aiguë vs chronique)** ⭐⭐⭐ — *cf. Phase 4*.
- **Trajectoire poids vs taille superposée à l'objectif** ⭐ (enrichir l'existant).

### Analyse comparative
- **Comparaison de périodes** (ce mois vs précédent : force, volume, poids, adhérence) ⭐⭐.
- **Par groupe musculaire / par menu** ⭐.
- **Projection de progression** (extrapolation rythme → ETA d'un objectif de poids/charge) ⭐⭐ — *cf. Phase 4*.

---

## 4. Aides à la décision manquantes

### Alertes
- **Surcharge / sous-charge d'entraînement** ⭐⭐⭐ — *cf. Phase 4*.
- **Stagnation** (force plate sur N semaines) ⭐⭐ — `bilanForce` détecte le déclin, pas la stagnation prolongée.
- **Dérive nutritionnelle** (kcal réelles s'éloignant durablement de la cible) ⭐⭐.
- **Récupération insuffisante** (manque de sommeil + force en baisse) ⭐⭐.
- **Cible protéines régulièrement ratée** ⭐.

### Recommandations
- **Verdict multi-objectif** ⭐⭐⭐ — adapter la consigne à masse/sèche/recompo (Phase 2).
- **Reco de deload programmée** ⭐⭐ — après X semaines de charge montante (Phase 4).
- **Reco d'ajustement calorique chiffrée** (en kcal/macros, pas en grammes de riz) ⭐⭐ — liée à E5.
- **Suggestion de rééquilibrage de volume** entre groupes ⭐.

### Détection de dérive
- **TDEE réel vs estimé** ⭐⭐ — si le poids ne bouge pas comme prévu, recaler la cible E5 automatiquement.
- **Dérive d'adhérence** (baisse progressive du respect du plan) ⭐.

### Détection de surcharge
- ⭐⭐⭐ — *cf. Phase 4* (ACWR, fatigue cumulée, monotonie/strain).

---

## 5. Automatisations manquantes

### Suggestions intelligentes
- **Comblement multi-macros** ⭐⭐ — aujourd'hui le comblement ne vise que les protéines ; l'étendre à kcal/glucides/lipides (E3).
- **Suggestion de menu/plat** selon cibles restantes et objectif ⭐⭐ (E1/E4/E5).
- **Suggestion de substitution d'aliment** (équivalent macro) ⭐.

### Pré-remplissage
- **« Comme la dernière fois »** existe en muscu ⭐ — à **étendre à la nutrition** (journée type, repas récurrents).
- **Pré-remplissage du profil/objectif** au 1er lancement (onboarding guidé) ⭐⭐ — clé pour E5.

### Ajustements automatiques
- **Cible calorique auto-ajustée** par la boucle calculateur↔verdict↔poids réel ⭐⭐⭐ (E5 + Verdict).
- **Flex généralisé auto** ⭐⭐ — répartir l'écart kcal sur les aliments marqués ajustables (E3).
- **Progression de charge proposée et pré-appliquée** dans le formulaire (déjà semi-fait via la reco) ⭐.

### Génération de recommandations
- **Synthèse hebdomadaire automatique** ⭐⭐ — « bilan de la semaine » consolidé (force, nutrition, charge, readiness) en un texte court.
- **Plan de la semaine** (séances + menus + courses) généré depuis programme + objectif ⭐.

---

## Synthèse Phase 3 — Top priorités émergentes

| # | Manque | Catégorie | Valeur | Dépend de |
|---|---|---|---|---|
| 1 | Profil (stature/âge/sexe) + objectif courant | Donnée contextuelle | ⭐⭐⭐ | prérequis E5 |
| 2 | Calculateur cible kcal/macros (boucle auto) | Auto/décision | ⭐⭐⭐ | E5 |
| 3 | Macros complètes (capture + métriques) | Donnée/métrique | ⭐⭐⭐ | E3 |
| 4 | RIR/RPE réel + charge interne | Donnée/charge | ⭐⭐⭐ | Phase 4 |
| 5 | Scores readiness/recovery/risk/progression | Score composite | ⭐⭐⭐ | Phase 4 |
| 6 | Sommeil + récupération | Donnée récup | ⭐⭐⭐ | scores Phase 4 |
| 7 | Verdict multi-objectif | Décision | ⭐⭐⭐ | objectif + E5 |
| 8 | Dashboard d'accueil unifié | Visualisation | ⭐⭐⭐ | agrège tout |
| 9 | ACWR + courbe de charge + alertes surcharge | Charge/alerte | ⭐⭐⭐ | Phase 4 |
| 10 | Tendances kcal/macros + adhérence élargie | Métrique | ⭐⭐ | E3 |

**Constat clé.** Beaucoup de manques sont **bloqués par une poignée de données d'entrée absentes** : profil, objectif, RIR réel, sommeil, macros complètes. Capter ces 5 entrées **débloque en cascade** la majorité des métriques, scores, visualisations et automatisations ci-dessus. C'est le meilleur levier de la refonte.
