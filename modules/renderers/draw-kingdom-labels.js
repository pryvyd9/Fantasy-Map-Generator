"use strict";

function drawKingdomLabels() {
  const {kingdoms} = pack;
  if (!kingdoms?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const textGroup = d3.select("g#labels > g#kingdoms");
  const pathGroup = d3.select("defs > g#deftemp > g#textPaths");
  textGroup.selectAll("text").remove();

  for (const kingdom of kingdoms) {
    if (!kingdom.i || kingdom.removed) continue;
    if (!kingdom.pole) continue;

    const [x, y] = kingdom.pole;
    const id = "kingdomLabel" + kingdom.i;
    pathGroup.select("#textPath_" + id).remove();

    // Simple straight horizontal path centred on the pole
    const halfLen = Math.max(kingdom.fullName.length * 5, 40);
    const pathD = `M${rn(x - halfLen, 1)},${rn(y, 1)} L${rn(x + halfLen, 1)},${rn(y, 1)}`;
    pathGroup.append("path").attr("d", pathD).attr("id", "textPath_" + id);

    textGroup
      .append("text")
      .attr("id", id)
      .attr("text-rendering", "optimizeSpeed")
      .append("textPath")
      .attr("href", "#textPath_" + id)
      .attr("startOffset", "50%")
      .attr("font-size", "120%")
      .html(`<tspan x="0">${kingdom.fullName}</tspan>`);
  }

  labels.style("display", layerDisplay);
}

function drawEmpireLabels() {
  const {empires} = pack;
  if (!empires?.length) return;

  const layerDisplay = labels.style("display");
  labels.style("display", null);

  const textGroup = d3.select("g#labels > g#empires");
  const pathGroup = d3.select("defs > g#deftemp > g#textPaths");
  textGroup.selectAll("text").remove();

  for (const empire of empires) {
    if (!empire.i || empire.removed) continue;
    if (!empire.pole) continue;

    const [x, y] = empire.pole;
    const id = "empireLabel" + empire.i;
    pathGroup.select("#textPath_" + id).remove();

    const halfLen = Math.max(empire.fullName.length * 7, 60);
    const pathD = `M${rn(x - halfLen, 1)},${rn(y, 1)} L${rn(x + halfLen, 1)},${rn(y, 1)}`;
    pathGroup.append("path").attr("d", pathD).attr("id", "textPath_" + id);

    textGroup
      .append("text")
      .attr("id", id)
      .attr("text-rendering", "optimizeSpeed")
      .append("textPath")
      .attr("href", "#textPath_" + id)
      .attr("startOffset", "50%")
      .attr("font-size", "170%")
      .html(`<tspan x="0">${empire.fullName}</tspan>`);
  }

  labels.style("display", layerDisplay);
}
