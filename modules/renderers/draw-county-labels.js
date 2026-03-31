"use strict";

function drawCountyLabels() {
  const {counties} = pack;
  if (!counties?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const textGroup = d3.select("g#labels > g#counties");
  const pathGroup = d3.select("defs > g#deftemp > g#textPaths");
  textGroup.selectAll("text").remove();

  for (const county of counties) {
    if (!county.i || county.removed) continue;
    if (!county.pole) continue;

    const [x, y] = county.pole;
    const id = "countyLabel" + county.i;
    pathGroup.select("#textPath_" + id).remove();

    const halfLen = Math.max(county.fullName.length * 4, 30);
    const pathD = `M${rn(x - halfLen, 1)},${rn(y, 1)} L${rn(x + halfLen, 1)},${rn(y, 1)}`;
    pathGroup.append("path").attr("d", pathD).attr("id", "textPath_" + id);

    textGroup
      .append("text")
      .attr("id", id)
      .attr("text-rendering", "optimizeSpeed")
      .append("textPath")
      .attr("href", "#textPath_" + id)
      .attr("startOffset", "50%")
      .attr("font-size", "85%")
      .html(`<tspan x="0">${county.fullName}</tspan>`);
  }

  labels.style("display", layerDisplay);
}
