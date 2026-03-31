"use strict";

// Generic raycast-based label drawing for domain levels (counties, kingdoms, empires).
// Mirrors the approach used in draw-state-labels.js.
function drawDomainLabels({entities, textGroupSelector, labelPrefix, getCellDomainId, lengthMax = 400, offset = 5}) {
  const {cells, features} = pack;

  const ANGLE_STEP = 9;
  const LENGTH_START = 5;
  const LENGTH_STEP = 5;

  const textGroup = d3.select(textGroupSelector);
  const pathGroup = d3.select("defs > g#deftemp > g#textPaths");
  const lineGen = d3.line().curve(d3.curveNatural);

  textGroup.selectAll("text").remove();

  const testLabel = textGroup.append("text").attr("x", 0).attr("y", 0).text("Example");
  const letterLength = testLabel.node().getComputedTextLength() / 7;
  testLabel.remove();

  const angles = precalculateAngles(ANGLE_STEP);

  for (const entity of entities) {
    if (!entity.i || entity.removed) continue;
    if (!entity.pole) continue;

    const domainId = entity.i;
    const id = labelPrefix + domainId;
    const [x0, y0] = entity.pole;

    pathGroup.select("#textPath_" + id).remove();
    textGroup.select("#" + id).remove();

    const maxLakeSize = 30;
    const rays = angles.map(({angle, dx, dy}) => {
      const {length, x, y} = raycast(domainId, x0, y0, dx, dy, maxLakeSize);
      return {angle, length, x, y};
    });

    const bestPair = findBestRayPair(rays);
    if (!bestPair) continue;
    const [ray1, ray2] = bestPair;

    const pathPoints = [[ray1.x, ray1.y], entity.pole, [ray2.x, ray2.y]];
    if (ray1.x > ray2.x) pathPoints.reverse();

    const textPath = pathGroup.append("path").attr("d", round(lineGen(pathPoints))).attr("id", "textPath_" + id);
    const pathLength = textPath.node().getTotalLength() / letterLength;

    const [lines, ratio] = getLinesAndRatio(entity.name, entity.fullName, pathLength);

    const longestLineLength = d3.max(lines.map(l => l.length));
    if (pathLength && pathLength < longestLineLength) {
      const [x1, y1] = pathPoints.at(0);
      const [x2, y2] = pathPoints.at(-1);
      const [ddx, ddy] = [(x2 - x1) / 2, (y2 - y1) / 2];
      const mod = longestLineLength / pathLength;
      pathPoints[0] = [x1 + ddx - ddx * mod, y1 + ddy - ddy * mod];
      pathPoints[pathPoints.length - 1] = [x2 - ddx + ddx * mod, y2 - ddy + ddy * mod];
      textPath.attr("d", round(lineGen(pathPoints)));
    }

    const textElement = textGroup
      .append("text")
      .attr("text-rendering", "optimizeSpeed")
      .attr("id", id)
      .append("textPath")
      .attr("startOffset", "50%")
      .attr("font-size", ratio + "%")
      .node();

    const top = (lines.length - 1) / -2;
    const spans = lines.map((line, index) => `<tspan x="0" dy="${index ? 1 : top}em">${line}</tspan>`);
    textElement.insertAdjacentHTML("afterbegin", spans.join(""));

    const {width, height} = textElement.getBBox();
    textElement.setAttribute("href", "#textPath_" + id);

    if (lines.length === 1) continue;

    const [[x1, y1], [x2, y2]] = [pathPoints.at(0), pathPoints.at(-1)];
    const angleRad = Math.atan2(y2 - y1, x2 - x1);
    const isInside = checkIfInsideDomain(textElement, angleRad, width / 2, height / 2, domainId);
    if (isInside) continue;

    const text = pathLength > entity.fullName.length * 1.8 ? entity.fullName : entity.name;
    textElement.innerHTML = `<tspan x="0">${text}</tspan>`;
    const correctedRatio = minmax(rn((pathLength / text.length) * 50), 50, 130);
    textElement.setAttribute("font-size", correctedRatio + "%");
  }

  function precalculateAngles(step) {
    const angles = [];
    const RAD = Math.PI / 180;
    for (let angle = 0; angle < 360; angle += step) {
      angles.push({angle, dx: Math.cos(angle * RAD), dy: Math.sin(angle * RAD)});
    }
    return angles;
  }

  function raycast(domainId, x0, y0, dx, dy, maxLakeSize) {
    let ray = {length: 0, x: x0, y: y0};
    for (let length = LENGTH_START; length < lengthMax; length += LENGTH_STEP) {
      const x = x0 + length * dx;
      const y = y0 + length * dy;
      const ox1 = [x + -dy * offset, y + dx * offset];
      const ox2 = [x + dy * offset, y + -dx * offset];
      if (!inDomain(x, y, domainId, maxLakeSize) || !inDomain(...ox1, domainId, maxLakeSize) || !inDomain(...ox2, domainId, maxLakeSize)) break;
      ray = {length, x, y};
    }
    return ray;
  }

  function inDomain(x, y, domainId, maxLakeSize) {
    if (x < 0 || x > graphWidth || y < 0 || y > graphHeight) return false;
    const cellId = findCell(x, y);
    const feature = features[cells.f[cellId]];
    if (feature.type === "lake") {
      const isInner = feature.shoreline.every(cid => getCellDomainId(cid) === domainId);
      return isInner || feature.cells <= maxLakeSize;
    }
    return getCellDomainId(cellId) === domainId;
  }

  function findBestRayPair(rays) {
    let bestPair = null;
    let bestScore = -Infinity;
    for (let i = 0; i < rays.length; i++) {
      const score1 = rays[i].length * scoreRayAngle(rays[i].angle);
      for (let j = i + 1; j < rays.length; j++) {
        const score2 = rays[j].length * scoreRayAngle(rays[j].angle);
        const pairScore = (score1 + score2) * scoreCurvature(rays[i].angle, rays[j].angle);
        if (pairScore > bestScore) {
          bestScore = pairScore;
          bestPair = [rays[i], rays[j]];
        }
      }
    }
    return bestPair;
  }

  function scoreRayAngle(angle) {
    const norm = Math.abs(angle % 180);
    const h = Math.abs(norm - 90) / 90;
    if (h === 1) return 1;
    if (h >= 0.75) return 0.9;
    if (h >= 0.5) return 0.6;
    if (h >= 0.25) return 0.5;
    if (h >= 0.15) return 0.2;
    return 0.1;
  }

  function scoreCurvature(a1, a2) {
    const delta = getAngleDelta(a1, a2);
    const sim = evaluateArc(a1, a2);
    if (delta === 180) return 1;
    if (delta < 90) return 0;
    if (delta < 120) return 0.6 * sim;
    if (delta < 140) return 0.7 * sim;
    if (delta < 160) return 0.8 * sim;
    return sim;
  }

  function getAngleDelta(a1, a2) {
    let d = Math.abs(a1 - a2) % 360;
    if (d > 180) d = 360 - d;
    return d;
  }

  function evaluateArc(a1, a2) {
    const p1 = Math.abs((a1 % 180) - 90);
    const p2 = Math.abs((a2 % 180) - 90);
    return 1 - Math.abs(p1 - p2) / 90;
  }

  function getLinesAndRatio(name, fullName, pathLength) {
    if (pathLength > fullName.length * 2) {
      const ratio = pathLength / fullName.length;
      return [[fullName], minmax(rn(ratio * 70), 70, 170)];
    }
    const lines = splitInTwo(fullName);
    const longest = d3.max(lines.map(l => l.length));
    const ratio = pathLength / longest;
    return [lines, minmax(rn(ratio * 60), 70, 150)];
  }

  function checkIfInsideDomain(textElement, angleRad, halfwidth, halfheight, domainId) {
    const bbox = textElement.getBBox();
    const [cx, cy] = [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
    const points = [[-halfwidth, -halfheight], [+halfwidth, -halfheight], [+halfwidth, halfheight], [-halfwidth, halfheight], [0, halfheight], [0, -halfheight]];
    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);
    let inside = 0;
    for (const [x, y] of points) {
      if (getCellDomainId(findCell(cx + x * cos - y * sin, cy + x * sin + y * cos)) === domainId) inside++;
      if (inside > 4) return true;
    }
    return false;
  }
}
