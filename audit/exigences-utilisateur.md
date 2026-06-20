# Exigences utilisateur (verrouillées) — refonte nutrition

> Ajouts explicites de l'utilisateur, à intégrer aux livrables d'audit (Phases 2/3/6).
> Verrouillé le 2026-06-20.

## E1 — Multi-menus / programmes d'alimentation
Pouvoir **créer plusieurs menus** et **switcher** entre eux (ex. Sèche / Prise de masse / Maintien), comme la Muscu le permet déjà pour les programmes.
**Mapping :** calquer le modèle Muscu `programmes[]` + `programmeActif` → `plansAlim[]` + `planActif`, sélecteur + éditeur. Aujourd'hui il n'existe qu'un seul `etat.plan` éditable.

## E2 — Grande base d'aliments (catégorisée)
Beaucoup plus d'aliments qu'aujourd'hui (11 codés en dur). Fruits, plats, viandes, féculents, laitages, miel, sucres, etc.
**Approche retenue :** base **curée embarquée ~250-400 aliments** par catégories + **éditeur d'aliments perso**, 100 % hors-ligne, zéro dépendance. OpenFoodFacts + scan code-barres = couche **optionnelle différée (V4)**. Pas de CIQUAL complet (trop lourd, surtout du bruit).

## E3 — Macros complètes par aliment
Stocker **kcal + protéines + glucides + lipides + fibres** (aujourd'hui seulement kcal + prot). Fondation à poser d'emblée (re-migration coûteuse sinon).
**Effet de bord :** généraliser le levier `flex` (ajustement auto des glucides) → optionnel et multi-aliments. Par défaut : « tu composes, l'app calcule l'écart » ; mode auto-flex conservé.

## E4 — Plats composés (recettes)
Un « plat » = liste d'(aliment, quantité) réutilisable d'un tap, macros dérivées des composants. Accélère la saisie quotidienne.

## E5 — Calculateur de besoins caloriques & macros (gros chantier)
Calculer la **cible calorique ET la répartition macros du jour** automatiquement, en fonction de :
- l'**objectif** : prise de masse / sèche / recomposition ;
- les **données anthropométriques** : taille (stature), poids, âge (sexe à prévoir) ;
- le **niveau d'activité dérivé des programmes de muscu** (fréquence/volume des séances).

**Implications :**
- Nécessite un **profil utilisateur** (stature, âge, sexe) — données absentes aujourd'hui.
- ⚠️ Collision de nommage : « taille » dans l'app = **tour de taille** (waist). La stature corporelle est une autre donnée → distinguer « tour de taille » vs « taille/stature ».
- Calcul : BMR (Mifflin-St Jeor recommandé) × facteur d'activité (TDEE) → ajustement selon objectif (surplus / déficit / maintenance recomp) → split macros (prot g/kg, lipides %, glucides = reste).
- **Synergie avec le Verdict** : le calculateur fixe la cible de *départ* ; le Verdict l'ajuste ensuite à partir du réel (boucle de feedback). Aujourd'hui `objectifKcal` est un nombre saisi à la main — il deviendrait une *sortie* du calculateur, ajustable.
