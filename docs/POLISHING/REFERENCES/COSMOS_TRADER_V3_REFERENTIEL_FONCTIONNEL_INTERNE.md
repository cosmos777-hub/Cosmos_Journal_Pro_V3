# COSMOS TRADER V3
## Référentiel fonctionnel interne

**Version :** 1.0  
**Date de consolidation :** Novembre 2026  
**Statut :** Référence interne — non destiné à la publication publique  
**Public visé :** équipe projet et personnes chargées de présenter ou d'accompagner l'utilisation du produit  

---

## Présentation du document

Ce référentiel rassemble les résultats des audits fonctionnels réalisés sur Cosmos Trader V3. Il décrit le fonctionnement réel de l'application tel qu'il a été identifié lors de ces audits, à partir des fichiers source et de la documentation disponibles.

**Ce document ne constitue pas le guide public destiné aux utilisateurs.**

Il sert de référence pour :

- comprendre le fonctionnement réel de Cosmos Trader V3 ;
- accompagner la préparation de la bêta fermée ;
- répondre aux questions fonctionnelles de l'équipe ;
- conserver une trace du travail d'audit réalisé ;
- préparer les futures évolutions sans confondre la V3 et les versions ultérieures.

**Convention de fiabilité utilisée dans ce document :**

- **Confirmé** : comportement directement identifiable dans le code source ou la documentation interne.
- **Déduction** : interprétation raisonnable fondée sur les standards ou le fonctionnement attendu, non démontrée directement.
- **À confirmer** : information qui nécessite une vérification sur l'application réelle avant d'être présentée publiquement.

Les réserves ne sont jamais supprimées pour rendre le document plus concis. Une information incertaine doit rester signalée comme telle.

---

## Table des matières

1. Le Journal
2. Le Dashboard
3. Analytics
4. Le Coach
5. Installation et première utilisation
6. Annexe — Points à confirmer avant publication
7. Traçabilité et historique documentaire

---

# CHAPITRE 1 — LE JOURNAL

## 1.1. Rôle du module

Le Journal est le point d'entrée opérationnel de Cosmos Trader. Il permet d'enregistrer les opérations de trading et de conserver les informations nécessaires à leur analyse ultérieure.

Son rôle ne se limite pas à mémoriser les gains et les pertes. Il rassemble également les informations relatives au contexte du trade, à la stratégie utilisée, au risque engagé, au respect du plan et à l'écart entre le résultat prévu et le résultat obtenu.

Les données enregistrées alimentent ensuite le Dashboard, Analytics et le Coach.

Le Journal repose sur un principe simple : **un trade doit être suffisamment documenté pour que le trader puisse comprendre ce qui s'est passé, et pas seulement constater son résultat financier.**

## 1.2. Enregistrement d'un trade

La création d'un trade s'effectue à travers un assistant de saisie composé de **sept cartes**. Une seule carte est affichée à la fois.

> **Précaution documentaire :** le Journal comporte sept cartes réelles. Toute communication ne doit pas annoncer huit cartes.

### Carte 1 — Compte

L'utilisateur sélectionne le compte auquel rattacher le trade et choisit son niveau de risque.

Les paliers disponibles dépendent du type de compte :

- **Fonds propres :** 5 %, 7,5 %, 10 %, 12,5 % et 15 %.
- **Prop Firm :** 0,25 %, 0,50 %, 0,75 % et 1 %.

Le montant du risque est calculé à partir du capital de référence du compte.

Pour un nouveau trade, le capital initial du compte sert de référence. Lorsqu'un trade existant est modifié, le système conserve son instantané de capital de référence (`riskCapitalSnapshot`), selon les règles de gestion du risque auditées. Ce snapshot est immuable une fois le trade créé, sauf transfert vers un autre compte ou régularisation explicite.

### Carte 2 — Trade

Cette carte rassemble les informations relatives à l'opération :

- date ;
- heure d'entrée ;
- heure de sortie ;
- session ;
- actif ;
- direction.

L'actif est obligatoire. La direction est préremplie sur Buy par défaut.

Les heures ne sont pas obligatoires pour enregistrer le trade, mais elles permettent de calculer sa durée lorsque les deux horaires sont renseignés. Une heure de sortie antérieure à l'heure d'entrée déclenche un avertissement.

**Précaution technique :** la date par défaut est construite à partir de la date UTC. Elle peut différer de la date locale dans certaines situations. **(À confirmer selon le fuseau horaire de l'utilisateur.)**

### Carte 3 — Analyse

Cette carte documente le contexte technique :

- timeframe supérieur (HTF) ;
- timeframe inférieur (LTF) ;
- combinaison HTF/LTF (calculée automatiquement) ;
- stratégie ;
- qualité du setup ;
- confluences.

La stratégie est obligatoire. La qualité du setup et les confluences sont facultatives.

Ces informations permettent notamment de comparer les résultats selon les stratégies et les configurations utilisées dans Analytics.

### Carte 4 — Gestion et résultat

Cette carte rassemble les éléments de gestion du trade et son résultat financier.

L'utilisateur renseigne :

- le RR prévu ;
- le respect du plan ;
- le résultat en devise.

Le RR prévu et le résultat en devise sont nécessaires à la validation du trade.

Le respect du plan est prérempli sur « Oui », mais peut être modifié sur « Partiellement » ou « Non ».

> **Limitation connue :** certains trades anciens ne disposant pas de RR prévu renseigné peuvent voir leur modification bloquée, même lorsqu'elle ne concerne que des informations descriptives.

### Carte 5 — Delta émotionnel

Cette carte présente les informations permettant de comparer le résultat réel au résultat théorique.

Le Delta est calculé automatiquement à partir de ces deux résultats.

L'utilisateur peut préciser si une intervention manuelle a eu lieu et sélectionner des causes émotionnelles lorsque cela correspond à son expérience.

L'intervention manuelle est préremplie sur « Non ».

**Précaution d'interprétation :** le Delta mesure un écart entre le résultat réel et le résultat théorique. Il ne démontre pas, à lui seul, que cet écart est dû à une émotion ou à une intervention particulière. Les informations comportementales apportent du contexte à son interprétation, sans constituer une preuve de causalité.

### Carte 6 — Notes

Cette carte permet d'ajouter :

- un commentaire libre ;
- des tags ;
- une capture HTF ;
- une capture LTF ;
- une capture du résultat.

Les notes et les captures enrichissent la documentation du trade, sans être obligatoires pour son enregistrement.

### Carte 7 — Validation

La dernière carte présente un récapitulatif avant l'enregistrement définitif.

La validation vérifie notamment :

- l'existence d'un compte valide ;
- la validité du capital initial ;
- la présence d'un actif ;
- la présence d'une stratégie ;
- la validité numérique du risque, du RR prévu et du résultat.

Le système effectue donc davantage de contrôles que les seuls champs visuellement marqués comme obligatoires. Certains contrôles concernent la cohérence des données et la validité du compte.

## 1.3. Calculs et indicateurs associés au trade

Cosmos Trader calcule plusieurs valeurs à partir des informations saisies.

**Montant du risque**

```
Montant du risque = Capital de référence × Risque (%)
```

Le montant est arrondi à deux décimales.

**Résultat réel en R**

```
Résultat réel (R) = Résultat en devise / Montant du risque
```

La valeur est arrondie à quatre décimales.

**Résultat théorique**

```
Résultat théorique = RR prévu × Montant du risque
```

**Delta émotionnel**

```
Delta (R) = Résultat réel (R) − RR prévu
Delta (devise) = Delta (R) × Montant du risque
```

Un Delta négatif indique que le résultat réel est inférieur au résultat théorique. Un Delta positif indique qu'il est supérieur. Le Delta ne constitue pas une preuve de causalité émotionnelle.

**Résultat en pourcentage**

```
Résultat (%) = (Résultat en devise / Capital de référence) × 100
```

**Statut du trade** *(confirmé par le code — termes français)*

| Résultat financier arrondi | Statut |
|---|---|
| Positif | Gagnant |
| Négatif | Perdant |
| Nul | BE (Break Even) |

**Distinction zéro / valeur indisponible :** un résultat réel égal à zéro correspond à un Break Even. Une valeur absente ou non calculable est affichée comme indisponible (`—`), et non comme zéro. Cette distinction est appliquée de façon cohérente dans l'historique et dans le Coach.

## 1.4. Historique des trades

L'historique permet de retrouver les opérations enregistrées.

Chaque ligne présente notamment :

- l'actif et la stratégie ;
- la date et la session ;
- les timeframes ;
- un aperçu des notes ;
- les indicateurs Réel, Plan et Delta ;
- l'accès aux captures lorsqu'elles existent ;
- les actions de modification et de suppression.

**L'historique affiche au maximum les 150 trades les plus récents.** Cette limite concerne l'affichage de la liste, pas la conservation des données ni les calculs des autres modules.

L'historique est replié par défaut. Son état d'affichage est mémorisé.

## 1.5. Modification d'un trade

Un trade existant peut être ouvert en mode modification. Le système restaure les informations enregistrées dans l'assistant, y compris les captures disponibles.

Les conséquences financières dépendent des champs modifiés :

- **Modification descriptive :** les informations financières et le capital du compte restent inchangés.
- **Modification du résultat financier :** les indicateurs sont recalculés et le capital du compte est ajusté de la différence.
- **Modification du RR prévu :** le résultat théorique et le Delta sont recalculés, sans modification du capital du compte.
- **Modification explicite du risque :** les indicateurs dérivés sont recalculés sur la base du capital de référence conservé.
- **Transfert vers un autre compte :** le système ajuste les capitaux des comptes concernés selon les règles de transfert auditées.

## 1.6. Suppression d'un trade

La suppression nécessite une confirmation. Elle entraîne :

- le retrait du trade de l'historique ;
- l'ajustement du capital du compte ;
- la suppression des captures associées dans IndexedDB ;
- le nettoyage des références temporaires d'affichage des médias.

Cette action est irréversible dans le fonctionnement normal de l'application. Une sauvegarde préalable est recommandée.

## 1.7. Gestion des captures

Les captures sont stockées séparément des données textuelles, dans IndexedDB (`cosmos_media_v3`).

Les trois emplacements disponibles sont : HTF, LTF et Résultat.

Les méthodes d'ajout identifiées sont :

- la sélection d'un fichier ;
- le glisser-déposer (sur les environnements qui le prennent en charge) ;
- le collage depuis le presse-papiers (lorsque le contexte de l'application le permet).

Les formats de fichiers acceptés par le sélecteur sont PNG, JPEG et WebP.

Les images volumineuses peuvent être compressées avant leur stockage. Le traitement tente de réduire leurs dimensions et leur poids, sans garantir qu'un fichier atteindra une taille cible précise.

Un visualiseur permet de consulter les captures depuis l'assistant de saisie et depuis l'historique, sans devoir entrer en mode modification.

**Précaution :** les comportements du glisser-déposer et du collage peuvent varier selon le navigateur et l'appareil, notamment sur mobile. **(À confirmer sur les environnements cibles.)**

---

# CHAPITRE 2 — LE DASHBOARD

## 2.1. Rôle du module

Le Dashboard constitue la vue d'ensemble de Cosmos Trader. Il est le premier écran affiché à l'ouverture de l'application.

Son objectif est de permettre au trader de comprendre rapidement son état général à partir des données enregistrées.

Il présente une synthèse des résultats, des indicateurs comportementaux, une visualisation de l'évolution réelle et théorique, et une mission de progression.

**Question principale : « Où en suis-je actuellement ? »**

## 2.2. Organisation générale

Le Dashboard est organisé autour de trois ensembles :

1. les indicateurs principaux ;
2. le Jumeau Numérique ;
3. le panneau de pilotage.

Sur mobile, l'ordre de présentation du panneau de pilotage est adapté à l'espace disponible (il apparaît en premier).

## 2.3. Les indicateurs principaux

Les indicateurs sont répartis en deux zones.

**Zone principale (trois colonnes) :**

| Indicateur | Description |
|---|---|
| P&L réel | Somme cumulée des résultats réels, exprimée en pourcentage du risque engagé |
| P&L théorique | Somme cumulée des résultats théoriques (exécution parfaite du plan) |
| Respect du plan | Pourcentage de trades où le plan a été suivi (réponse « Oui ») |

**Panneau de pilotage (colonne droite) :**

| Indicateur | Description |
|---|---|
| Delta émotionnel | Écart entre P&L réel et P&L théorique |
| Winrate | Proportion de trades gagnants parmi les trades valides |
| Capital actuel | Somme des capitaux actuels des comptes concernés par le filtre |

**Précaution d'interprétation des P&L :** le P&L réel et le P&L théorique sont exprimés en pourcentage du risque engagé, selon les métriques utilisées par l'application. Ils ne constituent pas des rendements classiques calculés en pourcentage du capital total du compte. Par exemple, un P&L réel de `+8,00 %` signifie que 8 unités de risque ont été accumulées, et non que le capital a augmenté de 8 %.

Le Delta ne prouve pas, à lui seul, qu'une erreur émotionnelle a été commise.

## 2.4. Le Jumeau Numérique

Le Jumeau Numérique du Dashboard représente une comparaison entre deux trajectoires :

- la **trajectoire réelle** : fondée sur les résultats effectivement obtenus ;
- la **trajectoire théorique** : fondée sur les résultats attendus selon les plans enregistrés.

Cette visualisation aide à observer l'écart entre l'exécution réelle et le scénario théorique. Elle ne constitue pas une promesse de performance ni la preuve qu'une exécution théorique aurait été réalisable dans toutes les conditions de marché.

La courbe est construite à partir des trades et du capital initial utilisé comme référence de calcul.

Lorsque l'historique contient moins de deux points de données, la visualisation n'est pas affichée.

**À ne pas confondre avec le Profil trader du Coach :** le Jumeau Numérique du Dashboard est une représentation graphique de trajectoires financières. Le Profil trader du Coach est une synthèse textuelle de comportements observés. Ces deux éléments sont distincts et complémentaires.

## 2.5. Le panneau de pilotage et le filtre de compte

Un filtre de compte est disponible dans le panneau de pilotage. Il influence les indicateurs et les courbes qui dépendent de la sélection des comptes.

**Périmètre important :** la Mission du moment n'est pas limitée au compte sélectionné. Elle est calculée à partir de l'ensemble des trades, tous comptes confondus.

Un utilisateur peut donc consulter les résultats d'un compte particulier tout en voyant une mission déterminée à partir de son historique complet.

**Précaution sur l'agrégation multi-devises :** lorsque plusieurs comptes de devises différentes sont agrégés dans le capital actuel, leur addition brute peut être trompeuse. L'application ne doit pas être présentée comme effectuant une conversion automatique entre devises.

## 2.6. La Mission du moment

La Mission du moment est une recommandation issue de la logique de génération de mission partagée avec le Coach.

Elle fournit une indication synthétique sur une priorité de progression.

Le Dashboard en affiche une version courte (titre + texte). Le Coach développe cette mission dans un parcours complet, avec un plan d'action, un suivi de progression, des acquis et un profil trader.

La mission repose sur les trades enregistrés et ne dépend pas du filtre de compte du Dashboard.

## 2.7. État initial et données de démonstration

Lorsqu'aucun trade n'est enregistré, le Dashboard présente un état vide : les indicateurs affichent des valeurs neutres ou indisponibles, et la mission initiale invite à construire une base statistique.

Un bouton permet de découvrir l'application avec des données de démonstration. Ces 36 trades fictifs permettent de visualiser immédiatement tous les modules. Ils ne représentent pas les performances de l'utilisateur et doivent être supprimés avant tout usage réel.

---

# CHAPITRE 3 — ANALYTICS

## 3.1. Rôle du module

Analytics est l'espace d'exploration et de comparaison des performances.

Alors que le Dashboard donne une vue synthétique, Analytics permet d'examiner les résultats sous différents angles et selon plusieurs dimensions.

**Question principale : « Quels facteurs sont associés à mes résultats et où se trouvent les différences ? »**

Analytics aide le trader à explorer son historique, à comparer des groupes de trades et à identifier des tendances. Il ne doit pas être présenté comme un système qui démontre automatiquement la causalité d'une performance.

## 3.2. Organisation générale

Le module est organisé autour de quatre blocs :

1. **Contexte** — filtres et indicateurs synthétiques ;
2. **Laboratoire d'exploration** — tableau de comparaison par dimension (centre de gravité du module) ;
3. **Comprendre vos indicateurs** — aide contextuelle statique, repliée par défaut ;
4. **Preuves** — liste des trades correspondant aux filtres, repliée par défaut.

Cette organisation permet de passer d'une vue globale à une comparaison par dimension, puis de retrouver les opérations concernées.

## 3.3. Les filtres

Analytics dispose de huit critères de filtrage :

- compte ;
- actif ;
- session ;
- HTF ;
- LTF ;
- stratégie ;
- date de début ;
- date de fin.

Les filtres peuvent être combinés (logique ET). Les résultats sont recalculés automatiquement à chaque changement de sélection — aucun bouton « Appliquer » n'est nécessaire.

**Précaution sur le filtre de période :** seuls les trades dont la date est au format ISO (`AAAA-MM-JJ`) sont pris en compte lorsqu'un filtre de période est actif. Les trades importés d'une version ancienne avec une date dans un autre format peuvent être exclus de ces analyses. Cette limite est signalée dans l'interface.

## 3.4. Les indicateurs

Analytics présente les indicateurs suivants, calculés sur les trades correspondant aux filtres actifs :

| Indicateur | Description |
|---|---|
| Trades filtrés | Nombre de trades sélectionnés sur le total |
| P&L réel | Somme cumulée des résultats réels |
| P&L théorique | Somme cumulée des résultats théoriques |
| Delta émotionnel | Écart entre P&L réel et P&L théorique |
| Winrate | Proportion de trades gagnants |
| RR moyen | Moyenne des RR obtenus |
| Durée moyenne | Durée moyenne des trades avec heures renseignées |
| Respect du plan | Pourcentage de trades « Oui » |
| Capital actuel | Somme des capitaux des comptes actifs filtrés |
| Drawdown maximum | Plus forte baisse de capital avant reprise |
| Profit Factor | Gains bruts / pertes brutes *(présent dans l'aide contextuelle)* |
| Expectancy | Espérance mathématique par trade en R *(présent dans l'aide contextuelle)* |

**Note sur le Profit Factor et l'Expectancy :** ces deux indicateurs sont présents dans le code et leurs valeurs sont calculées. Leur affichage dans la grille principale a été retiré au profit de l'aide contextuelle statique. Ils ne constituent pas une valeur dynamique personnalisée affichée dans l'aide.

**Précaution sur le drawdown :** le drawdown est calculé sur l'échantillon de trades filtré. Lorsque des filtres autres que le compte sont actifs, ce drawdown ne représente pas le drawdown historique complet du compte.

**Précaution sur l'agrégation multi-devises :** lorsque plusieurs comptes de devises différentes contribuent aux résultats totaux, leur addition brute sans conversion peut produire des totaux trompeurs.

## 3.5. Le tableau de comparaison

Le tableau permet de regrouper les trades selon une dimension choisie par l'utilisateur.

Les dimensions disponibles sont :

- compte ;
- actif ;
- stratégie ;
- session ;
- HTF ;
- LTF ;
- combinaison HTF/LTF ;
- risque ;
- durée (tranches : < 15 min, 15-30 min, 30-60 min, > 60 min) ;
- qualité du setup ;
- respect du plan ;
- intervention manuelle.

Pour chaque groupe, le tableau affiche : nombre de trades, Winrate, Profit Factor, Expectancy, RR moyen, résultat total en devise.

**Le tableau est trié par nombre de trades décroissant.** L'ordre d'affichage ne constitue pas un classement des meilleures performances.

**Aucun seuil minimal de taille de groupe n'a été identifié.** Un groupe contenant très peu de trades peut afficher des indicateurs très variables qui ne sont pas statistiquement représentatifs.

**Précaution d'interprétation :** une différence observée entre deux groupes ne prouve pas qu'une dimension est responsable de cette différence. La taille de l'échantillon, le contexte du marché et les autres facteurs doivent être pris en compte.

## 3.6. La liste des trades correspondants

Le quatrième bloc permet de consulter les opérations qui correspondent à la sélection active.

**La liste est limitée à 150 trades affichés.** Cette limite ne signifie pas que les calculs d'Analytics sont réalisés uniquement sur ces 150 opérations : tous les indicateurs utilisent l'ensemble des trades correspondant aux filtres, sans limitation.

## 3.7. Aide contextuelle

Le troisième bloc explique les notions utilisées dans Analytics, notamment le Profit Factor, l'Expectancy, le Delta et le Drawdown.

Son contenu est statique. Il ne constitue pas une explication personnalisée et dynamique des résultats de l'utilisateur.

## 3.8. Limites et précautions

**Petits échantillons :** un Winrate, un Profit Factor ou une Expectancy calculés sur peu de trades ne constituent pas une preuve statistique solide.

**Multi-devises :** l'agrégation de résultats provenant de comptes de devises différentes peut produire des totaux trompeurs.

**Filtres et drawdown :** le drawdown calculé sur un sous-ensemble filtré ne représente pas le drawdown complet du compte.

**Trades anciens :** les trades dont la date n'est pas au format attendu peuvent être exclus des analyses liées aux dates. Cette limite concerne le format, et non seulement l'absence d'heures.

**Données manquantes :** les opérations incomplètement renseignées peuvent être exclues de certains calculs spécifiques sans être supprimées de l'historique.

---

# CHAPITRE 4 — LE COACH

## 4.1. Rôle du module

Le Coach est l'espace d'accompagnement comportemental de Cosmos Trader.

Il exploite les données enregistrées dans le Journal pour identifier des priorités de progression et proposer des actions concrètes.

**Ce que le Coach n'est pas :** il ne constitue pas un conseiller financier, un système de signaux de marché, un diagnostic psychologique ni un moteur de prédiction.

**Question principale : « Sur quoi dois-je travailler maintenant ? »**

Le Coach s'appuie principalement sur des indicateurs comportementaux (respect du plan, interventions manuelles, Delta émotionnel), et utilise également des mesures dérivées des résultats financiers (Expectancy).

## 4.2. Organisation du parcours

Le Coach est organisé en cinq chapitres accessibles via un conteneur de navigation dédié :

| Ordre | Chapitre | Rôle |
|---|---|---|
| 1 | Mission | Identifier la priorité actuelle |
| 2 | Plan d'action | Proposer des actions concrètes |
| 3 | Progression | Observer l'évolution comportementale |
| 4 | Acquis | Reconnaître les comportements consolidés |
| 5 | Profil trader | Synthèse comportementale |

## 4.3. Les différents états du Coach

Le Coach distingue trois situations :

- **Aucun trade :** l'utilisateur est invité à commencer à documenter son activité.
- **De 1 à 29 trades :** état intermédiaire avec un compteur indiquant combien de trades manquent pour atteindre le seuil.
- **À partir de 30 trades :** le parcours complet devient disponible.

**Précautions sur ce seuil :**

- Il s'applique au total des trades de tous les comptes. Le Coach ne propose pas de filtre de compte.
- Il constitue une condition de fonctionnement définie par le produit, pas une garantie de fiabilité des conclusions.

## 4.4. Génération de la Mission

La mission est déterminée par une série de conditions évaluées dans un ordre précis. La première condition satisfaite détermine la mission affichée.

**Ordre de priorité :**

| Priorité | Condition | Mission déclenchée |
|---|---|---|
| 1 | Aucun trade | Construire une base statistique |
| 2 | Moins de 30 trades | Compléter l'échantillon |
| 3 | Delta cumulé < −3R (sur 30 deltas valides minimum) | Réduire le coût émotionnel |
| 4 | Coût des interventions manuelles > 0,3R d'Expectancy (groupes ≥ 5 trades chacun) | Réduire les interventions manuelles |
| 5 | Respect du plan < 80 % | Améliorer le respect du plan |
| 6 | Aucune condition précédente | Continuer à construire l'échantillon |

**Précautions techniques :**

- Pour la Priorité 3, seules les valeurs de Delta numériquement valides sont cumulées. Les valeurs absentes ne sont pas traitées comme des zéros.
- Ces conditions ne constituent pas des diagnostics absolus. Elles déterminent une priorité selon les règles du produit et les données disponibles.

**Note sur la cohérence interne :** deux fonctions distinctes évaluent des conditions proches — `generateMission()` pour le texte de la mission, et `missionPriority()` pour le niveau d'urgence (Priorité haute / Priorité moyenne / Maintien du cap). Ces deux fonctions fonctionnent de façon indépendante.

## 4.5. Le Plan d'action

Chaque mission est associée à un plan d'action issu d'un **catalogue prédéfini**.

Le plan comprend généralement :

- un objectif ;
- plusieurs actions à appliquer ;
- un conseil ;
- des critères de mesure.

Les plans sont associés aux catégories de missions. Ils ne sont pas générés à partir d'une analyse psychologique personnalisée de chaque utilisateur.

Lorsqu'une mission ne correspond à aucun modèle du catalogue, le système utilise un contenu générique de remplacement.

Le Plan d'action doit être compris comme un cadre de travail structuré, pas comme une prescription individuelle infaillible.

## 4.6. La Progression

La section Progression présente une lecture de l'évolution comportementale sur deux fenêtres de **20 trades** :

- une fenêtre récente (les 20 trades les plus récents) ;
- une fenêtre précédente (les 20 trades d'avant).

**Indicateur qualitatif** fondé sur le taux de respect du plan récent :

| Taux de respect du plan | Niveau | Label |
|---|---|---|
| ≥ 90 % | 4 | Ancré |
| 75 % à 89 % | 3 | Sur la bonne voie |
| 50 % à 74 % | 2 | En construction |
| < 50 % ou absent | 1 | Premiers repères |

L'indicateur est affiché sous forme de jalons visuels — jamais comme un pourcentage.

**Tendance** : comparaison des moyennes de Delta émotionnel entre les deux fenêtres. Un écart supérieur au seuil prévu est considéré comme une progression ; un écart inférieur, comme une régression ; les valeurs intermédiaires, comme stables.

Lorsque la fenêtre précédente ne contient pas assez de trades (< 40 au total), le système affiche une tendance stable avec une indication qu'il est trop tôt pour comparer.

**Précaution :** une amélioration du Delta ne prouve pas automatiquement une meilleure maîtrise émotionnelle. Elle indique une évolution de l'écart entre résultats réels et théoriques.

## 4.7. Les Acquis

La section Acquis présente quatre comportements évalués :

| Acquis | Catégorie | Condition |
|---|---|---|
| Fidèle au plan | Discipline | Taux de respect du plan ≥ 90 % sur tous les trades |
| Taille de risque maîtrisée | Gestion du risque | Les 20 derniers trades ont exactement le même pourcentage de risque |
| Journal tenu avec constance | Régularité | Au moins 50 trades documentés |
| Patience d'exécution | Psychologie | Taux d'absence d'intervention manuelle ≥ 90 % sur les 20 derniers trades |

Les acquis sont recalculés à chaque ouverture du Coach. Ils ne sont pas enregistrés comme des récompenses permanentes. Un acquis peut donc apparaître ou disparaître selon l'évolution des données.

Le statut est binaire : acquis ou non acquis.

L'ordre du catalogue détermine l'ordre d'affichage. Le dernier acquis affiché ne correspond pas nécessairement au dernier acquis obtenu chronologiquement.

**Précautions d'interprétation :**

- Un risque constant ne signifie pas que le risque choisi est adapté.
- Une absence d'intervention manuelle ne prouve pas que chaque décision était correcte.
- Un respect élevé du plan ne démontre pas que la stratégie est rentable.
- Un grand nombre de trades documentés ne garantit pas leur qualité.

Les Acquis mesurent des critères définis par l'application. Ils ne constituent pas des certifications de compétence.

## 4.8. Le Profil trader

La section Profil trader synthétise des informations issues de la mission, du plan d'action, de la progression et des acquis.

Elle peut présenter :

- un portrait synthétique ;
- des forces observées ;
- des axes de progression ;
- une perspective à long terme.

Ce profil est une synthèse construite à partir des indicateurs de l'application. Il ne s'agit ni d'un test psychologique ni d'une description exhaustive de la personnalité du trader.

**Distinction importante :**

| Élément | Module | Nature |
|---|---|---|
| Jumeau Numérique | Dashboard | Comparaison graphique des trajectoires financières réelle et théorique |
| Profil trader | Coach | Synthèse textuelle des comportements observés |

## 4.9. Limites de fonctionnement

- **Pas de complétion automatique de mission :** il n'existe pas de mécanisme général de validation d'une mission accomplie. Une mission peut changer lorsque les conditions qui l'avaient déclenchée ne sont plus réunies, sans célébration ni transition explicite.
- **Recalcul complet à chaque ouverture :** les priorités, la progression et les acquis sont entièrement recalculés depuis les données brutes. Le Coach ne mémorise pas d'état entre les sessions.
- **Données manquantes :** les trades sans Delta valide, sans respect du plan renseigné ou sans intervention manuelle documentée peuvent empêcher certaines conditions ou certains acquis de se déclencher.
- **Agrégation tous comptes :** le Coach travaille sur l'ensemble des trades, sans filtre de compte possible.
- **Partage de fonctions :** le Coach partage des fonctions de calcul avec le Dashboard et Analytics, mais il ne dépend pas fonctionnellement de ces modules.

---

# CHAPITRE 5 — INSTALLATION ET PREMIÈRE UTILISATION

## 5.1. Philosophie et public cible

Cosmos Trader est un journal de trading destiné aux traders qui disposent déjà d'une méthode et souhaitent mieux comprendre leurs résultats et leur comportement d'exécution.

L'application s'adresse notamment aux traders utilisant des comptes personnels ou des comptes de prop firm, avec des styles de trading variés (day trading, scalping, swing trading).

Son objectif est de dépasser le simple suivi du P&L en mettant en relation les résultats obtenus, les résultats théoriques et les informations relatives à l'exécution.

**La promesse produit repose sur trois principes :**

1. enregistrer les trades de manière structurée ;
2. comprendre les écarts entre résultats réels et théoriques ;
3. identifier des priorités de progression à partir des données.

## 5.2. Accès à l'application

La version auditée est distribuée via une adresse web hébergée sur GitHub Pages.

> **L'URL exacte de production n'a pas été fournie lors des audits. Elle doit être ajoutée à la documentation finale et utilisée dans les supports de présentation.**

Aucune distribution via un store desktop ou mobile n'a été identifiée dans le périmètre audité.

## 5.3. Installation sur ordinateur

L'application peut être utilisée directement depuis un navigateur compatible.

Elle dispose d'un manifeste PWA déclarant le mode `standalone`, ce qui permet une installation autonome lorsque le navigateur et le système prennent en charge cette fonctionnalité.

**Sur Chrome et Edge (procédure générale — déduction basée sur les standards PWA) :**

1. ouvrir l'adresse de l'application ;
2. utiliser l'option d'installation proposée par le navigateur (icône dans la barre d'adresse) ;
3. confirmer l'installation ;
4. ouvrir Cosmos Trader depuis son raccourci.

Le mode installé permet d'utiliser l'application dans une fenêtre dédiée, sans l'interface de navigation habituelle.

**Précautions :**

- Firefox desktop et Safari desktop ne doivent pas être annoncés comme compatibles avec l'installation PWA sans vérification préalable sur les environnements ciblés.
- La compatibilité exacte et les procédures d'installation doivent être confirmées sur les versions de navigateurs retenues pour la bêta.

## 5.4. Installation sur iPhone et iPad

Sur iOS, la procédure de référence pour ajouter l'application à l'écran d'accueil passe par Safari.

**Étapes générales :**

1. ouvrir l'adresse de Cosmos Trader dans Safari ;
2. appuyer sur le bouton de partage ;
3. sélectionner l'option « Sur l'écran d'accueil » ;
4. confirmer le nom et l'ajout ;
5. lancer l'application depuis son icône.

Le manifeste déclare le mode `standalone`, prévu pour permettre une ouverture sans l'interface habituelle de Safari.

Des comportements spécifiques à WebKit ont été rencontrés pendant le développement et ont fait l'objet de corrections. D'autres comportements spécifiques restent possibles.

La procédure doit être vérifiée sur les versions d'iOS retenues pour la bêta.

**Précaution de sauvegarde :** les données d'une PWA iOS sont soumises aux politiques de stockage du système. Il ne faut pas affirmer sans vérification que chaque installation sera automatiquement effacée après exactement sept jours d'inactivité. La recommandation sûre est d'exporter régulièrement les données et avant toute désinstallation ou opération de maintenance.

## 5.5. Installation sur Android

Sur Android, Chrome constitue le navigateur de référence recommandé.

**Procédure générale :**

1. ouvrir l'adresse de Cosmos Trader dans Chrome ;
2. utiliser l'option « Installer l'application » ou « Ajouter à l'écran d'accueil » lorsqu'elle est proposée ;
3. confirmer l'ajout ;
4. lancer l'application depuis son icône.

La présentation exacte des options peut varier selon la version de Chrome et le fabricant de l'appareil. Les étapes doivent être confirmées sur un appareil Android réel avant de produire un tutoriel illustré définitif.

## 5.6. Première ouverture

Lors de son initialisation, l'application affiche un écran de démarrage, puis ouvre le Dashboard.

En l'absence de trades enregistrés, le Dashboard présente des valeurs neutres et une mission initiale invitant à construire une base statistique.

Le projet contient un compte par défaut : « Compte Perso 40$ », type Fonds propres, en USD. Ce compte précréé facilite la découverte, mais ne constitue pas le compte réel de chaque utilisateur.

**Avant d'enregistrer de véritables trades, l'utilisateur doit vérifier :**

- le nom du compte ;
- le type (Fonds propres ou Prop Firm) ;
- le capital initial ;
- la devise.

Le type de compte détermine les paliers de risque disponibles dans le Journal. Le capital initial est une référence importante pour tous les calculs de risque. Il est essentiel de le vérifier avant de commencer à documenter une activité réelle.

## 5.7. Découverte avec les données de démonstration

Un bouton permet de découvrir Cosmos Trader avec un jeu de données prédéfini. Le jeu audité contient 36 trades de démonstration rattachés au premier compte actif.

Ces opérations sont fictives. Elles ne représentent pas les performances de l'utilisateur.

Avant de commencer son propre journal, l'utilisateur doit supprimer les données de démonstration à l'aide de la fonction de réinitialisation du Journal, après confirmation.

Cette étape doit être expliquée clairement afin d'éviter que des données fictives soient mélangées à un historique réel.

## 5.8. Parcours minimal de première utilisation

Pour commencer à utiliser Cosmos Trader avec ses propres opérations :

1. vérifier ou créer le compte de trading et son capital initial ;
2. ouvrir le Journal ;
3. sélectionner le compte et le niveau de risque ;
4. renseigner l'actif, les informations du trade et la stratégie ;
5. documenter le RR prévu et le résultat ;
6. compléter les informations comportementales et les notes lorsque cela est pertinent ;
7. valider l'enregistrement.

Les captures, les confluences, la qualité du setup et certaines informations complémentaires peuvent être ajoutées progressivement. Elles enrichissent l'analyse mais ne sont pas toutes indispensables à l'enregistrement.

> **Le Journal comporte sept cartes réelles. La documentation ne doit pas annoncer huit cartes.**

## 5.9. Utilisation quotidienne

| Moment | Action recommandée |
|---|---|
| Après chaque trade | Enregistrer l'opération dans le Journal |
| En fin de journée ou de semaine | Consulter le Dashboard pour l'état général |
| Pour analyser ses résultats | Utiliser Analytics et explorer les dimensions pertinentes |
| À partir de 30 trades | Consulter le Coach pour identifier la priorité comportementale |

Le Coach reste accessible avant 30 trades, mais présente un état intermédiaire sans parcours complet.

## 5.10. Stockage et fonctionnement hors ligne

Cosmos Trader conserve toutes les données localement dans le navigateur.

| Type de données | Emplacement |
|---|---|
| Données textuelles (trades, comptes, paramètres) | localStorage — clé `cosmos_v3_data` |
| Captures d'écran | IndexedDB — base `cosmos_media_v3` |

Le Service Worker met en cache les ressources nécessaires au fonctionnement de l'application. Après une première visite réussie, l'application peut fonctionner hors ligne.

Les données ne sont pas automatiquement synchronisées vers un compte cloud. Elles restent liées à l'environnement de stockage utilisé.

**Changer de navigateur, changer d'appareil, effacer les données du site ou désinstaller l'application peut entraîner une perte des données locales. Une sauvegarde préalable est indispensable.**

## 5.11. Export et import

**Export JSON standard :** sauvegarde les données textuelles (trades, comptes, paramètres, préférences). Fichier léger, sans les captures.

**Export avec captures :** inclut les captures sous forme de données encodées. Le fichier est plus volumineux mais constitue une sauvegarde complète.

**Import :** restaure une sauvegarde ou transfère les données vers un autre environnement. L'import remplace intégralement les données actuelles après confirmation. Il ne doit pas être utilisé sans avoir vérifié le fichier et sauvegardé les données déjà présentes.

**Règles de sauvegarde :**

- exporter régulièrement les données ;
- exporter avant de changer d'appareil ou de navigateur ;
- exporter avant une désinstallation ou une opération susceptible d'effacer les données ;
- utiliser l'export avec captures lorsque les médias doivent être conservés ;
- conserver les fichiers de sauvegarde dans un emplacement distinct de l'appareil utilisé.

---

# ANNEXE A — PRÉCAUTIONS ET LIMITES CONSOLIDÉES

Les précautions suivantes sont maintenues explicitement dans ce référentiel et ne doivent pas disparaître lors de révisions ultérieures.

| Précaution | Module concerné |
|---|---|
| Le Journal comporte 7 cartes réelles — ne pas annoncer 8 cartes | Journal |
| L'historique du Journal affiche au maximum 150 trades | Journal |
| Analytics affiche au maximum 150 trades dans sa liste, sans limiter ses calculs à ces 150 | Analytics |
| Le Dashboard et le Coach calculent la Mission à partir de tous les trades, sans tenir compte du filtre de compte du Dashboard | Dashboard / Coach |
| Le Coach reste accessible avant 30 trades, mais son parcours complet nécessite ce seuil | Coach |
| Le Delta mesure un écart entre résultats réels et théoriques — il ne prouve pas à lui seul une cause émotionnelle | Journal / Dashboard / Coach |
| Les P&L Dashboard sont exprimés en pourcentage du risque engagé, non en rendement sur capital | Dashboard |
| Les données sont stockées localement — aucune synchronisation cloud automatique | Stockage |
| L'export avec captures est distinct de l'export JSON standard | Stockage |
| L'agrégation de comptes en devises différentes doit être interprétée avec prudence | Dashboard / Analytics |
| Le drawdown calculé sur une sélection filtrée ne représente pas le drawdown complet du compte | Analytics |
| Les Acquis du Coach sont recalculés à chaque ouverture — ils ne sont pas permanents | Coach |
| Certains trades anciens sans RR prévu renseigné peuvent voir leur modification bloquée | Journal |
| La politique de suppression des données PWA sur iOS ne doit pas être présentée comme une règle universelle de 7 jours | Installation |

---

# ANNEXE B — POINTS À CONFIRMER AVANT PUBLICATION

Les éléments suivants doivent être vérifiés sur l'application réelle avant d'être présentés comme des garanties publiques.

| Sujet | État |
|---|---|
| Nombre de cartes du Journal | 7 cartes — confirmé |
| Logique générale des calculs du Journal | Confirmé par audit |
| Limite de 150 trades dans l'historique Journal | Confirmé |
| Logique générale du Dashboard | Confirmé par audit |
| Mission du Dashboard non filtrée par compte | Confirmé |
| Filtres et regroupements Analytics | Confirmé par audit |
| Limite de 150 trades dans la liste Analytics (calculs non limités) | Confirmé |
| Logique de génération des missions du Coach | Confirmé par audit |
| Seuil de 30 trades pour le parcours complet du Coach | Confirmé |
| Compte par défaut précréé (40 $) | Confirmé |
| 36 trades de démonstration | Confirmé |
| Stockage local et fonctions export/import | Confirmé |
| URL exacte de production | **À renseigner** |
| Procédures d'installation sur chaque navigateur et appareil | **À confirmer en conditions réelles** |
| Politique précise d'éviction des données iOS | **Ne pas présenter comme une règle universelle sans vérification** |
| Compatibilité officielle des navigateurs | **À définir et vérifier** |
| Comportements spécifiques à WebKit sur iOS | **À vérifier sur les appareils cibles** |
| Comportement exact des captures sur chaque appareil mobile | **À confirmer selon les appareils** |
| Date par défaut et décalage UTC/local | **À confirmer selon les fuseaux horaires concernés** |

---

# SECTION 7 — TRAÇABILITÉ ET HISTORIQUE DOCUMENTAIRE

## Missions d'audit réalisées

| Mission | Module couvert | Date approximative |
|---|---|---|
| Mission 04 | Dashboard | Novembre 2026 |
| Mission 05 | Analytics | Novembre 2026 |
| Mission 06 | Coach | Novembre 2026 |
| Mission 07 | Installation et première utilisation | Novembre 2026 |
| Mission 08 | Formalisation du référentiel (présent document) | Novembre 2026 |

> **Note :** les audits du Journal ont été réalisés dans le cadre d'un cycle antérieur (non numéroté dans cette série). Les informations du Journal proviennent du référentiel consolidé fourni comme source principale pour la Mission 08.

## Méthode d'audit

Les audits ont été réalisés par analyse statique des fichiers source et de la documentation disponibles dans le contexte du projet. Aucun test dynamique sur navigateur n'a été effectué dans le cadre de ces missions.

Les comportements qui nécessitent une vérification en conditions réelles sont signalés explicitement dans ce document.

## Périmètre de ce référentiel

Ce document décrit Cosmos Trader V3 tel qu'il a été audité. Il ne décrit pas de fonctionnalités envisagées pour des versions futures.

Toute nouvelle fonctionnalité ou évolution envisagée relève d'un périmètre V4 ou ultérieur et ne doit pas être intégrée rétroactivement à cette documentation comme si elle existait déjà dans la V3.

## Emplacement recommandé dans le dépôt

> Ce document n'a pas été écrit directement dans le dépôt GitHub. Il est fourni sous forme de fichier Markdown prêt à être placé manuellement.

**Chemin recommandé :**

```
docs/COSMOS_TRADER_V3_REFERENTIEL_FONCTIONNEL_INTERNE.md
```

Si le dossier `docs/` n'existe pas, il peut être créé. Ce fichier ne doit pas remplacer ni écraser les documents techniques existants (`PROJECT_STATUS.md`, `DECISIONS_LOG.md`, etc.) qui restent des références de développement distinctes.

---

*Fin du référentiel fonctionnel interne — Cosmos Trader V3 — Version 1.0*
