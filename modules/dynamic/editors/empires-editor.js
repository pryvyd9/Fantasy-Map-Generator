"use strict";

const $body = insertEditorHtml();
addListeners();

export function open() {
  closeDialogs("#empiresEditor, .stable");
  if (!layerIsOn("toggleEmpires")) toggleEmpires();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  refreshEmpiresEditor();

  $("#empiresEditor").dialog({
    title: "Empires Editor",
    resizable: false,
    close: closeEmpiresEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="empiresEditor" class="dialog stable">
    <div id="empiresHeader" class="header" style="grid-template-columns: 11em 8em 10em 5em 6em 6em">
      <div data-tip="Click to sort by empire name" class="sortable alphabetically" data-sortby="name">Empire&nbsp;</div>
      <div data-tip="Click to sort by empire form" class="sortable alphabetically" data-sortby="form">Form&nbsp;</div>
      <div data-tip="Click to sort by capital kingdom name" class="sortable alphabetically" data-sortby="capital">Capital Kingdom&nbsp;</div>
      <div data-tip="Click to sort by member kingdoms count" class="sortable" data-sortby="kingdoms">Kingdoms&nbsp;</div>
      <div data-tip="Click to sort by area" class="sortable icon-sort-number-down" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by population" class="sortable" data-sortby="population">Population&nbsp;</div>
    </div>

    <div id="empiresBodySection" class="table" data-type="absolute"></div>

    <div id="empiresFooter" class="totalLine">
      <div data-tip="Empires number" style="margin-left: 5px">Empires:&nbsp;<span id="empiresFooterCount">0</span></div>
      <div data-tip="Total member kingdoms" style="margin-left: 12px">Kingdoms:&nbsp;<span id="empiresFooterKingdoms">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Area:&nbsp;<span id="empiresFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="empiresFooterPopulation">0</span></div>
    </div>

    <div id="empiresBottom">
      <button id="empiresEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="empiresEditStyle" data-tip="Edit empires style in Style Editor" class="icon-adjust"></button>
      <button id="empiresLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="empiresPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
      <button id="empiresChart" data-tip="Show empires bubble chart" class="icon-chart-area"></button>
      <button id="empiresRegenerate" data-tip="Regenerate empires from current kingdoms" class="icon-shuffle"></button>

      <button id="empiresManually" data-tip="Manually re-assign kingdoms between empires" class="icon-brush"></button>
      <div id="empiresManuallyButtons" style="display: none">
        <span style="margin-left: .5em">Click a kingdom on the map to reassign it to the selected empire</span>
        <button id="empiresManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
        <button id="empiresManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
      </div>

      <button id="empiresAdd" data-tip="Add a new empire from a kingdom on the map" class="icon-plus"></button>
      <button id="empiresMerge" data-tip="Merge several empires into one" class="icon-layer-group"></button>
      <button id="empiresExport" data-tip="Save empires data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("empiresBodySection");
}

function addListeners() {
  applySortingByHeader("empiresHeader");

  byId("empiresEditorRefresh").on("click", refreshEmpiresEditor);
  byId("empiresEditStyle").on("click", () => editStyle("empireRegions"));
  byId("empiresLegend").on("click", toggleLegend);
  byId("empiresPercentage").on("click", togglePercentageMode);
  byId("empiresChart").on("click", showEmpiresChart);
  byId("empiresRegenerate").on("click", regenerateEmpires);
  byId("empiresManually").on("click", enterEmpiresManualAssignment);
  byId("empiresManuallyApply").on("click", applyEmpiresManualAssignment);
  byId("empiresManuallyCancel").on("click", () => exitEmpiresManualAssignment(false));
  byId("empiresAdd").on("click", enterAddEmpireMode);
  byId("empiresMerge").on("click", openEmpireMergeDialog);
  byId("empiresExport").on("click", downloadEmpiresCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const empireId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") empireChangeFill($element);
    else if (classList.contains("name")) editEmpireName(empireId);
    else if (classList.contains("empireCapital")) empireCapitalZoomIn(empireId);
    else if (classList.contains("icon-pin")) toggleFog(empireId, classList);
    else if (classList.contains("icon-lock") || classList.contains("icon-lock-open")) updateLockStatus(empireId, classList);
    else if (classList.contains("icon-trash-empty")) empireRemovePrompt(empireId);
  });

  $body.on("change", function (ev) {
    const $element = ev.target;
    if ($element.classList.contains("empireForm")) {
      const empireId = +$element.parentNode.dataset.id;
      const e = pack.empires[empireId];
      if (e) {
        e.formName = $element.value;
        e.fullName = `${e.name} ${e.formName}`.trim();
        if (layerIsOn("toggleLabels")) drawEmpireLabels();
      }
    }
  });
}

export function refreshEmpiresEditor() {
  empiresEditorAddLines();
}

function empiresEditorAddLines() {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalKingdomsCount = 0;

  for (const e of pack.empires) {
    if (!e.i || e.removed) continue;

    const capitalKingdom = pack.kingdoms[e.capital] || null;
    const capitalName = capitalKingdom ? capitalKingdom.name : "—";
    const focused = defs.select("#fog #focusEmpire" + e.i).size();

    let area = 0;
    let population = 0;
    const memberKingdomIds = e.kingdoms || [];

    for (const kid of memberKingdomIds) {
      const k = pack.kingdoms[kid];
      if (!k || k.removed) continue;
      for (const sid of k.states || []) {
        const s = pack.states[sid];
        if (!s || s.removed) continue;
        area += getArea(s.area);
        const rural = s.rural * populationRate;
        const urban = s.urban * populationRate * urbanization;
        population += rural + urban;
      }
    }

    totalArea += area;
    totalPopulation += population;
    totalKingdomsCount += memberKingdomIds.length;

    lines += /* html */ `<div
      class="empires"
      data-id="${e.i}"
      data-name="${e.name}"
      data-form="${e.formName || ""}"
      data-capital="${capitalName}"
      data-kingdoms="${memberKingdomIds.length}"
      data-area="${area}"
      data-population="${rn(population)}"
    >
      <fill-box fill="${e.color}"></fill-box>
      <input data-tip="Empire name. Click to change" class="empireName name pointer" value="${e.name}" readonly />
      <input data-tip="Empire form name. Type to change" class="empireForm" value="${e.formName || ""}" />
      <input data-tip="Capital kingdom. Click to zoom" class="empireCapital pointer" value="${capitalName}" readonly />
      <div data-tip="Member kingdoms count">${memberKingdomIds.length}</div>
      <div data-tip="Empire area" class="empireArea">${si(area)} ${unit}</div>
      <div data-tip="Empire population" class="empirePopulation">${si(rn(population))}</div>
      <span data-tip="Toggle empire focus" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
      <span data-tip="Lock the empire to protect it from re-generation" class="icon-lock${e.lock ? "" : "-open"} hide"></span>
      <span data-tip="Remove the empire" class="icon-trash-empty hide"></span>
    </div>`;
  }

  $body.innerHTML = lines;

  byId("empiresFooterCount").innerHTML = pack.empires.filter(e => e.i && !e.removed).length;
  byId("empiresFooterKingdoms").innerHTML = totalKingdomsCount;
  byId("empiresFooterArea").innerHTML = si(totalArea) + unit;
  byId("empiresFooterArea").dataset.area = totalArea;
  byId("empiresFooterPopulation").innerHTML = si(rn(totalPopulation));
  byId("empiresFooterPopulation").dataset.population = rn(totalPopulation);

  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", () => empireHighlightOn($line));
    $line.on("mouseleave", () => empireHighlightOff($line));
    $line.on("click", selectEmpireOnLineClick);
  });

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(empiresHeader);
  $("#empiresEditor").dialog({width: fitContent()});
}

function empireHighlightOn($line) {
  const id = +$line.dataset.id;
  const e = pack.empires[id];
  if (!e) return;
  for (const kid of e.kingdoms || []) {
    const k = pack.kingdoms[kid];
    if (!k) continue;
    for (const sid of k.states || []) {
      const el = viewbox.select("#state" + sid);
      el.size() && el.raise().attr("filter", "url(#blur1)");
    }
  }
}

function empireHighlightOff($line) {
  viewbox.selectAll("[id^='state']").attr("filter", null);
}

function empireChangeFill($element) {
  const $parent = $element.parentNode;
  const empireId = +$parent.dataset.id;
  const e = pack.empires[empireId];
  if (!e) return;

  const callback = color => {
    e.color = color;
    $element.setAttribute("fill", color);
    if (layerIsOn("toggleEmpires")) drawEmpires();
  };

  openColorPicker($element, e.color, callback);
}

function editEmpireName(empireId) {
  const e = pack.empires[empireId];
  if (!e) return;

  const input = prompt("Empire name:", e.name);
  if (input === null || input === e.name) return;

  e.name = input;
  e.fullName = `${e.name} ${e.formName}`.trim();
  refreshEmpiresEditor();
  if (layerIsOn("toggleLabels")) drawEmpireLabels();
}

function empireCapitalZoomIn(empireId) {
  const e = pack.empires[empireId];
  if (!e) return;
  const capitalKingdom = pack.kingdoms[e.capital];
  if (!capitalKingdom || !capitalKingdom.pole) return;
  const [x, y] = capitalKingdom.pole;
  zoomTo(x, y, 6, 1600);
}

function toggleFog(empireId, classList) {
  const id = "focusEmpire" + empireId;
  const e = pack.empires[empireId];
  if (!e) return;

  const path = defs.select("#fog #" + id);
  if (path.size()) {
    unfog(id);
    classList.add("inactive");
    return;
  }

  classList.remove("inactive");
  const memberCells = [];
  for (const kid of e.kingdoms || []) {
    const k = pack.kingdoms[kid];
    if (!k) continue;
    for (const sid of k.states || []) {
      pack.cells.state.forEach((s, i) => {
        if (s === sid) memberCells.push(i);
      });
    }
  }
  const polygons = memberCells.map(i => "M" + getPackPolygon(i)).join("");
  fog(id, polygons);
}

function updateLockStatus(empireId, classList) {
  const e = pack.empires[empireId];
  if (!e) return;
  e.lock = !e.lock;
  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

function empireRemovePrompt(empireId) {
  if (customization) return;

  confirmationDialog({
    title: "Remove empire",
    message: "Are you sure you want to remove this empire? Member kingdoms will become independent.",
    confirm: "Remove",
    onConfirm: () => empireRemove(empireId)
  });
}

function empireRemove(empireId) {
  const e = pack.empires[empireId];
  if (!e) return;

  for (const kid of e.kingdoms || []) {
    if (pack.kingdoms[kid]) pack.kingdoms[kid].empire = 0;
    // clear empire from member states
    const k = pack.kingdoms[kid];
    if (k) {
      for (const sid of k.states || []) {
        if (pack.states[sid]) pack.states[sid].empire = 0;
      }
    }
  }

  unfog("focusEmpire" + empireId);
  e.removed = true;

  refreshEmpiresEditor();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) drawEmpireLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function regenerateEmpires() {
  if (!confirm("Regenerate all empires from current kingdoms?")) return;
  Kingdoms.generate();
  Kingdoms.getPoles();
  refreshEmpiresEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) {
    drawKingdomLabels();
    drawEmpireLabels();
  }
  if (layerIsOn("toggleBorders")) drawBorders();
}

// ── Manual Assignment ──────────────────────────────────────────────────
function enterEmpiresManualAssignment() {
  if (!layerIsOn("toggleEmpires")) toggleEmpires();
  customization = 14;
  document.querySelectorAll("#empiresBottom > button").forEach(el => (el.style.display = "none"));
  byId("empiresManuallyButtons").style.display = "inline-block";
  empiresFooter.style.display = "none";

  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  $("#empiresEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  tip("Click on a kingdom on the map to reassign it to the selected empire", true);
  viewbox.style("cursor", "crosshair").on("click", reassignKingdomOnMapClick);

  const first = $body.querySelector("div");
  if (first) first.classList.add("selected");
}

function selectEmpireOnLineClick() {
  if (customization !== 14) return;
  if (this.parentNode.id !== "empiresBodySection") return;
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
  this.classList.add("selected");
}

function reassignKingdomOnMapClick() {
  const point = d3.mouse(this);
  const cellId = findCell(point[0], point[1]);
  if (pack.cells.h[cellId] < 20) return;

  const stateId = pack.cells.state[cellId];
  if (!stateId) return tip("Cannot reassign neutral lands", false, "error");

  const state = pack.states[stateId];
  if (!state || state.removed) return;

  const kingdomId = state.kingdom;
  if (!kingdomId) return tip("This duchy has no kingdom", false, "error");

  const $selected = $body.querySelector("div.selected");
  if (!$selected) return tip("Please select an empire first", false, "error");
  const newEmpireId = +$selected.dataset.id;

  const kingdom = pack.kingdoms[kingdomId];
  if (!kingdom || kingdom.removed) return;

  const oldEmpireId = kingdom.empire;
  if (oldEmpireId === newEmpireId) return;

  // remove from old empire
  if (oldEmpireId) {
    const oldE = pack.empires[oldEmpireId];
    if (oldE) {
      oldE.kingdoms = oldE.kingdoms.filter(id => id !== kingdomId);
      if (!oldE.kingdoms.length) oldE.removed = true;
    }
  }

  // add to new empire
  kingdom.empire = newEmpireId;
  const newE = pack.empires[newEmpireId];
  if (newE && !newE.kingdoms.includes(kingdomId)) {
    newE.kingdoms.push(kingdomId);
  }

  // update empire on member states
  for (const sid of kingdom.states || []) {
    if (pack.states[sid]) pack.states[sid].empire = newEmpireId;
  }

  refreshEmpiresEditor();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) drawEmpireLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function applyEmpiresManualAssignment() {
  Kingdoms.getPoles();
  exitEmpiresManualAssignment(false);
}

function exitEmpiresManualAssignment(close) {
  customization = 0;
  document.querySelectorAll("#empiresBottom > button").forEach(el => (el.style.display = "inline-block"));
  byId("empiresManuallyButtons").style.display = "none";
  empiresFooter.style.display = "block";

  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (!close)
    $("#empiresEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  restoreDefaultEvents();
  clearMainTip();
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

// ── Add Empire ─────────────────────────────────────────────────────────
function enterAddEmpireMode() {
  if (this.classList.contains("pressed")) {
    exitAddEmpireMode();
    return;
  }
  customization = 15;
  this.classList.add("pressed");
  tip("Click on a kingdom on the map to create a new empire from it", true);
  viewbox.style("cursor", "crosshair").on("click", addEmpire);
  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "none"));
}

function addEmpire() {
  const point = d3.mouse(this);
  const cellId = findCell(point[0], point[1]);
  if (pack.cells.h[cellId] < 20)
    return tip("You cannot place an empire in water. Please click on a land cell", false, "error");

  const stateId = pack.cells.state[cellId];
  if (!stateId) return tip("Cannot create an empire from neutral lands", false, "error");

  const state = pack.states[stateId];
  if (!state || state.removed) return;

  const kingdomId = state.kingdom;
  if (!kingdomId) return tip("This duchy has no kingdom to form an empire from", false, "error");

  const kingdom = pack.kingdoms[kingdomId];
  if (!kingdom || kingdom.removed) return;

  const oldEmpireId = kingdom.empire;

  // remove from old empire
  if (oldEmpireId) {
    const oldE = pack.empires[oldEmpireId];
    if (oldE) {
      oldE.kingdoms = oldE.kingdoms.filter(id => id !== kingdomId);
      if (!oldE.kingdoms.length) oldE.removed = true;
    }
  }

  // create new empire
  const newEmpireId = pack.empires.length;
  const color = getRandomColor();
  const formName = "Empire";
  const capitalState = pack.states[kingdom.capital];
  const name = capitalState ? capitalState.name : kingdom.name;
  const fullName = `${formName} of ${name}`;
  pack.empires.push({
    i: newEmpireId,
    name,
    fullName,
    formName,
    color,
    capital: kingdomId,
    kingdoms: [kingdomId]
  });

  kingdom.empire = newEmpireId;
  for (const sid of kingdom.states || []) {
    if (pack.states[sid]) pack.states[sid].empire = newEmpireId;
  }

  if (d3.event.shiftKey === false) exitAddEmpireMode();

  Kingdoms.getPoles();
  refreshEmpiresEditor();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) drawEmpireLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function exitAddEmpireMode() {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  byId("empiresAdd").classList.remove("pressed");
  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "all"));
}

// ── Merge Empires ──────────────────────────────────────────────────────
function openEmpireMergeDialog() {
  const validEmpires = pack.empires.filter(e => e.i && !e.removed);
  if (validEmpires.length < 2) return tip("Need at least 2 empires to merge", false, "error");

  const empiresSelector = validEmpires
    .map(
      e => /* html */ `
      <div data-tip="${e.fullName || e.name}">
        <input type="radio" name="rulingEmpire" value="${e.i}" />
        <input id="selectEmpire${e.i}" class="checkbox" type="checkbox" name="empiresToMerge" value="${e.i}" />
        <label for="selectEmpire${e.i}" class="checkbox-label">
          <svg width="1em" height="1em" style="vertical-align:middle"><rect width="100%" height="100%" fill="${e.color}"/></svg>
          ${e.fullName || e.name}
        </label>
      </div>
    `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeEmpiresForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <header style='font-weight:bold;'>Select multiple empires to merge and the ruling empire to merge into</header>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${empiresSelector}
      </main>
    </form>
  `;

  $("#alert").dialog({
    width: fitContent(),
    title: `Merge empires`,
    buttons: {
      Merge: function () {
        const formData = new FormData(byId("mergeEmpiresForm"));

        const rulingId = Number(formData.get("rulingEmpire"));
        if (!rulingId) return tip("Please select an empire to merge into", false, "error");
        const rulingEmpire = pack.empires[rulingId];

        const toMerge = formData
          .getAll("empiresToMerge")
          .map(Number)
          .filter(id => id !== rulingId);
        if (!toMerge.length) return tip("Please select several empires to merge", false, "error");

        confirmationDialog({
          title: "Merge empires",
          message: /* html */ `
            <p>The following empires will be <strong>removed</strong>: ${toMerge.map(id => pack.empires[id].name).join(", ")}.</p>
            <p>Their kingdoms will be assigned to ${rulingEmpire.name}.</p>
            <p>Are you sure? This action cannot be reverted.</p>`,
          confirm: "Merge",
          onConfirm: () => {
            mergeEmpires(toMerge, rulingId);
            $(this).dialog("close");
          }
        });
      },
      Cancel: function () {
        $(this).dialog("close");
      }
    }
  });
}

function mergeEmpires(toMerge, rulingId) {
  const ruling = pack.empires[rulingId];

  for (const id of toMerge) {
    const e = pack.empires[id];
    if (!e || e.removed) continue;

    for (const kid of e.kingdoms || []) {
      if (pack.kingdoms[kid]) pack.kingdoms[kid].empire = rulingId;
      if (!ruling.kingdoms.includes(kid)) ruling.kingdoms.push(kid);
      // update states
      const k = pack.kingdoms[kid];
      if (k) {
        for (const sid of k.states || []) {
          if (pack.states[sid]) pack.states[sid].empire = rulingId;
        }
      }
    }

    e.kingdoms = [];
    e.removed = true;
  }

  Kingdoms.getPoles();
  refreshEmpiresEditor();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) drawEmpireLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

// ── Chart ──────────────────────────────────��───────────────────────────
function showEmpiresChart() {
  const empiresData = pack.empires.filter(e => !e.removed && e.i);
  if (empiresData.length < 1) return tip("There are no empires to show", false, "error");

  const chartData = [{i: 0, name: "root"}];
  for (const e of empiresData) {
    let area = 0;
    let population = 0;
    let kingdoms = 0;
    for (const kid of e.kingdoms || []) {
      const k = pack.kingdoms[kid];
      if (!k || k.removed) continue;
      kingdoms++;
      for (const sid of k.states || []) {
        const s = pack.states[sid];
        if (!s || s.removed) continue;
        area += s.area;
        population += s.rural * populationRate + s.urban * populationRate * urbanization;
      }
    }
    chartData.push({i: e.i, name: e.name, fullName: e.fullName, color: e.color, area, population, kingdoms});
  }

  const root = d3
    .stratify()
    .id(d => d.i)
    .parentId(d => (d.i ? 0 : null))(chartData)
    .sum(d => d.area)
    .sort((a, b) => b.value - a.value);

  const size = 150 + 200 * uiSize.value;
  const margin = {top: 0, right: -50, bottom: 0, left: -50};
  const w = size - margin.left - margin.right;
  const h = size - margin.top - margin.bottom;
  const treeLayout = d3.pack().size([w, h]).padding(3);

  alertMessage.innerHTML = /* html */ `<select id="empiresTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>Area</option>
    <option value="population">Total population</option>
    <option value="kingdoms">Kingdoms number</option>
  </select>`;
  alertMessage.innerHTML += `<div id='empiresInfo' class='chartInfo'>&#8205;</div>`;

  const svg = d3
    .select("#alertMessage")
    .insert("svg", "#empiresInfo")
    .attr("id", "empiresTree")
    .attr("width", size)
    .attr("height", size)
    .style("font-family", "Almendra SC")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");
  const graph = svg.append("g").attr("transform", `translate(-50, 0)`);
  byId("empiresTreeType").on("change", updateChart);

  treeLayout(root);

  const node = graph
    .selectAll("g")
    .data(root.leaves())
    .enter()
    .append("g")
    .attr("transform", d => `translate(${d.x},${d.y})`)
    .attr("data-id", d => d.data.i)
    .on("mouseenter", d => showInfo(event, d))
    .on("mouseleave", d => hideInfo(event, d));

  node.append("circle").attr("fill", d => d.data.color).attr("r", d => d.r);

  const exp = /(?=[A-Z][^A-Z])/g;
  const lp = n => d3.max(n.split(exp).map(p => p.length)) + 1;

  node
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .style("font-size", d => rn((d.r ** 0.97 * 4) / lp(d.data.name), 2) + "px")
    .selectAll("tspan")
    .data(d => d.data.name.split(exp))
    .join("tspan")
    .attr("x", 0)
    .text(d => d)
    .attr("dy", (d, i, n) => `${i ? 1 : (n.length - 1) / -2}em`);

  function showInfo(ev, d) {
    d3.select(ev.target).select("circle").classed("selected", 1);
    const area = getArea(d.data.area) + " " + getAreaUnit();
    const option = empiresTreeType.value;
    const value =
      option === "area" ? "Area: " + area
      : option === "kingdoms" ? "Kingdoms: " + d.data.kingdoms
      : "Population: " + si(rn(d.data.population));
    empiresInfo.innerHTML = `${d.data.fullName || d.data.name}. ${value}`;
  }

  function hideInfo(ev) {
    if (!byId("empiresInfo")) return;
    empiresInfo.innerHTML = "&#8205;";
    d3.select(ev.target).select("circle").classed("selected", 0);
  }

  function updateChart() {
    const value =
      this.value === "area" ? d => d.area
      : this.value === "kingdoms" ? d => d.kingdoms
      : d => d.population;

    root.sum(value);
    node.data(treeLayout(root).leaves());
    node.transition().duration(1500).attr("transform", d => `translate(${d.x},${d.y})`);
    node.select("circle").transition().duration(1500).attr("r", d => d.r);
    node.select("text").transition().duration(1500).style("font-size", d => rn((d.r ** 0.97 * 4) / lp(d.data.name), 2) + "px");
  }

  $("#alert").dialog({
    title: "Empires bubble chart",
    width: fitContent(),
    position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"},
    buttons: {},
    close: () => { alertMessage.innerHTML = ""; }
  });
}

// ── Legend ──────────────────────────────────────────────────────────────
function toggleLegend() {
  if (legend.selectAll("*").size()) return clearLegend();

  const data = pack.empires
    .filter(e => e.i && !e.removed)
    .sort((a, b) => (b.kingdoms?.length || 0) - (a.kingdoms?.length || 0))
    .map(e => [e.i, e.color, e.name]);
  drawLegend("Empires", data);
}

// ── Percentage ─────────────────────────────────────────────────────────
function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalArea = +(byId("empiresFooterArea").dataset.area || 0);
    const totalPop = +(byId("empiresFooterPopulation").dataset.population || 0);

    $body.querySelectorAll(":scope > div").forEach($line => {
      const area = +$line.dataset.area;
      const pop = +$line.dataset.population;
      $line.querySelector(".empireArea").innerHTML = totalArea ? rn((area / totalArea) * 100) + "%" : "0%";
      $line.querySelector(".empirePopulation").innerHTML = totalPop ? rn((pop / totalPop) * 100) + "%" : "0%";
    });
  } else {
    $body.dataset.type = "absolute";
    empiresEditorAddLines();
  }
}

// ── CSV Export ─────────────────────────────────────────────────────────
function downloadEmpiresCsv() {
  const unit = getAreaUnit();
  const rows = [["Id", "Name", "Form", "Capital Kingdom", "Kingdoms", "Color"].join(",")];

  for (const e of pack.empires) {
    if (!e.i || e.removed) continue;
    const capitalKingdom = pack.kingdoms[e.capital] || null;
    rows.push(
      [e.i, `"${e.name}"`, `"${e.formName || ""}"`, `"${capitalKingdom ? capitalKingdom.name : ""}"`, (e.kingdoms || []).length, e.color].join(",")
    );
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFileName("Empires") + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

function closeEmpiresEditor() {
  if (customization === 14) exitEmpiresManualAssignment(true);
  if (customization === 15) exitAddEmpireMode();
}
