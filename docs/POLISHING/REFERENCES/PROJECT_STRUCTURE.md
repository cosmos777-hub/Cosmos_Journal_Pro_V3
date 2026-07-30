# PROJECT_STRUCTURE.md

> **Project:** Cosmos Journal Pro V3\
> **Document Version:** 3.0

# Purpose

This document defines the official architecture of Cosmos Journal Pro V3
after the completion of Phase 1.

------------------------------------------------------------------------

# High-Level Structure

index.html
style.css

src/
  main.js

  core/
    state.js
    defaults.js
    storage.js
    mediaStorage.js
    calculations.js
    migrations.js

    playbooks.js
    progress.js
    achievements.js
    digitalTwin.js
    coachConstants.js
    demoData.js

  ui/
    components.js
    dashboard.js
    journal.js
    analytics.js
    coach.js
    playbook.js
    progress.js
    achievements.js
    digitalTwin.js
    settings.js
    dom.js

  utils/
    constants.js
    formatters.js
    helpers.js
    index.js

styles/
├── variables.css
├── base.css
├── layout.css
├── typography.css
├── components.css
├── dashboard.css
├── journal.css
├── analytics.css
├── coach.css
├── settings.css
└── animations.css

docs/
  PRODUCT/
    PRODUCT_VISION.md
    UX_PHILOSOPHY.md
    VISUAL_COMPOSITION.md
    REFERENCE_MODULE.md

    COACH_PRODUCT_VISION.md
    COACH_DOMAIN_MODEL.md
    COACH_DECISION_ENGINE.md
    COACH_UI_ARCHITECTURE.md
    COACH_IMPLEMENTATION_BLUEPRINT.md

  POLISHING/
    Decisions log
    PROJECT_STATUS
    POLISHING_MASTER_PLAN
    REFERENCES/
      Component catalog
      DESIGN_SYSTEM_CHARTER.md
      Naming conventions
      PROJECT_STRUCTURE
            STATE_MODEL
------------------------------------------------------------------------

# Layer Responsibilities

## core/

Business logic only.

Responsibilities:

-   state management
-   calculations
-   migrations
-   persistence
-   media storage

Rules:

-   No UI rendering.
-   No DOM manipulation for application rendering.
-   No view-specific logic.

### storage.js

Responsible for structured application data (JSON).

### mediaStorage.js

Responsible for native media persistence.

-   IndexedDB
-   image compression
-   media lifecycle

It is the **only** low-level entry point for binary media.

------------------------------------------------------------------------

## ui/

Presentation layer.

Responsibilities:

-   rendering
-   DOM
-   interactions
-   user workflow

Rules:

-   Never access IndexedDB directly.
-   Use mediaStorage.js for media.
-   Use storage.js for structured data.

------------------------------------------------------------------------

## main.js

Application coordinator.

Responsibilities:

-   bootstrap
-   routing
-   global actions
-   orchestration between core and ui

------------------------------------------------------------------------

# Documentation

## PRODUCT

Defines long-term product vision.

## POLISHING

Tracks implementation, audits and design governance.

------------------------------------------------------------------------

# Architecture Principles

-   Separation of concerns
-   Single Responsibility
-   Single Source of Truth
-   Workflow First
-   Modular evolution
-   Documentation-driven development

- Business generation separated from presentation
- One Workspace = One Business Generator + One UI Component
- Coach consumes business objects only
- No Workspace recalculates existing business information
- Information flows progressively through the product

------------------------------------------------------------------------

# Reference Architecture

The Journal module remains the reference for workflow architecture.

The Dashboard remains the reference for KPI presentation.

The Coach module becomes the reference for business generation architecture,
introducing the official Cosmos pattern:

Business Generator

↓

Business Object

↓

UI Component

This architecture is intended to become the standard for every future
intelligent module of Cosmos Journal Pro V3.


# Coach Architecture

The Coach module follows the official Cosmos architecture based on a strict
separation between business generation and presentation.

Each Coach Workspace is composed of two independent layers.

core/*
    Pure business generation

↓

Business Object

↓

ui/*
    Rendering and presentation

Current Workspaces:

Mission
    calculations.generateMission()

Playbook
    core/playbooks.js
    ui/playbook.js

Progress
    core/progress.js
    ui/progress.js

Achievements
    core/achievements.js
    ui/achievements.js

Digital Twin
    core/digitalTwin.js
    ui/digitalTwin.js



# Official Architectural Patterns

## Workflow Pattern

Journal

User Workflow

↓

Business Logic

↓

Persistence

## KPI Pattern

Dashboard

Calculations

↓

KPI Cards

↓

Visual Components

## Coach Pattern

Business Generator

↓

Business Object

↓

UI Component
