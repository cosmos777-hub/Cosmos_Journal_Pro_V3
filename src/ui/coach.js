// COACH-001 — Mission Workspace Foundation.
// COACH-002 — Playbook Workspace.
// COACH-003 — Progress Workspace.
// COACH-004 — Achievements Workspace.
// COACH-005 — Digital Twin Workspace : ajoute le rendu du Digital Twin juste
// après les Achievements, via une génération temporaire (core/digitalTwin.js)
// strictement séparée de la présentation (ui/digitalTwin.js). Même principe
// exact que les trois Workspaces précédents : coach.js construit Mission,
// Playbook, Progress et Achievements, en déduit un DigitalTwin via
// buildDigitalTwin(mission, playbook, progress, achievements), puis délègue
// tout l'affichage à digitalTwinUi.renderDigitalTwin() — coach.js ne connaît
// jamais la forme interne du HTML généré.
//
// COACH-POLISH-001 — Premium Visual Polish (Journey Container).
// Ajoute l'orchestration du Journey Container défini par
// COACH_UI_ARCHITECTURE.md (§"Coach Journey Architecture") : navigation
// latérale (POLISH-002), transitions de chapitre (POLISH-003) via
// IntersectionObserver + classes CSS, sans toucher à la logique métier ni aux
// objets Mission/Playbook/Progress/Achievements/DigitalTwin déjà construits
// ci-dessus. Le Journey Container est un pur habillage de présentation :
// chaque "chapitre" (section.coach-chapter dans index.html) contient
// exactement le même conteneur DOM qu'avant (coach-mission-card,
// coach-playbook-card, coach-progress-card, coach-achievements-card,
// coach-digitaltwin-card) — seule la mise en scène change.
//
// COACH-POLISH-001 (révision palette) : la carte d'accent de chaque chapitre
// (--accentVar ci-dessous) est mise à jour sur demande explicite —
//   Mission          -> corail néon du Dashboard (--coral-warm)
//   Plan d'action     -> vert néon d'Analytics (--analytics-positive-glow)
//   Progression        -> bleu néon du Dashboard (--cosmos-glow)
//   Acquis              -> or (--coach-gold, nouveau token scopé à Coach,
//                          voir styles/coach.css :root)
//   Profil trader        -> inchangé (--cosmos-strong)
import { dom } from "./dom.js";
import { state } from "../core/state.js";
import { calculations } from "../core/calculations.js";
import { buildPlaybookForMission } from "../core/playbooks.js";
import { buildProgressForMission } from "../core/progress.js";
import { buildAchievements } from "../core/achievements.js";
import { buildDigitalTwin } from "../core/digitalTwin.js";
import { playbookUi } from "./playbook.js";
import { progressUi } from "./progress.js";
import { achievementsUi } from "./achievements.js";
import { digitalTwinUi } from "./digitalTwin.js";

const MIN_SAMPLE = 30;

// COACH-POLISH-001 (POLISH-002/POLISH-005) : source unique de vérité pour les
// 5 chapitres du Journey Container — libellé (Product Language, POLISH-006),
// sous-titre de navigation (intention du chapitre, Blueprint §02) et accent de
// couleur. Voir le commentaire d'en-tête ci-dessus pour la justification de
// chaque couleur (révision palette demandée après la première livraison).
const COACH_CHAPTERS = [
  { id: "mission", label: "Mission", hint: "Direction & priorité", accentVar: "--coral-warm" },
  { id: "playbook", label: "Plan d'action", hint: "Action concrète", accentVar: "--analytics-positive-glow" },
  { id: "progress", label: "Progression", hint: "Évolution", accentVar: "--cosmos-glow" },
  { id: "achievements", label: "Acquis", hint: "Consolidation", accentVar: "--coach-gold" },
  { id: "digitaltwin", label: "Profil trader", hint: "Réflexion", accentVar: "--cosmos-strong" }
];

export const coachUi = {
  // Niveau de priorité affiché sur la Mission Card. Dérivé de la même donnée
  // que generateMission() (Delta émotionnel cumulé, intervention manuelle,
  // respect du plan) — aucune nouvelle formule, uniquement une lecture de
  // classification sur des valeurs déjà calculées ailleurs (Règle Document 06 §4 :
  // jamais de formule dupliquée).
  missionPriority(trades) {
    if (!trades.length) return { level: "low", label: "Découverte" };

    const cumulativeDeltaR = trades.reduce((sum, t) => sum + (Number(t.emotionalDeltaR) || 0), 0);
    if (cumulativeDeltaR < -3) return { level: "high", label: "Priorité haute" };

    const byIntervention = calculations.groupTradesByDimension(trades, "manualIntervention", []).filter(g => g.count >= 5);
    const interventionOui = byIntervention.find(g => g.label === "Oui");
    const interventionNon = byIntervention.find(g => g.label === "Non");
    if (interventionOui && interventionNon && (interventionNon.expectancy - interventionOui.expectancy) > 0.3) {
      return { level: "medium", label: "Priorité moyenne" };
    }

    const planRespect = calculations.planRespectRate(trades);
    if (planRespect != null && planRespect < 80) return { level: "medium", label: "Priorité moyenne" };

    return { level: "low", label: "Maintien du cap" };
  },

  // Raisonnement simplifié (Explainability, COACH_DECISION_ENGINE.md §15) : une
  // phrase courte reliant la Mission à l'observation qui la justifie. Reste du
  // texte statique dérivé de mission.title — pas une nouvelle IA, juste un
  // habillage explicatif du Centre de Mission existant.
  missionReasoning(mission, trades) {
    if (!trades.length) {
      return "Aucun trade enregistré pour l'instant : Coach n'a encore rien à observer.";
    }
    if (trades.length < MIN_SAMPLE) {
      return `Coach a besoin d'un échantillon suffisant (${MIN_SAMPLE} trades minimum) avant de pouvoir isoler un comportement fiable.`;
    }
    return "Cette priorité a été sélectionnée parce qu'elle représente actuellement le levier de progression le plus significatif dans tes données récentes.";
  },

  renderCoach() {
    if (!dom["coach-content"]) return;
    const trades = state.data.trades;

    if (!trades.length) {
      this.renderCoachEmptyState(
        "Construisez votre première Mission",
        "Ajoutez vos premiers trades pour permettre à Coach de comparer votre exécution réelle et votre plan, et de vous proposer une première priorité."
      );
      return;
    }

    if (trades.length < MIN_SAMPLE) {
      const remaining = MIN_SAMPLE - trades.length;
      this.renderCoachEmptyState(
        "Encore quelques trades avant votre première Mission",
        `Ajoutez encore ${remaining} trade${remaining > 1 ? "s" : ""} (${trades.length}/${MIN_SAMPLE}) pour que Coach puisse identifier une priorité fiable, plutôt qu'inventer une conclusion prématurée.`
      );
      return;
    }

    dom["coach-empty-state"].classList.add("hidden");
    dom["coach-content"].classList.remove("hidden");

    const mission = calculations.generateMission(trades);
    const priority = this.missionPriority(trades);
    const reasoning = this.missionReasoning(mission, trades);

    dom["coach-mission-priority"].textContent = priority.label;
    dom["coach-mission-priority"].className = `badge coach-priority coach-priority--${priority.level}`;
    dom["coach-mission-title"].textContent = mission.title;
    dom["coach-mission-description"].textContent = mission.copy;
    dom["coach-mission-reasoning"].textContent = reasoning;

    // État de Mission (COACH_UI_ARCHITECTURE.md §7, "Mission States") : Version 1
    // ne distingue que "active" (une Mission existe toujours dès 30 trades — voir
    // generateMission, qui retombe toujours sur un message de continuité par
    // défaut) — Newly assigned / Near completion / Completed nécessitent un
    // suivi de Progress au fil du temps, hors périmètre de COACH-001 à COACH-005.
    dom["coach-mission-card"].dataset.state = "active";

    // COACH-002 : génération temporaire du Playbook à partir de la Mission
    // (core/playbooks.js, mapping déterministe), délégation intégrale du
    // rendu au composant générique (ui/playbook.js).
    const playbook = buildPlaybookForMission(mission);
    playbookUi.renderPlaybook(dom["coach-playbook-card"], playbook);

    // COACH-003 : même principe pour le Progress — génération temporaire
    // (core/progress.js, comparaison de deux fenêtres de trades), délégation
    // intégrale du rendu au composant générique (ui/progress.js).
    const progress = buildProgressForMission(mission, trades);
    progressUi.renderProgress(dom["coach-progress-card"], progress);

    // COACH-004 : même principe pour les Achievements — génération temporaire
    // (core/achievements.js, catalogue déterministe de signaux comportementaux),
    // délégation intégrale du rendu au composant générique (ui/achievements.js).
    const achievements = buildAchievements(progress, mission, trades);
    achievementsUi.renderAchievements(dom["coach-achievements-card"], achievements);

    // COACH-005 : même principe pour le Digital Twin — génération temporaire
    // (core/digitalTwin.js, synthèse pure des objets déjà construits ci-dessus,
    // sans relire `trades` ni `calculations`), délégation intégrale du rendu
    // au composant générique (ui/digitalTwin.js). coach.js ne construit jamais
    // lui-même le HTML du Digital Twin, et ne fait que transmettre les 4
    // objets déjà produits — sans connaître la logique de synthèse.
    const digitalTwin = buildDigitalTwin(mission, playbook, progress, achievements);
    digitalTwinUi.renderDigitalTwin(dom["coach-digitaltwin-card"], digitalTwin);

    // COACH-POLISH-001 (POLISH-001/002/003) : une fois le contenu des 5
    // chapitres injecté ci-dessus, met en scène le Journey Container —
    // navigation latérale, indicateurs de progression, scroll-spy. N'affecte
    // jamais les objets métier déjà construits : pure mise en scène.
    this.renderCoachJourney();
  },

  renderCoachEmptyState(title, copy) {
    dom["coach-content"].classList.add("hidden");
    dom["coach-empty-state"].classList.remove("hidden");
    dom["coach-empty-title"].textContent = title;
    dom["coach-empty-copy"].textContent = copy;
  },

  // ───────────────────────────────────────────────────────────────────────
  // COACH-POLISH-001 — Journey Container (POLISH-001, POLISH-002, POLISH-003)
  // ───────────────────────────────────────────────────────────────────────
  // Construit la navigation latérale gauche (liste des chapitres) et les
  // indicateurs de progression à droite (dots), à partir de COACH_CHAPTERS.
  // Rebâtit ce balisage à chaque appel de renderCoach() — coût négligeable
  // (5 éléments) — sans jamais toucher au conteneur scrollable lui-même
  // (#coach-journey-viewport), dont le scroll doit être préservé d'un rendu
  // à l'autre (ex. après l'enregistrement d'un trade pendant la lecture).
  renderCoachJourney() {
    if (!dom["coach-journey-nav"] || !dom["coach-journey-viewport"] || !dom["coach-journey-dots"]) return;

    dom["coach-journey-nav"].innerHTML = COACH_CHAPTERS.map(chapter => `
      <button type="button" class="coach-journey-nav-item" data-chapter-nav="${chapter.id}" style="--chapter-accent: var(${chapter.accentVar});">
        <span class="coach-journey-nav-label">${chapter.label}</span>
        <span class="coach-journey-nav-hint">${chapter.hint}</span>
      </button>
    `).join("");

    dom["coach-journey-dots"].innerHTML = COACH_CHAPTERS.map(chapter => `
      <span class="coach-journey-dot" data-chapter-dot="${chapter.id}" style="--chapter-accent: var(${chapter.accentVar});" title="${chapter.label}"></span>
    `).join("");

    // Applique l'accent de couleur (POLISH-005, identité subtile par chapitre)
    // directement sur chaque section .coach-chapter du Journey Container —
    // ces sections existent déjà dans index.html (voir #view-coach), ce
    // module se contente de leur assigner leur variable d'accent.
    COACH_CHAPTERS.forEach(chapter => {
      const chapterEl = dom["coach-journey-viewport"].querySelector(`[data-chapter="${chapter.id}"]`);
      if (chapterEl) chapterEl.style.setProperty("--chapter-accent", `var(${chapter.accentVar})`);
    });

    // Navigation : clic sur un item -> scroll fluide jusqu'au chapitre visé.
    dom["coach-journey-nav"].querySelectorAll("[data-chapter-nav]").forEach(button => {
      button.addEventListener("click", () => {
        this.scrollToCoachChapter(button.dataset.chapterNav);
      });
    });

    // Dots : même comportement, raccourci visuel équivalent à la navigation.
    dom["coach-journey-dots"].querySelectorAll("[data-chapter-dot]").forEach(dotEl => {
      dotEl.addEventListener("click", () => {
        this.scrollToCoachChapter(dotEl.dataset.chapterDot);
      });
    });

    this.setupCoachScrollSpy();
  },

  scrollToCoachChapter(chapterId) {
    const target = dom["coach-journey-viewport"].querySelector(`[data-chapter="${chapterId}"]`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  // Scroll-spy (POLISH-003) : observe chaque section .coach-chapter à
  // l'intérieur du viewport scrollable. Deux seuils :
  // - 0.15 : déclenche le fondu/glissement d'entrée (classe .in-view, voir
  //   coach.css) — le chapitre "apparaît depuis le bas" dès qu'il commence à
  //   être visible ;
  // - 0.5  : désigne le chapitre comme actif dans la navigation et les dots
  //   (un seul chapitre majoritairement visible à la fois, cohérent avec le
  //   principe "un seul chapitre actif" du Journey Container).
  // L'observer précédent est explicitement déconnecté avant d'en recréer un
  // nouveau, pour ne jamais accumuler d'observers au fil des renderCoach().
  setupCoachScrollSpy() {
    if (this._coachJourneyObserver) {
      this._coachJourneyObserver.disconnect();
    }

    const viewport = dom["coach-journey-viewport"];
    const chapters = Array.from(viewport.querySelectorAll(".coach-chapter"));
    if (!chapters.length) return;

    this._coachJourneyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle("in-view", entry.intersectionRatio > 0.15);
        if (entry.intersectionRatio >= 0.5) {
          this.setActiveCoachChapter(entry.target.dataset.chapter);
        }
      });
    }, { root: viewport, threshold: [0, 0.15, 0.5] });

    chapters.forEach(chapterEl => this._coachJourneyObserver.observe(chapterEl));

    // État initial : premier chapitre actif et visible sans attendre le
    // premier événement de scroll (évite un flash "aucun chapitre actif").
    this.setActiveCoachChapter(chapters[0].dataset.chapter);
    chapters[0].classList.add("in-view");
  },

  setActiveCoachChapter(chapterId) {
    if (!dom["coach-journey-nav"] || !dom["coach-journey-dots"]) return;
    dom["coach-journey-nav"].querySelectorAll("[data-chapter-nav]").forEach(button => {
      button.classList.toggle("active", button.dataset.chapterNav === chapterId);
    });
    dom["coach-journey-dots"].querySelectorAll("[data-chapter-dot]").forEach(dotEl => {
      dotEl.classList.toggle("active", dotEl.dataset.chapterDot === chapterId);
    });
  }
};