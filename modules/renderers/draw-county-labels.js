"use strict";

function drawCountyLabels() {
  const {counties, provinces, cells} = pack;
  if (!counties?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const getCellDomainId = cellId => {
    const p = cells.province[cellId];
    return p ? (provinces[p]?.county || 0) : 0;
  };

  drawDomainLabels({
    entities: counties,
    textGroupSelector: "g#labels > g#counties",
    labelPrefix: "countyLabel",
    getCellDomainId,
    lengthMax: 200,
    offset: 0
  });

  labels.style("display", layerDisplay);
}
