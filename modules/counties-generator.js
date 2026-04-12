"use strict";

window.Counties = (function () {
  const countyForms = {
    Monarchy: ["County", "March", "Shire"],
    Republic: ["Prefecture", "Canton", "District"],
    Theocracy: ["Parish", "Diocese", "Deanery"],
    Union: ["Canton", "District", "Commune"],
    Anarchy: ["Territory", "Domain", "Holdings"]
  };

  // Burg-to-county lookup, populated by generate() and consumed by Provinces.generate()
  let burgToCounty = {};

  const generate = () => {
    TIME && console.time("generateCounties");

    const {states, burgs, cells} = pack;
    const counties = [0]; // index 0 reserved for "no county"
    burgToCounty = {};

    const countiesRatio = +(byId("countiesRatio")?.value ?? 30);

    states.forEach(s => {
      if (!s.i || s.removed) return;

      const stateBurgs = burgs
        .filter(b => b.state === s.i && !b.removed)
        .sort((a, b) => b.population - a.population);

      if (!stateBurgs.length) return;

      const minCounties = stateBurgs.length >= 2 ? 2 : 1;
      const countiesCount = Math.max(Math.ceil((stateBurgs.length * countiesRatio) / 100), minCounties);
      const seeds = stateBurgs.slice(0, countiesCount);

      // Assign every burg in this state to the nearest seed by cell-distance
      const countyBurgs = seeds.map(seed => [seed.i]);
      const seedPositions = seeds.map(seed => cells.p[seed.cell]);

      for (let bIdx = countiesCount; bIdx < stateBurgs.length; bIdx++) {
        const b = stateBurgs[bIdx];
        const bPos = cells.p[b.cell];
        let minDist = Infinity;
        let bestSeedIdx = 0;
        seedPositions.forEach((sPos, sIdx) => {
          const dist = (bPos[0] - sPos[0]) ** 2 + (bPos[1] - sPos[1]) ** 2;
          if (dist < minDist) {
            minDist = dist;
            bestSeedIdx = sIdx;
          }
        });
        countyBurgs[bestSeedIdx].push(b.i);
      }

      seeds.forEach((capitalBurg, sIdx) => {
        const countyId = counties.length;
        const color = getMixedColor(s.color, 0.2, 0.15);
        const name = capitalBurg.name;
        const formName = ra(countyForms[s.form] || countyForms.Monarchy);
        counties.push({
          i: countyId,
          state: s.i,
          capital: capitalBurg.i,
          name,
          formName,
          fullName: name + " " + formName,
          color,
          burgs: countyBurgs[sIdx]
        });
        countyBurgs[sIdx].forEach(bid => { burgToCounty[bid] = countyId; });
      });
    });

    pack.counties = counties;
    TIME && console.timeEnd("generateCounties");
  };

  // Called from Provinces.generate() to resolve a province's county from its burg id
  const getBurgCounty = burgId => burgToCounty[burgId] || 0;

  const getPoles = () => {
    const {counties, provinces, burgs, cells} = pack;
    if (!counties) return;

    // Use actual rendered territory (via province→county mapping) when available
    if (provinces && cells.province) {
      const getType = cellId => {
        const p = cells.province[cellId];
        return p ? (provinces[p]?.county || 0) : 0;
      };
      const poles = getPolesOfInaccessibility(pack, getType);
      counties.forEach(c => {
        if (!c.i || c.removed) return;
        c.pole = poles[c.i] || cells.p[burgs[c.capital]?.cell] || [0, 0];
      });
    } else {
      // fallback before provinces are generated
      counties.forEach(c => {
        if (!c.i || c.removed) return;
        const positions = (c.burgs || [])
          .map(bid => burgs[bid])
          .filter(b => b?.cell != null)
          .map(b => cells.p[b.cell]);
        c.pole = positions.length
          ? [d3.mean(positions, p => p[0]), d3.mean(positions, p => p[1])]
          : cells.p[burgs[c.capital]?.cell] || [0, 0];
      });
    }
  };

  return {generate, getPoles, getBurgCounty};
})();
