# Time Study

Time Study is a browser-based, enVista-branded tool for configuring time-study templates, recording observations, and reviewing results. It is designed to work without a backend: templates and study data are saved in the browser that is being used.

[Open the deployed app](https://danielpaul2026.github.io/time-study-pwa/)

## What it does

- Create, edit, import, export, and delete study templates.
- Arrange template buttons in a configurable grid, customize their appearance, and optionally give a button one level of subbuttons.
- Record actions against one of ten numbered subjects for a template. Additional runs are saved as separate studies for the same subject.
- Review a subject's studies together, including action counts, notes, element IDs, timestamps, elapsed time, and markers between runs.
- Edit recorded action details, replace an action's element, and merge adjacent actions. A merge can be undone in Results.
- Export a template as JSON or download study data as an Excel workbook with a worksheet for each subject that has data.
- Install the app on supported browsers. In production, a service worker caches the app shell and build assets for offline use after the app has loaded successfully online.

The Stopwatch control is present in the menu but is not implemented yet.

## How data is stored

The app uses the browser's `localStorage`; it does not send templates or observations to a server. Data is scoped to the current browser profile and site origin. It is not automatically synchronized between devices or browsers. Clearing site data or changing browser profiles can make it unavailable, so export data you need to keep.

Two JSON arrays are stored under these keys:

| Key | Contents |
| --- | --- |
| `time-study-templates` | Saved template definitions |
| `time-study-sessions` | Recorded study sessions and their events |

### Template structure

A template has an `id`, a `name`, grid settings, and an `elements` array. Each element represents a button and can include its name, position, appearance, optional external element ID, and default count. A top-level element may contain a `children` array of subbuttons; the parent can also store the subbutton grid settings. For example:

```json
{
  "id": "1731700000000",
  "name": "Packing",
  "columns": 3,
  "rowHeightLines": 2,
  "elements": [
    {
      "id": 1,
      "name": "Pick",
      "position": 0,
      "externalId": "P-01",
      "defaultCount": 1,
      "backgroundColor": "#b9c9f2",
      "textColor": "#111111",
      "children": [
        {
          "id": 2,
          "name": "Small item",
          "position": 0
        }
      ],
      "childrenColumns": 2,
      "childrenRowHeightLines": 2
    }
  ]
}
```

Appearance fields such as font size, weight, and style are optional. An element's `position` identifies its grid cell. The editor normalizes positions when saving so elements occupy available cells.

### Study session and event structure

Each completed run is a separate session in `time-study-sessions`. A session associates the run with a template and subject and records start/end times, duration, and an ordered `events` array. Session objects have this general shape:

```json
{
  "id": "1731700060000",
  "templateId": "1731700000000",
  "templateName": "Packing",
  "subjectId": "1731700000000:1",
  "subjectNumber": 1,
  "startTime": 1731700000000,
  "endTime": 1731700060000,
  "durationMs": 60000,
  "events": [
    {
      "id": "event-id",
      "name": "Small item",
      "elementPrime": "Pick",
      "elementSub": "Small item",
      "elementId": "P-01",
      "count": 1,
      "note": "",
      "timestamp": 1731700015000
    }
  ]
}
```

Times are stored as JavaScript timestamps in milliseconds. Each action event records the selected element, count, optional note, and the time it was recorded. `elementPrime` and `elementSub` distinguish the parent and subbutton when applicable; `elementId` stores the configured external ID. Events can also contain a `type: "gap"` marker when recording resumes after an earlier run.

Merging does not discard the original events. Instead, the source event receives a `mergedInto` reference to the destination event. Results and exports derive the visible merged action from those retained events; this lets the merge be undone later. The displayed merged action keeps the destination's element and count, uses the earliest timestamp, and combines notes.

### Import, export, and deletion

- **Template import/export:** Templates are JSON files. Import validates the template's name and element structure, then assigns it a new ID so it is saved as a separate template.
- **Study data export:** The Excel workbook contains one worksheet per populated subject. Its rows include element details, notes, counts, date/time, elapsed seconds and minutes, and study number.
- **Deleting data:** Deleting a template also deletes all sessions associated with it. Results can clear all study data for the selected template or only the selected subject's data.

## Run locally

Requires Node.js and npm.

```sh
npm install
npm run dev
```

Vite prints a local development URL in the terminal.

## Project commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test:store` | Run the Node.js tests for storage and Excel export |

## Project structure

- `src/main.jsx` mounts the React app and registers the production service worker.
- `src/App.jsx` defines the routes for the menu, study, results, and template editor.
- `src/pages/` contains the user-facing screens.
- `src/data/studyStore.js` reads and writes templates and sessions in `localStorage`.
- `src/data/studyExport.js` builds the Excel workbook.
- `src/hooks/useAvailableGridRows.js` sizes the grids to the available screen space.
- `public/` contains the app icons and web app manifest.

The app is built with React and Vite. GitHub Actions builds and deploys the contents of `dist/` to GitHub Pages when changes are pushed to `main`.
