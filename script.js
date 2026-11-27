/* =========================================================
   Biblijna oś czasu — renderowanie z data/events.json
   Konwencja lat: ujemne = p.n.e., dodatnie = n.e. (bez roku 0)
   ========================================================= */

const DATA_URL = "data/events.json";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Pomocnicze: lata ---------- */

// Zamiana na rachubę astronomiczną (1 p.n.e. = 0), żeby różnice lat były poprawne
const toAstro = (year) => (year < 0 ? year + 1 : year);

const yearsBetween = (a, b) => Math.abs(toAstro(b) - toAstro(a));

function formatYear(year, approx = false) {
  const prefix = approx ? "ok. " : "";
  return year < 0 ? `${prefix}${Math.abs(year)} p.n.e.` : `${prefix}${year} n.e.`;
}

// Polska odmiana: 1 rok, 2–4 lata, 5+ lat (ale 12–14 lat, 22 lata…)
function pluralYears(n) {
  if (n === 1) return "1 rok";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} lata`;
  return `${n} lat`;
}

function formatRange(start, end) {
  // Obie daty p.n.e. → "4026–2370 p.n.e."
  if (start < 0 && end < 0) return `${Math.abs(start)}–${Math.abs(end)} p.n.e.`;
  return `${formatYear(start)} – ${formatYear(end)}`;
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

function renderEvent(event, prevYear) {
  const li = el("li", "event reveal");
  if (prevYear != null) {
    li.style.setProperty("--gap", gapForYears(yearsBetween(prevYear, event.year)));
  }

  const card = el("article", "event__card");
  const year = el("time", "event__year", formatYear(event.year, event.approx));
  year.dateTime = String(event.year);

  card.append(year, el("h3", "event__title", event.title));

  if (event.description) card.append(el("p", "event__desc", event.description));

  if (event.refs?.length) {
    const refs = el("ul", "event__refs");
    refs.setAttribute("aria-label", "Wersety");
    event.refs.forEach((ref) => refs.append(el("li", null, ref)));
    card.append(refs);
  }

  li.append(card);
  return li;
}

function renderEra(era) {
  const section = el("section", "era");
  section.id = era.id;
  section.dataset.color = era.color;
  section.dataset.accent = era.accent;
  section.setAttribute("aria-labelledby", `${era.id}-title`);

  const header = el("header", "era__header reveal");
  const title = el("h2", "era__title", era.title);
  title.id = `${era.id}-title`;

  header.append(el("p", "era__range", formatRange(era.start, era.end)), title);
  if (era.subtitle) header.append(el("p", "era__subtitle", era.subtitle));
  if (era.summary) header.append(el("p", "era__summary", era.summary));
  header.append(el("span", "era__duration", pluralYears(yearsBetween(era.start, era.end))));

  const list = el("ol", "era__events");
  const events = [...(era.events ?? [])].sort((a, b) => a.year - b.year);
  events.forEach((event, i) => {
    list.append(renderEvent(event, i > 0 ? events[i - 1].year : null));
  });

  section.append(header, list);
  return section;
}

function renderTimeline(container, data) {
  const fragment = document.createDocumentFragment();
  const eras = [...data.eras].sort((a, b) => a.start - b.start);
  eras.forEach((era) => fragment.append(renderEra(era)));
  container.replaceChildren(fragment);
  return eras;
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
        if (entry.isIntersecting) {
          const { color, accent } = entry.target.dataset;
          setTheme(color, accent);
        }
      });
    },
    // Epoka „aktywna”, gdy przecina środek ekranu
    { rootMargin: "-50% 0px -50% 0px" }
  );
  container.querySelectorAll(".era").forEach((era) => observer.observe(era));
  // Powrót do intro przywraca kolory startowe
  const intro = document.getElementById("intro");
  if (intro) observer.observe(intro);
}

/* ---------- Pojawianie się przy przewijaniu ---------- */

function watchReveals(container) {
  const items = container.querySelectorAll(".reveal");
  if (prefersReducedMotion) {
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

async function loadData() {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function showError(container, error) {
  console.error(error);
  const msg = el("p", "timeline__status timeline__status--error");
  msg.textContent =
    location.protocol === "file:"
      ? "Nie można wczytać danych z pliku otwartego bezpośrednio. Uruchom stronę przez lokalny serwer (np. Live Server w VS Code)."
      : "Nie udało się wczytać osi czasu. Spróbuj odświeżyć stronę.";
  container.replaceChildren(msg);
}

async function init() {
  initParallax();

  const container = document.getElementById("timeline");
  try {
    const data = await loadData();
    renderTimeline(container, data);
    watchEras(container);
    watchReveals(container);
  } catch (error) {
    showError(container, error);
  }
}

init();
