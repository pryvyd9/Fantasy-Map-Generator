"use strict";

window.Kingdoms = (function () {
  const kingdomForms = {
    Monarchy: ["Kingdom", "Realm", "Crown"],
    Republic: ["League", "Republic", "Federation"],
    Theocracy: ["Holy Kingdom", "Theocracy", "Patriarchate"],
    Union: ["Confederation", "Union", "Commonwealth"],
    Anarchy: ["Council", "Territory", "Lands"]
  };

  const empireForms = {
    Monarchy: ["Empire", "Hegemony", "Realm"],
    Republic: ["Union", "Commonwealth", "Confederation"],
    Theocracy: ["Caliphate", "Holy Empire", "Brotherhood"],
    Union: ["Union", "Commonwealth", "Federation"],
    Anarchy: ["League", "Coalition", "Alliance"]
  };

  const adjFormNames = new Set([
    "Empire", "Hegemony", "Caliphate", "Brotherhood",
    "Confederation", "League", "Coalition", "Alliance",
    "Union", "Commonwealth", "Federation", "Theocracy"
  ]);

  const generate = () => {
    TIME && console.time("generateKingdoms");

    const {states} = pack;
    const validStates = states.filter(s => s.i && !s.removed);

    states.forEach(s => { s.kingdom = 0; s.empire = 0; });

    const kingdoms = [0];
    const empires = [0];

    if (validStates.length < 2) {
      pack.kingdoms = kingdoms;
      pack.empires = empires;
      TIME && console.timeEnd("generateKingdoms");
      return;
    }

    const kingdomsRatio = +(byId("kingdomsRatio")?.value ?? 80);
    const empiresNumberTarget = +(byId("empiresNumber")?.value ?? 3);

    const areas = validStates.map(s => s.area);
    const median = d3.median(areas);
    const sorted = areas.slice().sort((a, b) => b - a);
    const empireMin = sorted[Math.max(Math.ceil(validStates.length ** 0.4) - 2, 0)] || 0;

    const getStateTier = s => {
      if (!median) return 0;
      let tier = Math.min(Math.floor((s.area / median) * 2.6), 4);
      if (tier === 4 && s.area < empireMin) tier = 3;
      return tier;
    };

    // ── Step 1: Kingdoms from existing Suzerain/Vassal diplomacy ─────────
    for (const s of validStates) {
      if (s.kingdom) continue;
      if (!s.diplomacy) continue;
      const vassalIds = [];
      for (let i = 1; i < states.length; i++) {
        const v = states[i];
        if (!v || !v.i || v.removed) continue;
        if (v.diplomacy && v.diplomacy[s.i] === "Vassal") vassalIds.push(i);
      }
      if (!vassalIds.length) continue;

      const memberIds = [s.i, ...vassalIds];
      const kingdomId = kingdoms.length;
      const formName = ra(kingdomForms[getDominantForm(memberIds)] || kingdomForms.Monarchy);
      kingdoms.push({i: kingdomId, name: s.name, fullName: buildFullName(s.name, formName, adjFormNames), formName, color: s.color, capital: s.i, states: memberIds});
      memberIds.forEach(id => { if (states[id]) states[id].kingdom = kingdomId; });
    }

    // ── Step 2: All remaining states get kingdoms ─────────────────────────
    const maxNeighborsToAbsorb = Math.round(kingdomsRatio / 25); // 0–4
    const needsKingdom = s => s.i && !s.removed && !s.kingdom;
    const byTierDesc = (a, b) => getStateTier(b) - getStateTier(a);

    for (const s of validStates.filter(needsKingdom).sort(byTierDesc)) {
      if (s.kingdom) continue;
      const memberIds = [s.i];
      if (maxNeighborsToAbsorb > 0) {
        for (const neighborId of (s.neighbors || [])) {
          if (memberIds.length - 1 >= maxNeighborsToAbsorb) break;
          const neighbor = states[neighborId];
          if (!neighbor || neighbor.removed || neighbor.kingdom) continue;
          if (getStateTier(neighbor) < 4) memberIds.push(neighborId);
        }
      }
      const kingdomId = kingdoms.length;
      const formName = ra(kingdomForms[getDominantForm(memberIds)] || kingdomForms.Monarchy);
      kingdoms.push({i: kingdomId, name: s.name, fullName: buildFullName(s.name, formName, adjFormNames), formName, color: s.color, capital: s.i, states: memberIds});
      memberIds.forEach(id => { if (states[id]) states[id].kingdom = kingdomId; });
    }

    pack.kingdoms = kingdoms;

    // ── Step 3: Empires via BFS flood-fill from largest-kingdom seeds ─────
    const kingdomNeighbors = buildKingdomNeighbors(kingdoms, states);

    if (empiresNumberTarget > 0 && kingdoms.length > 2) {
      const kingdomArea = k => k.states.reduce((sum, id) => sum + (states[id]?.area || 0), 0);
      const validKingdoms = kingdoms.filter(k => k.i);
      const seeds = validKingdoms.slice().sort((a, b) => kingdomArea(b) - kingdomArea(a)).slice(0, Math.min(empiresNumberTarget, validKingdoms.length));

      for (const seed of seeds) {
        const empireId = empires.length;
        const capitalState = states[seed.capital];
        const formName = ra(empireForms[getDominantForm(seed.states)] || empireForms.Monarchy);
        empires.push({i: empireId, name: capitalState.name, fullName: buildFullName(capitalState.name, formName, adjFormNames), formName, color: getRandomColor(), capital: seed.i, kingdoms: [seed.i]});
        seed.empire = empireId;
        seed.states.forEach(sId => { if (states[sId]) states[sId].empire = empireId; });
      }

      const assigned = new Set(seeds.map(k => k.i));
      const queue = seeds.map(k => k.i);
      while (queue.length) {
        const kId = queue.shift();
        const empireId = kingdoms[kId].empire;
        for (const neighborKId of (kingdomNeighbors.get(kId) || [])) {
          if (assigned.has(neighborKId)) continue;
          assigned.add(neighborKId);
          queue.push(neighborKId);
          kingdoms[neighborKId].empire = empireId;
          empires[empireId].kingdoms.push(neighborKId);
          kingdoms[neighborKId].states.forEach(sId => { if (states[sId]) states[sId].empire = empireId; });
        }
      }

      for (const k of kingdoms.filter(k => k.i && !k.empire)) {
        const biggest = empires.filter(e => e.i).sort((a, b) => b.kingdoms.length - a.kingdoms.length)[0];
        if (!biggest) continue;
        k.empire = biggest.i;
        biggest.kingdoms.push(k.i);
        k.states.forEach(sId => { if (states[sId]) states[sId].empire = biggest.i; });
      }
    }

    pack.empires = empires;

    // ── Step 4: Top-down color tree ────────────────────────────────────────
    recolorLevels(kingdoms, empires, states);

    TIME && console.timeEnd("generateKingdoms");
  };

  // Assign empire colors via chromatic graph coloring, then derive kingdom and state colors downward.
  function recolorLevels(kingdoms, empires, states) {
    const validEmpires = empires.filter(e => e.i && !e.removed);

    if (validEmpires.length) {
      // Build empire adjacency from kingdom neighbor graph
      const empireNeighbors = new Map();
      validEmpires.forEach(e => empireNeighbors.set(e.i, new Set()));
      const kNeighMap = buildKingdomNeighbors(kingdoms, states);
      kNeighMap.forEach((neighborSet, kId) => {
        const k = kingdoms[kId];
        if (!k?.empire) return;
        for (const nkId of neighborSet) {
          const nk = kingdoms[nkId];
          if (!nk?.empire || nk.empire === k.empire) continue;
          empireNeighbors.get(k.empire)?.add(nk.empire);
          empireNeighbors.get(nk.empire)?.add(k.empire);
        }
      });

      // Chromatic color assignment for empires
      const palette = getColors(validEmpires.length + 2);
      validEmpires.forEach(e => {
        const used = new Set([...(empireNeighbors.get(e.i) || [])].map(id => empires[id]?.color).filter(Boolean));
        e.color = palette.find(c => !used.has(c)) || getRandomColor();
      });
    }

    // Kingdoms derive from their empire, or keep existing color if no empire
    kingdoms.forEach(k => {
      if (!k.i || k.removed) return;
      const empireColor = empires[k.empire]?.color;
      k.color = empireColor ? getMixedColor(empireColor, 0.15, 0.0) : getMixedColor(k.color, 0.15, 0.0);
    });

    // States derive from their kingdom
    states.forEach(s => {
      if (!s.i || s.removed) return;
      const kingdomColor = kingdoms[s.kingdom]?.color;
      s.color = kingdomColor ? getMixedColor(kingdomColor, 0.15, 0.1) : s.color;
    });
  }

  function buildKingdomNeighbors(kingdoms, states) {
    const map = new Map();
    kingdoms.forEach(k => { if (k.i) map.set(k.i, new Set()); });
    for (const s of Object.values(states)) {
      if (!s?.i || s.removed || !s.kingdom) continue;
      for (const neighborId of (s.neighbors || [])) {
        const ns = states[neighborId];
        if (!ns || ns.removed || !ns.kingdom || ns.kingdom === s.kingdom) continue;
        map.get(s.kingdom)?.add(ns.kingdom);
        map.get(ns.kingdom)?.add(s.kingdom);
      }
    }
    return map;
  }

  function getDominantForm(stateIds) {
    const counts = {};
    for (const id of stateIds) {
      const form = pack.states[id]?.form || "Monarchy";
      counts[form] = (counts[form] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function buildFullName(name, formName, adjSet) {
    if (!name) return "The " + formName;
    if (adjSet.has(formName) && !/-| /.test(name)) return `${getAdjective(name)} ${formName}`;
    return `${formName} of ${name}`;
  }

  const getPoles = () => {
    const {states, kingdoms, empires} = pack;
    if (!kingdoms || !empires) return;

    kingdoms.forEach(k => {
      if (!k.i || k.removed) return;
      const poles = k.states.map(id => states[id]?.pole).filter(Boolean);
      k.pole = poles.length
        ? [d3.mean(poles, p => p[0]), d3.mean(poles, p => p[1])]
        : states[k.capital]?.pole || [0, 0];
    });

    empires.forEach(e => {
      if (!e.i || e.removed) return;
      const poles = e.kingdoms.map(id => kingdoms[id]?.pole).filter(Boolean);
      e.pole = poles.length
        ? [d3.mean(poles, p => p[0]), d3.mean(poles, p => p[1])]
        : kingdoms[e.capital]?.pole || [0, 0];
    });
  };

  return {generate, getPoles};
})();
