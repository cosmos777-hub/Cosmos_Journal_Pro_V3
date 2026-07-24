# STATE_MODEL.md

> **Project:** Cosmos Journal Pro V3 **Document Version:** 2.0

# Purpose

This document describes the official application state model, the
lifecycle of a trade, and how state, JSON storage and media storage
interact.

------------------------------------------------------------------------

# Global State

The application state is managed by `core/state.js`.

It contains:

-   application preferences
-   active view
-   trades
-   statistics
-   current edition context
-   temporary UI state

------------------------------------------------------------------------

# Trade Model

``` text
trade
├── id
├── account
├── date
├── strategy
├── execution
├── psychology
├── result
├── notes
├── tags[]
└── media
      ├── htf
      ├── ltf
      └── result
```

------------------------------------------------------------------------

# Media Model

Each slot can exist in one of three forms:

## Native

``` text
{
  native: true,
  type: "image/webp"
}
```

Stored in IndexedDB.

------------------------------------------------------------------------

## Legacy

``` text
https://...
```

Old V2 link.

------------------------------------------------------------------------

## Encoded

Temporary import/export representation.

``` text
{
 dataUrl: "...",
 type: "image/webp"
}
```

Never persisted during normal usage.

------------------------------------------------------------------------

# Edition Lifecycle

Normal flow:

Create Trade

↓

draftTradeId

↓

Add captures

↓

Save Trade

↓

editingTradeId (when editing)

↓

Update

↓

History

------------------------------------------------------------------------

# Storage Architecture

## storage.js

Stores:

-   preferences
-   trades
-   settings

Backend:

LocalStorage

------------------------------------------------------------------------

## mediaStorage.js

Stores:

-   HTF
-   LTF
-   Result screenshots

Backend:

IndexedDB

Responsibilities:

-   compression
-   save
-   load
-   delete
-   cleanup

------------------------------------------------------------------------

# Thumbnail Cache

The UI maintains temporary object URLs.

Lifecycle:

Load Blob

↓

Create Object URL

↓

Display

↓

Revoke URL

↓

Free memory

------------------------------------------------------------------------

# Wizard State

Current state includes:

-   current card
-   progress
-   focus mode
-   validation
-   temporary inputs

------------------------------------------------------------------------

# Principles

-   JSON never stores binary media.
-   IndexedDB never stores application state.
-   Only mediaStorage accesses IndexedDB.
-   UI never manipulates persistent storage directly.
-   One source of truth per data type.

------------------------------------------------------------------------

# Reference

The Journal module defines the reference implementation for state
management.
