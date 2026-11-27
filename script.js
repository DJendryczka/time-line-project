/* =========================================================
   Biblijna oś czasu — renderowanie z data/events.json
   Języki: data/i18n.json (PL, EN, SV, DE, ES)
   Lata: ujemne = p.n.e., dodatnie = n.e., null = czas nieokreślony
   ========================================================= */

const EVENTS_URL = "data/events.json";
const I18N_URL = "data/i18n.json";
const DEFAULT_LANG = "pl";
const STORAGE_KEY = "timeline-lang";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  lang: DEFAULT_LANG,
  i18n: null,
  data: null,
  observers: [],
  scenes: [],
};

/* ---------- Tłumaczenia ---------- */

// Wybiera tekst w bieżącym języku z obiektu { pl, en, … }; zapas: polski
function tr(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[state.lang] ?? value[DEFAULT_LANG] ?? "";
}

const ui = (key) => tr(state.i18n?.ui?.[key]);

function detectLanguage(supported) {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl && supported.includes(fromUrl)) return fromUrl;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && supported.includes(saved)) return saved;
  } catch { /* localStorage niedostępny */ }

  const browser = (navigator.language || "").slice(0, 2).toLowerCase();
  return supported.includes(browser) ? browser : DEFAULT_LANG;
}

/* ---------- Lata ---------- */

// Rachuba astronomiczna (1 p.n.e. = 0), żeby różnice lat były poprawne
const toAstro = (year) => (year < 0 ? year + 1 : year);
const yearsBetween = (a, b) => Math.abs(toAstro(b) - toAstro(a));
const isDated = (year) => typeof year === "number";

function formatYear(year, approx = false) {
  if (!isDated(year)) return ui("undated");
  const y = state.i18n.years;
  const suffix = tr(year < 0 ? y.bce : y.ce);
  const prefix = approx ? `${tr(y.approx)} ` : "";
  return `${prefix}${Math.abs(year)} ${suffix}`;
}

function formatRange(start, end) {
  if (!isDated(start) || !isDated(end)) return ui("undated");
  const y = state.i18n.years;
  if (start < 0 && end < 0) return `${Math.abs(start)}–${Math.abs(end)} ${tr(y.bce)}`;
  return `${formatYear(start)} – ${formatYear(end)}`;
}

// „1656 lat”, „22 lata”, „1 year”… — reguły odmiany z Intl.PluralRules
function formatDuration(n) {
  const forms = state.i18n.years.plural[state.lang] ?? state.i18n.years.plural[DEFAULT_LANG];
  const category = new Intl.PluralRules(state.lang).select(n);
  return `${n} ${forms[category] ?? forms.other}`;
}

// „gen 1:3-5” → „Rdz 1:3–5” (skrót księgi w bieżącym języku)
function formatRef(ref) {
  const match = ref.match(/^(\S+)\s+(.+)$/);
  if (!match) return ref;
  const [, code, verses] = match;
  const book = state.i18n.books[code];
  return `${book ? tr(book) : code} ${verses.replace(/-/g, "–")}`;
}

// Odstęp między wydarzeniami rośnie z liczbą lat (pierwiastek, żeby nie przesadzić)
function gapForYears(years) {
  const rem = 1.5 + Math.sqrt(years) * 0.45;
  return `${Math.min(rem, 12).toFixed(2)}rem`;
}

/* ---------- Tworzenie elementów ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderEvent(event, prev) {
  const dated = isDated(event.year);
  const li = el("li", `event reveal${dated ? "" : " event--undated"}`);

  if (prev && dated && isDated(prev.year)) {
    li.style.setProperty("--gap", gapForYears(yearsBetween(prev.year, event.year)));
  }

  li.append(buildCard(event, "event__card"));
  return li;
}

// Karta wydarzenia: rok, tytuł, opis, wersety
function buildCard(event, className) {
  const card = el("article", className);
  const dated = isDated(event.year);
  const year = el(dated ? "time" : "p", "event__year", formatYear(event.year, event.approx));
  if (dated) year.dateTime = String(event.year);

  card.append(year, el("h3", "event__title", tr(event.title)));

  const desc = tr(event.description);
  if (desc) card.append(el("p", "event__desc", desc));
  appendRefs(card, event.refs);
  return card;
}

function appendRefs(card, refsData) {
  if (!refsData?.length) return;
  const refs = el("ul", "event__refs");
  refs.setAttribute("aria-label", ui("versesLabel"));
  refsData.forEach((ref) => refs.append(el("li", null, formatRef(ref))));
  card.append(refs);
}

/* ---------- Scena kosmosu (animacja sterowana przewijaniem) ----------
   Kolejne wydarzenia z "scene": "cosmos" tworzą jeden blok: przyklejone płótno
   w tle i karty przewijane nad nim. Każda karta = jeden etap animacji. */

function renderCosmos(events) {
  const steps = [];
  events.forEach((event) => {
    steps.push({ state: event.sceneState, image: event.image, card: buildCard(event, "cosmos__card event--undated") });
    (event.stages ?? []).forEach((stage) => {
      const card = el("article", "cosmos__card cosmos__card--stage");
      card.append(el("h3", "event__title", tr(stage.title)), el("p", "event__desc", tr(stage.text)));
      appendRefs(card, stage.refs);
      steps.push({ state: stage.state, card });
    });
  });

  const li = el("li", "cosmos-item");
  const root = el("div", "cosmos");
  root.dataset.states = steps.map((s) => s.state).join(",");

  const stage = el("div", "cosmos__stage");
  const canvas = el("canvas", "cosmos__canvas");
  canvas.setAttribute("aria-hidden", "true");
  stage.append(canvas, el("p", "cosmos__note", ui("sceneNote")));
  root.append(stage);

  steps.forEach(({ card, image }) => {
    const step = el("div", "cosmos__step");
    if (image) step.dataset.image = image; // obraz zamiast animacji (cosmos.js)
    step.append(card);
    root.append(step);
  });

  li.append(root);
  return li;
}

function renderEra(era) {
  const section = el("section", "era");
  section.id = era.id;
  section.dataset.color = era.color;
  section.dataset.accent = era.accent;
  section.setAttribute("aria-labelledby", `${era.id}-title`);

  const header = el("header", "era__header reveal");
  const title = el("h2", "era__title", tr(era.title));
  title.id = `${era.id}-title`;

  header.append(el("p", "era__range", formatRange(era.start, era.end)), title);
  if (era.subtitle) header.append(el("p", "era__subtitle", tr(era.subtitle)));
  if (era.summary) header.append(el("p", "era__summary", tr(era.summary)));
  if (isDated(era.start) && isDated(era.end)) {
    header.append(el("span", "era__duration", formatDuration(yearsBetween(era.start, era.end))));
  }

  // Kolejność jak w pliku danych (wydarzeń bez dat nie da się sortować)
  const list = el("ol", "era__events");
  const events = era.events ?? [];
  for (let i = 0; i < events.length; i++) {
    const scene = events[i].scene;
    if (scene && window.Cosmos) {
      // Zbierz wszystkie kolejne wydarzenia tej samej sceny
      const group = [];
      while (i < events.length && events[i].scene === scene) group.push(events[i++]);
      i--;
      list.append(renderCosmos(group));
    } else {
      list.append(renderEvent(events[i], events[i - 1]));
    }
  }

  section.append(header, list);
  return section;
}

function renderTimeline(container) {
  const fragment = document.createDocumentFragment();
  state.data.eras.forEach((era) => fragment.append(renderEra(era)));
  container.replaceChildren(fragment);
}

/* ---------- Teksty statyczne i przełącznik języka ---------- */

function applyStaticTexts() {
  document.documentElement.lang = state.lang;
  document.title = ui("docTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = ui(node.dataset.i18n);
  });
}

function renderLanguageSwitch() {
  const nav = document.getElementById("lang-switch");
  if (!nav) return;
  nav.setAttribute("aria-label", ui("languageLabel"));
  nav.replaceChildren(
    ...Object.entries(state.i18n.languages).map(([code, name]) => {
      const btn = el("button", "lang-switch__btn", code.toUpperCase());
      btn.type = "button";
      btn.lang = code;
      btn.title = name;
      btn.setAttribute("aria-pressed", String(code === state.lang));
      btn.addEventListener("click", () => setLanguage(code));
      return btn;
    })
  );
}

function setLanguage(lang) {
  if (lang === state.lang) return;
  state.lang = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignoruj */ }

  const url = new URL(location.href);
  url.searchParams.set("lang", lang);
  history.replaceState(null, "", url);

  // Zachowaj pozycję względem epoki widocznej na środku ekranu
  const anchor = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest(".era");
  const offset = anchor ? anchor.getBoundingClientRect().top : null;

  applyStaticTexts();
  renderLanguageSwitch();
  mountTimeline({ animate: false });

  if (anchor && offset != null) {
    const again = document.getElementById(anchor.id);
    if (again) window.scrollBy(0, again.getBoundingClientRect().top - offset);
  }
}

/* ---------- Kolory tła per epoka ---------- */

function setTheme(color, accent) {
  const root = document.documentElement.style;
  if (color) root.setProperty("--page-bg", color);
  if (accent) root.setProperty("--accent", accent);
}

function watchEras(container) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setTheme(entry.target.dataset.color, entry.target.dataset.accent);
      });
    },
    // Epoka „aktywna”, gdy przecina środek ekranu
    { rootMargin: "-50% 0px -50% 0px" }
  );
  container.querySelectorAll(".era").forEach((era) => observer.observe(era));
  const intro = document.getElementById("intro"); // powrót do intro = kolory startowe
  if (intro) observer.observe(intro);
  state.observers.push(observer);
}

/* ---------- Pojawianie się przy przewijaniu ---------- */

function watchReveals(container, animate) {
  const items = container.querySelectorAll(".reveal");
  if (prefersReducedMotion || !animate) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  items.forEach((item) => observer.observe(item));
  state.observers.push(observer);
}

function mountTimeline({ animate = true } = {}) {
  state.observers.forEach((o) => o.disconnect());
  state.observers = [];
  state.scenes.forEach((scene) => scene.destroy());
  const container = document.getElementById("timeline");
  renderTimeline(container);
  state.scenes = [...container.querySelectorAll(".cosmos")].map((root) => window.Cosmos.mount(root));
  watchEras(container);
  watchReveals(container, animate);
}

/* ---------- Paralaksa intro ---------- */

function initParallax() {
  const intro = document.getElementById("intro");
  if (!intro || prefersReducedMotion) return;

  const layers = intro.querySelectorAll("[data-speed]");
  const content = intro.querySelector(".intro__content");
  let ticking = false;

  function update() {
    const y = window.scrollY;
    const h = intro.offsetHeight;
    if (y <= h) {
      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed) || 0;
        layer.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });
      if (content) content.style.opacity = String(Math.max(0, 1 - y / (h * 0.7)));
    }
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

/* ---------- Start ---------- */

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function showError(error) {
  console.error(error);
  const container = document.getElementById("timeline");
  const msg = el("p", "timeline__status timeline__status--error");
  // Gdy i18n się nie wczytało, komunikat po polsku
  msg.textContent = location.protocol === "file:"
    ? (state.i18n ? ui("errorFile") : "Uruchom stronę przez lokalny serwer (np. Live Server w VS Code).")
    : (state.i18n ? ui("errorGeneric") : "Nie udało się wczytać osi czasu.");
  container.replaceChildren(msg);
}

async function init() {
  initParallax();
  try {
    const [i18n, data] = await Promise.all([fetchJson(I18N_URL), fetchJson(EVENTS_URL)]);
    state.i18n = i18n;
    state.data = data;
    state.lang = detectLanguage(Object.keys(i18n.languages));

    applyStaticTexts();
    renderLanguageSwitch();
    mountTimeline();
  } catch (error) {
    showError(error);
  }
}

init();
