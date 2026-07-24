// Sprint 1 — ARCH-001 (Livraison 3) : rendu du panneau Paramètres, déplacé tel quel
// depuis main.js. Regroupe la méthode UI renderSettings() et le module de données/
// rendu settingsCategories (catégories, comptes, apparence) — ils sont toujours
// utilisés ensemble et jamais séparément ailleurs dans l'application.
//
// Bug report post-DASH-001, #2A : la suppression de compte n'a jamais été
// implémentée (pas une régression — la pill de compte n'a jamais eu de bouton,
// contrairement aux autres catégories de Paramètres). Le modèle Account a déjà un
// champ `archived` (Document 05, utilisé partout via `.filter(a => !a.archived)`),
// ce qui indique que le mécanisme prévu est l'archivage, pas une suppression
// définitive (qui poserait la question des trades déjà rattachés). Ajout d'un
// bouton Archiver/Réactiver réversible sur chaque pill de compte.
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { utils } from "../utils/index.js";

export const settingsCategories = {
        categories() {
          return [
            { id: "accounts", label: "Comptes", type: "accounts" },
            { id: "assets", label: "Actifs", key: "assets" },
            { id: "sessions", label: "Sessions", key: "sessions" },
            { id: "htf", label: "HTF", key: "htf" },
            { id: "ltf", label: "LTF", key: "ltf" },
            { id: "strategies", label: "Stratégies", key: "strategies" },
            { id: "confluences", label: "Confluences", key: "confluences" },
            { id: "emotionalCauses", label: "Causes émotionnelles", key: "emotionalCauses" },
            { id: "tags", label: "Tags", key: "tags" },
            { id: "appearance", label: "Apparence", type: "appearance" }
          ];
        },
        renderCategory(category) {
          if (category.type === "accounts") return this.renderAccounts();
          if (category.type === "appearance") return this.renderAppearance();
          const values = state.data.settings[category.key] || [];
          return `
            <h3>${utils.escape(category.label)}</h3>
            <p class="muted">Ajoutez ou supprimez les options utilisées par le Journal et les Analytics.</p>
            <div class="setting-items">
              ${values.map((value, index) => `
                <span class="setting-pill">${utils.escape(value)} <button type="button" data-remove-setting="${category.key}" data-index="${index}" aria-label="Supprimer ${utils.escape(value)}">×</button></span>
              `).join("")}
            </div>
            <form class="form-grid" data-add-setting="${category.key}">
              <div class="field">
                <label for="setting-${category.key}">Nouvelle option</label>
                <input id="setting-${category.key}" name="value" type="text" autocomplete="off" required>
              </div>
              <button class="button primary" type="submit">Ajouter</button>
            </form>
          `;
        },
        renderAccounts() {
  return `
    <h3>Comptes</h3>
    <p class="muted">Chaque compte définit son type (Prop Firm ou Fonds propres), ce qui ajuste automatiquement les paliers de risque disponibles dans le formulaire. La suppression d'un compte est définitive : les trades déjà enregistrés conservent leur nom de compte d'origine, en lecture seule.</p>
    <div class="setting-items">
      ${state.data.accounts.map(account => `
        <span class="setting-pill">
          ${utils.escape(account.name)} · ${utils.escape(account.type)} · ${utils.escape(account.currency)}
          <button type="button" data-delete-account="${utils.escape(account.id)}" aria-label="Supprimer ${utils.escape(account.name)}">×</button>
        </span>
      `).join("")}
    </div>
    <form class="form-grid" data-add-account>
      <div class="field">
        <label for="account-name">Nom</label>
        <input id="account-name" name="name" required placeholder="Compte Perso 40$">
      </div>
      <div class="field">
        <label for="account-type">Type</label>
        <select id="account-type" name="type">
          <option>Fonds propres</option>
          <option>Prop Firm</option>
        </select>
      </div>
      <div class="field">
        <label for="account-capital">Capital</label>
        <input id="account-capital" name="capital" type="number" min="0" step="0.01" required>
      </div>
      <div class="field">
        <label for="account-currency">Devise</label>
        <input id="account-currency" name="currency" value="USD" maxlength="8" required>
      </div>
      <button class="button primary" type="submit">Créer le compte</button>
    </form>
  `;
},

        renderAppearance() {
          return `
            <h3>Apparence</h3>
            <p class="muted">Le thème est stocké dans les préférences V3.</p>
            <div class="segmented">
              <button class="chip ${state.data.preferences.theme === "dark" ? "active" : ""}" type="button" data-theme-choice="dark">Sombre</button>
              <button class="chip ${state.data.preferences.theme === "light" ? "active" : ""}" type="button" data-theme-choice="light">Clair</button>
            </div>
          `;
        }
};

export const settingsUi = {
        renderSettings() {
          const categories = settingsCategories.categories();
          const active = state.data.preferences.activeSettingsCategory || categories[0].id;

          dom["settings-nav"].innerHTML = categories.map(category => `
            <button class="button settings-tab ${category.id === active ? "active" : ""}" type="button" data-settings-category="${category.id}">
              ${utils.escape(category.label)}
            </button>
          `).join("");

          const category = categories.find(item => item.id === active) || categories[0];
          dom["settings-content"].innerHTML = settingsCategories.renderCategory(category);
        },
};