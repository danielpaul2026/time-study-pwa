# Copilot instructions for time-study-pwa

## Project snapshot

This repository is a minimal Vite + React browser app, currently acting as the foundation for a time-study / productivity PWA. The app entry point is `src/main.jsx`, which renders the root component from `src/App.jsx`. Styling is currently split between `src/index.css` and `src/App.css`.

The project does not yet define a backend, API layer, or test stack. Keep new work aligned with the existing lightweight React single-page architecture unless the project intentionally grows beyond that.

## Build, lint, and validation commands

Use the repo scripts from the project root:

- Install dependencies: `npm install`
- Start the dev server: `npm run dev`
- Create a production build: `npm run build`
- Lint the project: `npm run lint`
- Preview the production build locally: `npm run preview`

Targeted validation:

- Single-file lint check: `npx eslint src/App.jsx`
- If you add a new file or change a subset of the app, prefer `npx eslint <file-or-directory>` over running the whole repo unless you need the full pass.

Test status:

- There is no automated test runner configured in `package.json` and no `vitest`/`jest` setup in the repo currently.
- Do not assume a test command exists; if you add tests, wire them into `package.json` and keep the command consistent with the existing Vite/React setup.

## High-level architecture

- `src/main.jsx` is the application bootstrap. It mounts the React tree into the DOM and imports the root stylesheet.
- `src/App.jsx` is the root UI component and the current place for the app shell.
- `src/index.css` and `src/App.css` are the styling entry points; keep UI styling co-located with features as the app grows.
- This is a client-side React app with no server-side rendering or backend service layer yet. Feature logic should remain in components or local module files under `src/` rather than introducing a new framework or architecture unless there is a clear need.
- When adding new areas of functionality, prefer keeping a small, straightforward component structure rather than creating abstraction layers prematurely.

## Key conventions in this repo

- Follow the existing Vite + React conventions already in use: ES modules, JSX, default exports for root components, and `import`/`export` syntax consistent with the current files.
- The codebase currently uses a lightweight style: single quotes, no semicolons, and simple functional components.
- Keep the root app intentionally minimal; do not add framework-level complexity (routing, global stores, SSR, or server code) unless a feature explicitly requires it.
- Because this is a browser-only project, avoid introducing server-side or Node-only patterns into client code. Any new feature should still work cleanly in the browser bundle.
- If the project grows, preserve the Vite setup and React structure rather than replacing it with another build/tooling approach.

## Repository notes

- The README is currently a placeholder and does not yet describe the app's intended product behavior or workflow. If you add user-facing functionality, keep the documentation in sync with the actual behavior.
- There is no `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, or other AI-specific instruction file in the repository right now.
