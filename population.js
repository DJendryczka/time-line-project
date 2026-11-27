/* =========================================================
   „Ludzkości przybywa” — szacunek wzrostu liczby ludzi
   Prosty model pokoleniowy (Biblia nie podaje liczb):
   - pokolenie 0: Adam i Ewa,
   - każda para ma `k` dzieci, kolejne pokolenie rodzi się co `g` lat,
   - narodziny pokolenia rozkładają się równo na `g` lat,
   - ludzie żyją ok. 900 lat (Rdz 5).
   ========================================================= */

(function () {
  const LIFESPAN = 900;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const W = 640, H = 240;
  const PAD = { l: 52, r: 14, t: 14, b: 30 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Ułamek pokolenia urodzonego do roku t: pokolenie n rodzi się w latach (n-1)·g … n·g
  // (dzieci Adama i Ewy od 1. roku, ich dzieci od ok. g-tego roku itd.)
  const bornShare = (t, n, g) => (n === 0 ? (t >= 0 ? 1 : 0) : clamp((t - (n - 1) * g) / g));

  function model(t, k, g) {
    let people = 0, families = 0;
    for (let n = 0; (n - 1) * g <= t; n++) {
      const size = n === 0 ? 2 : k * Math.pow(k / 2, n - 1);
      const alive = bornShare(t, n, g) - bornShare(t - LIFESPAN, n, g);
      people += size * alive;
      // Rodzinę zakładają osoby starsze niż pół pokolenia
      families += (size * clamp(bornShare(t - g / 2, n, g) - bornShare(t - LIFESPAN, n, g))) / 2;
      if (n > 60) break;
    }
    return { people, families: Math.max(1, families) };
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function create(event, { ui, tr, lang, formatYear, formatDuration }) {
    const cfg = event.widgetConfig ?? {};
    const startYear = event.yearRange?.[0] ?? -4026;
    const span = cfg.span ?? 930;
    const params = { k: cfg.children ?? 8, g: cfg.generation ?? 100 };
    let selected = span;

    const fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
    const fmtCompact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
    // Miliony i więcej skrótem („1,2 mln”), mniejsze liczby w całości („594 190”)
    const formatCount = (n) => (n >= 1e6 ? fmtCompact.format(n) : fmt.format(Math.round(n)));

    const root = document.createElement("div");
    root.className = "pop";

    /* --- Suwaki --- */
    const controls = document.createElement("div");
    controls.className = "pop__controls";

    function slider(key, label, min, max, step) {
      const wrap = document.createElement("label");
      wrap.className = "pop__slider";
      const head = document.createElement("span");
      head.className = "pop__slider-head";
      const name = document.createElement("span");
      name.textContent = label;
      const value = document.createElement("output");
      value.textContent = params[key];
      head.append(name, value);
      const input = document.createElement("input");
      Object.assign(input, { type: "range", min, max, step, value: params[key] });
      input.addEventListener("input", () => {
        params[key] = Number(input.value);
        value.textContent = input.value;
        update();
      });
      wrap.append(head, input);
      return wrap;
    }

    controls.append(
      slider("k", ui("popChildren"), 2, 10, 1),
      slider("g", ui("popGeneration"), 80, 200, 10)
    );

    /* --- Odczyt --- */
    const readout = document.createElement("div");
    readout.className = "pop__readout";
    readout.setAttribute("aria-live", "polite");

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

    function drawGrid() {
      gGrid.replaceChildren();
      for (let e = 0; e <= yMaxExp; e++) {
        const yy = y(10 ** e);
        gGrid.append(svg("line", { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy }));
        const label = svg("text", { x: PAD.l - 8, y: yy + 4, "text-anchor": "end" });
        label.textContent = formatCount(10 ** e);
        gGrid.append(label);
      }
      for (let t = 0; t <= span; t += 200) {
        const label = svg("text", { x: x(t), y: H - 8, "text-anchor": "middle" });
        label.textContent = String(Math.abs(startYear + t));
        gGrid.append(label);
      }
    }

    function drawMarkers() {
      gMarkers.replaceChildren();
      (cfg.markers ?? []).forEach((m) => {
        const t = Math.abs(startYear) - Math.abs(m.year);
        if (t < 0 || t > span) return;
        gMarkers.append(svg("line", { x1: x(t), x2: x(t), y1: PAD.t, y2: H - PAD.b }));
        const label = svg("text", { x: x(t) + (t > span * 0.85 ? -5 : 5), y: PAD.t + 12, "text-anchor": t > span * 0.85 ? "end" : "start" });
        label.textContent = tr(m.label);
        gMarkers.append(label);
      });
    }

    // Narodziny osób z rodowodu jako kropki przy osi czasu (z podpowiedzią)
    function drawBirths() {
      (cfg.family ?? []).filter((m) => m.marker && m.born <= span).forEach((m) => {
        const c = svg("circle", { cx: x(m.born), cy: H - PAD.b, r: 3.5, class: "pop__birth" });
        const title = svg("title");
        title.textContent = `${tr(m.name)} — ${formatYear(startYear + m.born)}`;
        c.append(title);
        c.addEventListener("click", () => select(m.born));
        gMarkers.append(c);
      });
    }

    function update() {
      const end = model(span, params.k, params.g).people;
      const newExp = Math.max(3, Math.ceil(Math.log10(Math.max(10, end))));
      if (newExp !== yMaxExp) { yMaxExp = newExp; }
      drawGrid();
      drawMarkers();
      drawBirths();

      let d = "";
      for (let t = 0; t <= span; t += 3) {
        d += `${t ? "L" : "M"}${x(t).toFixed(1)},${y(model(t, params.k, params.g).people).toFixed(1)}`;
      }
      line.setAttribute("d", d);
      area.setAttribute("d", `${d}L${x(span)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`);
      select(selected);
    }

    function select(t) {
      selected = Math.round(t);
      const est = model(selected, params.k, params.g);
      // Nie mniej ludzi niż członków rodziny wymienionych poniżej
      const named = (cfg.family ?? []).filter((m) => selected >= m.born && !(m.deadFrom != null && selected >= m.deadFrom)).length;
      const people = Math.max(est.people, named);
      const families = est.families;
      cursor.setAttribute("x1", x(selected));
      cursor.setAttribute("x2", x(selected));
      dot.setAttribute("cx", x(selected));
      dot.setAttribute("cy", y(people));

      readout.replaceChildren();
      const year = document.createElement("p");
      year.className = "pop__year";
      year.textContent = `${formatYear(startYear + selected)} · ${ui("popAfter").replace("{n}", formatDuration(selected))}`;
      const stats = document.createElement("p");
      stats.className = "pop__stats";
      const peopleEl = document.createElement("strong");
      peopleEl.textContent = `~${formatCount(people)}`;
      const famEl = document.createElement("strong");
      famEl.textContent = `~${formatCount(families)}`;
      stats.append(peopleEl, ` ${ui("popPeople")}  ·  `, famEl, ` ${ui("popFamilies")}`);
      // Mężczyźni i kobiety: zakładamy, że chłopców i dziewczynek rodzi się mniej więcej po równo
      // Liczby całkowite, żeby mężczyźni + kobiety = ludzie (np. 5 = 3 + 2)
      const total = Math.round(people);
      const menCount = Math.ceil(total / 2);
      const womenCount = total - menCount;
      const sexes = document.createElement("p");
      sexes.className = "pop__sexes";
      const men = document.createElement("span");
      men.className = "pop__sex pop__sex--men";
      men.textContent = `♂ ~${formatCount(menCount)} ${ui("popMen")}`;
      const women = document.createElement("span");
      women.className = "pop__sex pop__sex--women";
      women.textContent = `♀ ~${formatCount(womenCount)} ${ui("popWomen")}`;
      sexes.append(men, women);

      readout.append(year, stats, sexes, renderFamily(selected));
      chart.setAttribute("aria-label", `${year.textContent}: ${stats.textContent}, ${men.textContent}, ${women.textContent}`);
    }

    /* Wiek członków rodziny Adama w wybranym roku.
       born: rok od stworzenia Adama; exact: wiek znany z Biblii (Adam, Set);
       unknownAfter: od tego roku los nieznany (Abel — zginął przed narodzinami Seta). */
    function renderFamily(t) {
      const box = document.createElement("div");
      box.className = "pop__family";
      const head = document.createElement("p");
      head.className = "pop__family-title";
      head.textContent = ui("popFamilyTitle");
      const list = document.createElement("ul");
      list.className = "pop__family-list";

      // Wszyscy zawsze na liście (nieurodzeni przygaszeni), żeby ramka nie zmieniała wysokości
      (cfg.family ?? []).forEach((m) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.className = "pop__family-name";
        name.textContent = tr(m.name);
        const age = document.createElement("span");
        age.className = "pop__family-age";

        if (t < m.born) {
          age.textContent = "—";
          li.classList.add("is-unborn");
          li.title = `${tr(m.name)}: ${formatYear(startYear + m.born)}`;
        } else if (m.deadFrom != null && t >= m.deadFrom) {
          age.textContent = "†";
          li.classList.add("is-dead");
          li.title = tr(m.deadNote);
        } else {
          const uncertain = m.uncertainFrom != null && t >= m.uncertainFrom;
          age.textContent = `${m.exact ? "" : "~"}${formatDuration(t - m.born)}${uncertain ? " ?" : ""}`;
          if (uncertain) li.title = ui("popIfAlive");
        }
        li.append(name, age);
        list.append(li);
      });

      box.append(head, list);

      if (cfg.cainLine) {
        const cain = document.createElement("p");
        cain.className = "pop__family-extra";
        const label = document.createElement("strong");
        label.textContent = ui("popCainLine");
        cain.append(label, ` ${tr(cfg.cainLine)}`);
        box.append(cain);
      }
      const noah = document.createElement("p");
      noah.className = "pop__family-extra";
      noah.textContent = ui("popNoah");
      box.append(noah);

      const note = document.createElement("p");
      note.className = "pop__family-note";
      note.textContent = `${ui("popSymbols")} ${ui("popFamilyNote")}`;
      box.append(note);
      return box;
    }

    function pointer(e) {
      const rect = chart.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      select(tFromX(px));
    }
    chart.addEventListener("pointermove", pointer);
    chart.addEventListener("pointerdown", (e) => { chart.setPointerCapture(e.pointerId); pointer(e); });

    const hint = document.createElement("p");
    hint.className = "pop__hint";
    hint.textContent = `${ui("popHint")} · ${ui("popNote")} · ${ui("popSexNote")}`;

    root.append(controls, readout, chart, hint);
    update();
    return root;
  }

  window.PopulationWidget = { create, model };
})();
