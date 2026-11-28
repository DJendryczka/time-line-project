/* =========================================================
   „Kto wtedy żył?” — panel z paskami życia (Rdz 5 i 11)
   Rok bieżący wynika z pozycji przewijania: elementy osi z data-year
   (wydarzenia i nagłówki epok) są punktami odniesienia, a rok między nimi
   jest interpolowany. Panel pokazuje tylko osoby żyjące w tym roku.
   ========================================================= */

(function () {
  const STORAGE_KEY = "timeline-lifespans-open";
  const WIDE = window.matchMedia("(min-width: 1100px)");

  // Rachuba astronomiczna (bez roku 0) — tak jak w script.js
  const toAstro = (y) => (y < 0 ? y + 1 : y);
  const diff = (a, b) => toAstro(b) - toAstro(a);

  let current = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function readOpen() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v != null) return v === "1";
    } catch { /* brak localStorage */ }
    return WIDE.matches; // na dużym ekranie domyślnie otwarty
  }

  function saveOpen(open) {
    try { localStorage.setItem(STORAGE_KEY, open ? "1" : "0"); } catch { /* ignoruj */ }
  }

  // Rok na środku ekranu na podstawie elementów z data-year
  function yearAtCenter(container) {
    const mid = window.innerHeight / 2;
    const anchors = [...container.querySelectorAll("[data-year]")]
      .map((node) => {
        const r = node.getBoundingClientRect();
        return { y: r.top + r.height / 2, year: Number(node.dataset.year) };
      })
      .filter((a) => Number.isFinite(a.year));
    if (!anchors.length) return null;

    // Przed pierwszym punktem z datą (np. epoka stwarzania) — brak roku
    if (mid < anchors[0].y - window.innerHeight * 0.35) return null;

    let prev = anchors[0];
    for (const a of anchors) {
      if (a.y > mid) {
        if (a === prev) return prev.year;
        const f = Math.min(1, Math.max(0, (mid - prev.y) / (a.y - prev.y)));
        return Math.round(prev.year + (a.year - prev.year) * f);
      }
      prev = a;
    }
    return prev.year;
  }

  function mount(container, { data, ui, tr, formatYear, formatDuration, adamYears }) {
    current?.destroy();
    if (!data?.people?.length) return;

    const [rangeFrom, rangeTo] = data.range;
    const maxLife = Math.max(...data.people.map((p) => diff(p.born, p.died)));

    const panel = el("aside", "lifespans");
    panel.setAttribute("aria-label", ui("lifeTitle"));

    const toggle = el("button", "lifespans__toggle");
    toggle.type = "button";
    const body = el("div", "lifespans__body");
    body.id = "lifespans-body";
    toggle.setAttribute("aria-controls", body.id);

    const head = el("div", "lifespans__head");
    const title = el("p", "lifespans__title", ui("lifeTitle"));
    const close = el("button", "lifespans__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", ui("lifeClose"));
    close.title = ui("lifeClose");
    head.append(title, close);

    const yearBox = el("div", "lifespans__year");
    const yearMain = el("p", "lifespans__year-main");
    const yearAdam = el("p", "lifespans__year-adam");
    yearBox.append(yearMain, yearAdam);

    const list = el("ul", "lifespans__list");
    const rows = data.people.map((p) => {
      const life = diff(p.born, p.died);
      const li = el("li", "lifespans__row");
      li.title = `${tr(p.name)}: ${formatYear(p.born)} – ${formatYear(p.died)} · ${ui("lifeLifespan").replace("{n}", formatDuration(life))}`;
      const top = el("div", "lifespans__row-top");
      const name = el("span", "lifespans__name", tr(p.name));
      const age = el("span", "lifespans__age");
      top.append(name, age);
      const track = el("div", "lifespans__track");
      track.style.width = `${(life / maxLife) * 100}%`;
      const fill = el("div", "lifespans__fill");
      track.append(fill);
      li.append(top, track);
      list.append(li);
      return { p, li, age, fill, life };
    });

    const noteBox = el("p", "lifespans__event");
    const foot = el("p", "lifespans__note", ui("lifeNote"));

    body.append(head, yearBox, list, noteBox, foot);
    panel.append(toggle, body);
    document.body.append(panel);

    let open = readOpen();
    function setOpen(value, persist = true) {
      open = value;
      panel.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("lifespans-docked", open && WIDE.matches);
      if (persist) saveOpen(open);
    }
    toggle.addEventListener("click", () => setOpen(!open));
    close.addEventListener("click", () => setOpen(false));
    setOpen(open, false);

    function render(year) {
      const inRange = year != null && year >= rangeFrom && year <= rangeTo;
      panel.classList.toggle("is-visible", inRange);
      if (!inRange) return;

      yearMain.textContent = formatYear(year);
      yearAdam.textContent = adamYears(year);
      toggle.textContent = `${ui("lifeToggle")} · ${formatYear(year)}`;

      rows.forEach(({ p, li, age, fill, life }) => {
        const alive = year >= p.born && year <= p.died;
        li.hidden = !alive;
        if (!alive) return;
        const lived = diff(p.born, year);
        age.textContent = formatDuration(lived);
        fill.style.width = `${(lived / life) * 100}%`;
      });

      const note = (data.notes ?? []).find((n) => year >= n.from && year <= n.to);
      noteBox.hidden = !note;
      if (note) noteBox.textContent = tr(note.text);
    }

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        render(yearAtCenter(container));
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    current = {
      destroy() {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        panel.remove();
        document.body.classList.remove("lifespans-docked");
      },
    };
  }

  window.Lifespans = { mount, yearAtCenter };
})();
