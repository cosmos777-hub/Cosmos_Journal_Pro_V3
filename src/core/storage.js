import { APP_VERSION, STORAGE_KEY, LEGACY_TRADES_KEY, LEGACY_PREFS_KEY } from "../utils/constants.js";
import { utils } from "../utils/index.js";
import { defaults } from "./defaults.js";
import { migrations } from "./migrations.js";
import { state } from "./state.js";

export const featureRegistry = [
  { id: "accounts", name: "Multi-comptes", dependsOn: ["storage"], produces: ["journal", "risk"], status: "active" },
  { id: "settings", name: "Paramètres dynamiques", dependsOn: ["storage"], produces: ["journal", "analytics"], status: "active" },
  { id: "analytics", name: "Analytics", dependsOn: ["trades"], produces: ["dashboard"], status: "active" },
  { id: "insights", name: "Insights & Jumeau Numérique", dependsOn: ["trades", "accounts"], produces: ["dashboard"], status: "active" }
];

export const storage = {
  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return this.normalize(JSON.parse(saved));
      } catch (error) {
        console.warn("Cosmos storage parse failed", error);
      }
    }
    return this.migrateLegacy();
  },

  // Fusionne les comptes strictement dupliqués (même id OU même nom)
  // et réaffecte les trades associés vers le compte survivant.
  dedupeAccounts(accounts, trades) {
    const survivorByKey = new Map();
    const idRedirect = new Map();

    const survivors = [];
    accounts.forEach(account => {
      const nameKey = `name:${(account.name || "").trim().toLowerCase()}`;
      const idKey = `id:${account.id}`;
      const existing = survivorByKey.get(idKey) || survivorByKey.get(nameKey);

      if (existing) {
        idRedirect.set(account.id, existing.id);
        return;
      }

      survivors.push(account);
      survivorByKey.set(idKey, account);
      survivorByKey.set(nameKey, account);
    });

    if (idRedirect.size === 0) return { accounts, trades };

    const redirectedTrades = trades.map(trade => {
      const redirectedId = idRedirect.get(trade.accountId);
      if (!redirectedId) return trade;
      return { ...trade, accountId: redirectedId };
    });

    return { accounts: survivors, trades: redirectedTrades };
  },

  // Complète trade.accountName pour les anciens trades
  migrateAccountNames(trades, accounts) {
    return trades.map(trade => {
      if (trade.accountName) return trade;
      const account = accounts.find(a => a.id === trade.accountId);
      return { ...trade, accountName: account ? account.name : "Compte supprimé" };
    });
  },

  normalize(data) {
    const accounts = Array.isArray(data.accounts) && data.accounts.length ? data.accounts : utils.clone(defaults.accounts);
    const rawTrades = Array.isArray(data.trades) ? data.trades : [];

    const deduped = this.dedupeAccounts(accounts, rawTrades);
    const withAccountNames = this.migrateAccountNames(deduped.trades, deduped.accounts);

    const normalized = {
      version: data.version || APP_VERSION,
      migratedFrom: data.migratedFrom || null,
      accounts: deduped.accounts,
      trades: withAccountNames.map(trade => migrations.upgradeTradeV3Calc(trade, deduped.accounts)),
      settings: { ...utils.clone(defaults.settings), ...(data.settings || {}) },
      preferences: { ...utils.clone(defaults.preferences), ...(data.preferences || {}) },
      featureRegistry
    };
    normalized.version = APP_VERSION;
    return normalized;
  },

  migrateLegacy() {
    const legacyTrades = this.readJSON(LEGACY_TRADES_KEY, []);
    const legacyPrefs = this.readJSON(LEGACY_PREFS_KEY, null);
    const data = this.normalize({
      version: APP_VERSION,
      migratedFrom: legacyTrades.length || legacyPrefs ? "2.0" : null,
      accounts: utils.clone(defaults.accounts),
      trades: legacyTrades.map(migrations.tradeV2ToV3),
      settings: legacyPrefs ? migrations.prefsV2ToSettings(legacyPrefs) : utils.clone(defaults.settings),
      preferences: utils.clone(defaults.preferences)
    });
    this.save(data);
    return data;
  },

  readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(`Unable to parse ${key}`, error);
      return fallback;
    }
  },

  // RCFIX-A03 : storage.save() est désormais défensif contre tout échec
  // d'écriture localStorage (QuotaExceededError, stockage indisponible,
  // mode privé restrictif, etc.).
  //
  // Comportement inchangé en cas de succès : aucune différence observable.
  //
  // En cas d'échec :
  //   - l'exception est interceptée, l'application ne plante jamais ;
  //   - un console.warn donne le détail technique pour le diagnostic ;
  //   - un CustomEvent "cosmos:storage-error" est émis sur `window`, afin que
  //     la couche UI (qui seule a le droit d'afficher un toast — voir
  //     PROJECT_STRUCTURE.md, "core/ ne manipule jamais le DOM") puisse
  //     informer l'utilisateur sans que storage.js n'ait à connaître ui.toast()
  //     ni le DOM directement. Voir main.js pour l'unique listener associé.
  //
  // Valeur de retour : true si l'écriture a réussi, false sinon. Aucun appel
  // existant à storage.save() ne lit cette valeur — purement additif,
  // rétrocompatible avec tous les appels actuels.
  save(data = state.data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn("Cosmos storage.save() failed — les données n'ont pas pu être sauvegardées.", error);
      window.dispatchEvent(new CustomEvent("cosmos:storage-error", { detail: { error } }));
      return false;
    }
  }
};