// COACH-003 — Progress Workspace : couche PRÉSENTATION, strictement séparée de
// la couche GÉNÉRATION (core/progress.js). Même principe que ui/playbook.js
// (COACH-002).
//
// Ce composant ne connaît RIEN de la Mission, des trades, ni de
// core/progress.js. Il consomme uniquement un objet `Progress` déjà construit :
//
//   {
//     summary:      string,
//     indicator:    { level: 1-4, label: string } | null,
//     trend:        { state: "progress"|"stable"|"regression", label: string } | null,
//     coachComment: string,
//     state:        "none" | "active" | "completed"
//   }
//
// Contrainte produit explicite : AUCUN pourcentage, AUCUN graphique, AUCUN
// vocabulaire de KPI. L'indicateur principal est rendu comme une suite de
// jalons pleins/vides (jamais un chiffre), pour ne jamais ressembler à un
// composant Dashboard/Analytics — Coach montre une trajectoire, il ne mesure
// pas une performance.
//
// COACH-POLISH-001 (POLISH-006, Product Language) : l'étiquette visible
// "Progress" devient "Progression" — vocabulaire français cohérent avec les
// autres chapitres du Journey Container. Aucun changement de structure de
// données ni d'id DOM : seul le texte affiché change.
import { utils } from "../utils/index.js";

function renderNoneState() {
  return `
    <div class="empty-state coach-progress-empty">
      <div>
        <h3>Pas encore de progression à afficher</h3>
        <p class="muted">Coach a besoin de davantage d'observations pour suivre ton évolution.</p>
      </div>
    </div>
  `;
}

// Jalons qualitatifs (1 à 4) — jamais un pourcentage, jamais un chiffre affiché
// à l'utilisateur. Même esprit que les étoiles de qualité du setup (Journal),
// mais avec un vocabulaire et une classe CSS propres à Coach (jamais réutilisé
// tel quel, pour ne pas laisser penser qu'il s'agit d'une notation).
function renderIndicatorMilestones(level) {
  let dots = "";
  for (let i = 1; i <= 4; i += 1) {
    dots += `<span class="progress-milestone${i <= level ? " filled" : ""}"></span>`;
  }
  return dots;
}

const TREND_ICON = {
  progress: "↗",
  stable: "→",
  regression: "↘"
};

export const progressUi = {
  // container : élément DOM unique dans lequel injecter le Progress (ex.
  // dom["coach-progress-card"]). progress : objet Progress tel que décrit
  // ci-dessus, quelle que soit sa provenance.
  renderProgress(container, progress) {
    if (!container) return;

    if (!progress || progress.state === "none") {
      container.innerHTML = renderNoneState();
      container.dataset.state = "none";
      return;
    }

    container.dataset.state = progress.state || "active";

    // Hiérarchie de lecture imposée par COACH-003 : Header -> Résumé ->
    // Indicateur -> Évolution récente -> Commentaire du Coach.
    container.innerHTML = `
      <div class="section-header progress-header">
        <div>
          <p class="eyebrow">Progression</p>
          <h3>Est-ce que je progresse ?</h3>
        </div>
        ${progress.state === "completed" ? `<span class="badge progress-state-badge">Consolidé</span>` : ""}
      </div>

      <p class="progress-summary">${utils.escape(progress.summary || "")}</p>

      ${progress.indicator ? `
        <div class="progress-indicator">
          <div class="progress-milestones">${renderIndicatorMilestones(progress.indicator.level)}</div>
          <span class="progress-indicator-label">${utils.escape(progress.indicator.label)}</span>
        </div>
      ` : ""}

      ${progress.trend ? `
        <p class="progress-trend progress-trend--${utils.escape(progress.trend.state)}">
          <span class="progress-trend-icon" aria-hidden="true">${TREND_ICON[progress.trend.state] || "→"}</span>
          ${utils.escape(progress.trend.label)}
        </p>
      ` : ""}

      <p class="progress-coach-comment">${utils.escape(progress.coachComment || "")}</p>
    `;
  }
};