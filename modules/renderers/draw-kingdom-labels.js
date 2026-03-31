"use strict";

function drawKingdomLabels() {
  const {kingdoms, states, cells} = pack;
  if (!kingdoms?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const getCellDomainId = cellId => {
    const s = cells.state[cellId];
    return s ? (states[s]?.kingdom || 0) : 0;
  };

  drawDomainLabels({
    entities: kingdoms,
    textGroupSelector: "g#labels > g#kingdoms",
    labelPrefix: "kingdomLabel",
    getCellDomainId,
    lengthMax: 600,
    offset: 10
  });

  labels.style("display", layerDisplay);
}

function drawEmpireLabels() {
  const {empires, kingdoms, states, cells} = pack;
  if (!empires?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const getCellDomainId = cellId => {
    const s = cells.state[cellId];
    if (!s) return 0;
    const k = states[s]?.kingdom;
    return k ? (kingdoms[k]?.empire || 0) : 0;
  };

  drawDomainLabels({
    entities: empires,
    textGroupSelector: "g#labels > g#empires",
    labelPrefix: "empireLabel",
    getCellDomainId,
    lengthMax: 900,
    offset: 15
  });

  labels.style("display", layerDisplay);
}
