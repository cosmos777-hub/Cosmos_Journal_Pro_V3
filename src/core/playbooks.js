// COACH-002 — Playbook Workspace : génération temporaire du contenu Playbook.
//
// Architecture (voir note produit COACH-002) : ce fichier est la couche
// GÉNÉRATION, strictement séparée de la couche PRÉSENTATION (src/ui/playbook.js).
// Il ne connaît rien du DOM, de Coach, ni de coach.js — il consomme une Mission
// (telle que produite par calculations.generateMission(), inchangée) et retourne
// un objet `Playbook` brut : { title, objective, actions, tips, criteria, state }.
//
// Le composant de présentation (ui/playbook.js) ne doit JAMAIS importer ce
// fichier ni connaître son existence — il se contente de recevoir un objet
// Playbook déjà construit, quelle que soit sa provenance. C'est cette séparation
// qui permettra de remplacer entièrement ce fichier par le futur Decision Engine
// (COACH_DECISION_ENGINE.md) sans toucher à une seule ligne d'UI.
//
// Mapping volontairement déterministe et temporaire (Mission → Playbook), sans
// aucune logique IA ni moteur complexe — conforme au périmètre strict de COACH-002.
// Les clés ci-dessous correspondent exactement aux titres produits par
// calculations.generateMission() (core/calculations.js) pour un échantillon
// suffisant (>= 30 trades) — seul cas où coach.js appelle cette fonction.
//
// COACH-POLISH-001 (POLISH-006) : correction grammaticale signalée dans le
// conseil "Réduire le coût de tes émotions" — "N'intervenus manuellement"
// (faute de conjugaison) devient "N'interviens manuellement". Aucun autre
// changement : cette fonction reste par ailleurs strictement identique.
const PLAYBOOK_CATALOG = {
  "Réduire le coût de tes émotions": {
    objective: "Cette semaine, concentre-toi sur la discipline d'exécution plutôt que sur le résultat de chaque trade.",
    actions: [
      "Avant chaque entrée, relis ton plan à voix haute.",
      "N'interviens manuellement qu'après 30 secondes de réflexion.",
      "Note la raison de chaque écart au plan, même minime.",
      "Termine la séance dès que le plan du jour est respecté."
    ],
    tips: [
      "Un Delta émotionnel élevé n'est jamais un jugement sur toi — c'est un signal à corriger, pas une faute à te reprocher."
    ],
    criteria: [
      "5 trades consécutifs sans intervention manuelle.",
      "Delta émotionnel cumulé en amélioration sur les 10 prochains trades."
    ]
  },

  "Réduire les interventions manuelles": {
    objective: "Laisse ton plan s'exécuter jusqu'au bout, sans jugement de dernière minute.",
    actions: [
      "Fixe ton stop et ton objectif avant l'entrée, jamais après.",
      "Ne touche plus à un trade en cours tant que le plan n'est pas invalidé.",
      "Si l'envie d'intervenir apparaît, note-la au lieu d'agir.",
      "Compare le résultat réel au résultat théorique après chaque trade."
    ],
    tips: [
      "L'intervention manuelle donne une impression de contrôle — elle en retire souvent, statistiquement, à ton plan."
    ],
    criteria: [
      "10 trades exécutés sans intervention manuelle.",
      "Écart réel/théorique qui se resserre sur la période."
    ]
  },

  "Améliorer le respect du plan": {
    objective: "Fais du respect du plan ta seule mesure de réussite cette semaine, indépendamment du résultat.",
    actions: [
      "Rédige ton plan de trade avant chaque entrée, jamais pendant.",
      "Valide chaque critère d'entrée un par un avant de cliquer.",
      "Marque chaque trade \"Oui / Partiellement / Non\" sans te justifier.",
      "Revois en fin de journée les trades marqués \"Non\"."
    ],
    tips: [
      "Un trade perdant mais conforme au plan est une réussite comportementale, même s'il n'est pas une réussite financière."
    ],
    criteria: [
      "Taux de respect du plan au-dessus de 90% sur les 10 prochains trades.",
      "Aucun trade non documenté sur la période."
    ]
  },

  "Continuer à construire l'échantillon": {
    objective: "Aucune faiblesse majeure détectée — consolide ce qui fonctionne déjà.",
    actions: [
      "Continue à documenter chaque trade avec la même rigueur.",
      "Relis une fois par semaine tes trades les plus rentables.",
      "Identifie un point fort à renforcer plutôt qu'une faiblesse à corriger."
    ],
    tips: [
      "La régularité de la documentation est elle-même une compétence — elle prépare les futurs Insights de Coach."
    ],
    criteria: [
      "Continuité de la documentation sur les 10 prochains trades.",
      "Aucune régression sur le respect du plan ou le Delta émotionnel."
    ]
  }
};

// Playbook de sécurité (état "Aucun Playbook", COACH-002 §États) : ne devrait
// normalement jamais s'afficher, une Mission possédant toujours une entrée dans
// PLAYBOOK_CATALOG — filet de sécurité si generateMission() évolue sans que ce
// catalogue soit mis à jour en parallèle.
const FALLBACK_PLAYBOOK = {
  objective: "Coach n'a pas encore de plan d'action prédéfini pour cette Mission.",
  actions: [],
  tips: [],
  criteria: []
};

// Point d'entrée unique de ce module. Pure : même Mission en entrée -> même
// Playbook en sortie, aucun effet de bord, aucune lecture de state.data ici
// (déjà lu en amont par coach.js pour produire `mission`).
export function buildPlaybookForMission(mission) {
  const content = PLAYBOOK_CATALOG[mission.title] || FALLBACK_PLAYBOOK;
  const hasContent = content !== FALLBACK_PLAYBOOK;

  return {
    title: mission.title,
    objective: content.objective,
    actions: content.actions,
    tips: content.tips,
    criteria: content.criteria,
    // "none" déclenche l'état de sécurité côté présentation (COACH-002 §États) ;
    // "active" est le seul état atteignable en V1 (pas de suivi de Progress —
    // "completed" est supporté par le composant de présentation mais jamais
    // produit par cette fonction tant que COACH-003 n'existe pas).
    state: hasContent ? "active" : "none"
  };
}