# PROJECT_STRUCTURE.md

> **Project:** Cosmos Journal Pro V3\
> **Document Version:** 2.0

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

      ui/
        components.js
        dashboard.js
        journal.js
        analytics.js
        insights.js
        settings.js

    docs/
      PRODUCT/
        PRODUCT_VISION.md
        UX_PHILOSOPHY.md
        VISUAL_COMPOSITION.md
        REFERENCE_MODULE.md

      POLISHING/
        REFERENCES/
          DESIGN_SYSTEM_CHARTER.md

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

------------------------------------------------------------------------

# Reference Architecture

The Journal module is the architectural reference.

Future modules (Dashboard, Analytics, Insights and Settings) must follow
the same layering and responsibilities.
