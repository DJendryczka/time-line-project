/* =========================================================
   Kosmos — animacja cząstek sterowana przewijaniem
   Etapy (nazwy z data/events.json → sceneState / stages[].state):
   void → quarks → hadrons → atoms → stars → galaxies → solar → earth
   Te same cząstki płynnie przechodzą z jednego układu w następny.
   ========================================================= */

(function () {
  const TAU = Math.PI * 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Pomocnicze ---------- */

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  // Deterministyczny „los” dla grup (atom nr 12, gwiazda nr 5…)
  const hash = (n, k) => {
    const s = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  const QUARK_COLORS = [
    [255, 95, 95],
    [95, 230, 140],
    [110, 150, 255],
  ];

  const PLANETS = [
    { r: 0.2, size: 0.012, color: [180, 170, 160] }, // Merkury
    { r: 0.27, size: 0.017, color: [235, 200, 140] }, // Wenus
    { r: 0.35, size: 0.018, color: [80, 140, 255] }, // Ziemia
    { r: 0.43, size: 0.014, color: [225, 110, 70] }, // Mars
    { r: 0.58, size: 0.042, color: [225, 185, 140] }, // Jowisz
    { r: 0.72, size: 0.036, color: [235, 215, 160] }, // Saturn
    { r: 0.85, size: 0.026, color: [150, 215, 230] }, // Uran
    { r: 0.96, size: 0.025, color: [95, 125, 245] }, // Neptun
  ];
  const ORBIT_TILT = 0.42; // spłaszczenie orbit (widok z ukosa)

  const GALAXIES = [
    { x: -0.05, y: 0.02, R: 0.78, tilt: 0.48, rot: 0.4, dir: 1 },
    { x: -1.0, y: -0.6, R: 0.3, tilt: 0.8, rot: 2.1, dir: -1 },
    { x: 1.0, y: 0.62, R: 0.36, tilt: 0.36, rot: 1.0, dir: 1 },
    { x: 0.95, y: -0.72, R: 0.22, tilt: 0.6, rot: -0.5, dir: 1 },
    { x: -0.9, y: 0.78, R: 0.25, tilt: 0.5, rot: 2.6, dir: -1 },
  ];

  const STAR_CLUSTERS = 70;

  /* ---------- Układy cząstek dla każdego etapu ----------
     Każda funkcja zapisuje do `o`: x, y (jednostki: 1 = pół krótszego boku ekranu),
     s (rozmiar w px), r, g, b, a (krycie). `v` = { ax, ay } — zasięg ekranu w jednostkach. */

  function backgroundStar(p, t, v, o) {
    o.x = (p.r1 * 2 - 1) * v.ax;
    o.y = (p.r2 * 2 - 1) * v.ay;
    o.s = 0.7;
    o.r = 255; o.g = 255; o.b = 255;
    o.a = 0.25 + 0.25 * Math.sin(t * 1.5 + p.r3 * 40);
  }

  const STATES = {
    // Punkt światła — przed „wybuchem” stworzenia
    void(p, t, v, o) {
      const pulse = 1 + 0.25 * Math.sin(t * 2);
      o.x = (p.r1 - 0.5) * 0.012 * pulse;
      o.y = (p.r2 - 0.5) * 0.012 * pulse;
      o.s = 1;
      o.r = 255; o.g = 245; o.b = 230;
      o.a = 0.6;
    },

    // Gorąca „zupa” kwarków wypełniająca cały ekran
    quarks(p, t, v, o) {
      o.x = (p.r1 * 2 - 1) * v.ax + Math.sin(t * 9 + p.r3 * 60) * 0.012;
      o.y = (p.r2 * 2 - 1) * v.ay + Math.cos(t * 8 + p.r4 * 60) * 0.012;
      o.s = 1.3;
      [o.r, o.g, o.b] = QUARK_COLORS[p.i % 3];
      o.a = 0.85;
    },

    // Trójki kwarków = protony i neutrony
    hadrons(p, t, v, o) {
      const g = Math.floor(p.i / 3);
      const k = p.i % 3;
      const ang = k * (TAU / 3) + t * 3 + hash(g, 9) * TAU;
      o.x = (hash(g, 7) * 2 - 1) * v.ax + Math.cos(ang) * 0.009;
      o.y = (hash(g, 8) * 2 - 1) * v.ay + Math.sin(ang) * 0.009;
      o.s = 1.4;
      [o.r, o.g, o.b] = QUARK_COLORS[k];
      o.a = 0.9;
    },

    // Jądro + krążące elektrony
    atoms(p, t, v, o) {
      const a = Math.floor(p.i / 8);
      const k = p.i % 8;
      const cx = (hash(a, 4) * 2 - 1) * v.ax;
      const cy = (hash(a, 5) * 2 - 1) * v.ay;
      if (k < 2) {
        o.x = cx + (k ? 0.004 : -0.004);
        o.y = cy;
        o.s = 1.7;
        o.r = 255; o.g = 190; o.b = 140;
        o.a = 0.95;
      } else {
        const rad = 0.022 + 0.009 * (k % 3);
        const speed = (k % 2 ? 1 : -1) * (2 + k * 0.3);
        const ang = t * speed + k * 1.1 + hash(a, 6) * TAU;
        o.x = cx + Math.cos(ang) * rad;
        o.y = cy + Math.sin(ang) * rad * 0.55;
        o.s = 1;
        o.r = 130; o.g = 200; o.b = 255;
        o.a = 0.75;
      }
    },

    // Obłoki gazu zapadają się w gwiazdy
    stars(p, t, v, o) {
      const s = p.i % STAR_CLUSTERS;
      const rad = 0.035 * p.r2 * p.r2;
      o.x = (hash(s, 1) * 2 - 1) * v.ax * 0.95 + Math.cos(p.r1 * TAU) * rad;
      o.y = (hash(s, 2) * 2 - 1) * v.ay * 0.95 + Math.sin(p.r1 * TAU) * rad;
      o.s = 1.2;
      const temp = hash(s, 3);
      if (temp < 0.3) { o.r = 170; o.g = 200; o.b = 255; }
      else if (temp < 0.7) { o.r = 255; o.g = 245; o.b = 220; }
      else { o.r = 255; o.g = 180; o.b = 110; }
      o.a = 0.8 + 0.2 * Math.sin(t * 3 + s);
    },

    // Wirujące galaktyki spiralne
    galaxies(p, t, v, o) {
      const gal = GALAXIES[p.r6 < 0.55 ? 0 : 1 + (p.i % 4)];
      let rr = Math.pow(p.r2, 0.8) * gal.R;
      if (p.r3 < 0.15) rr *= 0.22; // jasne jądro
      const rel = rr / gal.R;
      const arm = (p.i % 2) * Math.PI;
      const ang = arm + rel * 4.2 + (p.r4 - 0.5) * 0.55 + (t * 0.12 * gal.dir) / (0.25 + rel);
      const lx = Math.cos(ang) * rr;
      const ly = Math.sin(ang) * rr * gal.tilt;
      const c = Math.cos(gal.rot), sn = Math.sin(gal.rot);
      // Na wąskim (pionowym) ekranie mniejsze galaktyki zbliżają się do środka
      o.x = gal.x * Math.min(1, v.ax * 0.8) + lx * c - ly * sn;
      o.y = gal.y * Math.min(1, v.ay) + lx * sn + ly * c;
      o.s = 1.1;
      o.r = lerp(255, 150, rel);
      o.g = lerp(225, 180, rel);
      o.b = lerp(170, 255, rel);
      o.a = 0.85;
    },

    // Słońce i planety
    solar(p, t, v, o) {
      if (p.r6 < 0.25) {
        const rad = 0.1 * Math.sqrt(p.r2);
        o.x = Math.cos(p.r1 * TAU) * rad;
        o.y = Math.sin(p.r1 * TAU) * rad;
        o.s = 1.8;
        o.r = 255; o.g = 185 + p.r3 * 55; o.b = 80;
        o.a = 0.75 + 0.25 * Math.sin(t * 4 + p.r4 * 30);
      } else if (p.r6 < 0.45) {
        const pl = PLANETS[Math.floor(p.r4 * PLANETS.length)];
        const idx = PLANETS.indexOf(pl);
        const ang = idx * 1.7 + (t * 0.25) / Math.pow(pl.r, 1.5);
        const rad = pl.size * Math.sqrt(p.r2);
        o.x = Math.cos(ang) * pl.r + Math.cos(p.r1 * TAU) * rad;
        o.y = Math.sin(ang) * pl.r * ORBIT_TILT + Math.sin(p.r1 * TAU) * rad;
        o.s = 1.3;
        [o.r, o.g, o.b] = pl.color;
        o.a = 0.95;
      } else {
        backgroundStar(p, t, v, o);
      }
    },

    // Ziemia: „bezkształtna i pusta”, okryta wodą i ciemnością (Rdz 1:2)
    earth(p, t, v, o) {
      const R = 0.5;
      if (p.r6 < 0.6) {
        const rad = R * Math.sqrt(p.r2);
        const ang = p.r1 * TAU + t * 0.03 * (1.2 - rad / R); // powolny ruch wód
        o.x = Math.cos(ang) * rad;
        o.y = Math.sin(ang) * rad;
        const lit = 0.2 + 0.8 * clamp(0.55 - (o.x * 0.8 + o.y * 0.6) / (R * 2));
        const swirl = 0.75 + 0.25 * Math.sin(ang * 3 + rad * 12);
        o.r = 35 * lit * swirl;
        o.g = 85 * lit * swirl;
        o.b = 165 * lit;
        o.s = 1.6;
        o.a = 0.9;
      } else if (p.r6 < 0.75) {
        // Mgła i chmury otulające planetę
        const rad = R + 0.015 + 0.06 * p.r2;
        const ang = p.r1 * TAU + t * 0.05;
        o.x = Math.cos(ang) * rad;
        o.y = Math.sin(ang) * rad;
        o.s = 2;
        o.r = 120; o.g = 150; o.b = 200;
        o.a = 0.22;
      } else {
        backgroundStar(p, t, v, o);
      }
    },
  };

  /* ---------- Dodatkowe efekty rysowane pod cząstkami ---------- */

  const DECOR = {
    void(ctx, w, cx, cy, unit) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.12);
      g.addColorStop(0, `rgba(255,245,225,${0.9 * w})`);
      g.addColorStop(1, "rgba(255,245,225,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - unit, cy - unit, unit * 2, unit * 2);
    },
    stars(ctx, w, cx, cy, unit, view) {
      for (let s = 0; s < STAR_CLUSTERS; s++) {
        const x = cx + (hash(s, 1) * 2 - 1) * view.ax * 0.95 * unit;
        const y = cy + (hash(s, 2) * 2 - 1) * view.ay * 0.95 * unit;
        const r = unit * (0.03 + 0.03 * hash(s, 10));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,240,215,${0.5 * w})`);
        g.addColorStop(1, "rgba(255,240,215,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    },
    solar(ctx, w, cx, cy, unit) {
      ctx.strokeStyle = `rgba(255,255,255,${0.09 * w})`;
      ctx.lineWidth = 1;
      PLANETS.forEach((pl) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, pl.r * unit, pl.r * unit * ORBIT_TILT, 0, 0, TAU);
        ctx.stroke();
      });
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.3);
      g.addColorStop(0, `rgba(255,200,90,${0.55 * w})`);
      g.addColorStop(1, "rgba(255,200,90,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - unit * 0.3, cy - unit * 0.3, unit * 0.6, unit * 0.6);
    },
    earth(ctx, w, cx, cy, unit) {
      const R = unit * 0.5;
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.3, R * 0.1, cx, cy, R);
      g.addColorStop(0, `rgba(30,75,140,${0.9 * w})`);
      g.addColorStop(0.7, `rgba(10,30,70,${0.9 * w})`);
      g.addColorStop(1, `rgba(4,10,25,${0.9 * w})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
    },
  };

  /* ---------- Scena ---------- */

  function mount(root) {
    const canvas = root.querySelector("canvas");
    const steps = [...root.querySelectorAll(".cosmos__step")];
    const states = (root.dataset.states || "").split(",").map((s) => (STATES[s] ? s : "void"));
    if (!canvas || !steps.length) return { destroy() {} };

    const ctx = canvas.getContext("2d");
    const count = window.innerWidth < 700 ? 1000 : 1800;
    const particles = Array.from({ length: count }, (_, i) => ({
      i,
      r1: Math.random(), r2: Math.random(), r3: Math.random(),
      r4: Math.random(), r5: Math.random(), r6: Math.random(),
    }));

    const a = {}, b = {};
    let width = 0, height = 0, dpr = 1;
    let target = 0, current = 0;
    let running = false, rafId = 0, visible = false;
    const start = performance.now();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    // Postęp: 0 = pierwszy krok na środku ekranu, n-1 = ostatni
    function readProgress() {
      const rect = root.getBoundingClientRect();
      const stepH = steps[0].offsetHeight || window.innerHeight;
      target = clamp(-rect.top / stepH, 0, states.length - 1);
    }

    function draw() {
      const time = reducedMotion ? 0 : (performance.now() - start) / 1000;
      current = reducedMotion ? target : current + (target - current) * 0.1;

      const idx = Math.min(Math.floor(current), states.length - 1);
      const next = Math.min(idx + 1, states.length - 1);
      const u = current - idx;
      const fa = STATES[states[idx]];
      const fb = STATES[states[next]];

      const unit = Math.min(width, height) * 0.5;
      const view = { ax: width / 2 / unit, ay: height / 2 / unit };
      const cx = width / 2, cy = height / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      // Poświaty (słońce, orbity, kula ziemska…) z wagą zależną od postępu
      states.forEach((name, k) => {
        const w = clamp(1 - Math.abs(current - k));
        if (w > 0.01 && DECOR[name]) {
          if (name === "earth") ctx.globalCompositeOperation = "source-over";
          DECOR[name](ctx, w, cx, cy, unit, view);
          ctx.globalCompositeOperation = "lighter";
        }
      });

      for (const p of particles) {
        fa(p, time, view, a);
        fb(p, time, view, b);
        // Każda cząstka zaczyna przejście trochę w innym momencie — efekt „roju”
        const k = smooth(clamp((u - p.r5 * 0.35) / 0.65));
        const x = cx + lerp(a.x, b.x, k) * unit;
        const y = cy + lerp(a.y, b.y, k) * unit;
        const alpha = lerp(a.a, b.a, k);
        if (alpha <= 0.01 || x < -10 || y < -10 || x > width + 10 || y > height + 10) continue;
        const s = lerp(a.s, b.s, k);
        ctx.fillStyle = `rgba(${lerp(a.r, b.r, k) | 0},${lerp(a.g, b.g, k) | 0},${lerp(a.b, b.b, k) | 0},${alpha.toFixed(2)})`;
        if (s < 1.25) {
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, s / 2 + 0.3, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    function loop() {
      readProgress();
      draw();
      rafId = running ? requestAnimationFrame(loop) : 0;
    }

    function startLoop() {
      if (running) return;
      running = true;
      current = target;
      rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    // Animacja działa tylko, gdy scena jest na ekranie
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { resize(); readProgress(); startLoop(); }
      else stopLoop();
    });
    io.observe(root);

    const ro = new ResizeObserver(() => { if (visible) resize(); });
    ro.observe(canvas);

    resize();
    readProgress();
    current = target;
    draw();

    return {
      destroy() {
        stopLoop();
        io.disconnect();
        ro.disconnect();
      },
    };
  }

  window.Cosmos = { mount, states: Object.keys(STATES) };
})();
