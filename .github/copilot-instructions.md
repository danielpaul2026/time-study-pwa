# Copilot instructions for time-study-pwa

## Project snapshot

This repository is a React + Vite progressive web app for collecting and reviewing time-study data. The app boots in `src/main.jsx`, wraps the tree in `BrowserRouter`, and renders the route-driven app shell from `src/App.jsx`.

The key application flows are:

- `src/pages/Menu.jsx`: template import/export, result navigation, and study selection
- `src/pages/Study.jsx`: live time-study recording and event editing
- `src/pages/Results.jsx`: aggregated reporting for saved study sessions
- `src/pages/Template.jsx`: template design and editing
- `src/data/studyStore.js`: localStorage-backed persistence for templates and sessions
- `src/hooks/useAvailableGridRows.js`: grid sizing helper used in the study UI

This is a browser-only app with no backend, API layer, or server-side rendering. Prefer small feature additions within the existing React page/data pattern rather than introducing new frameworks or state-management layers.

## Build, lint, and validation commands

Use the repo scripts from the project root:

- Install dependencies: `npm install`
- Start the dev server: `npm run dev`
- Create a production build: `npm run build`
- Lint the project: `npm run lint`
- Preview the production build locally: `npm run preview`

Targeted validation:

- Single-file lint check: `npx eslint src/App.jsx`
- For focused changes, prefer `npx eslint <file-or-directory>` to avoid broad repo runs.

Test status:

- There is no automated test runner configured in `package.json` and no Vitest/Jest setup in the repo currently.
- Do not assume a test command exists; if you add tests, wire them into `package.json` and keep the command consistent with the existing Vite/React setup.

## High-level architecture

- `src/main.jsx` is the app bootstrap. It mounts the React tree into the DOM and imports `src/index.css`.
- `src/App.jsx` defines the router layout and routes for `/`, `/Study`, `/Results`, `/Template`, and `/Template/:templateId`.
- `src/index.css` is the global stylesheet; keep app-wide styles there and keep feature-specific styling closely associated with the corresponding page/component.
- `src/data/studyStore.js` stores templates and study sessions in `localStorage` and exposes CRUD helpers. Changes here should stay compatible with the current page flows.
- This project is intentionally lightweight. Prefer to keep logic in page components or local modules under `src/` instead of introducing alternative architecture patterns unless there is a strong requirement.

## Key conventions in this repo

- Follow the Vite + React conventions already in use: ES modules, JSX, function components, and straightforward `import`/`export` syntax consistent with existing files.
- Preserve the current pattern of route-driven pages and localStorage-backed state instead of introducing server or remote state management.
- Keep the UI simple and direct; do not add framework-level complexity such as Redux, server rendering, or a custom routing system unless a feature clearly requires it.
- Because this is a browser-only app, avoid server-side or Node-only code patterns in client files.
- If the project grows, keep the existing React structure rather than replacing it with another framework.

## Repository notes

- The README is currently a placeholder and does not yet describe the intended product workflow. If you add user-facing functionality, keep the documentation aligned with the actual behavior.
- Use the existing app structure as the baseline for new work. The repo currently has a PWA/time-study app shape, not a generic starter app.
