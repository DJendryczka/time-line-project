/* =========================================================
   Kosmos — animacja cząstek sterowana przewijaniem
   Etapy (nazwy z data/events.json → sceneState / stages[].state):
   void → quarks → hadrons → atoms → stars → galaxies → solar → earth
   → day1 … day6 → eden (dni stwarzania na tej samej planecie)
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

  /* ---------- Planeta podczas dni stwarzania ----------
     Cząstki powierzchni mają stałe „domowe” miejsce na tarczy Ziemi,
     więc lądy, chmury i zwierzęta nie skaczą między etapami. */

  const EARTH_R = 0.5;
  const EDEN_ZOOM = 2.6;
  const CLOUDS = 26;

  // Gładki „szum” wyznaczający kontynenty (wartość > LAND_LEVEL = ląd)
  const LAND_LEVEL = 0.45;
  const landNoise = (x, y) =>
    Math.sin(x * 5.1 + 1.3) * Math.cos(y * 4.7 - 0.7) +
    0.5 * Math.sin(x * 9.3 - y * 7.1 + 2.1) +
    0.3 * Math.sin((x + y) * 13);

  // Eden: najbardziej „lądowy” punkt blisko środka tarczy
  const EDEN = (() => {
    let best = { x: 0, y: 0, n: -Infinity };
    for (let x = -0.25; x <= 0.25; x += 0.01) {
      for (let y = -0.2; y <= 0.2; y += 0.01) {
        const n = landNoise(x, y);
        if (n > best.n) best = { x, y, n };
      }
    }
    return best;
  })();

  function surface(p) {
    if (p.sx !== undefined) return;
    const ang = p.r1 * TAU;
    const rad = EARTH_R * Math.sqrt(p.r2);
    p.sx = Math.cos(ang) * rad;
    p.sy = Math.sin(ang) * rad;
    p.nz = Math.sqrt(Math.max(0, 1 - (rad / EARTH_R) ** 2));
    p.land = landNoise(p.sx, p.sy) > LAND_LEVEL;
    p.edenDist = Math.hypot(p.sx - EDEN.x, p.sy - EDEN.y);
  }

  // Oświetlenie kuli: L = kierunek światła, amb = światło rozproszone
  function shade(p, [lx, ly, lz], amb) {
    const d = (p.sx / EARTH_R) * lx + (p.sy / EARTH_R) * ly + p.nz * lz;
    return amb + (1 - amb) * clamp(d);
  }

  const LIGHT_DIFFUSE = [-0.45, -0.3, 0.84];
  const LIGHT_SUN = [-0.68, -0.42, 0.6];

  const sunPos = (v) => [-Math.min(v.ax, 1.7) * 0.78, -v.ay * 0.68];
  const moonPos = (v) => [Math.min(v.ax, 1.7) * 0.74, -v.ay * 0.6];

  /* opts: water, land (kolory lub null), light, amb, sky ('dim' | 'stars' | 'sun'),
           atmo ('haze' | 'clear'), fish, birds, animals, eden */
  function planet(p, t, v, o, opts) {
    surface(p);

    // --- Powierzchnia ---
    if (p.r6 < 0.6) {
      const L = shade(p, opts.light, opts.amb);
      let col = opts.water;
      let glow = false; // ogród, ryby i zwierzęta lekko świecą, także po stronie nocnej
      if (opts.land && p.land) col = p.r3 < 0.3 ? [150, 125, 80] : opts.land;
      o.x = p.sx;
      o.y = p.sy;
      o.s = 1.6;
      o.a = 0.9;

      if (opts.eden && p.edenDist < 0.07 && p.land) {
        col = p.r3 < 0.12 ? [255, 120, 90] : [90, 225, 110]; // ogród i owoce
        o.a = 1;
        glow = true;
      } else if (opts.fish && !p.land && p.r3 < 0.16) {
        o.x += Math.sin(t * 1.5 + p.r4 * 20) * 0.012;
        o.y += Math.cos(t * 1.1 + p.r4 * 20) * 0.006;
        col = [130, 235, 255];
        o.s = 1.3;
        glow = true;
      } else if (opts.animals && p.land && p.r3 > 0.3 && p.r3 < 0.48) {
        o.x += Math.sin(t * 0.6 + p.r4 * 30) * 0.008;
        o.y += Math.cos(t * 0.5 + p.r5 * 30) * 0.005;
        col = [240, 175, 100];
        o.s = 1.5;
        glow = true;
      }
      const lit = glow ? Math.max(L, 0.55) : L;
      o.r = col[0] * lit; o.g = col[1] * lit; o.b = col[2] * lit;
    }

    // --- Atmosfera, chmury, ptaki ---
    else if (p.r6 < 0.75) {
      if (opts.atmo === "haze") {
        const rad = EARTH_R + 0.01 + 0.055 * p.r2;
        const ang = p.r1 * TAU + t * 0.04;
        o.x = Math.cos(ang) * rad;
        o.y = Math.sin(ang) * rad;
        o.s = 2.2;
        o.r = 195; o.g = 200; o.b = 215;
        o.a = 0.3;
      } else if (p.r3 < 0.5) {
        if (opts.birds && p.r4 < 0.6) {
          const rad = EARTH_R + 0.02 + 0.06 * p.r2;
          const ang = p.r1 * TAU + t * (0.12 + 0.1 * p.r5);
          o.x = Math.cos(ang) * rad;
          o.y = Math.sin(ang) * rad + Math.sin(t * 12 + p.r3 * 40) * 0.004;
          o.s = 1.2;
          o.r = 255; o.g = 255; o.b = 255;
          o.a = 0.9;
        } else {
          // Cienka, niebieska atmosfera
          const rad = EARTH_R + 0.008 + 0.028 * p.r2;
          const ang = p.r1 * TAU;
          o.x = Math.cos(ang) * rad;
          o.y = Math.sin(ang) * rad;
          o.s = 1.8;
          o.r = 110; o.g = 170; o.b = 255;
          o.a = 0.35;
        }
      } else {
        // Chmury: skupiska nad powierzchnią, powoli dryfujące
        const c = p.i % CLOUDS;
        const ca = hash(c, 11) * TAU + t * 0.015;
        const cr = EARTH_R * 0.88 * Math.sqrt(hash(c, 12));
        const off = 0.055 * p.r2;
        o.x = Math.cos(ca) * cr + Math.cos(p.r4 * TAU) * off * 1.6;
        o.y = Math.sin(ca) * cr + Math.sin(p.r4 * TAU) * off * 0.7;
        const fake = { sx: o.x, sy: o.y, nz: Math.sqrt(Math.max(0, 1 - (o.x ** 2 + o.y ** 2) / EARTH_R ** 2)) };
        const L = shade(fake, opts.light, opts.amb + 0.15);
        o.s = 2.2;
        o.r = 240 * L; o.g = 244 * L; o.b = 252 * L;
        o.a = 0.5;
      }
    }

    // --- Niebo w tle: gwiazdy, Słońce, Księżyc ---
    else {
      if (opts.sky === "sun" && p.r1 < 0.25) {
        const [sx, sy] = sunPos(v);
        const rad = 0.075 * Math.sqrt(p.r2);
        o.x = sx + Math.cos(p.r3 * TAU) * rad;
        o.y = sy + Math.sin(p.r3 * TAU) * rad;
        o.s = 1.8;
        o.r = 255; o.g = 215 + p.r4 * 30; o.b = 120;
        o.a = 0.85;
      } else if (opts.sky === "sun" && p.r1 < 0.32) {
        const [mx, my] = moonPos(v);
        const rad = 0.038 * Math.sqrt(p.r2);
        const ang = p.r3 * TAU;
        o.x = mx + Math.cos(ang) * rad;
        o.y = my + Math.sin(ang) * rad;
        const lit = 0.25 + 0.75 * clamp(0.5 - Math.cos(ang) * Math.sqrt(p.r2));
        o.s = 1.4;
        o.r = 215 * lit; o.g = 215 * lit; o.b = 205 * lit;
        o.a = 0.9;
      } else {
        backgroundStar(p, t, v, o);
        if (opts.sky === "dim") o.a *= 0.4;
      }
      return; // tło nie podlega zbliżeniu na Eden
    }

    if (opts.eden) {
      o.x = (o.x - EDEN.x) * EDEN_ZOOM;
      o.y = (o.y - EDEN.y) * EDEN_ZOOM;
    }
  }

  const WATER_DARK = [55, 75, 105];
  const WATER = [35, 105, 200];
  const GREEN = [60, 145, 70];

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

    // Dzień 1: światło przenika przez gęste warstwy — rozproszona poświata
    day1(p, t, v, o) {
      planet(p, t, v, o, { water: WATER_DARK, land: null, light: LIGHT_DIFFUSE, amb: 0.18, sky: "dim", atmo: "haze" });
    },
    // Dzień 2: przestworze — przejrzysta atmosfera i chmury nad wodami
    day2(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: null, light: LIGHT_DIFFUSE, amb: 0.2, sky: "dim", atmo: "clear" });
    },
    // Dzień 3: ląd i rośliny
    day3(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: GREEN, light: LIGHT_DIFFUSE, amb: 0.2, sky: "dim", atmo: "clear" });
    },
    // Dzień 4: Słońce i Księżyc wyraźnie widoczne, ostry podział na dzień i noc
    day4(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: GREEN, light: LIGHT_SUN, amb: 0.07, sky: "sun", atmo: "clear" });
    },
    // Dzień 5: ryby w morzach, ptaki na niebie
    day5(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: GREEN, light: LIGHT_SUN, amb: 0.07, sky: "sun", atmo: "clear", fish: true, birds: true });
    },
    // Dzień 6: zwierzęta lądowe
    day6(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: GREEN, light: LIGHT_SUN, amb: 0.07, sky: "sun", atmo: "clear", fish: true, birds: true, animals: true });
    },
    // Ogród Eden: zbliżenie na jedno miejsce na lądzie
    eden(p, t, v, o) {
      planet(p, t, v, o, { water: WATER, land: GREEN, light: LIGHT_SUN, amb: 0.07, sky: "stars", atmo: "clear", fish: true, birds: true, animals: true, eden: true });
    },
  };

  /* ---------- Dodatkowe efekty rysowane pod cząstkami ---------- */

  // Pełna tarcza planety pod cząstkami (żeby nie prześwitywała)
  function planetDisc(ctx, w, cx, cy, unit, lit, dark, hl) {
    const R = unit * EARTH_R;
    const g = ctx.createRadialGradient(cx - R * hl, cy - R * hl * 0.7, R * 0.05, cx, cy, R);
    g.addColorStop(0, `rgba(${lit.join(",")},${0.85 * w})`);
    g.addColorStop(0.75, `rgba(${dark.join(",")},${0.9 * w})`);
    g.addColorStop(1, `rgba(${dark.join(",")},${0.95 * w})`);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
  }

  function hazeGlow(ctx, w, cx, cy, unit, rgb, strength) {
    const R = unit * EARTH_R;
    const g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18);
    g.addColorStop(0, `rgba(${rgb},${strength * w})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
  }

  function sunlitDecor(ctx, w, cx, cy, unit, view) {
    planetDisc(ctx, w, cx, cy, unit, [45, 120, 205], [3, 8, 20], 0.55);
    hazeGlow(ctx, w, cx, cy, unit, "110,170,255", 0.3);
    const [sx, sy] = sunPos(view);
    const x = cx + sx * unit, y = cy + sy * unit, r = unit * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,225,140,${0.7 * w})`);
    g.addColorStop(1, "rgba(255,225,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

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
    day1(ctx, w, cx, cy, unit) { planetDisc(ctx, w, cx, cy, unit, [70, 85, 110], [12, 16, 26], 0.35); hazeGlow(ctx, w, cx, cy, unit, "200,205,220", 0.35); },
    day2(ctx, w, cx, cy, unit) { planetDisc(ctx, w, cx, cy, unit, [40, 110, 200], [6, 20, 45], 0.35); hazeGlow(ctx, w, cx, cy, unit, "110,170,255", 0.3); },
    day3(ctx, w, cx, cy, unit) { planetDisc(ctx, w, cx, cy, unit, [40, 115, 190], [6, 20, 45], 0.35); hazeGlow(ctx, w, cx, cy, unit, "110,170,255", 0.3); },
    day4: sunlitDecor,
    day5: sunlitDecor,
    day6: sunlitDecor,
    eden(ctx, w, cx, cy, unit) {
      const z = EDEN_ZOOM;
      const ox = cx - EDEN.x * z * unit;
      const oy = cy - EDEN.y * z * unit;
      planetDisc(ctx, w, ox, oy, unit * z, [45, 120, 200], [5, 15, 35], 0.6);
      // Rzeka wypływająca z Edenu i dzieląca się na cztery odnogi (Rdz 2:10)
      ctx.strokeStyle = `rgba(120,200,255,${0.55 * w})`;
      ctx.lineWidth = Math.max(1.5, unit * 0.006);
      ctx.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        const ang = k * (TAU / 4) + 0.5;
        const len = unit * (0.32 + 0.08 * k);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
          cx + Math.cos(ang + 0.5) * len * 0.5, cy + Math.sin(ang + 0.5) * len * 0.5,
          cx + Math.cos(ang) * len, cy + Math.sin(ang) * len
        );
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.3);
      g.addColorStop(0, `rgba(140,255,150,${0.35 * w})`);
      g.addColorStop(1, "rgba(140,255,150,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - unit * 0.3, cy - unit * 0.3, unit * 0.6, unit * 0.6);
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
