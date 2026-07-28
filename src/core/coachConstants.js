// COACH-CORR-001 (CORR-002) — Harmonisation de la notion de "récent" dans Coach.
//
// Avant cette correction, deux définitions différentes du "récent" coexistaient :
// - core/progress.js utilisait une fenêtre de 10 trades ;
// - core/achievements.js utilisait une fenêtre de 20 trades.
//
// Ce fichier centralise cette valeur en une constante unique, réutilisée par les
// deux Workspaces. Aucun autre changement de comportement n'est introduit : seule
// la taille de la fenêtre "récente" de Progress passe de 10 à 20, pour s'aligner
// sur Achievements plutôt que l'inverse (20 trades donne une tendance plus stable
// et cohérente avec le seuil déjà utilisé pour la Régularité).
//
// Emplacement : src/core/coachConstants.js — importé uniquement par les modules
// de génération Coach (core/progress.js, core/achievements.js), jamais par la
// couche présentation (ui/*), conformément à la séparation Business Generator /
// UI Component (PROJECT_STRUCTURE.md, "Coach Architecture").
export const RECENT_TRADES_WINDOW = 20;