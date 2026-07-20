// Sprint Polishing — MEDIA-001 (Livraison A) : point d'accès unique à IndexedDB pour le
// stockage binaire des captures (HTF/LTF/Résultat). Même rôle que core/storage.js mais
// pour le binaire — jamais accédé directement ailleurs dans l'application (voir
// PROJECT_STRUCTURE.md §4, règle 2 : un seul point de lecture/écriture par mécanisme de
// stockage). Séparé de localStorage : storage.js reste seul responsable des données
// métier (state.data), mediaStorage.js seul responsable du binaire (Blob).
//
// Décision d'architecture (DECISIONS_LOG.md, suite de D-024) : IndexedDB plutôt que
// Base64 dans localStorage — asynchrone (jamais de blocage de l'UI), binaire natif
// (pas de surcoût +33% de l'encodage Base64), capacité non plafonnée à quelques Mo.

const DB_NAME = "cosmos_media_v3";
const DB_VERSION = 1;
const STORE_NAME = "captures";

// Clé composite trade+slot : un trade a au plus 3 captures (htf, ltf, result),
// jamais plus — cohérent avec la forme figée de trade.media dans calculations.js/migrations.js.
function captureKey(tradeId, slot) {
  return `${tradeId}::${slot}`;
}

let dbPromise = null;

// Ouverture paresseuse et mise en cache de la connexion : un seul upgrade possible,
// toutes les opérations suivantes réutilisent la même promesse résolue.
function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // keyPath "key" = clé composite tradeId::slot (voir captureKey ci-dessus).
        // Un index secondaire sur tradeId permet deleteAllForTrade() sans lister
        // les 3 slots manuellement (résilient si un futur slot est ajouté).
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("tradeId", "tradeId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Point de compression : redimensionnement + réencodage adaptatif d'un Blob image
// avant écriture (Décision média 001 : pas de seuil fixe 1600px/JPEG 0.8, mais point
// de départ ajusté automatiquement — voir chooseEncoding ci-dessous). Aucune librairie
// externe (cohérent avec la suppression des CDN dès le Milestone 1).
const MAX_DIMENSION_START = 1600;
const MIN_DIMENSION_FLOOR = 960; // ne jamais descendre sous ce plancher, même en réajustant
const TARGET_MAX_BYTES = 600 * 1024; // ~600 Ko cible par capture, pas une limite dure
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("canvas.toBlob a retourné null"))),
      type,
      quality
    );
  });
}

// Détermine si le format d'origine mérite d'être préservé plutôt que systématiquement
// converti en JPEG (Décision média 001 : "évite de convertir toutes les images en JPEG
// si leur format d'origine est déjà pertinent — WebP par exemple"). PNG reste converti
// (rarement le bon choix pour une capture d'écran photographique, poids disproportionné) ;
// WebP est préservé car déjà performant et largement supporté.
function chooseOutputType(originalType) {
  if (originalType === "image/webp") return "image/webp";
  return "image/jpeg";
}

// Compresse un Blob image en cherchant automatiquement le meilleur compromis
// qualité/poids autour de la cible TARGET_MAX_BYTES, plutôt que d'appliquer une
// règle fixe. Réduit la dimension maximale par paliers si la qualité seule ne
// suffit pas à atteindre la cible, jusqu'au plancher MIN_DIMENSION_FLOOR (jamais
// en dessous, pour préserver la lisibilité d'une capture de setup — Document 02).
export async function compressImage(blob) {
  // Pas de compression utile pour un fichier déjà léger.
  if (blob.size <= TARGET_MAX_BYTES) return blob;

  const img = await loadImageFromBlob(blob);
  const outputType = chooseOutputType(blob.type);

  let maxDimension = MAX_DIMENSION_START;
  let bestResult = blob;

  while (maxDimension >= MIN_DIMENSION_FLOOR) {
    const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      // eslint-disable-next-line no-await-in-loop
      const candidate = await canvasToBlob(canvas, outputType, quality);
      if (candidate.size < bestResult.size) bestResult = candidate;
      if (candidate.size <= TARGET_MAX_BYTES) return candidate;
    }

    maxDimension -= 200;
  }

  // Cible non atteinte même au plancher : retourne le meilleur résultat obtenu
  // plutôt que d'échouer — mieux vaut une image un peu plus lourde que perdue.
  return bestResult;
}

export const mediaStorage = {
  // Compresse puis sauvegarde un Blob pour un trade/slot donné. Écrase silencieusement
  // toute capture précédente sur le même slot (comportement "remplacer" attendu par
  // le composant captureSlot(), Livraison C).
  async save(tradeId, slot, blob) {
    const compressed = await compressImage(blob);
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        key: captureKey(tradeId, slot),
        tradeId,
        slot,
        blob: compressed,
        type: compressed.type,
        size: compressed.size,
        updatedAt: new Date().toISOString()
      });
      tx.oncomplete = () => resolve({ id: captureKey(tradeId, slot), size: compressed.size, type: compressed.type });
      tx.onerror = () => reject(tx.error);
    });
  },

  // Retourne l'entrée complète ({ blob, type, size, ... }) ou null si absente —
  // jamais d'exception pour une capture manquante, c'est un état normal (Progressive
  // Disclosure : un trade peut n'avoir aucune, une, deux ou trois captures).
  async get(tradeId, slot) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(captureKey(tradeId, slot));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(tradeId, slot) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(captureKey(tradeId, slot));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Suppression en cascade (Document 04 §13 combiné à MEDIA-001) : appelée par
  // actions.deleteTrade() pour ne jamais laisser une capture orpheline en base.
  // Utilise l'index "tradeId" plutôt qu'un appel delete() par slot connu, pour
  // rester valide même si un futur slot est ajouté sans modifier ce module.
  async deleteAllForTrade(tradeId) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("tradeId");
      const request = index.openCursor(IDBKeyRange.only(tradeId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Vide entièrement le store — appelée par actions.clearData() (réinitialisation
  // de l'historique complet), symétrique à state.data.trades = [].
  async clear() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
};
