# Biblijna oś czasu

Interaktywna oś czasu wydarzeń biblijnych: od stworzenia Adama (4026 p.n.e.) aż do naszych czasów. Projekt w czystym HTML, CSS i JavaScripcie, bez frameworków i bez kroku budowania.

Chronologia według leksykonu *Wnikliwe poznawanie Pism* (Adam 4026 p.n.e., potop 2370 p.n.e.).

## Uruchomienie

Dane są wczytywane przez `fetch`, dlatego strona musi działać przez lokalny serwer. Samo dwukrotne kliknięcie `index.html` nie wystarczy.

- **VS Code:** prawy klik na `index.html` → *Open with Live Server* (port 5502 jest ustawiony w `.vscode/settings.json`)
- **albo w terminalu:** `npx serve .` lub `python -m http.server`

## Struktura

```
index.html          intro z paralaksą, przełącznik języka, kontener osi
style.css           zmienne, fonty, responsywność, wygląd osi
population.js       widżet „Ludzkości przybywa” (wykres + suwaki)
cosmos.js           animacja kosmosu (cząstki na canvas) sterowana przewijaniem
script.js           wczytuje dane, renderuje oś, języki, paralaksa, kolory epok
data/events.json    epoki i wydarzenia (treść w 5 językach)
data/i18n.json      teksty interfejsu, oznaczenia lat, skróty ksiąg biblijnych
images/time.png     tło intro (kosmos)
images/creation/    obrazy dni 4–6 i Edenu + PROMPTY.md (jak je wygenerować)
```

## Języki

Dostępne są PL, EN, SV, DE i ES. Język wybierasz przyciskami w prawym górnym rogu albo przez `?lang=en` w adresie. Wybór jest zapamiętywany w przeglądarce.

## Dodawanie danych

Wydarzenie w `data/events.json`:

```json
{
  "year": -4026,
  "refs": ["gen 2:7", "gen 2:15"],
  "title":       { "pl": "Stworzenie Adama", "en": "Creation of Adam", "sv": "…", "de": "…", "es": "…" },
  "description": { "pl": "…", "en": "…", "sv": "…", "de": "…", "es": "…" }
}
```

- **`year`:** liczba ujemna to p.n.e., dodatnia n.e. `null` oznacza *czas nieokreślony*. Roku 0 nie ma, a skrypt sam to uwzględnia przy liczeniu różnic.
- **`"qualifier"`:** `"approx"` daje „ok. 4026”, `"before"` „przed 3896”, `"after"` „po 4026”. Starsze `"approx": true` też działa.
- **`"yearRange": [-4026, -3896]`** pokazuje zakres lat zamiast jednego roku.
- **`"backdrop"`** w epoce ustawia rozmyte tło. **`"outroBackdrop"`** w ostatnim wydarzeniu sceny rozmywa jej ostatni obraz i płynnie przechodzi w to tło.
- **`"widget": "population"`** wstawia wykres wzrostu ludzkości. Ustawienia są w `widgetConfig`.
- **`refs`:** kod księgi + werset, np. `"joh 1:1-3"`. Skrót wyświetla się w każdym języku osobno (np. Jn / Joh / Joh / Joh / Jn). Nowe księgi dopisuje się w `data/i18n.json` → `books`.
- **Brak tłumaczenia:** pokaże się wersja polska.
- **Epoka bez dat:** `"start": null, "end": null`.
- **Scena kosmosu:** kolejne wydarzenia z `"scene": "cosmos"` tworzą jedną animowaną scenę. `sceneState` i `stages[].state` wybierają etap animacji: `void`, `quarks`, `hadrons`, `atoms`, `stars`, `galaxies`, `solar`, `earth`, `day1`–`day6`, `eden`.
- **`"image": "images/creation/day4"`** w wydarzeniu sceny: w tym miejscu zamiast animacji pojawia się obraz. Rozszerzenie można pominąć, wtedy strona próbuje .webp, .jpg i .png.
- Wydarzenia wyświetlają się w kolejności z pliku. Odstęp między datowanymi wydarzeniami rośnie z liczbą lat.

## Plan

- [x] Fundament CSS, intro z paralaksą, dane z 4 epokami, renderowanie osi
- [x] Kolory tła zmieniające się per epoka
- [x] Epoka „Stwarzanie” (przed Adamem, bez dat)
- [x] 5 języków: PL, EN, SV, DE, ES
- [x] Animacja kosmosu: kwarki → atomy → gwiazdy → galaktyki → Układ Słoneczny → Ziemia
- [x] Dni stwarzania i Eden jako dalsze etapy tej samej animacji
- [x] Od 4. dnia przejście z animacji w obrazy (czekają na pliki, patrz `images/creation/PROMPTY.md`)
- [x] Eden przechodzi w rozmyte tło epoki przed potopem
- [x] Bunt w Edenie, Kain i Abel, wykres „Ludzkości przybywa”
- [ ] Przyklejony licznik roku
- [ ] Minimapa w prawdziwej skali
- [ ] Kolejne epoki (królowie, niewola babilońska, czasy Jezusa, …)
