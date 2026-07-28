// COACH-002 — Playbook Workspace : couche PRÉSENTATION, strictement séparée de
// la couche GÉNÉRATION (core/playbooks.js).
//
// Ce composant ne connaît RIEN de la Mission, de calculations.generateMission(),
// ni du catalogue temporaire de core/playbooks.js. Il consomme uniquement un
// objet `Playbook` déjà construit :
//
//   {
//     title:     string,            // repris à titre informatif (non affiché ici)
//     objective: string,            // phrase courte, formulée positivement
//     actions:   string[],          // liste d'actions courtes et observables
//     tips:      string[],          // conseils pratiques, ton mentor
//     criteria:  string[],          // critères de réussite, mesurables
//     state:     "active" | "completed" | "none"
//   }
//
// C'est cette séparation qui permettra, lors de l'arrivée du véritable
// Decision Engine (COACH_DECISION_ENGINE.md), de remplacer entièrement
// core/playbooks.js sans modifier une seule ligne de ce fichier : n'importe
// quelle source (catalogue statique aujourd'hui, moteur déterministe ou IA
// demain) n'a qu'à produire un objet respectant cette forme.
//
// Le composant s'appuie uniquement sur un conteneur DOM générique (passé en
// paramètre) — il ne lit jamais `dom` lui-même, pour rester réutilisable dans
// n'importe quel contexte futur (ex. un Playbook secondaire, un aperçu, un
// export) sans dépendre du cache global de components.js.
//
// COACH-POLISH-001 (POLISH-006, Product Language) : l'étiquette visible
// "Playbook" devient "Plan d'action" — vocabulaire naturel, cohérent avec les
// autres chapitres du Journey Container (Mission, Progression, Acquis, Profil
// trader). Aucun changement de structure de données ni d'id DOM : seul le
// texte affiché change.
import { utils } from "../utils/index.js";

// État de sécurité (COACH-002 §États, "Aucun Playbook") : ne devrait jamais
// s'afficher en usage normal — filet si la génération produit un objet vide.
function renderNoneState() {
  return `
    <div class="empty-state coach-playbook-empty">
      <div>
        <h3>Aucun plan d'action disponible</h3>
        <p class="muted">Coach n'a pas encore de plan d'action pour cette Mission.</p>
      </div>
    </div>
  `;
}

function renderList(items, className) {
  if (!items || !items.length) return "";
  return `<ul class="${className}">${items.map(item => `<li>${utils.escape(item)}</li>`).join("")}</ul>`;
}

export const playbookUi = {
  // container : élément DOM unique dans lequel injecter le Playbook (ex.
  // dom["coach-playbook-card"]). playbook : objet Playbook tel que décrit
  // ci-dessus, quelle que soit sa provenance.
  renderPlaybook(container, playbook) {
    if (!container) return;

    if (!playbook || playbook.state === "none") {
      container.innerHTML = renderNoneState();
      container.dataset.state = "none";
      return;
    }

    container.dataset.state = playbook.state || "active";

    // Hiérarchie de lecture imposée par COACH-002 : Header -> Objectif ->
    // Actions -> Conseils -> Critères. Les Conseils restent un bloc optionnel
    // (peuvent être absents sans casser la mise en page — voir renderList,
    // qui retourne une chaîne vide si le tableau est vide).
    container.innerHTML = `
      <div class="section-header playbook-header">
        <div>
          <p class="eyebrow">Plan d'action</p>
          <h3>Comment réussir cette Mission</h3>
        </div>
        <span class="badge playbook-state-badge" data-playbook-state="${utils.escape(playbook.state || "active")}">
          ${playbook.state === "completed" ? "Terminé" : "En cours"}
        </span>
      </div>

      <p class="playbook-objective">${utils.escape(playbook.objective || "")}</p>

      <div class="playbook-section">
        <p class="playbook-section-label">Actions</p>
        ${renderList(playbook.actions, "playbook-actions")}
      </div>

      ${playbook.tips && playbook.tips.length ? `
        <div class="playbook-section playbook-section--tips">
          <p class="playbook-section-label">Conseils</p>
          ${renderList(playbook.tips, "playbook-tips")}
        </div>
      ` : ""}

      <div class="playbook-section">
        <p class="playbook-section-label">Critères de réussite</p>
        ${renderList(playbook.criteria, "playbook-criteria")}
      </div>
    `;
  }
};