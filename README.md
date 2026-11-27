# Biblijna oś czasu

Interaktywna oś czasu wydarzeń biblijnych: od stworzenia Adama (4026 p.n.e.) aż do naszych czasów. Projekt w czystym HTML, CSS i JavaScripcie, bez frameworków i bez kroku budowania.

Chronologia według leksykonu *Wnikliwe poznawanie Pism* (Adam 4026 p.n.e., potop 2370 p.n.e.).

## Uruchomienie

Dane są wczytywane przez `fetch`, dlatego strona musi działać przez lokalny serwer. Samo dwukrotne kliknięcie `index.html` nie wystarczy.

- **VS Code:** prawy klik na `index.html` → *Open with Live Server* (port 5502 jest ustawiony w `.vscode/settings.json`)
- **albo w terminalu:** `npx serve .` lub `python -m http.server`

## Struktura

```
index.html          intro z paralaksą + kontener osi
style.css           zmienne, fonty, responsywność, wygląd osi
script.js           wczytuje dane, renderuje oś, paralaksa, kolory per epoka
data/events.json    epoki i wydarzenia
images/time.png     tło intro (kosmos)
```

## Dodawanie danych

Każda epoka w `data/events.json`:

```json
{
  "id": "przed-potopem",
  "title": "Świat przed potopem",
  "subtitle": "Od stworzenia Adama do potopu",
  "start": -4026,
  "end": -2370,
  "color": "#0f1a16",
  "accent": "#8fc79a",
  "summary": "Krótki opis epoki",
  "events": [
    { "year": -4026, "title": "Stworzenie Adama", "description": "…", "refs": ["Rdz 2:7"] }
  ]
}
```

- **Lata:** liczby ujemne oznaczają p.n.e., dodatnie n.e. Roku 0 nie ma, a skrypt sam to uwzględnia przy liczeniu różnic.
- **`"approx": true`** dodaje „ok.” przed datą.
- **`color` / `accent`:** kolor tła strony i kolor akcentu, gdy epoka jest na środku ekranu.
- Wydarzenia są sortowane automatycznie. Odstęp między nimi rośnie z liczbą lat.

## Plan

- [x] Fundament CSS, intro z paralaksą, dane z 4 epokami, renderowanie osi
- [x] Kolory tła zmieniające się per epoka
- [ ] Przyklejony licznik roku
- [ ] Minimapa w prawdziwej skali
- [ ] Kolejne epoki (królowie, niewola babilońska, czasy Jezusa, …)
