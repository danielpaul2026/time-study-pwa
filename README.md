# time-study-pwa

This PWA is intended to be used as a local tool for others at enVista to take time studies. The goal is to make it easy to configure and use without both the overcomplication and limitations of the current solution (Quetech Workstudy+). 

## Features
- enVista-branded menu with selectable templates and per-template study summaries
- template import and sharing from the menu
- stopwatch action reserved for a future feature
- configurable template grid columns and row height
- buttons can be dragged between dotted grid cells, leaving cells empty
- template buttons can have one level of subbuttons; black corner markers identify buttons that open subbuttons, and selecting a subbutton records it and returns to the main study screen
- template editing supports selecting buttons for Properties, dragging them to arrange the grid, and opening a subbutton editor with Back navigation; a button without subbuttons stays a normal button
- template grid columns and row height are saved independently for the top-level view and for each button's subbutton view; grid contents stay within the visible area, with columns increased automatically when needed
- selected template buttons can be deleted from the action row
- ten numbered subjects are always available for each template, and repeated studies continue adding to that subject's data
- the study preview and results show a subject's previous runs, with a gap marker when recording resumes
- results display one template and subject at a time, with separate subject- and template-scoped clearing
- more style options