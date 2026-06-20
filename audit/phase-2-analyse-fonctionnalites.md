# PHASE 2 — Analyse Critique des Fonctionnalités

> Pour chaque fonctionnalité : **Évaluation** (utilité réelle · fréquence d'usage estimée · valeur apportée) — **Limites** (manque · confus · sous-exploité) — **Évolution** (améliorations · simplifications · modularisation).
> Les exigences utilisateur verrouillées (E1-E5, cf. `audit/exigences-utilisateur.md`) sont rattachées aux fonctionnalités concernées.
> Synchro = hors périmètre.

---

## 1. Verdict (arbre de décision recompo)

**Évaluation.** Utilité réelle : **très élevée** — c'est la signature du produit, la transformation données → consigne unique. Fréquence : consultation hebdo/mensuelle (passive). Valeur : différenciante ; peu d'apps osent *trancher*.

**Limites.**
- **Mono-objectif** : l'arbre est câblé pour la *recompo* (poids quasi stable + taille). Inutilisable tel quel pour une **prise de masse** ou une **sèche** assumées (cf. **E5**) — où l'on *veut* monter/descendre vite.
- **Zones mortes non explicitées** (M4) : certains états tombent en « Zone grise » sans dire pourquoi.
- **Conseil en dur** : « retire 30 g de riz » suppose le plan par défaut ; cassé dès que l'utilisateur change de menu (**E1/E2**).
- **N'exploite pas la muscu** : la force/le volume ne nourrissent pas le verdict (alors que `bilanForce` existe déjà à côté).

**Évolution.**
- Rendre l'arbre **paramétré par l'objectif** (masse/sèche/recompo) : seuils de rythme et lecture de la taille adaptés à l'intention. Couplage direct avec **E5**.
- Boucle avec le calculateur : verdict = *ajustement* de la cible calculée, pas conseil isolé sur un aliment. Exprimer la consigne en **kcal/macros** (« −150 kcal ») plutôt qu'« en grammes de riz ».
- Expliciter les zones grises (« pas d'action car… »).
- **Modularisation** : `verdict.js` est déjà pur ; ajouter un paramètre `objectif` à `decisionVerdict` et déplacer les libellés hors du moteur.

---

## 2. Repas / Nutrition (cible + écart)

**Évaluation.** Utilité : **élevée** (saisie quotidienne). Fréquence : **plusieurs fois/jour** — la plus sollicitée. Valeur : modèle « cible + écart » + journal de la réalité = honnête et actionnable.

**Limites (c'est ici que se concentrent E1-E5).**
- **Un seul menu** (`etat.plan`) : impossible de gérer plusieurs régimes/contextes → **E1**.
- **Base d'aliments minuscule** (11 items) → **E2**.
- **Macros pauvres** : kcal + protéines uniquement ; pas de glucides/lipides/fibres → **E3**. Impossible d'« équilibrer » un menu ou d'afficher une répartition.
- **Pas de plats composés** : chaque aliment est saisi à l'unité → **E4**.
- **Cible saisie à la main** : `objectifKcal` est un nombre réglé manuellement, sans calcul de besoin → **E5**.
- **Flex rigide** : seuls riz/avoine s'ajustent ; logique câblée sur ces clés.
- Sous-exploité : le `journalRepas` capture déjà la réalité (bonne base pour des stats nutritionnelles inexistantes aujourd'hui — tendances kcal/macros).

**Évolution.**
- **E1** : `plansAlim[]` + `planActif` (modèle Muscu) + éditeur de menu.
- **E2** : base curée catégorisée + éditeur d'aliments perso.
- **E3** : modèle aliment à macros complètes ; affichage répartition P/G/L ; flex **généralisé** (marquer librement les aliments ajustables) et **optionnel**.
- **E4** : entité « plat » (liste d'aliments réutilisable, macros dérivées).
- **E5** : la cible kcal/macros devient une **sortie du calculateur** (ajustable manuellement en surcharge).
- **Modularisation** : `nutrition.js` (pur) est le bon réceptacle ; en extraire un moteur `aliments`/`plats` et un moteur `cible` (calculateur). `RepasModule` (372 l.) à dégraisser (formulaire hors-plan, réorg, comblement = sous-composants).

---

## 3. Calculateur de besoins (NOUVEAU — E5)

**Évaluation.** Utilité : **élevée** — supprime l'arbitraire du « 2545 kcal » et personnalise réellement. Fréquence : ponctuel (recalcul au changement de poids/objectif). Valeur : transforme l'app de *suivi* en *prescription complète* (besoin → menu → courses → ajustement).

**Limites (à concevoir, n'existe pas).**
- **Données absentes** : stature, âge, sexe ne sont **pas** stockés (les mensurations couvrent tour de taille/bras/cuisse/torse, pas la stature). ⚠ **collision de nommage** « taille » = tour de taille ≠ stature.
- **Niveau d'activité** à dériver des programmes muscu (jours/semaine, volume) — donnée non agrégée aujourd'hui.

**Évolution / conception cible.**
- **Profil** : stature, âge, sexe, (poids = déjà suivi).
- **Chaîne de calcul** : BMR (Mifflin-St Jeor) → × facteur d'activité (TDEE), facteur déduit de la fréquence/volume des séances → ajustement objectif (sèche : déficit ; masse : surplus ; recompo : ~maintenance) → **split macros** (protéines en g/kg de poids, lipides en % des kcal, glucides = reste).
- **Synergie Verdict** : cible calculée = point de départ ; le Verdict l'ajuste sur le réel.
- **Modularisation** : nouveau moteur pur `besoins.js` (BMR/TDEE/macros) — entièrement testable, dans la lignée des moteurs existants.

---

## 4. Muscu — Surcharge progressive

**Évaluation.** Utilité : **très élevée** — le cœur revendiqué. Fréquence : à chaque séance (≈ 5/sem dans le programme type). Valeur : la reco « monter / consolider / deload » + double progression + « comme la dernière fois » = excellent, rare sur le marché.

**Limites.**
- **Pas de RPE/RIR réel saisi** : le RIR n'est qu'une note statique du programme → pas de mesure d'effort/fatigue (bloquant pour readiness, Phase 4).
- **Pas de notion de récupération** (repos entre séances d'un même groupe, fatigue cumulée).
- **`MuscuModule` god object** (741 l.) — tout y est mélangé (cf. Phase 1).
- e1RM plafonné à 12 reps → signal de force émoussé en isolation hautes reps (M2).

**Évolution.**
- Saisir le **RIR/RPE réel par série** (alimente Phase 4 : readiness, charge interne).
- Découper `MuscuModule` : saisie séance · éditeur programmes · progression/charts · recap/XP.
- Exposer un **agrégat d'activité** (jours/volume) consommable par le calculateur **E5**.

---

## 5. Muscu — Système XP & niveaux

**Évaluation.** Utilité : **moyenne-élevée** (motivation/engagement). Fréquence : feedback à chaque enregistrement. Valeur : maligne car **gatée par la vraie progression** (0 XP si pas mieux) — pas du gaming gratuit.

**Limites.**
- **Coût O(n²)** au rendu (Phase 1, T3) — vrai risque à long terme.
- Double échelle (global + par exercice) = un peu opaque ; calibrage des constantes empirique.
- Sous-exploité : aucune **historisation** des niveaux/jalons (pas de timeline « tu es passé Confirmé le … »).

**Évolution.**
- **Mémoïser** les agrégats XP/e1RM (invalidation à l'écriture) ou calcul incrémental à l'enregistrement.
- Garder le concept (bonne mécanique d'engagement), éventuellement timeline de jalons.

---

## 6. Mesures (pesées + mensurations + courbes)

**Évaluation.** Utilité : **élevée** (alimente Verdict). Fréquence : pesée hebdo, mensurations mensuelles. Valeur : la base factuelle de tout.

**Limites.**
- **Suppression sans confirmation/undo** (U1) — risque de perte.
- Pas de **stature/âge/sexe** (requis par **E5**) ; nommage « taille » ambigu.
- Pas de **% de masse grasse** ni d'estimation (utile pour recompo).
- Pas de **photos** (mentionné « hors photos » dans l'historique — délibérément exclu).

**Évolution.**
- Ajouter le **profil** (stature/âge/sexe) — idéalement onglet/écran dédié, pas mélangé aux mensurations récurrentes.
- Undo léger sur suppression.
- Optionnel : estimation masse grasse (méthode Navy à partir tour de taille/cou/hanches).

---

## 7. Courses (liste dérivée du plan)

**Évaluation.** Utilité : **moyenne** (pratique, ferme la boucle plan→conso→achats). Fréquence : hebdo. Valeur : automatisation appréciable.

**Limites.**
- Entièrement **couplée au plan unique** → à réaligner sur **E1** (multi-menus) et **E2/E3/E4** (nouveaux aliments/plats).
- Mapping `cle`↔article par slug = fragile.

**Évolution.**
- Dériver des **menus actifs** (et plats composés) avec le nouveau modèle d'aliments.
- Agréger sur plusieurs menus si pertinent (semaine mixte).

---

## 8. Données (export / import / reset) — hors synchro

**Évaluation.** Utilité : **élevée** (filet de sécurité). Fréquence : ponctuel. Valeur : sérénité, portabilité.

**Limites.**
- **Bug T1** : `toutEffacer()` recrée un état incomplet → crash onglet Repas.
- Export/import devront suivre l'extension du modèle (aliments perso, plats, plans, profil) — versionner le schéma.

**Évolution.**
- Fabrique d'état par défaut **unique** (corrige T1, supprime la duplication).
- **Versionnement de schéma** + migrations explicites (deviendra critique avec E1-E5).

---

## 9. Transverses (RestTimer, brouillons, UI inline, PWA)

**Évaluation.** Chrono de repos, brouillon auto, toasts/modales, offline/PWA, écran de récupération : **bien faits**, faible friction, robustes. À **conserver tels quels**.

**Limites.** RestTimer correct ; brouillon par jour OK. Rien de bloquant.

**Évolution.** Aucun changement prioritaire ; bénéficieront de la modularisation générale.

---

## Synthèse Phase 2

| Fonctionnalité | Utilité | Fréquence | Verdict d'évolution |
|---|---|---|---|
| Verdict | Très élevée | Hebdo/mensuel | Paramétrer par objectif (E5), exprimer en macros |
| Repas/Nutrition | Élevée | Pluri-quotidien | **Refonte majeure E1-E4** |
| Calculateur besoins | Élevée | Ponctuel | **À créer (E5)** — moteur pur `besoins.js` |
| Muscu surcharge | Très élevée | Par séance | Saisir RIR réel, casser le god object |
| XP/niveaux | Moyenne-élevée | Par séance | Conserver + mémoïser (T3) |
| Mesures | Élevée | Hebdo/mensuel | Profil (E5), undo, masse grasse |
| Courses | Moyenne | Hebdo | Réaligner sur multi-menus |
| Données | Élevée | Ponctuel | Corriger T1, versionner le schéma |
| Transverses | — | — | Conserver |

**Le centre de gravité de la refonte = l'onglet Repas** (E1-E5) : il porte la plus forte valeur ajoutée demandée et le plus gros écart avec l'existant. Le **calculateur (E5)** est le liant qui relie profil + muscu + nutrition + verdict en une boucle cohérente.
