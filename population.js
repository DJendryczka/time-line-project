/* =========================================================
   „Ludzkości przybywa” — szacunek wzrostu liczby ludzi
   Biblia nie podaje liczb, więc liczymy według prostych, jawnych zasad:
   - Adam i Ewa: najpierw Kain i Abel, potem na przemian córka i syn;
     Set w 130. roku (Rdz 5:3), po nim kolejni synowie i córki (Rdz 5:4),
   - każda para ma `k` dzieci, co 2 lata, na przemian syn i córka,
   - rodzinę zakłada się w wieku `M` lat; najstarszy wolny mężczyzna
     bierze najstarszą wolną kobietę (stąd Kain + 1. córka Adama i Ewy),
   - Abel nie zakłada rodziny i ginie przed narodzinami Seta,
   - ludzie żyją ok. 900 lat (Rdz 5).
   Te same zasady liczą wszystkich (simulate) i wypisują pierwsze osoby (firstPeople),
   więc liczby i lista zawsze się zgadzają.
   ========================================================= */

(function () {
  const LIFESPAN = 900;
  const SPACING = 2;
  const SETH_BORN = 130;
  const ABEL_BORN = 3;
  const ABEL_DEAD = 130;
  const ADAM_DIES = 930;
  const SLOTS = 16; // ile pierwszych urodzonych osób pokazać z „nazwy”
  const MAX_GEN_ROWS = 9; // dalsze pokolenia sumowane w jednym wierszu

  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 640, H = 240;
  const PAD = { l: 52, r: 14, t: 14, b: 30 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const childSex = (i) => (i % 2 === 0 ? "m" : "f");

  /* ---------- Zasady ---------- */

  // Dzieci Adama i Ewy: [{ year, sex, name }]
  function adamChildren(k) {
    const list = [];
    for (let i = 0; i < k; i++) {
      const sex = i < 2 ? "m" : i % 2 === 0 ? "f" : "m";
      list.push({ year: 1 + SPACING * i, sex, name: i === 0 ? "cain" : i === 1 ? "abel" : null });
    }
    list.push({ year: SETH_BORN, sex: "m", name: "seth" });
    for (let i = 0; i < k - 1; i++) {
      list.push({ year: SETH_BORN + SPACING * (i + 1), sex: i % 2 === 0 ? "f" : "m", name: null });
    }
    return list;
  }

  /* ---------- Symulacja wszystkich (grupami, dokładne liczby całkowite) ---------- */

  function simulate(k, M, span) {
    const N = span + 1;
    const gens = [];
    const G = (g) => gens[g] ?? (gens[g] = { m: new Float64Array(N), f: new Float64Array(N) });
    const couples = new Float64Array(N);

    adamChildren(k).forEach((c) => { if (c.year < N) G(1)[c.sex][c.year] += 1; });

    const poolM = [], poolF = []; // kolejki { count, gen } w kolejności wieku
    for (let t = 0; t < N; t++) {
      const by = t - M;
      if (by >= 1) {
        for (let g = 1; g < gens.length; g++) {
          if (!gens[g]) continue;
          let m = gens[g].m[by];
          const f = gens[g].f[by];
          if (g === 1 && by === ABEL_BORN) m -= 1; // Abel nie zakłada rodziny
          if (m > 0) poolM.push({ count: m, gen: g });
          if (f > 0) poolF.push({ count: f, gen: g });
        }
      }
      while (poolM.length && poolF.length) {
        const a = poolM[0], b = poolF[0];
        const c = Math.min(a.count, b.count);
        couples[t] += c;
        for (let i = 0; i < k; i++) {
          const y = t + 1 + SPACING * i;
          if (y < N) G(a.gen + 1)[childSex(i)][y] += c;
        }
        a.count -= c;
        b.count -= c;
        if (a.count <= 0) poolM.shift();
        if (b.count <= 0) poolF.shift();
      }
    }

    // Żyjący w każdym roku: urodzeni w ostatnich LIFESPAN latach
    const alive = (arr) => {
      const out = new Float64Array(N);
      let sum = 0;
      for (let t = 0; t < N; t++) {
        sum += arr[t];
        if (t - LIFESPAN >= 0) sum -= arr[t - LIFESPAN];
        out[t] = sum;
      }
      return out;
    };

    const perGen = gens.map((g) => (g ? { m: alive(g.m), f: alive(g.f) } : { m: new Float64Array(N), f: new Float64Array(N) }));
    perGen[0] = { m: new Float64Array(N).map((_, t) => (t <= ADAM_DIES ? 1 : 0)), f: new Float64Array(N).fill(1) };
    for (let t = ABEL_DEAD; t < N; t++) perGen[1].m[t] -= 1; // Abel nie żyje

    const men = new Float64Array(N), women = new Float64Array(N);
    perGen.forEach((g) => { for (let t = 0; t < N; t++) { men[t] += g.m[t]; women[t] += g.f[t]; } });

    // Rodziny: Adam i Ewa + pary zawarte w ostatnich (LIFESPAN − M) latach
    const families = new Float64Array(N);
    let sum = 0;
    const window = Math.max(1, LIFESPAN - M);
    for (let t = 0; t < N; t++) {
      sum += couples[t];
      if (t - window >= 0) sum -= couples[t - window];
      families[t] = sum + 1;
    }

    return { men, women, families, perGen, span };
  }

  /* ---------- Pierwsze osoby — te same zasady, ale pojedynczo ---------- */

  function firstPeople(k, M, span) {
    const people = [
      { id: 0, sex: "m", born: 0, gen: 0, name: "adam" },
      { id: 1, sex: "f", born: 0, gen: 0, name: "eve" },
    ];
    const scheduled = new Map(); // rok → [{ sex, father, mother, gen, name }]
    const ordinals = new Map(); // ojciec → { m, f }
    const schedule = (year, child) => {
      if (year > span) return;
      if (!scheduled.has(year)) scheduled.set(year, []);
      scheduled.get(year).push(child);
    };
    adamChildren(k).forEach((c) => schedule(c.year, { sex: c.sex, father: 0, mother: 1, gen: 1, name: c.name }));

    const poolM = [], poolF = [];
    let born = 0;
    for (let t = 1; t <= span && born < SLOTS + 1; t++) {
      (scheduled.get(t) ?? []).forEach((c) => {
        const ord = ordinals.get(c.father) ?? { m: 0, f: 0 };
        ord[c.sex] += 1;
        ordinals.set(c.father, ord);
        const person = { id: people.length, born: t, ...c, ord: ord[c.sex] };
        if (c.father === 2 && c.sex === "m" && ord.m === 1) person.name = "henoch"; // Henoch, syn Kaina (Rdz 4:17)
        people.push(person);
        if (person.name !== "seth") born += 1;
      });

      // Ci, którzy osiągnęli wiek założenia rodziny (kolejność jak w simulate: pokolenie, potem narodziny)
      people
        .filter((p) => p.born === t - M && p.gen > 0 && p.name !== "abel")
        .sort((a, b) => a.gen - b.gen || a.id - b.id)
        .forEach((p) => (p.sex === "m" ? poolM : poolF).push(p));

      while (poolM.length && poolF.length) {
        const husband = poolM.shift(), wife = poolF.shift();
        husband.spouse = wife.id;
        wife.spouse = husband.id;
        for (let i = 0; i < k; i++) {
          schedule(t + 1 + SPACING * i, { sex: childSex(i), father: husband.id, mother: wife.id, gen: husband.gen + 1, name: null });
        }
      }
    }

    const seth = people.find((p) => p.name === "seth");
    const slots = people.filter((p) => p.name !== "seth").slice(0, SLOTS + 2);
    return { people, slots, seth };
  }

  /* ---------- Opisy osób w 5 językach ---------- */

  function ordinal(n, sex, lang) {
    switch (lang) {
      case "en": {
        const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
        return `${n}${s}`;
      }
      case "sv": return `${n}:${n % 10 === 1 || n % 10 === 2 ? "a" : "e"}`;
      case "es": return `${n}.${sex === "f" ? "ª" : "º"}`;
      default: return `${n}.`;
    }
  }

  function makeLabeler(kin, names, tr, lang, people) {
    const K = tr(kin);
    const byId = new Map(people.map((p) => [p.id, p]));

    function parentRef(father) {
      if (father.name === "adam") return K.ofAdam;
      if (father.name === "cain") return K.ofCain;
      if (father.name === "seth") return K.ofSeth;
      if (father.name === "henoch") return K.ofHenoch;
      const grand = byId.get(father.father);
      return K.ofSon.replace("{o}", ordinal(father.ord, "m", lang)).replace("{p}", grand ? parentRef(grand) : "");
    }

    return function label(p) {
      if (p.name) return tr(names[p.name]);
      const father = byId.get(p.father);
      const text = (p.sex === "m" ? K.son : K.daughter)
        .replace("{o}", ordinal(p.ord, p.sex, lang))
        .replace("{p}", parentRef(father));
      if (lang === "es") return text.replace(/\bde el\b/g, "del");
      if (lang === "de") return text.replace(/\bvon dem\b/g, "vom");
      return text;
    };
  }

  /* ---------- Widżet ---------- */

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function create(event, { ui, tr, lang, formatYear, formatDuration, i18n }) {
    const cfg = event.widgetConfig ?? {};
    const startYear = event.yearRange?.[0] ?? -4026;
    const span = cfg.span ?? 930;
    const params = { k: cfg.children ?? 6, M: cfg.marriageAge ?? 80 };
    let selected = span;
    let sim = null, first = null, label = null;

    const fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
    const fmtCompact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
    // Miliony i więcej skrótem („1,2 mln”), mniejsze liczby w całości („594 190”)
    const formatCount = (n) => (n >= 1e6 ? fmtCompact.format(n) : fmt.format(Math.round(n)));

    const root = el("div", "pop");

    /* --- Suwaki --- */
    const controls = el("div", "pop__controls");
    function slider(key, labelText, min, max, step) {
      const wrap = el("label", "pop__slider");
      const head = el("span", "pop__slider-head");
      const value = el("output", null, String(params[key]));
      head.append(el("span", null, labelText), value);
      const input = document.createElement("input");
      Object.assign(input, { type: "range", min, max, step, value: params[key] });
      input.addEventListener("input", () => {
        params[key] = Number(input.value);
        value.textContent = input.value;
        recompute();
      });
      wrap.append(head, input);
      return wrap;
    }
    controls.append(
      slider("k", ui("popChildren"), 3, 10, 1),
      slider("M", ui("popMarriage"), 70, 150, 5)
    );

    /* --- Odczyt --- */
    const readout = el("div", "pop__readout");
    readout.setAttribute("aria-live", "polite");
    const yearLine = el("p", "pop__year");
    const stats = el("p", "pop__stats");
    const sexes = el("p", "pop__sexes");
    readout.append(yearLine, stats, sexes);

    /* --- Wykres (skala logarytmiczna) --- */
    const chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "pop__chart", role: "img" });
    const gGrid = svg("g", { class: "pop__grid" });
    const area = svg("path", { class: "pop__area" });
    const line = svg("path", { class: "pop__line" });
    const gMarkers = svg("g", { class: "pop__markers" });
    const cursor = svg("line", { class: "pop__cursor", y1: PAD.t, y2: H - PAD.b });
    const dot = svg("circle", { class: "pop__dot", r: 4.5 });
    chart.append(gGrid, area, line, gMarkers, cursor, dot);

    const x = (t) => PAD.l + (t / span) * (W - PAD.l - PAD.r);
    const tFromX = (px) => clamp((px - PAD.l) / (W - PAD.l - PAD.r)) * span;
    let yMaxExp = 6;
    const y = (n) => H - PAD.b - (Math.log10(Math.max(1, n)) / yMaxExp) * (H - PAD.t - PAD.b);
    const total = (t) => sim.men[t] + sim.women[t];

    const hint = el("p", "pop__hint", `${ui("popHint")} · ${ui("popNote")}`);

    /* --- Ramka: kto żyje w tym roku --- */
    const family = el("div", "pop__family");
    const slotsTitle = el("p", "pop__family-title", ui("popFirstPeople"));
    const slotList = el("ul", "pop__family-list");
    const sethTitle = el("p", "pop__family-title", ui("popSethLine"));
    const sethList = el("ul", "pop__family-list");
    const genTitle = el("p", "pop__family-title", ui("popGenerations"));
    const genTable = el("table", "pop__gens");
    const cainLine = el("p", "pop__family-extra");
    if (cfg.cainLine) cainLine.append(el("strong", null, ui("popCainLine")), ` ${tr(cfg.cainLine)}`);
    const noah = el("p", "pop__family-extra", ui("popNoah"));
    const note = el("p", "pop__family-note", ui("popRules"));
    family.append(slotsTitle, slotList, sethTitle, sethList, genTitle, genTable, cainLine, noah, note);

    root.append(controls, readout, chart, hint, family);

    /* --- Rysowanie --- */

    function drawGrid() {
      gGrid.replaceChildren();
      for (let e = 0; e <= yMaxExp; e++) {
        const yy = y(10 ** e);
        gGrid.append(svg("line", { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy }));
        const t = svg("text", { x: PAD.l - 8, y: yy + 4, "text-anchor": "end" });
        t.textContent = formatCount(10 ** e);
        gGrid.append(t);
      }
      for (let t = 0; t <= span; t += 200) {
        const lbl = svg("text", { x: x(t), y: H - 8, "text-anchor": "middle" });
        lbl.textContent = String(Math.abs(startYear + t));
        gGrid.append(lbl);
      }
    }

    function drawMarkers() {
      gMarkers.replaceChildren();
      (cfg.markers ?? []).forEach((m) => {
        const t = Math.abs(startYear) - Math.abs(m.year);
        if (t < 0 || t > span) return;
        gMarkers.append(svg("line", { x1: x(t), x2: x(t), y1: PAD.t, y2: H - PAD.b }));
        const right = t > span * 0.85;
        const lbl = svg("text", { x: x(t) + (right ? -5 : 5), y: PAD.t + 12, "text-anchor": right ? "end" : "start" });
        lbl.textContent = tr(m.label);
        gMarkers.append(lbl);
      });
      // Narodziny z rodowodu Seta jako kropki przy osi
      (cfg.sethLine ?? []).filter((m) => m.born <= span).forEach((m) => {
        const c = svg("circle", { cx: x(m.born), cy: H - PAD.b, r: 3.5, class: "pop__birth" });
        const title = svg("title");
        title.textContent = `${tr(m.name)} — ${formatYear(startYear + m.born)}`;
        c.append(title);
        c.addEventListener("click", () => select(m.born));
        gMarkers.append(c);
      });
    }

    // Tabela pokoleń: liczba wierszy zależy tylko od suwaków, nie od wybranego roku
    let genRows = [];
    function buildGenTable() {
      const lastGen = sim.perGen.reduce((acc, g, i) => (g.m[span] + g.f[span] > 0 || g.m.some((v) => v > 0) ? i : acc), 0);
      const rowsCount = Math.min(lastGen, MAX_GEN_ROWS) + 1;
      genTable.replaceChildren();
      const head = el("tr");
      ["popGeneration", "popMenShort", "popWomenShort", "popTotal"].forEach((key) => head.append(el("th", null, ui(key))));
      const thead = el("thead");
      thead.append(head);
      const tbody = el("tbody");
      genRows = [];
      for (let r = 0; r < rowsCount; r++) {
        const tr_ = el("tr");
        const names = i18n.generations;
        let name;
        if (r < rowsCount - 1 || lastGen <= MAX_GEN_ROWS) {
          name = r < names.length ? tr(names[r]) : tr(i18n.generationN).replace("{n}", r);
        } else {
          name = tr(i18n.generationsMore).replace("{n}", r);
        }
        const cells = [el("td", null, name), el("td"), el("td"), el("td")];
        tr_.append(...cells);
        tbody.append(tr_);
        genRows.push({ row: tr_, cells, from: r, to: r < rowsCount - 1 || lastGen <= MAX_GEN_ROWS ? r : lastGen });
      }
      genTable.append(thead, tbody);
    }

    function updateGenTable(t) {
      genRows.forEach(({ row, cells, from, to }) => {
        let m = 0, f = 0;
        for (let g = from; g <= to; g++) {
          if (!sim.perGen[g]) continue;
          m += sim.perGen[g].m[t];
          f += sim.perGen[g].f[t];
        }
        cells[1].textContent = m ? formatCount(m) : "—";
        cells[2].textContent = f ? formatCount(f) : "—";
        cells[3].textContent = m + f ? formatCount(m + f) : "—";
        row.classList.toggle("is-empty", m + f === 0);
      });
    }

    // Pierwsze osoby: stała lista, zmienia się tylko wiek i przygaszenie
    let slotItems = [];
    function buildSlots() {
      slotList.replaceChildren();
      slotItems = first.slots.map((p) => {
        const li = el("li");
        const name = el("span", "pop__family-name", label(p));
        const age = el("span", "pop__family-age");
        li.append(name, age);
        if (p.spouse != null) {
          const spouse = first.people.find((q) => q.id === p.spouse);
          if (spouse) li.title = `${label(p)} — ${ui("popSpouse")}: ${label(spouse)}`;
        }
        slotList.append(li);
        return { p, li, age };
      });

      sethList.replaceChildren();
      const sethItems = (cfg.sethLine ?? []).map((m) => {
        const li = el("li");
        const age = el("span", "pop__family-age");
        li.append(el("span", "pop__family-name", tr(m.name)), age);
        sethList.append(li);
        return { p: { born: m.born, exact: true }, li, age };
      });
      slotItems = slotItems.concat(sethItems);
    }

    function updateSlots(t) {
      slotItems.forEach(({ p, li, age }) => {
        li.classList.remove("is-unborn", "is-dead");
        if (t < p.born) {
          age.textContent = "—";
          li.classList.add("is-unborn");
        } else if (p.name === "abel" && t >= ABEL_DEAD) {
          age.textContent = ui("popDead");
          li.classList.add("is-dead");
        } else {
          const exact = p.exact || p.name === "adam";
          age.textContent = `${exact ? "" : "~"}${formatDuration(t - p.born)}${p.name === "abel" ? " ?" : ""}`;
        }
      });
    }

    function recompute() {
      sim = simulate(params.k, params.M, span);
      first = firstPeople(params.k, params.M, span);
      label = makeLabeler(i18n.kin, i18n.names, tr, lang, first.people);

      const end = total(span);
      yMaxExp = Math.max(3, Math.ceil(Math.log10(Math.max(10, end))));
      drawGrid();
      drawMarkers();
      let d = "";
      for (let t = 0; t <= span; t += 3) {
        d += `${t ? "L" : "M"}${x(t).toFixed(1)},${y(total(t)).toFixed(1)}`;
      }
      d += `L${x(span).toFixed(1)},${y(end).toFixed(1)}`;
      line.setAttribute("d", d);
      area.setAttribute("d", `${d}L${x(span)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`);

      buildGenTable();
      buildSlots();
      select(selected);
    }

    function select(t) {
      selected = Math.round(clamp(t, 0, span));
      const men = sim.men[selected], women = sim.women[selected];
      const people = men + women;
      cursor.setAttribute("x1", x(selected));
      cursor.setAttribute("x2", x(selected));
      dot.setAttribute("cx", x(selected));
      dot.setAttribute("cy", y(people));

      yearLine.textContent = `${formatYear(startYear + selected)} · ${ui("popAfter").replace("{n}", formatDuration(selected))}`;
      stats.replaceChildren(
        el("strong", null, `~${formatCount(people)}`), ` ${ui("popPeople")}  ·  `,
        el("strong", null, `~${formatCount(sim.families[selected])}`), ` ${ui("popFamilies")}`
      );
      sexes.replaceChildren(
        el("span", "pop__sex pop__sex--men", `♂ ~${formatCount(men)} ${ui("popMen")}`),
        el("span", "pop__sex pop__sex--women", `♀ ~${formatCount(women)} ${ui("popWomen")}`)
      );
      chart.setAttribute("aria-label", `${yearLine.textContent}: ${stats.textContent}, ${sexes.textContent}`);

      updateSlots(selected);
      updateGenTable(selected);
    }

    function pointer(e) {
      const rect = chart.getBoundingClientRect();
      select(tFromX(((e.clientX - rect.left) / rect.width) * W));
    }
    chart.addEventListener("pointermove", pointer);
    chart.addEventListener("pointerdown", (e) => { chart.setPointerCapture(e.pointerId); pointer(e); });

    recompute();
    return root;
  }

  window.PopulationWidget = { create, simulate, firstPeople, makeLabeler };
})();
