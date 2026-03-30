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
      <div data-tip="Click to sort by capital state name" class="sortable alphabetically" data-sortby="capital">Capital State&nbsp;</div>
      <div data-tip="Click to sort by member states count" class="sortable" data-sortby="states">States&nbsp;</div>
      <div data-tip="Click to sort by area" class="sortable icon-sort-number-down" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by population" class="sortable" data-sortby="population">Population&nbsp;</div>
    </div>

    <div id="kingdomsBodySection" class="table" data-type="absolute"></div>

    <div id="kingdomsFooter" class="totalLine">
      <div data-tip="Kingdoms number" style="margin-left: 5px">Kingdoms:&nbsp;<span id="kingdomsFooterCount">0</span></div>
      <div data-tip="Total member states" style="margin-left: 12px">States:&nbsp;<span id="kingdomsFooterStates">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Area:&nbsp;<span id="kingdomsFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="kingdomsFooterPopulation">0</span></div>
    </div>

    <div id="kingdomsBottom">
      <button id="kingdomsEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="kingdomsEditStyle" data-tip="Edit kingdoms style in Style Editor" class="icon-adjust"></button>
      <button id="kingdomsLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="kingdomsPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
      <button id="kingdomsRegenerate" data-tip="Regenerate kingdoms from current state diplomacy" class="icon-shuffle"></button>
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
  byId("kingdomsRegenerate").on("click", regenerateKingdoms);
  byId("kingdomsExport").on("click", downloadKingdomsCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const kingdomId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") kingdomChangeFill($element);
    else if (classList.contains("name")) editKingdomName(kingdomId);
    else if (classList.contains("icon-trash-empty")) kingdomRemovePrompt(kingdomId);
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
      <input data-tip="Kingdom form name" class="kingdomForm" value="${k.formName || ""}" readonly />
      <input data-tip="Capital state name" class="kingdomCapital" value="${capitalName}" readonly />
      <div data-tip="Member states count">${memberIds.length}</div>
      <div data-tip="Kingdom area" class="kingdomArea">${si(area)} ${unit}</div>
      <div data-tip="Kingdom population" class="kingdomPopulation">${si(rn(population))}</div>
      <span data-tip="Remove the kingdom" class="icon-trash-empty hide"></span>
    </div>`;
  }

  $body.innerHTML = lines;

  byId("kingdomsFooterCount").innerHTML = pack.kingdoms.filter(k => k.i && !k.removed).length;
  byId("kingdomsFooterStates").innerHTML = totalStatesCount;
  byId("kingdomsFooterArea").innerHTML = si(totalArea) + unit;
  byId("kingdomsFooterPopulation").innerHTML = si(rn(totalPopulation));

  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", () => kingdomHighlightOn($line));
    $line.on("mouseleave", () => kingdomHighlightOff($line));
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
    // update visual fill if kingdom layer is on
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

function kingdomRemovePrompt(kingdomId) {
  if (!confirm("Remove this kingdom? Member states will become independent.")) return;

  const k = pack.kingdoms[kingdomId];
  if (!k) return;

  for (const sid of k.states || []) {
    if (pack.states[sid]) pack.states[sid].kingdom = 0;
  }

  k.removed = true;
  refreshKingdomsEditor();
  if (layerIsOn("toggleKingdoms")) drawKingdoms();
  if (layerIsOn("toggleLabels")) drawKingdomLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function regenerateKingdoms() {
  if (!confirm("Regenerate all kingdoms from current state diplomacy?")) return;
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

function downloadKingdomsCsv() {
  const unit = getAreaUnit();
  const rows = [["Id", "Name", "Form", "Capital State", "States", "Area " + unit, "Color"].join(",")];

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
  // nothing special needed
}

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
