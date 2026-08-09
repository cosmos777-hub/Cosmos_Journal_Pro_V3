// PWA-003 — Service Worker Cosmos Journal Pro V3
//
// RÔLE UNIQUE : servir et maintenir en cache les assets statiques nécessaires
// au démarrage de l'application. Ce fichier ne contient et ne doit JAMAIS
// contenir : logique métier, calculs de trading, accès localStorage/IndexedDB,
// synchronisation, logique utilisateur. Ces responsabilités restent
// entièrement dans src/core/* et src/ui/* (voir PROJECT_STRUCTURE.md).
//
// Version de cache PWA — indépendante de APP_VERSION (src/utils/constants.js).
// Incrémenter cette chaîne (jamais APP_VERSION) déclenche une nouvelle
// installation du Service Worker et invalide l'ancien cache statique.
const CACHE_VERSION = "cosmos-static-v1";

// Chemins relatifs au scope d'enregistrement du SW (racine du projet, voir
// index.html). Compatibles GitHub Pages en sous-répertoire : aucun chemin
// n'est préfixé par "/". Liste exhaustive, vérifiée contre PROJECT_STRUCTURE.md
// et les imports réels de src/main.js — aucun fichier inventé.
const PRECACHE_URLS = [
  "./",
  "index.html",
  "style.css",
  "manifest.json",

  // styles/
  "styles/variables.css",
  "styles/base.css",
  "styles/layout.css",
  "styles/typography.css",
  "styles/components.css",
  "styles/dashboard.css",
  "styles/journal.css",
  "styles/analytics.css",
  "styles/coach.css",
  "styles/settings.css",
  "styles/animations.css",

  // src/
  "src/main.js",

  // src/core/
  "src/core/state.js",
  "src/core/defaults.js",
  "src/core/storage.js",
  "src/core/mediastorage.js",
  "src/core/calculations.js",
  "src/core/migrations.js",
  "src/core/playbooks.js",
  "src/core/progress.js",
  "src/core/achievements.js",
  "src/core/digitalTwin.js",
  "src/core/coachConstants.js",
  "src/core/demoData.js",

  // src/ui/
  "src/ui/dom.js",
  "src/ui/components.js",
  "src/ui/dashboard.js",
  "src/ui/journal.js",
  "src/ui/analytics.js",
  "src/ui/coach.js",
  "src/ui/playbook.js",
  "src/ui/progress.js",
  "src/ui/achievements.js",
  "src/ui/digitalTwin.js",
  "src/ui/settings.js",

  // src/utils/
  "src/utils/constants.js",
  "src/utils/formatters.js",
  "src/utils/helpers.js",
  "src/utils/index.js"

  // Icônes PWA (icons/icon-192.png, icons/icon-512.png, icons/icon-512-maskable.png)
  // volontairement absentes de cette liste : elles n'existent pas encore dans
  // le projet (bloquant PWA-002). Les ajouter ici avant leur création ferait
  // échouer cache.addAll() sur un 404, ce qui annulerait tout le précache
  // (comportement natif de Cache.addAll : échec atomique). À ajouter dans un
  // futur ticket dès que les fichiers PNG existent réellement.
];

// ─────────────────────────────────────────────────────────────────────────
// INSTALL — précache best-effort. Un échec individuel ne doit jamais
// empêcher l'installation du SW (Étape 10 : tolérance aux erreurs). On évite
// cache.addAll() (échec atomique) au profit d'un cache.add() par fichier,
// chacun capturé isolément.
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async cache => {
      const results = await Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url))
      );
      const failed = results
        .map((r, i) => (r.status === "rejected" ? PRECACHE_URLS[i] : null))
        .filter(Boolean);
      if (failed.length) {
        // console visible côté DevTools > Application > Service Workers,
        // jamais une erreur bloquante pour l'utilisateur final.
        console.warn("[sw.js] Précache partiel — fichiers non mis en cache :", failed);
      }
    })
  );
  // PAS de self.skipWaiting() ici (Étape 8 : mise à jour prudente). Le nouveau
  // SW reste en état "waiting" tant que tous les onglets de l'ancienne version
  // ne sont pas fermés — comportement natif du navigateur, jamais forcé.
});

// ─────────────────────────────────────────────────────────────────────────
// ACTIVATE — supprime uniquement les anciens caches PWA (préfixe
// "cosmos-static-"), ne touche jamais à IndexedDB ni localStorage (hors de
// portée d'un Service Worker de toute façon — API Cache Storage uniquement).
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("cosmos-static-") && key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  );
  // PAS de self.clients.claim() ici (Étape 8). Les onglets déjà ouverts
  // continuent d'être servis par leur SW précédent jusqu'à leur prochain
  // rechargement complet — évite qu'une session en cours (ex. saisie d'un
  // trade dans le Wizard) ne bascule brutalement de version.
});

// Détermine si une requête cible un des fichiers précachés par ce SW
// (comparaison sur le chemin, indépendante de l'origine — compatible
// sous-répertoire GitHub Pages).
function isPrecachedAsset(requestUrl) {
  const scopeUrl = new URL(self.registration.scope);
  return PRECACHE_URLS.some(path => {
    const target = new URL(path, scopeUrl);
    return target.href === requestUrl.href;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// FETCH — deux stratégies, jamais de logique métier :
//
//   1. Navigation (index.html / "./") : Network First avec fallback cache.
//      Permet de détecter une nouvelle version dès qu'un réseau existe ;
//      utilise la copie locale si hors ligne.
//
//   2. Assets statiques précachés (JS/CSS/manifest) : Cache First.
//      Rapide, stable, cohérent avec le fait que ces fichiers ne changent
//      qu'avec une nouvelle CACHE_VERSION.
//
// Toute requête hors scope (cross-origin, non-GET) n'est jamais interceptée
// — laissée au comportement réseau natif du navigateur (Règle §7 : aucune
// tentative de mise en cache de données utilisateur, qui ne transitent de
// toute façon jamais par fetch() — localStorage/IndexedDB sont des API
// synchrones/locales, invisibles pour un Service Worker).
// ─────────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Stratégie 1 — Navigation : Network First, fallback cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          // Met à jour discrètement la copie en cache pour le prochain offline.
          caches.open(CACHE_VERSION).then(cache => cache.put(request, networkResponse.clone()));
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || caches.match("index.html"))
        )
    );
    return;
  }

  // Stratégie 2 — Assets statiques précachés : Cache First.
  if (isPrecachedAsset(requestUrl)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        // Absent du cache (ex. précache partiel) : tente le réseau, met en
        // cache pour la prochaine fois si succès, ne casse jamais si échec.
        return fetch(request)
          .then(networkResponse => {
            caches.open(CACHE_VERSION).then(cache => cache.put(request, networkResponse.clone()));
            return networkResponse;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Toute autre requête GET same-origin non précachée (aucune API n'existe
  // dans ce projet, voir Étape 6) : laissée au réseau natif, sans interception.
});