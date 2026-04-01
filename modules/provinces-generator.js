"use strict";

window.Provinces = (function () {
  const forms = {
    Monarchy: {County: 22, Earldom: 6, Shire: 2, Landgrave: 2, Margrave: 2, Barony: 2, Captaincy: 1, Seneschalty: 1},
    Republic: {Province: 6, Department: 2, Governorate: 2, District: 1, Canton: 1, Prefecture: 1},
    Theocracy: {Parish: 3, Deanery: 1},
    Union: {Province: 1, State: 1, Canton: 1, Republic: 1, County: 1, Council: 1},
    Anarchy: {Council: 1, Commune: 1, Community: 1, Tribe: 1},
    Wild: {Territory: 10, Land: 5, Region: 2, Tribe: 1, Clan: 1, Dependency: 1, Area: 1}
  };

  const generate = (regenerate = false, regenerateLockedStates = false) => {
    TIME && console.time("generateProvinces");
    const localSeed = regenerate ? generateSeed() : seed;
    Math.random = aleaPRNG(localSeed);

    const {cells, states, burgs} = pack;
    const provinces = [0]; // 0 index is reserved for "no province"
    const provinceIds = new Uint16Array(cells.i.length);

    const isProvinceLocked = province => province.lock || (!regenerateLockedStates && states[province.state]?.lock);
    const isProvinceCellLocked = cell => provinceIds[cell] && isProvinceLocked(provinces[provinceIds[cell]]);

    if (regenerate) {
      pack.provinces.forEach(province => {
        if (!province.i || province.removed || !isProvinceLocked(province)) return;

        const newId = provinces.length;
        for (const i of cells.i) {
          if (cells.province[i] === province.i) provinceIds[i] = newId;
        }

        province.i = newId;
        provinces.push(province);
      });
    }

    const provincesRatio = +byId("provincesRatio").value;
    const max = provincesRatio == 100 ? 1000 : gauss(20, 5, 5, 100) * provincesRatio ** 0.5; // max growth

    // generate provinces for selected burgs
    states.forEach(s => {
      s.provinces = [];
      if (!s.i || s.removed) return;
      if (provinces.length) s.provinces = provinces.filter(p => p.state === s.i).map(p => p.i); // locked provinces ids
      if (s.lock && !regenerateLockedStates) return; // don't regenerate provinces of a locked state

      const stateBurgs = burgs
        .filter(b => b.state === s.i && !b.removed && !provinceIds[b.cell])
        .sort((a, b) => b.population * gauss(1, 0.2, 0.5, 1.5, 3) - a.population)
        .sort((a, b) => b.capital - a.capital);
      if (stateBurgs.length < 2) return; // at least 2 provinces are required
      const provincesNumber = Math.max(Math.ceil((stateBurgs.length * provincesRatio) / 100), 2);

      // Compute minimum spacing from state area for even distribution
      const stateArea = cells.i.reduce((sum, i) => (cells.state[i] === s.i ? sum + cells.area[i] : sum), 0) || 1;
      const minSpacing = Math.sqrt(stateArea / provincesNumber) * 0.6;

      const seeds = []; // {cell, burgId, culture, burgObj}
      const seedTree = d3.quadtree();

      // Pass 1: accept burgs that pass spacing test (capital always included first)
      for (const b of stateBurgs) {
        if (seeds.length >= provincesNumber) break;
        const [x, y] = cells.p[b.cell];
        if (b.capital || seedTree.find(x, y, minSpacing) === undefined) {
          seeds.push({cell: b.cell, burgId: b.i, culture: b.culture, burgObj: b});
          seedTree.add([x, y]);
        }
      }

      // Pass 2: fill remaining slots with burgless seeds at best-suitability gap cells
      if (seeds.length < provincesNumber) {
        const stateCells = cells.i
          .filter(i => cells.state[i] === s.i && cells.h[i] >= 20 && !provinceIds[i])
          .sort((a, b) => cells.s[b] - cells.s[a]);
        for (const i of stateCells) {
          if (seeds.length >= provincesNumber) break;
          const [x, y] = cells.p[i];
          if (seedTree.find(x, y, minSpacing) === undefined) {
            seeds.push({cell: i, burgId: cells.burg[i] || 0, culture: cells.culture[i], burgObj: null});
            seedTree.add([x, y]);
          }
        }
      }

      const form = Object.assign({}, forms[s.form]);

      for (let i = 0; i < seeds.length; i++) {
        const provinceId = provinces.length;
        const seed = seeds[i];
        const center = seed.cell;
        const burg = seed.burgId;
        const c = seed.culture;
        const nameByBurg = seed.burgObj && P(0.5);
        const name = nameByBurg ? seed.burgObj.name : Names.getState(Names.getCultureShort(c), c);
        const formName = rw(form);
        form[formName] += 10;
        const fullName = name + " " + formName;
        const county = Counties?.getBurgCounty(burg) || 0;
        const countyColor = pack.counties?.[county]?.color;
        const color = countyColor ? getMixedColor(countyColor, 0.2, 0.2) : getMixedColor(s.color);
        const kinship = nameByBurg ? 0.8 : 0.4;
        const type = BurgsAndStates.getType(center, seed.burgObj?.port);
        const coa = COA.generate(seed.burgObj?.coa || s.coa, kinship, null, type);
        coa.shield = COA.getShield(c, s.i);

        s.provinces.push(provinceId);
        provinces.push({i: provinceId, state: s.i, center, burg, name, formName, fullName, color, county, coa});
      }
    });

    // generate provinces for neutral land cells (state === 0) with spatial spacing
    const neutralProvinceIds = [];
    let neutralTargetCells = 10;
    {
      const neutralCells = cells.i.filter(i => !cells.state[i] && cells.h[i] >= 20 && !provinceIds[i]);
      if (neutralCells.length) {
        const neutralArea = neutralCells.reduce((sum, i) => sum + cells.area[i], 0);
        const totalLandArea = cells.i.reduce((sum, i) => (cells.h[i] >= 20 ? sum + cells.area[i] : sum), 0) || 1;
        const totalStateProvinces = provinces.length - 1; // exclude index 0
        const areaPerProvince = totalStateProvinces > 0 ? totalLandArea / totalStateProvinces : neutralArea;
        const neutralCount = Math.max(Math.ceil(neutralArea / areaPerProvince), 1);
        const neutralSpacing = Math.sqrt(neutralArea / neutralCount) * 0.6;
        neutralTargetCells = Math.ceil(neutralCells.length / neutralCount);

        const neutralTree = d3.quadtree();
        const neutralSeeds = [];
        const sortedNeutral = neutralCells.slice().sort((a, b) => cells.s[b] - cells.s[a]);

        for (const i of sortedNeutral) {
          if (neutralSeeds.length >= neutralCount) break;
          const [x, y] = cells.p[i];
          if (neutralTree.find(x, y, neutralSpacing) === undefined) {
            neutralSeeds.push(i);
            neutralTree.add([x, y]);
          }
        }

        // find nearest state to a cell center (for form name)
        const validStates = pack.states.filter(s => s.i && !s.removed);
        const getNearestState = center => {
          const [cx, cy] = cells.p[center];
          let best = null, bestDist = Infinity;
          for (const s of validStates) {
            const [sx, sy] = cells.p[s.center];
            const d = (cx - sx) ** 2 + (cy - sy) ** 2;
            if (d < bestDist) { bestDist = d; best = s; }
          }
          return best;
        };

        for (const center of neutralSeeds) {
          const provinceId = provinces.length;
          const burg = cells.burg[center] || 0;
          const c = cells.culture[center];
          const nearestState = getNearestState(center);
          const formTable = nearestState ? forms[nearestState.form] || forms.Monarchy : forms.Monarchy;
          const name = burg ? burgs[burg].name : Names.getState(Names.getCultureShort(c), c);
          const formName = rw(Object.assign({}, formTable));
          const fullName = name + " " + formName;
          const color = getMixedColor(null, 0.2, 0.2);
          const type = BurgsAndStates.getType(center, burgs[burg]?.port);
          const coa = COA.generate(null, 0, false, type);
          coa.shield = COA.getShield(c, 0);
          provinces.push({i: provinceId, state: 0, center, burg, name, formName, fullName, color, county: 0, coa});
          neutralProvinceIds.push(provinceId);
        }
      }
    }

    // expand generated provinces (state-owned only; neutral provinces use separate pass below)
    const queue = new FlatQueue();
    const cost = [];

    provinces.forEach(p => {
      if (!p.i || p.removed || isProvinceLocked(p)) return;
      if (p.state === 0) return; // neutral provinces expand in a separate pass
      provinceIds[p.center] = p.i;
      queue.push({e: p.center, province: p.i, state: p.state, p: 0}, 0);
      cost[p.center] = 1;
    });

    while (queue.length) {
      const {e, p, province, state} = queue.pop();

      cells.c[e].forEach(e => {
        if (isProvinceCellLocked(e)) return; // do not overwrite cell of locked provinces

        const land = cells.h[e] >= 20;
        if (!land && !cells.t[e]) return; // cannot pass deep ocean
        if (land && cells.state[e] !== state) return;
        const evevation = cells.h[e] >= 70 ? 100 : cells.h[e] >= 50 ? 30 : cells.h[e] >= 20 ? 10 : 100;
        const totalCost = p + evevation;

        if (totalCost > max) return;
        if (!cost[e] || totalCost < cost[e]) {
          if (land) provinceIds[e] = province; // assign province to a cell
          cost[e] = totalCost;
          queue.push({e, province, state, p: totalCost}, totalCost);
        }
      });
    }

    // justify provinces shapes a bit
    for (const i of cells.i) {
      if (cells.burg[i]) continue; // do not overwrite burgs
      if (isProvinceCellLocked(i)) continue; // do not overwrite cell of locked provinces

      const neibs = cells.c[i]
        .filter(c => cells.state[c] === cells.state[i] && !isProvinceCellLocked(c))
        .map(c => provinceIds[c]);
      const adversaries = neibs.filter(c => c !== provinceIds[i]);
      if (adversaries.length < 2) continue;

      const buddies = neibs.filter(c => c === provinceIds[i]).length;
      if (buddies.length > 2) continue;

      const competitors = adversaries.map(p => adversaries.reduce((s, v) => (v === p ? s + 1 : s), 0));
      const max = d3.max(competitors);
      if (buddies >= max) continue;

      provinceIds[i] = adversaries[competitors.indexOf(max)];
    }

    // add "wild" provinces if some cells don't have a province assigned
    const noProvince = Array.from(cells.i).filter(i => cells.state[i] && !provinceIds[i]); // cells without province assigned
    states.forEach(s => {
      if (!s.i || s.removed) return;
      if (s.lock && !regenerateLockedStates) return;
      if (!s.provinces.length) return;

      const coreProvinceNames = s.provinces.map(p => provinces[p]?.name);
      const colonyNamePool = [s.name, ...coreProvinceNames].filter(name => name && !/new/i.test(name));
      const getColonyName = () => {
        if (colonyNamePool.length < 1) return null;

        const index = rand(colonyNamePool.length - 1);
        const spliced = colonyNamePool.splice(index, 1);
        return spliced[0] ? `New ${spliced[0]}` : null;
      };

      let stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !provinceIds[i]);
      while (stateNoProvince.length) {
        // add new province
        const provinceId = provinces.length;
        const burgCell = stateNoProvince.find(i => cells.burg[i]);
        const center = burgCell ? burgCell : stateNoProvince[0];
        const burg = burgCell ? cells.burg[burgCell] : 0;
        provinceIds[center] = provinceId;

        // expand province
        const cost = [];
        cost[center] = 1;
        queue.push({e: center, p: 0}, 0);
        while (queue.length) {
          const {e, p} = queue.pop();

          cells.c[e].forEach(nextCellId => {
            if (provinceIds[nextCellId]) return;
            const land = cells.h[nextCellId] >= 20;
            if (cells.state[nextCellId] && cells.state[nextCellId] !== s.i) return;
            const ter = land ? (cells.state[nextCellId] === s.i ? 3 : 20) : cells.t[nextCellId] ? 10 : 30;
            const totalCost = p + ter;

            if (totalCost > max) return;
            if (!cost[nextCellId] || totalCost < cost[nextCellId]) {
              if (land && cells.state[nextCellId] === s.i) provinceIds[nextCellId] = provinceId; // assign province to a cell
              cost[nextCellId] = totalCost;
              queue.push({e: nextCellId, p: totalCost}, totalCost);
            }
          });
        }

        // generate "wild" province name
        const c = cells.culture[center];
        const f = pack.features[cells.f[center]];
        let wildCounty = Counties?.getBurgCounty(burg) || 0;
        if (!wildCounty && pack.counties?.length > 1) {
          // no burg county — find most-adjacent county from neighboring assigned cells
          const adjCounts = new Map();
          const provCellsForCounty = stateNoProvince.filter(i => provinceIds[i] === provinceId);
          for (const ci of provCellsForCounty) {
            for (const nb of cells.c[ci]) {
              const nbPid = provinceIds[nb];
              if (!nbPid) continue;
              const nbCounty = provinces[nbPid]?.county;
              if (!nbCounty) continue;
              adjCounts.set(nbCounty, (adjCounts.get(nbCounty) || 0) + 1);
            }
          }
          if (adjCounts.size) {
            wildCounty = [...adjCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
          }
        }
        const wildCountyColor = pack.counties?.[wildCounty]?.color;
        const color = wildCountyColor ? getMixedColor(wildCountyColor, 0.2, 0.2) : getMixedColor(s.color);

        const provCells = stateNoProvince.filter(i => provinceIds[i] === provinceId);
        const singleIsle = provCells.length === f.cells && !provCells.find(i => cells.f[i] !== f.i);
        const isleGroup = !singleIsle && !provCells.find(i => pack.features[cells.f[i]].group !== "isle");
        const colony = !singleIsle && !isleGroup && P(0.5) && !isPassable(s.center, center);

        const name = (() => {
          const colonyName = colony && P(0.8) && getColonyName();
          if (colonyName) return colonyName;
          if (burgCell && P(0.5)) return burgs[burg].name;
          return Names.getState(Names.getCultureShort(c), c);
        })();

        const formName = (() => {
          if (singleIsle) return "Island";
          if (isleGroup) return "Islands";
          if (colony) return "Colony";
          return rw(forms["Wild"]);
        })();

        const fullName = name + " " + formName;

        const dominion = colony ? P(0.95) : singleIsle || isleGroup ? P(0.7) : P(0.3);
        const kinship = dominion ? 0 : 0.4;
        const type = BurgsAndStates.getType(center, burgs[burg]?.port);
        const coa = COA.generate(s.coa, kinship, dominion, type);
        coa.shield = COA.getShield(c, s.i);

        provinces.push({i: provinceId, state: s.i, center, burg, name, formName, fullName, color, county: wildCounty, coa});
        s.provinces.push(provinceId);

        // check if there is a land way within the same state between two cells
        function isPassable(from, to) {
          if (cells.f[from] !== cells.f[to]) return false; // on different islands
          const passableQueue = [from],
            used = new Uint8Array(cells.i.length),
            state = cells.state[from];
          while (passableQueue.length) {
            const current = passableQueue.pop();
            if (current === to) return true; // way is found
            cells.c[current].forEach(c => {
              if (used[c] || cells.h[c] < 20 || cells.state[c] !== state) return;
              passableQueue.push(c);
              used[c] = 1;
            });
          }
          return false; // way is not found
        }

        // re-check
        stateNoProvince = noProvince.filter(i => cells.state[i] === s.i && !provinceIds[i]);
      }
    });

    // expand neutral provinces with a per-province cell-count cap for consistent sizing
    if (neutralProvinceIds.length) {
      const neutralQueue = new FlatQueue();
      const neutralCost = [];
      const neutralCellCounts = new Array(provinces.length).fill(0);

      for (const id of neutralProvinceIds) {
        const p = provinces[id];
        provinceIds[p.center] = id;
        neutralCellCounts[id] = 1;
        neutralQueue.push({e: p.center, province: id, p: 0}, 0);
        neutralCost[p.center] = 1;
      }

      while (neutralQueue.length) {
        const {e, p, province} = neutralQueue.pop();
        if (neutralCellCounts[province] >= neutralTargetCells) continue;

        cells.c[e].forEach(nextCell => {
          if (provinceIds[nextCell]) return;
          if (cells.h[nextCell] < 20) return;
          if (cells.state[nextCell]) return;
          const elevation = cells.h[nextCell] >= 70 ? 100 : cells.h[nextCell] >= 50 ? 30 : 10;
          const totalCost = p + elevation;
          if (!neutralCost[nextCell] || totalCost < neutralCost[nextCell]) {
            provinceIds[nextCell] = province;
            neutralCellCounts[province]++;
            neutralCost[nextCell] = totalCost;
            neutralQueue.push({e: nextCell, province, p: totalCost}, totalCost);
          }
        });
      }

      // assign each neutral province to its most-neighboring county (by cell adjacency)
      if (pack.counties?.length > 1) {
        const neutralSet = new Set(neutralProvinceIds);
        const countyCounts = new Map(neutralProvinceIds.map(id => [id, new Map()]));

        for (const i of cells.i) {
          const pid = provinceIds[i];
          if (!pid || !neutralSet.has(pid)) continue;
          for (const neighbor of cells.c[i]) {
            const npid = provinceIds[neighbor];
            if (!npid || neutralSet.has(npid)) continue;
            const neighborCounty = provinces[npid]?.county;
            if (!neighborCounty) continue;
            const m = countyCounts.get(pid);
            m.set(neighborCounty, (m.get(neighborCounty) || 0) + 1);
          }
        }

        for (const id of neutralProvinceIds) {
          const prov = provinces[id];
          const m = countyCounts.get(id);
          if (!m?.size) continue;
          let bestCounty = 0, bestCount = 0;
          for (const [countyId, count] of m) {
            if (count > bestCount) { bestCount = count; bestCounty = countyId; }
          }
          prov.county = bestCounty;
          const countyColor = pack.counties[bestCounty]?.color;
          if (countyColor) prov.color = getMixedColor(countyColor, 0.2, 0.2);
        }
      }
    }

    // Propagate county assignments: BFS from provinces with county>0 to fill county=0 provinces
    if (pack.counties?.length > 1) {
      let changed = true;
      while (changed) {
        changed = false;
        for (const i of cells.i) {
          const pid = provinceIds[i];
          if (!pid) continue;
          const prov = provinces[pid];
          if (!prov || prov.county) continue;
          for (const nb of cells.c[i]) {
            const npid = provinceIds[nb];
            if (!npid || npid === pid) continue;
            const nbCounty = provinces[npid]?.county;
            if (!nbCounty) continue;
            prov.county = nbCounty;
            const countyColor = pack.counties[nbCounty]?.color;
            if (countyColor) prov.color = getMixedColor(countyColor, 0.2, 0.2);
            changed = true;
            break;
          }
        }
      }
    }

    cells.province = provinceIds;
    pack.provinces = provinces;

    TIME && console.timeEnd("generateProvinces");
  };

  // calculate pole of inaccessibility for each province
  const getPoles = () => {
    const getType = cellId => pack.cells.province[cellId];
    const poles = getPolesOfInaccessibility(pack, getType);

    pack.provinces.forEach(province => {
      if (!province.i || province.removed) return;
      province.pole = poles[province.i] || [0, 0];
    });
  };

  return {generate, getPoles};
})();
