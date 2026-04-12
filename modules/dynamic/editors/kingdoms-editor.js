"use strict";

const $body = insertEditorHtml();
addListeners();

export function open() {
  closeDialogs("#kingdomsEditor, .stable");
  if (!layerIsOn("toggleKingdoms")) toggleKingdoms();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  refreshKingdomsEditor();

  $("#kingdomsEditor").dialog({
    title: "Kingdoms Editor",
    resizable: false,
    close: closeKingdomsEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="kingdomsEditor" class="dialog stable">
    <div id="kingdomsHeader" class="header" style="grid-template-columns: 11em 8em 10em 5em 6em 6em">
      <div data-tip="Click to sort by kingdom name" class="sortable alphabetically" data-sortby="name">Kingdom&nbsp;</div>
      <div data-tip="Click to sort by kingdom form" class="sortable alphabetically" data-sortby="form">Form&nbsp;</div>
      <div data-tip="Click to sort by capital duchy name" class="sortable alphabetically" data-sortby="capital">Capital Duchy&nbsp;</div>
      <div data-tip="Click to sort by member duchies count" class="sortable" data-sortby="states">Duchies&nbsp;</div>
      <div data-tip="Click to sort by area" class="sortable icon-sort-number-down" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by population" class="sortable" data-sortby="population">Population&nbsp;</div>
    </div>

    <div id="kingdomsBodySection" class="table" data-type="absolute"></div>

    <div id="kingdomsFooter" class="totalLine">
      <div data-tip="Kingdoms number" style="margin-left: 5px">Kingdoms:&nbsp;<span id="kingdomsFooterCount">0</span></div>
      <div data-tip="Total member duchies" style="margin-left: 12px">Duchies:&nbsp;<span id="kingdomsFooterStates">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Area:&nbsp;<span id="kingdomsFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="kingdomsFooterPopulation">0</span></div>
    </div>

    <div id="kingdomsBottom">
      <button id="kingdomsEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="kingdomsEditStyle" data-tip="Edit kingdoms style in Style Editor" class="icon-adjust"></button>
      <button id="kingdomsLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="kingdomsPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
      <button id="kingdomsChart" data-tip="Show kingdoms bubble chart" class="icon-chart-area"></button>
      <button id="kingdomsRegenerate" data-tip="Regenerate kingdoms from current duchy diplomacy" class="icon-shuffle"></button>

      <button id="kingdomsManually" data-tip="Manually re-assign duchies between kingdoms" class="icon-brush"></button>
      <div id="kingdomsManuallyButtons" style="display: none">
        <span style="margin-left: .5em">Click a duchy on the map to reassign it to the selected kingdom</span>
        <button id="kingdomsManuallyApply" data-tip="Apply assignment" class="icon-check"></button>
        <button id="kingdomsManuallyCancel" data-tip="Cancel assignment" class="icon-cancel"></button>
      </div>

      <button id="kingdomsAdd" data-tip="Add a new kingdom from a duchy on the map" class="icon-plus"></button>
      <button id="kingdomsMerge" data-tip="Merge several kingdoms into one" class="icon-layer-group"></button>
      <button id="kingdomsExport" data-tip="Save kingdoms data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("kingdomsBodySection");
}

function addListeners() {
  applySortingByHeader("kingdomsHeader");

  byId("kingdomsEditorRefresh").on("click", refreshKingdomsEditor);
  byId("kingdomsEditStyle").on("click", () => editStyle("kingdomRegions"));
  byId("kingdomsLegend").on("click", toggleLegend);
  byId("kingdomsPercentage").on("click", togglePercentageMode);
  byId("kingdomsChart").on("click", showKingdomsChart);
  byId("kingdomsRegenerate").on("click", regenerateKingdoms);
  byId("kingdomsManually").on("click", enterKingdomsManualAssignment);
  byId("kingdomsManuallyApply").on("click", applyKingdomsManualAssignment);
  byId("kingdomsManuallyCancel").on("click", () => exitKingdomsManualAssignment(false));
  byId("kingdomsAdd").on("click", enterAddKingdomMode);
  byId("kingdomsMerge").on("click", openKingdomMergeDialog);
  byId("kingdomsExport").on("click", downloadKingdomsCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const kingdomId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") kingdomChangeFill($element);
    else if (classList.contains("name")) editKingdomName(kingdomId);
    else if (classList.contains("kingdomCapital")) kingdomCapitalZoomIn(kingdomId);
    else if (classList.contains("icon-pin")) toggleFog(kingdomId, classList);
    else if (classList.contains("icon-lock") || classList.contains("icon-lock-open")) updateLockStatus(kingdomId, classList);
    else if (classList.contains("icon-trash-empty")) kingdomRemovePrompt(kingdomId);
  });

  $body.on("change", function (ev) {
    const $element = ev.target;
    if ($element.classList.contains("kingdomForm")) {
      const kingdomId = +$element.parentNode.dataset.id;
      const k = pack.kingdoms[kingdomId];
      if (k) {
        k.formName = $element.value;
        k.fullName = `${k.name} ${k.formName}`.trim();
        if (layerIsOn("toggleLabels")) drawKingdomLabels();
      }
    }
  });
}

export function refreshKingdomsEditor() {
  kingdomsEditorAddLines();
}

function kingdomsEditorAddLines() {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalStatesCount = 0;

  for (const k of pack.kingdoms) {
    if (!k.i || k.removed) continue;

    const capitalState = pack.states[k.capital] || null;
    const capitalName = capitalState ? capitalState.name : "—";
    const focused = defs.select("#fog #focusKingdom" + k.i).size();

    let area = 0;
    let population = 0;
    const memberIds = k.states || [];
    for (const sid of memberIds) {
      const s = pack.states[sid];
      if (!s || s.removed) continue;
      area += getArea(s.area);
      const rural = s.rural * populationRate;
      const urban = s.urban * populationRate * urbanization;
      population += rural + urban;
    }

    totalArea += area;
    totalPopulation += population;
    totalStatesCount += memberIds.length;

    lines += /* html */ `<div
      class="kingdoms"
      data-id="${k.i}"
      data-name="${k.name}"
      data-form="${k.formName || ""}"
      data-capital="${capitalName}"
      data-states="${memberIds.length}"
      data-area="${area}"
      data-population="${rn(population)}"
    >
      <fill-box fill="${k.color}"></fill-box>
      <input data-tip="Kingdom name. Click to change" class="kingdomName name pointer" value="${k.name}" readonly />
      <input data-tip="Kingdom form name. Type to change" class="kingdomForm" value="${k.formName || ""}" />
      <input data-tip="Capital duchy. Click to zoom" class="kingdomCapital pointer" value="${capitalName}" readonly />
      <div data-tip="Member duchies count">${memberIds.length}</div>
      <div data-tip="Kingdom area" class="kingdomArea">${si(area)} ${unit}</div>
      <div data-tip="Kingdom population" class="kingdomPopulation">${si(rn(population))}</div>
      <span data-tip="Toggle kingdom focus" class="icon-pin ${focused ? "" : " inactive"} hide"></span>
      <span data-tip="Lock the kingdom to protect it from re-generation" class="icon-lock${k.lock ? "" : "-open"} hide"></span>
      <span data-tip="Remove the kingdom" class="icon-trash-empty hide"></span>
    </div>`;
  }

  $body.innerHTML = lines;

  byId("kingdomsFooterCount").innerHTML = pack.kingdoms.filter(k => k.i && !k.removed).length;
  byId("kingdomsFooterStates").innerHTML = totalStatesCount;
  byId("kingdomsFooterArea").innerHTML = si(totalArea) + unit;
  byId("kingdomsFooterArea").dataset.area = totalArea;
  byId("kingdomsFooterPopulation").innerHTML = si(rn(totalPopulation));
  byId("kingdomsFooterPopulation").dataset.population = rn(totalPopulation);

  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", () => kingdomHighlightOn($line));
    $line.on("mouseleave", () => kingdomHighlightOff($line));
    $line.on("click", selectKingdomOnLineClick);
  });

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(kingdomsHeader);
  $("#kingdomsEditor").dialog({width: fitContent()});
}

function kingdomHighlightOn($line) {
  const id = +$line.dataset.id;
  const k = pack.kingdoms[id];
  if (!k) return;
  for (const sid of k.states || []) {
    const el = viewbox.select("#state" + sid);
    el.size() && el.raise().attr("filter", "url(#blur1)");
  }
}

function kingdomHighlightOff($line) {
  viewbox.selectAll("[id^='state']").attr("filter", null);
}

function kingdomChangeFill($element) {
  const $parent = $element.parentNode;
  const kingdomId = +$parent.dataset.id;
  const k = pack.kingdoms[kingdomId];
  if (!k) return;

  const callback = color => {
    k.color = color;
    $element.setAttribute("fill", color);
    if (layerIsOn("toggleKingdoms")) drawKingdoms();
  };

  openColorPicker($element, k.color, callback);
}

function editKingdomName(kingdomId) {
  const k = pack.kingdoms[kingdomId];
  if (!k) return;

  const input = prompt("Kingdom name:", k.name);
  if (input === null || input === k.name) return;

  k.name = input;
  k.fullName = `${k.name} ${k.formName}`.trim();
  refreshKingdomsEditor();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
}

function kingdomCapitalZoomIn(kingdomId) {
  const k = pack.kingdoms[kingdomId];
  if (!k) return;
  const capitalState = pack.states[k.capital];
  if (!capitalState || !capitalState.pole) return;
  const [x, y] = capitalState.pole;
  zoomTo(x, y, 8, 1600);
}

function toggleFog(kingdomId, classList) {
  const id = "focusKingdom" + kingdomId;
  const k = pack.kingdoms[kingdomId];
  if (!k) return;

  const path = defs.select("#fog #" + id);
  if (path.size()) {
    unfog(id);
    classList.add("inactive");
    return;
  }

  classList.remove("inactive");
  const memberCells = [];
  for (const sid of k.states || []) {
    pack.cells.state.forEach((s, i) => {
      if (s === sid) memberCells.push(i);
    });
  }
  const polygons = memberCells.map(i => "M" + getPackPolygon(i)).join("");
  fog(id, polygons);
}

function updateLockStatus(kingdomId, classList) {
  const k = pack.kingdoms[kingdomId];
  if (!k) return;
  k.lock = !k.lock;
  classList.toggle("icon-lock-open");
  classList.toggle("icon-lock");
}

function kingdomRemovePrompt(kingdomId) {
  if (customization) return;

  confirmationDialog({
    title: "Remove kingdom",
    message: "Are you sure you want to remove this kingdom? Member duchies will become independent.",
    confirm: "Remove",
    onConfirm: () => kingdomRemove(kingdomId)
  });
}

function kingdomRemove(kingdomId) {
  const k = pack.kingdoms[kingdomId];
  if (!k) return;

  for (const sid of k.states || []) {
    if (pack.states[sid]) pack.states[sid].kingdom = 0;
  }

  unfog("focusKingdom" + kingdomId);
  k.removed = true;

  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function regenerateKingdoms() {
  if (!confirm("Regenerate all kingdoms from current duchy diplomacy?")) return;
  Kingdoms.generate();
  Kingdoms.getPoles();
  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleEmpires")) drawEmpires();
  if (layerIsOn("toggleLabels")) {
    drawKingdomLabels();
    drawEmpireLabels();
  }
  if (layerIsOn("toggleBorders")) drawBorders();
}

// ── Manual Assignment ──────────────────────────────────────────────────
function enterKingdomsManualAssignment() {
  if (!layerIsOn("toggleKingdoms")) toggleKingdoms();
  customization = 12; // unique customization mode
  document.querySelectorAll("#kingdomsBottom > button").forEach(el => (el.style.display = "none"));
  byId("kingdomsManuallyButtons").style.display = "inline-block";
  kingdomsFooter.style.display = "none";

  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "none"));
  $("#kingdomsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  tip("Click on a duchy on the map to reassign it to the selected kingdom", true);
  viewbox.style("cursor", "crosshair").on("click", reassignDuchyOnMapClick);

  const first = $body.querySelector("div");
  if (first) first.classList.add("selected");
}

function selectKingdomOnLineClick() {
  if (customization !== 12) return;
  if (this.parentNode.id !== "kingdomsBodySection") return;
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
  this.classList.add("selected");
}

function reassignDuchyOnMapClick() {
  const point = d3.mouse(this);
  const cellId = findCell(point[0], point[1]);
  if (pack.cells.h[cellId] < 20) return;

  const stateId = pack.cells.state[cellId];
  if (!stateId) return tip("Cannot reassign neutral lands", false, "error");

  const $selected = $body.querySelector("div.selected");
  if (!$selected) return tip("Please select a kingdom first", false, "error");
  const newKingdomId = +$selected.dataset.id;
  const state = pack.states[stateId];
  if (!state || state.removed) return;

  const oldKingdomId = state.kingdom;
  if (oldKingdomId === newKingdomId) return;

  // remove from old kingdom
  if (oldKingdomId) {
    const oldK = pack.kingdoms[oldKingdomId];
    if (oldK) {
      oldK.states = oldK.states.filter(id => id !== stateId);
      if (!oldK.states.length) oldK.removed = true;
    }
  }

  // add to new kingdom
  state.kingdom = newKingdomId;
  const newK = pack.kingdoms[newKingdomId];
  if (newK && !newK.states.includes(stateId)) {
    newK.states.push(stateId);
  }

  // update empire assignment
  if (newK) state.empire = newK.empire || 0;

  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function applyKingdomsManualAssignment() {
  Kingdoms.getPoles();
  exitKingdomsManualAssignment(false);
}

function exitKingdomsManualAssignment(close) {
  customization = 0;
  document.querySelectorAll("#kingdomsBottom > button").forEach(el => (el.style.display = "inline-block"));
  byId("kingdomsManuallyButtons").style.display = "none";
  kingdomsFooter.style.display = "block";

  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "all"));
  if (!close)
    $("#kingdomsEditor").dialog({position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}});

  restoreDefaultEvents();
  clearMainTip();
  const selected = $body.querySelector("div.selected");
  if (selected) selected.classList.remove("selected");
}

// ── Add Kingdom ────────────────────────────────────────────────────────
function enterAddKingdomMode() {
  if (this.classList.contains("pressed")) {
    exitAddKingdomMode();
    return;
  }
  customization = 13;
  this.classList.add("pressed");
  tip("Click on a duchy on the map to create a new kingdom from it", true);
  viewbox.style("cursor", "crosshair").on("click", addKingdom);
  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "none"));
}

function addKingdom() {
  const point = d3.mouse(this);
  const cellId = findCell(point[0], point[1]);
  if (pack.cells.h[cellId] < 20)
    return tip("You cannot place a kingdom in water. Please click on a land cell", false, "error");

  const stateId = pack.cells.state[cellId];
  if (!stateId)
    return tip("Cannot create a kingdom from neutral lands. Click on a duchy cell", false, "error");

  const state = pack.states[stateId];
  if (!state || state.removed) return;

  const oldKingdomId = state.kingdom;

  // remove from old kingdom
  if (oldKingdomId) {
    const oldK = pack.kingdoms[oldKingdomId];
    if (oldK) {
      oldK.states = oldK.states.filter(id => id !== stateId);
      if (!oldK.states.length) oldK.removed = true;
    }
  }

  // create new kingdom
  const newKingdomId = pack.kingdoms.length;
  const color = getRandomColor();
  const formName = "Kingdom";
  const fullName = `${formName} of ${state.name}`;
  pack.kingdoms.push({
    i: newKingdomId,
    name: state.name,
    fullName,
    formName,
    color,
    capital: stateId,
    states: [stateId],
    empire: 0
  });

  state.kingdom = newKingdomId;

  if (d3.event.shiftKey === false) exitAddKingdomMode();

  Kingdoms.getPoles();
  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function exitAddKingdomMode() {
  customization = 0;
  restoreDefaultEvents();
  clearMainTip();
  byId("kingdomsAdd").classList.remove("pressed");
  $body.querySelectorAll("div > input, span, svg").forEach(e => (e.style.pointerEvents = "all"));
}

// ── Merge Kingdoms ─────────────────────────────────────────────────────
function openKingdomMergeDialog() {
  const validKingdoms = pack.kingdoms.filter(k => k.i && !k.removed);
  if (validKingdoms.length < 2) return tip("Need at least 2 kingdoms to merge", false, "error");

  const kingdomsSelector = validKingdoms
    .map(
      k => /* html */ `
      <div data-tip="${k.fullName || k.name}">
        <input type="radio" name="rulingKingdom" value="${k.i}" />
        <input id="selectKingdom${k.i}" class="checkbox" type="checkbox" name="kingdomsToMerge" value="${k.i}" />
        <label for="selectKingdom${k.i}" class="checkbox-label">
          <svg width="1em" height="1em" style="vertical-align:middle"><rect width="100%" height="100%" fill="${k.color}"/></svg>
          ${k.fullName || k.name}
        </label>
      </div>
    `
    )
    .join("");

  alertMessage.innerHTML = /* html */ `
    <form id='mergeKingdomsForm' style="overflow: hidden; display: flex; flex-direction: column; gap: 1em;">
      <header style='font-weight:bold;'>Select multiple kingdoms to merge and the ruling kingdom to merge into</header>
      <main style='display: grid; grid-template-columns: 1fr 1fr; gap: .3em;'>
        ${kingdomsSelector}
      </main>
    </form>
  `;

  $("#alert").dialog({
    width: fitContent(),
    title: `Merge kingdoms`,
    buttons: {
      Merge: function () {
        const formData = new FormData(byId("mergeKingdomsForm"));

        const rulingId = Number(formData.get("rulingKingdom"));
        if (!rulingId) return tip("Please select a kingdom to merge into", false, "error");
        const rulingKingdom = pack.kingdoms[rulingId];

        const toMerge = formData
          .getAll("kingdomsToMerge")
          .map(Number)
          .filter(id => id !== rulingId);
        if (!toMerge.length) return tip("Please select several kingdoms to merge", false, "error");

        confirmationDialog({
          title: "Merge kingdoms",
          message: /* html */ `
            <p>The following kingdoms will be <strong>removed</strong>: ${toMerge.map(id => pack.kingdoms[id].name).join(", ")}.</p>
            <p>Their duchies will be assigned to ${rulingKingdom.name}.</p>
            <p>Are you sure? This action cannot be reverted.</p>`,
          confirm: "Merge",
          onConfirm: () => {
            mergeKingdoms(toMerge, rulingId);
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

function mergeKingdoms(toMerge, rulingId) {
  const ruling = pack.kingdoms[rulingId];

  for (const id of toMerge) {
    const k = pack.kingdoms[id];
    if (!k || k.removed) continue;

    for (const sid of k.states || []) {
      if (pack.states[sid]) pack.states[sid].kingdom = rulingId;
      if (!ruling.states.includes(sid)) ruling.states.push(sid);
    }

    k.states = [];
    k.removed = true;
  }

  Kingdoms.getPoles();
  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

// ── Chart ──────────────────────────────────────────────────────────────
function showKingdomsChart() {
  const kingdomsData = pack.kingdoms.filter(k => !k.removed && k.i);
  if (kingdomsData.length < 1) return tip("There are no kingdoms to show", false, "error");

  // compute area per kingdom
  const chartData = [{i: 0, name: "root"}];
  for (const k of kingdomsData) {
    let area = 0;
    let population = 0;
    for (const sid of k.states || []) {
      const s = pack.states[sid];
      if (!s || s.removed) continue;
      area += s.area;
      population += s.rural * populationRate + s.urban * populationRate * urbanization;
    }
    chartData.push({i: k.i, name: k.name, fullName: k.fullName, color: k.color, area, population, duchies: (k.states || []).length});
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

  alertMessage.innerHTML = /* html */ `<select id="kingdomsTreeType" style="display:block; margin-left:13px; font-size:11px">
    <option value="area" selected>Area</option>
    <option value="population">Total population</option>
    <option value="duchies">Duchies number</option>
  </select>`;
  alertMessage.innerHTML += `<div id='kingdomsInfo' class='chartInfo'>&#8205;</div>`;

  const svg = d3
    .select("#alertMessage")
    .insert("svg", "#kingdomsInfo")
    .attr("id", "kingdomsTree")
    .attr("width", size)
    .attr("height", size)
    .style("font-family", "Almendra SC")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central");
  const graph = svg.append("g").attr("transform", `translate(-50, 0)`);
  byId("kingdomsTreeType").on("change", updateChart);

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
    const option = kingdomsTreeType.value;
    const value =
      option === "area" ? "Area: " + area
      : option === "duchies" ? "Duchies: " + d.data.duchies
      : "Population: " + si(rn(d.data.population));
    kingdomsInfo.innerHTML = `${d.data.fullName || d.data.name}. ${value}`;
  }

  function hideInfo(ev) {
    if (!byId("kingdomsInfo")) return;
    kingdomsInfo.innerHTML = "&#8205;";
    d3.select(ev.target).select("circle").classed("selected", 0);
  }

  function updateChart() {
    const value =
      this.value === "area" ? d => d.area
      : this.value === "duchies" ? d => d.duchies
      : d => d.population;

    root.sum(value);
    node.data(treeLayout(root).leaves());
    node.transition().duration(1500).attr("transform", d => `translate(${d.x},${d.y})`);
    node.select("circle").transition().duration(1500).attr("r", d => d.r);
    node.select("text").transition().duration(1500).style("font-size", d => rn((d.r ** 0.97 * 4) / lp(d.data.name), 2) + "px");
  }

  $("#alert").dialog({
    title: "Kingdoms bubble chart",
    width: fitContent(),
    position: {my: "left bottom", at: "left+10 bottom-10", of: "svg"},
    buttons: {},
    close: () => { alertMessage.innerHTML = ""; }
  });
}

// ── Legend ──────────────────────────────────────────────────────────────
function toggleLegend() {
  if (legend.selectAll("*").size()) return clearLegend();

  const data = pack.kingdoms
    .filter(k => k.i && !k.removed)
    .sort((a, b) => (b.states?.length || 0) - (a.states?.length || 0))
    .map(k => [k.i, k.color, k.name]);
  drawLegend("Kingdoms", data);
}

// ── Percentage ─────────────────────────────────────────────────────────
function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalArea = +(byId("kingdomsFooterArea").dataset.area || 0);
    const totalPop = +(byId("kingdomsFooterPopulation").dataset.population || 0);

    $body.querySelectorAll(":scope > div").forEach($line => {
      const area = +$line.dataset.area;
      const pop = +$line.dataset.population;
      $line.querySelector(".kingdomArea").innerHTML = totalArea ? rn((area / totalArea) * 100) + "%" : "0%";
      $line.querySelector(".kingdomPopulation").innerHTML = totalPop ? rn((pop / totalPop) * 100) + "%" : "0%";
    });
  } else {
    $body.dataset.type = "absolute";
    kingdomsEditorAddLines();
  }
}

// ── CSV Export ─────────────────────────────────────────────────────────
function downloadKingdomsCsv() {
  const unit = getAreaUnit();
  const rows = [["Id", "Name", "Form", "Capital Duchy", "Duchies", "Area " + unit, "Color"].join(",")];

  for (const k of pack.kingdoms) {
    if (!k.i || k.removed) continue;
    const capitalState = pack.states[k.capital] || null;
    let area = 0;
    for (const sid of k.states || []) {
      const s = pack.states[sid];
      if (s && !s.removed) area += getArea(s.area);
    }
    rows.push(
      [k.i, `"${k.name}"`, `"${k.formName || ""}"`, `"${capitalState ? capitalState.name : ""}"`, (k.states || []).length, rn(area), k.color].join(",")
    );
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFileName("Kingdoms") + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

function closeKingdomsEditor() {
  if (customization === 12) exitKingdomsManualAssignment(true);
  if (customization === 13) exitAddKingdomMode();
}
