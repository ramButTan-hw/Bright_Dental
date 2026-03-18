# AI Assistant Guidelines for Medical-Clinic-Project

This repo is a simple full‑stack prototype for a medical clinic. It is not yet fully wired up; the front‑end React app and database helpers live side by side. AI agents should focus on existing material and respect the separation between the client folder and the database utilities.

## High‑level architecture

1. **Root workspace** (`/`) contains:
   - `package.json` with a `copy` script to run database initialization (`node database/init-db.js`).
   - `database/` directory with `db.js` (MySQL pool setup), `init-db.js` (executes `schema.sql`), and the schema file itself.
   - No express server or API code yet – just the plumbing for connecting to MySQL. The intent is to add a Node/Express backend later.

2. **Front-end project** (`/clinic-medical`)
   - A Vite‑powered React application (default template code in `src/`).
   - Contains its own `package.json` with React, Vite, ESLint, and a stray `mysql` dependency (likely a leftover).
   - Runs independently via `npm run dev` inside `clinic-medical`. It currently renders the Vite welcome page and does not call any backend APIs.
   - Styling is plain CSS (`App.css`, `index.css`).

## Setup & common workflows

- **Installation**
  ```bash
  # root
  npm install
  cd clinic-medical && npm install
  ```
- **Environment**
  Create a `.env` file in the root directory with the following keys (values will differ for local vs Azure):
  ```text
  DB_HOST=...              # MySQL server hostname or IP
  DB_PORT=3306             # default port
  DB_USER=...
  DB_PASSWORD=...
  DB_NAME=medical-clinic
  ```
  `db.js` uses `dotenv` to load these and configures SSL when `NODE_ENV=production`.

- **Database initialization**
  Run from the root:
  ```bash
  npm run copy        # alias for `node database/init-db.js`
  ```
  This reads `database/schema.sql` and executes it against the configured database. Useful for bootstrapping a fresh environment.

- **Development**
  ```bash
  cd clinic-medical
  npm run dev          # starts Vite dev server on localhost:5173 by default
  ```
  The React app is the only runnable component right now. There is no backend server to start.

## Patterns & project-specific conventions

- **Environment-aware DB config**: `database/db.js` checks `NODE_ENV === 'production'` to toggle SSL. Connection pool options are defined once and exported as `module.exports = pool`.
- **Minimal ESLint setup**: ESLint is configured via `clinic-medical/eslint.config.js` (default from Vite template). React hooks and HMR-related plugins are enabled.
- **Folder separation**: Treat `clinic-medical` as a self‑contained front-end project. Backend work should occur in the root or under a new `server/` folder when added.
- **No tests yet**: there are no test files or frameworks configured; focus on the existing files and clearly state when you recommend adding tests.

## Common tasks for an AI agent

- **Adding a backend**: Propose creating an `express` server (e.g. `/server/index.js`) that imports `database/db.js` and exposes REST endpoints. Ensure environment variables and CORS are handled.
- **Connecting front‑end**: Use `fetch`/`axios` in React components to call the newly created API, keeping CORS and proxy rules in mind (Vite provides `vite.config.js` for proxies).
- **Updating schema**: Modify `database/schema.sql` and remind the user to rerun `npm run copy`.
- **Environment guidance**: When adding features that require configuration (e.g., Azure connection), point out the `.env` expectations and local development defaults.

## Search paths & references

- The front-end code lives in `clinic-medical/src`. Typical starting points are `App.jsx` and `main.jsx`.
- Database-related utilities are in `database/db.js` and `database/init-db.js`.
- Project README files (`/README.md` and `clinic-medical/README.md`) contain installation notes that should be preserved or updated.

## Notes

- There is currently no lint or build step that exercises the database code. Use `node` to execute scripts directly when verifying changes.
- The React app is bare‑bones; most code you write will be new rather than modifying existing logic.
- Keep the git branch workflow note from the root README in mind: create a branch before merging.

---

If anything in this overview is unclear or incomplete, please ask the maintainer for more context; it will help keep the instructions accurate.