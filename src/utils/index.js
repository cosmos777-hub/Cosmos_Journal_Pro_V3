// Sprint 1 — CODE-001 (Livraison 2) : point d'assemblage unique de l'objet `utils`.
// Avant ce fichier, `const utils = { uid, clone, escape, formatPercent, formatR, tone }`
// était reconstruit à l'identique dans 8 fichiers (résidu de la prudence prise lors
// d'ARCH-001 Livraison 1, où dupliquer ce shim limitait le risque de régression pendant
// le premier découpage). L'architecture étant maintenant stable, ce point unique élimine
// cette duplication sans rien changer au comportement (Règle 1 du ticket).
import { uid, clone, escape } from "./helpers.js";
import { formatPercent, formatR, tone } from "./formatters.js";

export const utils = { uid, clone, escape, formatPercent, formatR, tone };