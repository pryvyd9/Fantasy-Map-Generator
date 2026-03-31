"use strict";

const $body = insertEditorHtml();
addListeners();

export function open() {
  closeDialogs("#countiesEditor, .stable");
  if (!layerIsOn("toggleCounties")) toggleCounties();
  if (!layerIsOn("toggleBorders")) toggleBorders();

  refreshCountiesEditor();

  $("#countiesEditor").dialog({
    title: "Counties Editor",
    resizable: false,
    close: closeCountiesEditor,
    position: {my: "right top", at: "right-10 top+10", of: "svg", collision: "fit"}
  });
}

function insertEditorHtml() {
  const editorHtml = /* html */ `<div id="countiesEditor" class="dialog stable">
    <div id="countiesHeader" class="header" style="grid-template-columns: 11em 8em 10em 5em 6em 6em">
      <div data-tip="Click to sort by county name" class="sortable alphabetically" data-sortby="name">County&nbsp;</div>
      <div data-tip="Click to sort by county form" class="sortable alphabetically" data-sortby="form">Form&nbsp;</div>
      <div data-tip="Click to sort by capital barony name" class="sortable alphabetically" data-sortby="capital">Capital Barony&nbsp;</div>
      <div data-tip="Click to sort by member baronies count" class="sortable" data-sortby="baronies">Baronies&nbsp;</div>
      <div data-tip="Click to sort by area" class="sortable icon-sort-number-down" data-sortby="area">Area&nbsp;</div>
      <div data-tip="Click to sort by population" class="sortable" data-sortby="population">Population&nbsp;</div>
    </div>

    <div id="countiesBodySection" class="table" data-type="absolute"></div>

    <div id="countiesFooter" class="totalLine">
      <div data-tip="Counties number" style="margin-left: 5px">Counties:&nbsp;<span id="countiesFooterCount">0</span></div>
      <div data-tip="Total member baronies" style="margin-left: 12px">Baronies:&nbsp;<span id="countiesFooterBaronies">0</span></div>
      <div data-tip="Total land area" style="margin-left: 12px">Area:&nbsp;<span id="countiesFooterArea">0</span></div>
      <div data-tip="Total population" style="margin-left: 12px">Population:&nbsp;<span id="countiesFooterPopulation">0</span></div>
    </div>

    <div id="countiesBottom">
      <button id="countiesEditorRefresh" data-tip="Refresh the Editor" class="icon-cw"></button>
      <button id="countiesEditStyle" data-tip="Edit counties style in Style Editor" class="icon-adjust"></button>
      <button id="countiesLegend" data-tip="Toggle Legend box" class="icon-list-bullet"></button>
      <button id="countiesPercentage" data-tip="Toggle percentage / absolute values views" class="icon-percent"></button>
      <button id="countiesRegenerate" data-tip="Regenerate counties from current baronies" class="icon-shuffle"></button>
      <button id="countiesExport" data-tip="Save counties data as a text file (.csv)" class="icon-download"></button>
    </div>
  </div>`;

  byId("dialogs").insertAdjacentHTML("beforeend", editorHtml);
  return byId("countiesBodySection");
}

function addListeners() {
  applySortingByHeader("countiesHeader");

  byId("countiesEditorRefresh").on("click", refreshCountiesEditor);
  byId("countiesEditStyle").on("click", () => editStyle("countyRegions"));
  byId("countiesLegend").on("click", toggleLegend);
  byId("countiesPercentage").on("click", togglePercentageMode);
  byId("countiesRegenerate").on("click", regenerateCounties);
  byId("countiesExport").on("click", downloadCountiesCsv);

  $body.on("click", event => {
    const $element = event.target;
    const classList = $element.classList;
    const countyId = +$element.parentNode?.dataset?.id;
    if ($element.tagName === "FILL-BOX") countyChangeFill($element);
    else if (classList.contains("name")) editCountyName(countyId);
    else if (classList.contains("icon-trash-empty")) countyRemovePrompt(countyId);
  });
}

export function refreshCountiesEditor() {
  countiesEditorAddLines();
}

function countiesEditorAddLines() {
  const unit = getAreaUnit();
  let lines = "";
  let totalArea = 0;
  let totalPopulation = 0;
  let totalBaroniesCount = 0;

  for (const c of pack.counties) {
    if (!c.i || c.removed) continue;

    const capitalProvince = pack.provinces.find(p => p.i && p.burg === c.capital);
    const capitalName = capitalProvince ? capitalProvince.name : (pack.burgs[c.capital]?.name || "—");

    const memberProvinces = pack.provinces.filter(p => p.i && !p.removed && p.county === c.i);
    let area = 0;
    let population = 0;
    for (const p of memberProvinces) {
      area += getArea(p.area || 0);
      const rural = (p.rural || 0) * populationRate;
      const urban = (p.urban || 0) * populationRate * urbanization;
      population += rural + urban;
    }

    totalArea += area;
    totalPopulation += population;
    totalBaroniesCount += memberProvinces.length;

    lines += /* html */ `<div
      class="counties"
      data-id="${c.i}"
      data-name="${c.name}"
      data-form="${c.formName || ""}"
      data-capital="${capitalName}"
      data-baronies="${memberProvinces.length}"
      data-area="${area}"
      data-population="${rn(population)}"
    >
      <fill-box fill="${c.color}"></fill-box>
      <input data-tip="County name. Click to change" class="countyName name pointer" value="${c.name}" readonly />
      <input data-tip="County form name" class="countyForm" value="${c.formName || ""}" readonly />
      <input data-tip="Capital barony name" class="countyCapital" value="${capitalName}" readonly />
      <div data-tip="Member baronies count">${memberProvinces.length}</div>
      <div data-tip="County area" class="countyArea">${si(area)} ${unit}</div>
      <div data-tip="County population" class="countyPopulation">${si(rn(population))}</div>
      <span data-tip="Remove the county" class="icon-trash-empty hide"></span>
    </div>`;
  }

  $body.innerHTML = lines;

  byId("countiesFooterCount").innerHTML = pack.counties.filter(c => c.i && !c.removed).length;
  byId("countiesFooterBaronies").innerHTML = totalBaroniesCount;
  byId("countiesFooterArea").innerHTML = si(totalArea) + unit;
  byId("countiesFooterPopulation").innerHTML = si(rn(totalPopulation));

  $body.querySelectorAll(":scope > div").forEach($line => {
    $line.on("mouseenter", () => countyHighlightOn($line));
    $line.on("mouseleave", () => countyHighlightOff($line));
  });

  if ($body.dataset.type === "percentage") {
    $body.dataset.type = "absolute";
    togglePercentageMode();
  }
  applySorting(countiesHeader);
  $("#countiesEditor").dialog({width: fitContent()});
}

function countyHighlightOn($line) {
  const id = +$line.dataset.id;
  const memberProvinces = pack.provinces.filter(p => p.i && !p.removed && p.county === id);
  for (const p of memberProvinces) {
    const el = viewbox.select("#province" + p.i);
    el.size() && el.raise().attr("filter", "url(#blur1)");
  }
}

function countyHighlightOff($line) {
  viewbox.selectAll("[id^='province']").attr("filter", null);
}

function countyChangeFill($element) {
  const $parent = $element.parentNode;
  const countyId = +$parent.dataset.id;
  const c = pack.counties[countyId];
  if (!c) return;

  const callback = color => {
    c.color = color;
    $element.setAttribute("fill", color);
    if (layerIsOn("toggleCounties")) drawCounties();
  };

  openColorPicker($element, c.color, callback);
}

function editCountyName(countyId) {
  const c = pack.counties[countyId];
  if (!c) return;

  const input = prompt("County name:", c.name);
  if (input === null || input === c.name) return;

  c.name = input;
  c.fullName = `${c.name} ${c.formName}`.trim();
  refreshCountiesEditor();
  if (layerIsOn("toggleLabels")) drawCountyLabels();
}

function countyRemovePrompt(countyId) {
  if (!confirm("Remove this county? Member baronies will become county-less.")) return;

  const c = pack.counties[countyId];
  if (!c) return;

  pack.provinces.forEach(p => { if (p.county === countyId) p.county = 0; });
  c.removed = true;
  refreshCountiesEditor();
  if (layerIsOn("toggleCounties")) drawCounties();
  if (layerIsOn("toggleLabels")) drawCountyLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function regenerateCounties() {
  if (!confirm("Regenerate all counties from current baronies?")) return;
  Counties.generate();
  Counties.getPoles();
  refreshCountiesEditor();
  if (layerIsOn("toggleCounties")) drawCounties();
  if (layerIsOn("toggleLabels")) drawCountyLabels();
  if (layerIsOn("toggleBorders")) drawBorders();
}

function downloadCountiesCsv() {
  const unit = getAreaUnit();
  const rows = [["Id", "Name", "Form", "State", "Capital Burg", "Baronies", "Color"].join(",")];

  for (const c of pack.counties) {
    if (!c.i || c.removed) continue;
    const stateName = pack.states[c.state]?.name || "";
    const capitalBurgName = pack.burgs[c.capital]?.name || "";
    const baroniesCount = pack.provinces.filter(p => p.i && !p.removed && p.county === c.i).length;
    rows.push([c.i, `"${c.name}"`, `"${c.formName || ""}"`, `"${stateName}"`, `"${capitalBurgName}"`, baroniesCount, c.color].join(","));
  }

  const csv = rows.join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getFileName("Counties") + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

function closeCountiesEditor() {
  // nothing special needed
}

function togglePercentageMode() {
  if ($body.dataset.type === "absolute") {
    $body.dataset.type = "percentage";
    const totalArea = +(byId("countiesFooterArea").dataset.area || 0);
    const totalPop = +(byId("countiesFooterPopulation").dataset.population || 0);

    $body.querySelectorAll(":scope > div").forEach($line => {
      const area = +$line.dataset.area;
      const pop = +$line.dataset.population;
      $line.querySelector(".countyArea").innerHTML = totalArea ? rn((area / totalArea) * 100) + "%" : "0%";
      $line.querySelector(".countyPopulation").innerHTML = totalPop ? rn((pop / totalPop) * 100) + "%" : "0%";
    });
  } else {
    $body.dataset.type = "absolute";
    countiesEditorAddLines();
  }
}
