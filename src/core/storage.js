// Sprint 1 — ARCH-001 (Livraison 2) : stockage JSON, migration V2 et Feature Registry,
// déplacés tels quels depuis main.js.
import { APP_VERSION, STORAGE_KEY, LEGACY_TRADES_KEY, LEGACY_PREFS_KEY } from "../utils/constants.js";
import { utils } from "../utils/index.js";
import { defaults } from "./defaults.js";
import { migrations } from "./migrations.js";
import { state } from "./state.js";

// Feature Registry (Document 04) : permet de savoir immédiatement quelles parties de
// l'application sont impactées lorsqu'on modifie une fonctionnalité. Rattaché à storage.js
// car storage.normalize() l'embarque dans chaque sauvegarde ; ré-exporté pour l'UI (main.js).
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
        normalize(data) {
          const accounts = Array.isArray(data.accounts) && data.accounts.length ? data.accounts : utils.clone(defaults.accounts);
          const rawTrades = Array.isArray(data.trades) ? data.trades : [];
          const normalized = {
            version: data.version || APP_VERSION,
            migratedFrom: data.migratedFrom || null,
            accounts,
            // Milestone 2A : chaque trade (V2 migré ou V3 déjà sauvegardé) passe par le moteur de
            // calcul V3 pour compléter les champs manquants (riskAmount, resultR, emotionalDelta...)
            // sans jamais supprimer ou écraser une donnée déjà présente.
            trades: rawTrades.map(trade => migrations.upgradeTradeV3Calc(trade, accounts)),
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
        save(data = state.data) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      };