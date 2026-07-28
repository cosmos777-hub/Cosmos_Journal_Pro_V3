// COACH-004 — Achievements Workspace : couche PRÉSENTATION, strictement
// séparée de la couche GÉNÉRATION (core/achievements.js). Même principe que
// ui/playbook.js (COACH-002) et ui/progress.js (COACH-003).
//
// Ce composant ne connaît RIEN de la Mission, du Progress, des trades, ni de
// core/achievements.js. Il consomme uniquement un objet `Achievements` déjà
// construit :
//
//   {
//     latest:     { id, category, title, description, unlocked } | null,
//     items:      Array<{ id, category, title, description, unlocked }>,
//     categories: Array<{ name, consolidated }>,
//     nextHint:   string,
//     state:      "none" | "active"
//   }
//
// Contrainte produit explicite : sobre, jamais ludique. Aucune grosse icône,
// aucun effet brillant, aucune couleur excessive, aucune animation permanente.
// Les Achievements ne doivent JAMAIS rivaliser visuellement avec Mission,
// Playbook ou Progress — ce composant reste volontairement le plus discret
// des quatre Workspaces Coach.
//
// COACH-POLISH-001 (POLISH-006, Product Language) : l'étiquette visible
// "Achievements" devient "Acquis" — vocabulaire français cohérent avec les
// autres chapitres du Journey Container. Aucun changement de structure de
// données ni d'id DOM : seul le texte affiché change.
//
// COACH-POLISH-001 (révision — médaille premium) : la carte "Dernier acquis"
// reçoit une médaille SVG vectorielle dans la zone auparavant vide à droite.
// Purement décoratif (aria-hidden, aucune information supplémentaire portée
// par le SVG — le texte à gauche reste la seule source d'information) :
// n'ajoute donc aucune donnée ni logique, conforme au périmètre strict du
// Premium Visual Polish (aucune modification métier).
import { utils } from "../utils/index.js";

function renderNoneState() {
  return `
    <div class="empty-state coach-achievements-empty">
      <div>
        <h3>Pas encore de reconnaissance</h3>
        <p class="muted">Les Acquis apparaîtront naturellement à mesure que tes habitudes se consolident — rien à forcer, rien à chercher.</p>
      </div>
    </div>
  `;
}

// Médaillon géométrique premium (or mat) — purement décoratif. Un cercle
// double liseré + une étoile à 8 branches, dégradé linéaire sombre->or pour
// éviter tout effet "gamification tape-à-l'œil" (contrainte produit COACH-004 :
// élégant, jamais ludique). Le léger glow doré est porté par CSS
// (.achievement-latest-medal, filter: drop-shadow), pas par le SVG lui-même.
function renderLatestMedal() {
  return `
    <div class="achievement-latest-medal" aria-hidden="true">
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="achievementGoldGradient" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#f3dfa0"/>
            <stop offset="0.55" stop-color="#cda753"/>
            <stop offset="1" stop-color="#8a6a2c"/>
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r="19.5" stroke="url(#achievementGoldGradient)" stroke-width="1.25" fill="rgba(205,167,83,0.06)"/>
        <circle cx="22" cy="22" r="14.5" stroke="url(#achievementGoldGradient)" stroke-width="1"/>
        <path
          d="M22 11.5L24.6 18.2L31.8 18.7L26.2 23.2L28.1 30.2L22 26.2L15.9 30.2L17.8 23.2L12.2 18.7L19.4 18.2Z"
          fill="url(#achievementGoldGradient)"
        />
      </svg>
    </div>
  `;
}

function renderLatest(latest) {
  if (!latest) return "";
  return `
    <div class="achievement-latest">
      <div class="achievement-latest-text">
        <span class="achievement-latest-label">Dernier acquis</span>
        <p class="achievement-latest-title">${utils.escape(latest.title)}</p>
        <p class="achievement-latest-description">${utils.escape(latest.description)}</p>
      </div>
      ${renderLatestMedal()}
    </div>
  `;
}

// Galerie organisée par catégorie (COACH-004 §Galerie) — regroupement simple,
// aucune logique de tri au-delà de l'ordre déjà fourni par `items`.
function renderGallery(items, categories) {
  const categoryNames = categories.map(c => c.name);
  return categoryNames.map(categoryName => {
    const categoryItems = items.filter(item => item.category === categoryName);
    const isConsolidated = categories.find(c => c.name === categoryName)?.consolidated;
    return `
      <div class="achievement-category${isConsolidated ? " achievement-category--consolidated" : ""}">
        <p class="achievement-category-label">${utils.escape(categoryName)}</p>
        <div class="achievement-items">
          ${categoryItems.map(item => `
            <div class="achievement-item${item.unlocked ? " unlocked" : " locked"}" title="${utils.escape(item.description)}">
              <span class="achievement-item-dot" aria-hidden="true"></span>
              <span class="achievement-item-title">${utils.escape(item.title)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

export const achievementsUi = {
  // container : élément DOM unique dans lequel injecter les Achievements (ex.
  // dom["coach-achievements-card"]). achievements : objet Achievements tel
  // que décrit ci-dessus, quelle que soit sa provenance.
  renderAchievements(container, achievements) {
    if (!container) return;

    if (!achievements || achievements.state === "none") {
      container.innerHTML = renderNoneState();
      container.dataset.state = "none";
      return;
    }

    container.dataset.state = achievements.state;

    // Hiérarchie de lecture imposée par COACH-004 : Header -> Dernier
    // Achievement -> Galerie -> Prochaine étape.
    container.innerHTML = `
      <div class="section-header achievements-header">
        <div>
          <p class="eyebrow">Acquis</p>
          <h3>Ce que tu as réellement consolidé</h3>
        </div>
      </div>

      ${renderLatest(achievements.latest)}

      <div class="achievement-gallery">
        ${renderGallery(achievements.items, achievements.categories)}
      </div>

      <p class="achievement-next-hint">${utils.escape(achievements.nextHint || "")}</p>
    `;
  }
};