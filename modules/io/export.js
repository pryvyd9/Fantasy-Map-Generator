"use strict";
// Functions to export map to image or data files

async function exportToSvg() {
  TIME && console.time("exportToSvg");
  const url = await getMapURL("svg", {fullMap: true});
  const link = document.createElement("a");
  link.download = getFileName() + ".svg";
  link.href = url;
  link.click();

  const message = `${link.download} is saved. Open 'Downloads' screen (ctrl + J) to check`;
  tip(message, true, "success", 5000);
  TIME && console.timeEnd("exportToSvg");
}

async function exportToPng() {
  TIME && console.time("exportToPng");
  const url = await getMapURL("png");

  const link = document.createElement("a");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = function () {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    link.download = getFileName() + ".png";
    canvas.toBlob(function (blob) {
      link.href = window.URL.createObjectURL(blob);
      link.click();
      window.setTimeout(function () {
        canvas.remove();
        window.URL.revokeObjectURL(link.href);

        const message = `${link.download} is saved. Open 'Downloads' screen (ctrl + J) to check. You can set image scale in options`;
        tip(message, true, "success", 5000);
      }, 1000);
    });
  };

  TIME && console.timeEnd("exportToPng");
}

async function exportToJpeg() {
  TIME && console.time("exportToJpeg");
  const url = await getMapURL("png");

  const canvas = document.createElement("canvas");
  canvas.width = svgWidth * pngResolutionInput.value;
  canvas.height = svgHeight * pngResolutionInput.value;
  const img = new Image();
  img.src = url;

  img.onload = async function () {
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const quality = Math.min(rn(1 - pngResolutionInput.value / 20, 2), 0.92);
    const URL = await canvas.toDataURL("image/jpeg", quality);
    const link = document.createElement("a");
    link.download = getFileName() + ".jpeg";
    link.href = URL;
    link.click();
    tip(`${link.download} is saved. Open "Downloads" screen (CTRL + J) to check`, true, "success", 7000);
    window.setTimeout(() => window.URL.revokeObjectURL(URL), 5000);
  };

  TIME && console.timeEnd("exportToJpeg");
}

async function exportToPngTiles() {
  const status = byId("tileStatus");
  status.innerHTML = "Preparing files...";

  const urlSchema = await getMapURL("tiles", {debug: true, fullMap: true});
  await import("../../libs/jszip.min.js");
  const zip = new window.JSZip();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = graphWidth;
  canvas.height = graphHeight;

  const imgSchema = new Image();
  imgSchema.src = urlSchema;
  await loadImage(imgSchema);

  status.innerHTML = "Drawing schema...";
  ctx.drawImage(imgSchema, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/png");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  zip.file("schema.png", blob);

  // download tiles
  const url = await getMapURL("tiles", {fullMap: true});
  const tilesX = +byId("tileColsInput").value;
  const tilesY = +byId("tileRowsInput").value;
  const scale = +byId("tileScaleInput").value;
  const tolesTotal = tilesX * tilesY;

  const tileW = (graphWidth / tilesX) | 0;
  const tileH = (graphHeight / tilesY) | 0;

  const width = graphWidth * scale;
  const height = width * (tileH / tileW);
  canvas.width = width;
  canvas.height = height;

  const img = new Image();
  img.src = url;
  await loadImage(img);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let y = 0, row = 0, id = 1; y + tileH <= graphHeight; y += tileH, row++) {
    const rowName = alphabet[row % alphabet.length];

    for (let x = 0, cell = 1; x + tileW <= graphWidth; x += tileW, cell++, id++) {
      status.innerHTML = `Drawing tile ${rowName}${cell} (${id} of ${tolesTotal})...`;
      ctx.drawImage(img, x, y, tileW, tileH, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, "image/png");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      zip.file(`${rowName}${cell}.png`, blob);
    }
  }

  status.innerHTML = "Zipping files...";
  zip.generateAsync({type: "blob"}).then(blob => {
    status.innerHTML = "Downloading the archive...";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = getFileName() + ".zip";
    link.click();
    link.remove();

    status.innerHTML = 'Done. Check .zip file in "Downloads" (crtl + J)';
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  });

  // promisified img.onload
  function loadImage(img) {
    return new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = err => reject(err);
    });
  }

  // promisified canvas.toBlob
  function canvasToBlob(canvas, mimeType, qualityArgument = 1) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob() error"));
        },
        mimeType,
        qualityArgument
      );
    });
  }
}

// parse map svg to object url
async function getMapURL(type, options) {
  const {
    debug = false,
    noLabels = false,
    noWater = false,
    noScaleBar = false,
    noIce = false,
    fullMap = false
  } = options || {};

  const cloneEl = byId("map").cloneNode(true); // clone svg
  cloneEl.id = "fantasyMap";
  document.body.appendChild(cloneEl);
  const clone = d3.select(cloneEl);
  if (!debug) clone.select("#debug")?.remove();

  const cloneDefs = cloneEl.getElementsByTagName("defs")[0];
  const svgDefs = byId("defElements");

  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  if (isFirefox && type === "mesh") clone.select("#oceanPattern")?.remove();
  if (noLabels) {
    clone.select("#labels #states")?.remove();
    clone.select("#labels #burgLabels")?.remove();
    clone.select("#icons #burgIcons")?.remove();
  }
  if (noWater) {
    clone.select("#oceanBase").attr("opacity", 0);
    clone.select("#oceanPattern").attr("opacity", 0);
  }
  if (noIce) clone.select("#ice")?.remove();
  if (fullMap) {
    // reset transform to show the whole map
    clone.attr("width", graphWidth).attr("height", graphHeight);
    clone.select("#viewbox").attr("transform", null);

    if (!noScaleBar) {
      drawScaleBar(clone.select("#scaleBar"), 1);
      fitScaleBar(clone.select("#scaleBar"), graphWidth, graphHeight);
    }
  }
  if (noScaleBar) clone.select("#scaleBar")?.remove();

  if (type === "svg") removeUnusedElements(clone);
  if (customization && type === "mesh") updateMeshCells(clone);
  inlineStyle(clone);

  // remove unused filters
  const filters = cloneEl.querySelectorAll("filter");
  for (let i = 0; i < filters.length; i++) {
    const id = filters[i].id;
    if (cloneEl.querySelector("[filter='url(#" + id + ")']")) continue;
    if (cloneEl.getAttribute("filter") === "url(#" + id + ")") continue;
    filters[i].remove();
  }

  // remove unused patterns
  const patterns = cloneEl.querySelectorAll("pattern");
  for (let i = 0; i < patterns.length; i++) {
    const id = patterns[i].id;
    if (cloneEl.querySelector("[fill='url(#" + id + ")']")) continue;
    patterns[i].remove();
  }

  // remove unused symbols
  const symbols = cloneEl.querySelectorAll("symbol");
  for (let i = 0; i < symbols.length; i++) {
    const id = symbols[i].id;
    if (cloneEl.querySelector("use[*|href='#" + id + "']")) continue;
    symbols[i].remove();
  }

  // add displayed emblems
  if (layerIsOn("toggleEmblems") && emblems.selectAll("use").size()) {
    cloneEl
      .getElementById("emblems")
      ?.querySelectorAll("use")
      .forEach(el => {
        const href = el.getAttribute("href") || el.getAttribute("xlink:href");
        if (!href) return;
        const emblem = byId(href.slice(1));
        if (emblem) cloneDefs.append(emblem.cloneNode(true));
      });
  } else {
    cloneDefs.querySelector("#defs-emblems")?.remove();
  }

  {
    // replace ocean pattern href to base64
    const image = cloneEl.getElementById("oceanicPattern");
    const href = image?.getAttribute("href");
    if (href) {
      await new Promise(resolve => {
        getBase64(href, base64 => {
          image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  {
    // replace texture href to base64
    const image = cloneEl.querySelector("#texture > image");
    const href = image?.getAttribute("href");
    if (href) {
      await new Promise(resolve => {
        getBase64(href, base64 => {
          image.setAttribute("href", base64);
          resolve();
        });
      });
    }
  }

  // add relief icons
  if (cloneEl.getElementById("terrain")) {
    const uniqueElements = new Set();
    const terrainNodes = cloneEl.getElementById("terrain").childNodes;
    for (let i = 0; i < terrainNodes.length; i++) {
      const href = terrainNodes[i].getAttribute("href") || terrainNodes[i].getAttribute("xlink:href");
      uniqueElements.add(href);
    }

    const defsRelief = svgDefs.getElementById("defs-relief");
    for (const terrain of [...uniqueElements]) {
      const element = defsRelief.querySelector(terrain);
      if (element) cloneDefs.appendChild(element.cloneNode(true));
    }
  }

  // add wind rose
  if (cloneEl.getElementById("compass")) {
    const rose = svgDefs.getElementById("rose");
    if (rose) cloneDefs.appendChild(rose.cloneNode(true));
  }

  // add port icon
  if (cloneEl.getElementById("anchors")) {
    const anchor = svgDefs.getElementById("icon-anchor");
    if (anchor) cloneDefs.appendChild(anchor.cloneNode(true));
  }

  // add grid pattern
  if (cloneEl.getElementById("gridOverlay")?.hasChildNodes()) {
    const type = cloneEl.getElementById("gridOverlay").getAttribute("type");
    const pattern = svgDefs.getElementById("pattern_" + type);
    if (pattern) cloneDefs.appendChild(pattern.cloneNode(true));
  }

  if (!cloneEl.getElementById("fogging-cont")) cloneEl.getElementById("fog")?.remove(); // remove unused fog
  if (!cloneEl.getElementById("regions")) cloneEl.getElementById("statePaths")?.remove(); // removed unused statePaths
  if (!cloneEl.getElementById("labels")) cloneEl.getElementById("textPaths")?.remove(); // removed unused textPaths

  // add armies style
  if (cloneEl.getElementById("armies")) {
    cloneEl.insertAdjacentHTML(
      "afterbegin",
      "<style>#armies text {stroke: none; fill: #fff; text-shadow: 0 0 4px #000; dominant-baseline: central; text-anchor: middle; font-family: Helvetica; fill-opacity: 1;}#armies text.regimentIcon {font-size: .8em;}</style>"
    );
  }

  // add xlink: for href to support svg 1.1
  if (type === "svg") {
    cloneEl.querySelectorAll("[href]").forEach(el => {
      const href = el.getAttribute("href");
      el.removeAttribute("href");
      el.setAttribute("xlink:href", href);
    });
  }

  // add hatchings
  const hatchingUsers = cloneEl.querySelectorAll(`[fill^='url(#hatch']`);
  const hatchingFills = unique(Array.from(hatchingUsers).map(el => el.getAttribute("fill")));
  const hatchingIds = hatchingFills.map(fill => fill.slice(5, -1));
  for (const hatchingId of hatchingIds) {
    const hatching = svgDefs.getElementById(hatchingId);
    if (hatching) cloneDefs.appendChild(hatching.cloneNode(true));
  }

  // load fonts
  const usedFonts = getUsedFonts(cloneEl);
  const fontsToLoad = usedFonts.filter(font => font.src);
  if (fontsToLoad.length) {
    const dataURLfonts = await loadFontsAsDataURI(fontsToLoad);

    const fontFaces = dataURLfonts
      .map(({family, src, unicodeRange = "", variant = "normal"}) => {
        return `@font-face {font-family: "${family}"; src: ${src}; unicode-range: ${unicodeRange}; font-variant: ${variant};}`;
      })
      .join("\n");

    const style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = fontFaces;
    cloneEl.querySelector("defs").appendChild(style);
  }

  clone.remove();

  const serialized =
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>` + new XMLSerializer().serializeToString(cloneEl);
  const blob = new Blob([serialized], {type: "image/svg+xml;charset=utf-8"});
  const url = window.URL.createObjectURL(blob);
  window.setTimeout(() => window.URL.revokeObjectURL(url), 5000);
  return url;
}

// remove hidden g elements and g elements without children to make downloaded svg smaller in size
function removeUnusedElements(clone) {
  if (!terrain.selectAll("use").size()) clone.select("#defs-relief")?.remove();

  for (let empty = 1; empty; ) {
    empty = 0;
    clone.selectAll("g").each(function () {
      if (!this.hasChildNodes() || this.style.display === "none" || this.classList.contains("hidden")) {
        empty++;
        this.remove();
      }
      if (this.hasAttribute("display") && this.style.display === "inline") this.removeAttribute("display");
    });
  }
}

function updateMeshCells(clone) {
  const data = renderOcean.checked ? grid.cells.i : grid.cells.i.filter(i => grid.cells.h[i] >= 20);
  const scheme = getColorScheme(terrs.select("#landHeights").attr("scheme"));
  clone.select("#heights").attr("filter", "url(#blur1)");
  clone
    .select("#heights")
    .selectAll("polygon")
    .data(data)
    .join("polygon")
    .attr("points", d => getGridPolygon(d))
    .attr("id", d => "cell" + d)
    .attr("stroke", d => getColor(grid.cells.h[d], scheme));
}

// for each g element get inline style
function inlineStyle(clone) {
  const emptyG = clone.append("g").node();
  const defaultStyles = window.getComputedStyle(emptyG);

  clone.selectAll("g, #ruler *, #scaleBar > text").each(function () {
    const compStyle = window.getComputedStyle(this);
    let style = "";

    for (let i = 0; i < compStyle.length; i++) {
      const key = compStyle[i];
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ":" + value + ";";
    }

    for (const key in compStyle) {
      const value = compStyle.getPropertyValue(key);

      if (key === "cursor") continue; // cursor should be default
      if (this.hasAttribute(key)) continue; // don't add style if there is the same attribute
      if (value === defaultStyles.getPropertyValue(key)) continue;
      style += key + ":" + value + ";";
    }

    if (style != "") this.setAttribute("style", style);
  });

  emptyG.remove();
}

function saveGeoJSON_Cells() {
  const json = {type: "FeatureCollection", features: []};
  const cells = pack.cells;
  const getPopulation = i => {
    const [r, u] = getCellPopulation(i);
    return rn(r + u);
  };
  const getHeight = i => parseInt(getFriendlyHeight([cells.p[i][0], cells.p[i][1]]));

  cells.i.forEach(i => {
    const coordinates = getCellCoordinates(cells.v[i]);
    const height = getHeight(i);
    const biome = cells.biome[i];
    const type = pack.features[cells.f[i]].type;
    const population = getPopulation(i);
    const state = cells.state[i];
    const province = cells.province[i];
    const culture = cells.culture[i];
    const religion = cells.religion[i];
    const neighbors = cells.c[i];

    const properties = {id: i, height, biome, type, population, state, province, culture, religion, neighbors};
    const feature = {type: "Feature", geometry: {type: "Polygon", coordinates}, properties};
    json.features.push(feature);
  });

  const fileName = getFileName("Cells") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}


function ck3DrawHeightmap() {
  TIME && console.time("drawHeightmap");
  
  const land = document.getElementById("landHeights").cloneNode(true);
  // const land = document.createElement("g");
  land.setAttribute("scheme", "monochrome");
  land.setAttribute("opacity", "1");
  land.setAttribute("terracing", "0");
  land.removeAttribute("mask");

  const paths = new Array(101);

  // land cells
  {
    const {cells, vertices} = pack;
    const used = new Uint8Array(cells.i.length);

    const skip = +land.getAttribute("skip") + 1 || 1;
    const relax = +land.getAttribute("relax") || 0;
    lineGen.curve(d3[land.getAttribute("curve") || "curveBasisClosed"]);

    let currentLayer = 20;
    const heights = Array.from(cells.i).sort((a, b) => cells.h[a] - cells.h[b]);
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer > 100) break; // no layers possible with height > 100
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some(n => cells.h[n] < h);
      if (!onborder) continue;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
      const chain = connectVertices(cells, vertices, vertex, h, used);
      if (chain.length < 3) continue;
      const points = simplifyLine(chain, relax).map(v => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points));
    }
  }

  // render paths
  for (const height of d3.range(0, 101)) {
    const group = land;
    const scheme = getColorScheme(group.getAttribute("scheme"));

    if (height === 20) {
      // draw base land layer
      const e = createElement("rect");
      e.setAttribute("x", 0);
      e.setAttribute("y", 0);
      e.setAttribute("width", graphWidth);
      e.setAttribute("height", graphHeight);
      e.setAttribute("fill", scheme(0.8));
      group.appendChild(e);
    }

    if (paths[height] && paths[height].length >= 10) {
      const color = getColor(height, scheme);
      const e = createElement("path");
      e.setAttribute("d", paths[height]);
      e.setAttribute("fill", color);
      e.setAttribute("data-height", height);
      group.appendChild(e);
    }
  }

  // connect vertices to chain
  function connectVertices(cells, vertices, start, h, used) {
    const n = cells.i.length;
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.h[c] === h).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.h[c[0]] < h;
      const c1 = c[1] >= n || cells.h[c[1]] < h;
      const c2 = c[2] >= n || cells.h[c[2]] < h;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }

  function simplifyLine(chain, simplification) {
    if (!simplification) return chain;
    const n = simplification + 1; // filter each nth element
    return chain.filter((d, i) => i % n === 0);
  }

  TIME && console.timeEnd("drawHeightmap");
}

function saveCK3() {
  // saveMap()

  const xml = document.createElement("xml");
  const landHeights = ck3DrawHeightmap();
  xml.appendChild(landHeights)

  const serializedMap = new XMLSerializer().serializeToString(xml);
  const filename = getFileName() + ".xml";
  saveToMachine(serializedMap, filename);
}

function saveGeoJSON_Routes() {
  const json = {type: "FeatureCollection", features: []};

  routes.selectAll("g > path").each(function () {
    const coordinates = getRoutePoints(this);
    const id = this.id;
    const type = this.parentElement.id;

    const feature = {type: "Feature", geometry: {type: "LineString", coordinates}, properties: {id, type}};
    json.features.push(feature);
  });

  const fileName = getFileName("Routes") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJSON_Rivers() {
  const json = {type: "FeatureCollection", features: []};

  rivers.selectAll("path").each(function () {
    const river = pack.rivers.find(r => r.i === +this.id.slice(5));
    if (!river) return;

    const coordinates = getRiverPoints(this);
    const properties = {...river, id: this.id};
    const feature = {type: "Feature", geometry: {type: "LineString", coordinates}, properties};
    json.features.push(feature);
  });

  const fileName = getFileName("Rivers") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function saveGeoJSON_Markers() {
  const features = pack.markers.map(marker => {
    const {i, type, icon, x, y, size, fill, stroke} = marker;
    const coordinates = getCoordinates(x, y, 4);
    const id = `marker${i}`;
    const note = notes.find(note => note.id === id);
    const properties = {id, type, icon, x, y, ...note, size, fill, stroke};
    return {type: "Feature", geometry: {type: "Point", coordinates}, properties};
  });

  const json = {type: "FeatureCollection", features};

  const fileName = getFileName("Markers") + ".geojson";
  downloadFile(JSON.stringify(json), fileName, "application/json");
}

function getCellCoordinates(vertices) {
  const p = pack.vertices.p;
  const coordinates = vertices.map(n => getCoordinates(p[n][0], p[n][1], 2));
  return [coordinates.concat([coordinates[0]])];
}

function getRoutePoints(node) {
  let points = [];
  const l = node.getTotalLength();
  const increment = l / Math.ceil(l / 2);
  for (let i = 0; i <= l; i += increment) {
    const p = node.getPointAtLength(i);
    points.push(getCoordinates(p.x, p.y, 4));
  }
  return points;
}

function getRiverPoints(node) {
  let points = [];
  const l = node.getTotalLength() / 2; // half-length
  const increment = 0.25; // defines density of points
  for (let i = l, c = i; i >= 0; i -= increment, c += increment) {
    const p1 = node.getPointAtLength(i);
    const p2 = node.getPointAtLength(c);
    const [x, y] = getCoordinates((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 4);
    points.push([x, y]);
  }
  return points;
}
