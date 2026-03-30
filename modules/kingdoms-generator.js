"use strict";

window.Kingdoms = (function () {
  // Form names by government category
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

  // Forms that use "Adjective + FormName" naming (not "FormName of Name")
  const adjFormNames = new Set([
    "Empire", "Hegemony", "Caliphate", "Brotherhood",
    "Confederation", "League", "Coalition", "Alliance",
    "Union", "Commonwealth", "Federation", "Theocracy"
  ]);

  const generate = () => {
    TIME && console.time("generateKingdoms");

    const {states} = pack;
    const validStates = states.filter(s => s.i && !s.removed);

    // reset previous assignments
    states.forEach(s => {
      s.kingdom = 0;
      s.empire = 0;
    });

    const kingdoms = [0]; // index 0 reserved for "no kingdom"
    const empires = [0];  // index 0 reserved for "no empire"

    if (validStates.length < 2) {
      pack.kingdoms = kingdoms;
      pack.empires = empires;
      TIME && console.timeEnd("generateKingdoms");
      return;
    }

    const kingdomsRatio = +(byId("kingdomsRatio")?.value ?? 80);
    const empiresNumberTarget = +(byId("empiresNumber")?.value ?? 3);

    // Re-calculate state tiers using the same formula as defineStateForms
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

      // Collect this state's direct vassals
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
      kingdoms.push({
        i: kingdomId,
        name: s.name,
        fullName: buildFullName(s.name, formName, adjFormNames),
        formName,
        color: s.color,
        capital: s.i,
        states: memberIds
      });
      memberIds.forEach(id => { if (states[id]) states[id].kingdom = kingdomId; });
    }

    // ── Step 2: Additional kingdoms from independent states ───────────────
    const targetAssigned = Math.round(validStates.length * kingdomsRatio / 100);
    let assignedCount = validStates.filter(s => s.kingdom).length;

    // High-tier independents first; they may absorb unassigned neighbors
    const needsKingdom = s => s.i && !s.removed && !s.kingdom;
    const byTierDesc = (a, b) => getStateTier(b) - getStateTier(a);

    for (const s of validStates.filter(needsKingdom).sort(byTierDesc)) {
      if (assignedCount >= targetAssigned) break;
      if (s.kingdom) continue;

      const memberIds = [s.i];

      // Absorb unassigned neighboring low-tier states (greedy)
      for (const neighborId of (s.neighbors || [])) {
        if (assignedCount + memberIds.length >= targetAssigned + 1) break;
        const neighbor = states[neighborId];
        if (!neighbor || neighbor.removed || neighbor.kingdom) continue;
        if (getStateTier(neighbor) < 3) memberIds.push(neighborId);
      }

      const kingdomId = kingdoms.length;
      const formName = ra(kingdomForms[getDominantForm(memberIds)] || kingdomForms.Monarchy);
      kingdoms.push({
        i: kingdomId,
        name: s.name,
        fullName: buildFullName(s.name, formName, adjFormNames),
        formName,
        color: s.color,
        capital: s.i,
        states: memberIds
      });
      memberIds.forEach(id => { if (states[id]) states[id].kingdom = kingdomId; });
      assignedCount += memberIds.length;
    }

    pack.kingdoms = kingdoms;

    // ── Step 3: Empires from empire-tier kingdoms ─────────────────────────
    if (empiresNumberTarget > 0 && kingdoms.length > 2) {
      // Find kingdoms with empire-tier (tier 4) capital states, largest first
      const empireSeeds = kingdoms
        .filter(k => k.i && getStateTier(states[k.capital]) === 4)
        .sort((a, b) => {
          const aArea = a.states.reduce((sum, id) => sum + (states[id]?.area || 0), 0);
          const bArea = b.states.reduce((sum, id) => sum + (states[id]?.area || 0), 0);
          return bArea - aArea;
        })
        .slice(0, empiresNumberTarget);

      for (const seed of empireSeeds) {
        if (seed.empire) continue; // already absorbed into a larger empire

        const empireId = empires.length;
        const empireKingdomIds = [seed.i];

        // Add kingdoms whose capital state is a Vassal of the seed's capital
        for (const k of kingdoms) {
          if (!k.i || k.i === seed.i) continue;
          const cap = states[k.capital];
          if (!cap?.diplomacy) continue;
          if (cap.diplomacy[seed.capital] === "Vassal") empireKingdomIds.push(k.i);
        }

        const formName = ra(empireForms[getDominantForm(seed.states)] || empireForms.Monarchy);
        const capitalState = states[seed.capital];
        empires.push({
          i: empireId,
          name: capitalState.name,
          fullName: buildFullName(capitalState.name, formName, adjFormNames),
          formName,
          color: seed.color,
          capital: seed.i,
          kingdoms: empireKingdomIds
        });

        // Mark kingdoms and their member states
        empireKingdomIds.forEach(kId => {
          if (kingdoms[kId]) kingdoms[kId].empire = empireId;
          kingdoms[kId]?.states.forEach(sId => { if (states[sId]) states[sId].empire = empireId; });
        });
      }
    }

    pack.empires = empires;
    TIME && console.timeEnd("generateKingdoms");
  };

  // Returns the most common government form category among given stateIds
  function getDominantForm(stateIds) {
    const counts = {};
    for (const id of stateIds) {
      const form = pack.states[id]?.form || "Monarchy";
      counts[form] = (counts[form] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Builds "Adjective FormName" or "FormName of Name" depending on form
  function buildFullName(name, formName, adjSet) {
    if (!name) return "The " + formName;
    if (adjSet.has(formName) && !/-| /.test(name)) return `${getAdjective(name)} ${formName}`;
    return `${formName} of ${name}`;
  }

  // Compute label poles for kingdoms and empires (average of member poles)
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
