# time-study-pwa

This PWA is intended to be used as a local tool for others at enVista to take time studies. The goal is to make it easy to configure and use without both the overcomplication and limitations of the current solution (Quetech Workstudy+). 

[text](https://danielpaul2026.github.io/time-study-pwa/)

## Features
- enVista-branded menu with selectable templates and per-template study summaries
- installable as a standalone home-screen app on supported mobile browsers, with offline app-shell and asset caching after the first successful online load
- import templates from JSON files under Menu > More
- export/share a selected template as JSON and study data as an Excel workbook with a sheet for each populated subject, using the browser's share sheet when available or downloading the file for sharing
- warning-confirmed template deletion from the Menu action bar
- stopwatch action reserved for a future feature
- configurable template grid columns and row height
- empty grid cells on Template and Study display an Add control for creating buttons in place; when a grid is full, Add moves to the adjacent action bar
- buttons can be dragged between dotted grid cells, leaving cells empty
- template buttons can have one level of subbuttons; black corner markers identify buttons that open subbuttons, and selecting a subbutton records it and returns to the main study screen
- template editing supports selecting buttons for Properties, dragging them to arrange the grid, and explicitly nesting or unnesting buttons in Properties; double-click a nested button to open its subbutton grid
- template grid controls use compact, aligned dropdowns; Delete/Add/Properties are displayed as tabs, and the Save control highlights unsaved changes
- template grid columns and row height are saved independently for the top-level view and for each button's subbutton view; grid contents stay within the visible area, with columns increased automatically when needed
- selected template buttons can be deleted from the action row
- ten numbered subjects are always available for each template, and repeated studies continue adding to that subject's data
- the study preview and results show a subject's previous runs, with a gap marker when recording resumes
- the observation log is chronological; action counts and notes remain editable after recording, and selecting an action then a template button replaces its element without interrupting capture
- the Study and Results screens support merging sequential actions; merges keep the destination action and count, append source notes under `Merged:`, and retain the earlier timestamp, while original events remain stored so merges can be undone later from Results
- the study screen can add named buttons directly to the template; during capture, the new action is recorded only after confirming its name
- results display one template and subject at a time, with separate subject- and template-scoped clearing
- results show all selected subject actions in one export-ready table with element details, notes, counts, dates, timestamps, elapsed time, and study number
- button properties can define an optional Element ID and default count; during capture, action counts and notes can be adjusted per action
- more style options