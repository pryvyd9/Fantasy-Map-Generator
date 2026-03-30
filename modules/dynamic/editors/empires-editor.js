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
      <button id="empiresRegenerate" data-tip="Regenerate empires from current kingdoms" class="icon-shuffle"></button>
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
  byId("empiresRegenerate").on("click", regenerateEmpires);
  byId("empiresExport").on("click", downloadEmpiresCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const empireId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") empireChangeFill($element);
    else if (classList.contains("name")) editEmpireName(empireId);
    else if (classList.contains("icon-trash-empty")) empireRemovePrompt(empireId);
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
      <input data-tip="Empire form name" class="empireForm" value="${e.formName || ""}" readonly />
      <input data-tip="Capital kingdom name" class="empireCapital" value="${capitalName}" readonly />
      <div data-tip="Member kingdoms count">${memberKingdomIds.length}</div>
      <div data-tip="Empire area" class="empireArea">${si(area)} ${unit}</div>
      <div data-tip="Empire population" class="empirePopulation">${si(rn(population))}</div>
      <span data-tip="Remove the empire" class="icon-trash-empty hide"></span>
    </div>`;
  }

  $body.innerHTML = lines;

  byId("empiresFooterCount").innerHTML = pack.empires.filter(e => e.i && !e.removed).length;
  byId("empiresFooterKingdoms").innerHTML = totalKingdomsCount;
  byId("empiresFooterArea").innerHTML = si(totalArea) + unit;
  byId("empiresFooterPopulation").innerHTML = si(rn(totalPopulation));

  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", () => empireHighlightOn($line));
    $line.on("mouseleave", () => empireHighlightOff($line));
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

function empireRemovePrompt(empireId) {
  if (!confirm("Remove this empire? Member kingdoms will become independent.")) return;

  const e = pack.empires[empireId];
  if (!e) return;

  for (const kid of e.kingdoms || []) {
    if (pack.kingdoms[kid]) pack.kingdoms[kid].empire = 0;
  }

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
  // nothing special needed
}

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
