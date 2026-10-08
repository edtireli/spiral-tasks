# Spiral Tasks

A small, local task list built from the visual language of Spiral Chat and the Spiral presentation engine.

[Open the app](https://edtireli.github.io/spiral-tasks/) · [Try the example](https://edtireli.github.io/spiral-tasks/?example=1)

- Add and edit tasks inline. Highlight what matters.
- Branch tasks into smaller steps; fold branches away.
- Drag to reorder. Drag right over a task to nest it. Keyboard and touch work too.
- Checked subtasks stay in place until their top-level task is complete; the whole tree then settles below the active list. Clear or delete, then undo.
- True black, warm grey, slate, moss, and paper backgrounds; seven highlight colors.
- Spiral’s animated interference field, with warped completion waves and bloom transitions. Reduced motion is respected.

Tasks and appearance are saved in this browser’s `localStorage`, under `spiral-tasks:v1`. There is no account, backend, analytics, or external font request. Lists do not sync between devices, and clearing browser site data removes the saved list. Example mode is separate from saved tasks.

## Run

Requires Node.js for development checks and Python 3 for the local server. The published app has no runtime dependencies.

```sh
npm install
npm start
```

Open `http://127.0.0.1:8873/`. `npm run build` copies only application files into `docs/`, the GitHub Pages source. `npm test` checks tree invariants. `npm run test:browser` checks the interface with Playwright and an installed Chrome; set `CHROME_PATH` for another installation.

## Controls

Click a title to edit. Use the row’s marker to highlight it, its branch button for a smaller step, or its menu for more actions. On touchscreens, use the row menu. Drag the grip to reorder; dragging right over a row makes it a branch. Branches can be nested up to six levels.

`N` focuses the new-task input. `Cmd/Ctrl Z` undoes a list change outside a text input. Focus a task control and use `Alt ↑/↓` to move it, `Alt →` to branch under its previous sibling, or `Alt ←` to unbranch it. `Cmd/Ctrl K` opens shortcuts.

Completing a parent completes its descendants; reopening a child reopens its ancestors. Checked subtasks remain under their parent, even when all its steps are checked, until the parent itself is completed. Completed trees keep their structure. Clear completed removes only trees in the completed section, preserving checked steps in unfinished tasks. Deleting a parent deletes its subtree. These operations and clearing the list are undoable during the current page session.

## Design provenance

The field is adapted directly from Edis Tireli’s [Spiral presentation engine](https://github.com/edtireli/presentation), `engine/js/field.js`, also maintained in the original `spiralengine` project. It preserves the twelve-wave interference pattern, fixed seed, brightness buckets, swelling front, warped arrival maps, color-draining wake, and gradual return. The task-list adapter controls lifecycle and interaction origins, adds accent tinting, and respects reduced motion. A GPU point renderer evaluates the same wave equations and palette in one draw at 60 Hz. The original Canvas renderer remains a 30 Hz fallback when WebGL is unavailable or its context is lost. Grid geometry is cached, text measurements are batched, and nested row transitions account for their parent motion. Height-only resizing and interrupted transitions are handled.

Typography, continuous marker strokes, and resolving text follow the presentation’s `clinical-synthesis.css` / typed statements and [Spiral Chat](https://github.com/edtireli/spiralChat)’s `Theme.kt`, `Decode.kt`, and animated banner/feature references. The unrelated translation mockups are not used.

The optional browser WebMCP tools use the same task actions as the interface and activate only when the browser exposes `document.modelContext`. Native WebMCP availability varies by browser.
