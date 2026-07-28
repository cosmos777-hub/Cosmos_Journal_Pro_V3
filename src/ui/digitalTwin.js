// COACH-005 — Digital Twin Workspace : couche PRÉSENTATION, strictement
// séparée de la couche GÉNÉRATION (core/digitalTwin.js). Même principe que
// ui/playbook.js (COACH-002), ui/progress.js (COACH-003) et
// ui/achievements.js (COACH-004).
//
// Ce composant ne connaît RIEN de la Mission, du Playbook, du Progress, des
// Achievements, ni de core/digitalTwin.js. Il consomme uniquement un objet
// `DigitalTwin` déjà construit :
//
//   {
//     portrait:         string,
//     strengths:        { category, label }[],
//     growthAreas:      string[],
//     coachPerspective: string,
//     state:            "none" | "active" | "consolidated"
//   }
//
// Contrainte produit explicite (COACH-005) : ni avatar, ni jauge, ni
// illustration. Le Digital Twin est un miroir textuel — sa force vient de la
// qualité de la synthèse, jamais d'un habillage graphique. Composant
// volontairement le plus sobre visuellement après les Achievements.
//
// COACH-POLISH-001 (POLISH-006, Product Language) : l'étiquette visible
// "Digital Twin" devient "Profil trader" — le terme "Jumeau Numérique" reste
// exclusivement réservé au Dashboard (courbe réel/théorique, Document 05 §8),
// pour lever toute ambiguïté entre les deux fonctionnalités. Aucun changement
// de structure de données ni d'id DOM (coach-digitaltwin-card, classes
// .digitaltwin-*) : seul le texte affiché change.
import { utils } from "../utils/index.js";

function renderNoneState() {
  return `
    <div class="empty-state coach-digitaltwin-empty">
      <div>
        <h3>Ton profil trader se construit</h3>
        <p class="muted">Coach construit progressivement une compréhension de ton profil de trader — reviens après quelques trades supplémentaires.</p>
      </div>
    </div>
  `;
}

function renderStrengths(strengths) {
  if (!strengths.length) return "";
  return `
    <div class="digitaltwin-section">
      <p class="digitaltwin-section-label">Forces observées</p>
      <div class="digitaltwin-strengths">
        ${strengths.map(s => `<span class="digitaltwin-strength">${utils.escape(s.label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderGrowthAreas(growthAreas) {
  if (!growthAreas.length) return "";
  return `
    <div class="digitaltwin-section">
      <p class="digitaltwin-section-label">Axes de développement</p>
      <ul class="digitaltwin-growth-areas">
        ${growthAreas.map(g => `<li>${utils.escape(g)}</li>`).join("")}
      </ul>
    </div>
  `;
}

export const digitalTwinUi = {
  // container : élément DOM unique dans lequel injecter le Digital Twin (ex.
  // dom["coach-digitaltwin-card"]). digitalTwin : objet DigitalTwin tel que
  // décrit ci-dessus, quelle que soit sa provenance.
  renderDigitalTwin(container, digitalTwin) {
    if (!container) return;

    if (!digitalTwin || digitalTwin.state === "none") {
      container.innerHTML = renderNoneState();
      container.dataset.state = "none";
      return;
    }

    container.dataset.state = digitalTwin.state;

    // Hiérarchie de lecture imposée par COACH-005 : Header -> Portrait ->
    // Forces observées -> Axes de développement -> Perspective du Coach.
    container.innerHTML = `
      <div class="section-header digitaltwin-header">
        <div>
          <p class="eyebrow">Profil trader</p>
          <h3>Le trader que tu es en train de devenir</h3>
        </div>
        ${digitalTwin.state === "consolidated" ? `<span class="badge digitaltwin-state-badge">Profil consolidé</span>` : ""}
      </div>

      <p class="digitaltwin-portrait">${utils.escape(digitalTwin.portrait)}</p>

      ${renderStrengths(digitalTwin.strengths)}
      ${renderGrowthAreas(digitalTwin.growthAreas)}

      <p class="digitaltwin-coach-perspective">${utils.escape(digitalTwin.coachPerspective)}</p>
    `;
  }
};