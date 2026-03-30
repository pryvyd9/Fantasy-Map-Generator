# Upstream Merge Guide

This guide explains how to sync this fork with the upstream [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator) repository after the Kingdom and Empire feature has been added.

---

## Overview of Modified Files

The Kingdom/Empire feature touches the following files:

| File | Type of change |
|------|---------------|
| `modules/kingdoms-generator.js` | **New file** — no upstream conflict |
| `modules/renderers/draw-kingdom-labels.js` | **New file** — no upstream conflict |
| `modules/dynamic/editors/kingdoms-editor.js` | **New file** — no upstream conflict |
| `modules/dynamic/editors/empires-editor.js` | **New file** — no upstream conflict |
| `docs/upstream-merge-guide.md` | **New file** — no upstream conflict |
| `main.js` | Modified — new SVG groups and generation call |
| `modules/renderers/draw-borders.js` | Modified — kingdom/empire border passes |
| `modules/ui/layers.js` | Modified — toggle/draw functions |
| `modules/ui/editors.js` | Modified — editKingdoms/editEmpires |
| `modules/io/save.js` | Modified — data[39]/data[40] |
| `modules/io/load.js` | Modified — parse data[39]/data[40] |
| `modules/dynamic/auto-update.js` | Modified — migration block |
| `modules/dynamic/export-json.js` | Modified — kingdoms/empires in JSON |
| `index.html` | Modified — layer toggles, sliders, script tags |
| `versioning.js` | Modified — version bump |

New files will not conflict. Only the modified files require attention.

---

## Step-by-Step Rebase Workflow

```bash
# 1. Add upstream remote (one-time setup)
git remote add upstream https://github.com/Azgaar/Fantasy-Map-Generator.git

# 2. Fetch latest upstream changes
git fetch upstream

# 3. Check what commits upstream has that your branch doesn't
git log HEAD..upstream/master --oneline

# 4. Rebase your feature branch on top of upstream master
git rebase upstream/master

# OR if you prefer a merge commit:
# git merge upstream/master
```

If conflicts occur, `git rebase` will pause at each conflicting commit. Resolve conflicts in each file as described below, then run `git rebase --continue`.

---

## Conflict Resolution Per File

### `main.js`

**What to keep:** Your additions of SVG groups and the `Kingdoms.generate()` / `Kingdoms.getPoles()` calls.

Look for these blocks that you added and make sure they survive the merge:

```js
// SVG region groups (inserted before #regions so they render behind states)
let empireRegions = viewbox.append("g").attr("id", "empireRegions");
let kingdomRegions = viewbox.append("g").attr("id", "kingdomRegions");

// Inside borders group:
let kingdomBorders = borders.append("g").attr("id", "kingdomBorders")...
let empireBorders  = borders.append("g").attr("id", "empireBorders")...

// Inside labels group:
labels.append("g").attr("id", "kingdoms");
labels.append("g").attr("id", "empires");

// Generation call order (after Provinces.getPoles()):
Kingdoms.generate();
Kingdoms.getPoles();
```

If upstream added new SVG groups or changed the generation call order, re-apply your additions in the correct relative position.

---

### `modules/io/save.js`

**Key risk:** If upstream adds new entries to the `mapData` array, the indices of `kingdoms` (data[39]) and `empires` (data[40]) may shift.

**What to verify after merging:**
1. `kingdoms` and `empires` are still at the **end** of the `mapData` array.
2. The comment `// data[39] = kingdoms, data[40] = empires` still matches the actual position.

Count the entries in the `mapData` array. The last two should always be:
```js
kingdoms,   // data[N-1]
empires     // data[N]
```

If upstream inserted new entries before them, update the index comments accordingly and update `load.js` to match.

---

### `modules/io/load.js`

**What to verify after merging:**

The parse lines must use the correct indices matching `save.js`:
```js
pack.kingdoms = data[39] ? JSON.parse(data[39]) : [0];
pack.empires  = data[40] ? JSON.parse(data[40]) : [0];
```

If the indices shifted in `save.js`, update them here too.

Also verify the patch lines are present:
```js
pack.states.forEach(s => {
  if (s.kingdom === undefined) s.kingdom = 0;
  if (s.empire === undefined)  s.empire  = 0;
});
if (pack.kingdoms) pack.kingdoms.forEach(k => { if (k?.empire === undefined) k.empire = 0; });
```

And the layer detection:
```js
if (hasChildren(kingdomRegions)) turnOn("toggleKingdoms");
if (hasChildren(empireRegions))  turnOn("toggleEmpires");
```

---

### `modules/dynamic/auto-update.js`

**What to keep:** The `isOlderThan("1.109.0")` migration block must stay at the **end** of `resolveVersionConflicts()`, after any upstream migration blocks.

If upstream added new migration blocks with version strings higher than `"1.109.0"` (e.g. `"1.110.0"`), insert your block before those.

If upstream added blocks between `"1.108.0"` and `"1.109.0"` that conflict with the kingdom data, examine each block individually.

---

### `modules/renderers/draw-borders.js`

**What to keep:** The kingdom and empire border rendering additions:
- `getKingdom()` and `getEmpire()` helper functions
- `kingdomPath` and `empirePath` array declarations
- The additional scan pass in the cell loop for kingdom and empire borders
- The two `svg.select().append("path")` calls at the bottom for `#kingdomBorders` and `#empireBorders`

If upstream rewrote `draw-borders.js`, re-apply these additions to the new version carefully, following the same pattern as state borders.

---

### `modules/ui/layers.js`

**What to keep:**
- `toggleKingdoms(event)` and `toggleEmpires(event)` functions
- `drawKingdoms()` and `drawEmpires()` fill region functions
- Calls to `drawKingdomLabels()` and `drawEmpireLabels()` inside `drawLabels()`
- Calls to `drawKingdoms()` and `drawEmpires()` inside `drawLayers()`
- `getLayer()` entries for `toggleKingdoms` and `toggleEmpires`
- `toggleKingdoms` and `toggleEmpires` in the `political` preset array

---

### `modules/ui/editors.js`

**What to keep:**
- `async function editKingdoms()` with dynamic import of `kingdoms-editor.js`
- `async function editEmpires()` with dynamic import of `empires-editor.js`
- `kingdomsEditorRefresh` and `empiresEditorRefresh` calls in `refreshAllEditors()`

---

### `index.html`

This is the most likely file to have large diffs. Verify:

1. **Layer toggle buttons** (in `#mapLayers` list, after Provinces):
   ```html
   <li id="toggleKingdoms" ...>Kingdoms</li>
   <li id="toggleEmpires"  ...>Empires</li>
   ```

2. **Options sliders** (in World Configurator, after statesNumber):
   ```html
   <tr>...kingdomsRatio slider...</tr>
   <tr>...empiresNumber slider...</tr>
   ```
   Also confirm `<td>States ratio</td>` (was renamed from "States number").

3. **Script tags**:
   ```html
   <script src="modules/kingdoms-generator.js?v=1.109.0"></script>
   <script defer src="modules/renderers/draw-kingdom-labels.js?v=1.109.0"></script>
   ```

---

### `versioning.js`

After merging, keep whichever version number is **higher**. If upstream bumped to `1.109.0` or beyond, use their version. If their version is lower than `1.109.0`, keep `1.109.0`.

---

## Testing After Rebase

Run through these checks after merging to verify nothing broke:

1. **Generate a new map** — verify `pack.kingdoms` and `pack.empires` are populated in the browser console.
2. **Open Kingdoms Editor** — confirm states are grouped under kingdoms.
3. **Open Empires Editor** — confirm kingdoms are grouped under empires.
4. **Toggle "Kingdoms" layer** — fill regions appear colored by kingdom.
5. **Toggle "Empires" layer** — fill regions appear colored by empire.
6. **Toggle "Labels"** — kingdom and empire names render larger than state labels.
7. **Toggle "Borders"** — kingdom borders (dashed) and empire borders (solid, thick) appear.
8. **Save → reload** — kingdoms and empires persist correctly.
9. **Load an old `.map` file** — auto-update migration runs, kingdoms derived from diplomacy, no errors in console.
10. **Export JSON (Full and Minimal)** — kingdoms and empires arrays present in exported data.

---

## Minimizing Future Conflict Risk

- Keep `kingdoms` and `empires` at the **end** of the `mapData` array in `save.js`. This means upstream adding new data entries between them and `zones` would only require an index number update.
- New files (`kingdoms-generator.js`, editor files, this guide) will never conflict with upstream pulls.
- If a large upstream refactor touches `layers.js` or `draw-borders.js`, treat those files as requiring careful manual re-application of the kingdom/empire additions.
