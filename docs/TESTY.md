# Raport weryfikacji — 20 września 2026

## Wykonane

`npm test`: **27/27 testów zakończonych powodzeniem**, runner Node.js 22.16.0. Testy są w `tests/backend.test.cjs` i `tests/frontend.test.mjs`, bez kontaktu z Azure i bez zależności npm.

Zakres: scrypt / weryfikacja hasła, podpis / wygaśnięcie / unieważnienie sesji, flagi cookie, wszystkie prywatne endpointy bez logowania, origin / CSRF / metody HTTP, dwa rodzaje nieprawidłowego logowania, współdzielony rate limit, walidacja nazw / rozmiarów / rozszerzeń, kompatybilność starych plików, puste albumy, stronicowanie, ukrywanie plików systemowych, miniatury / finalizacja, ulubione / kosz / przywrócenie, konflikty ETag, warunek trwałego usunięcia, usuwanie miniatur, stronicowane czyszczenie zawartości albumu, odświeżanie linku, kolejka trzech plików, retry bez duplikacji, częściowe błędy, anulowanie, pojedynczy PUT, bloki 4 MiB / dwie równoległe części, commit listy, retry 503 oraz odrzucenie 403.

`npm run check`: weryfikacja składni modułów JS, konfiguracji JSON, wszystkich **12 bindingów Functions**, runtime Node 22 i wykluczenia API z fallbacku SPA. JSX dodatkowo został przetłumaczony lokalnym TypeScriptem bez błędów składni.

Sprawdzono również interaktywny `npm run setup` w terminalu: dwa konta, maskowanie hasła, zapis wyłącznie hashy i rozdzielenie konfiguracji lokalnej od produkcyjnej.

## Interfejs: dziewięć grup scenariuszy

W Chromium sprawdzono:

1. Logowanie i rzeczywiste renderowanie biblioteki z danymi testowymi.
2. Desktop 1440×1000 i mobile 390×844: brak poziomego wychodzenia poza ekran.
3. Siatkę / listę, ulubione i wyszukiwanie z pustym wynikiem.
4. Odtwarzanie MP4 H.264 (czas odtwarzania rzeczywiście rośnie), podgląd zdjęcia, panel informacji, klawiaturę i Escape.
5. Odrzucenie SVG, wyczyszczenie wyboru i ponowny wybór dwóch obrazów i MP4, upload do nowego albumu, miniatury / finalizację oraz zakończenie kolejki 3/3.
6. Zaznaczanie wielu plików, kosz i przywracanie.
7. Przeniesienie całej zawartości albumu do kosza i potwierdzone trwałe usuwanie.
8. Ciemny motyw oraz mobilną nawigację z otwartą kolejką uploadów.
9. Wylogowanie i dostęp do wspólnej biblioteki drugim kontem.

W tej kontroli wykryto i naprawiono m.in. pierwszą stronę czyszczenia albumu wysyłającą cursor:null oraz panel uploadu zasłaniający menu telefonu. Naprawiono również odczyt żywego FileList po wyczyszczeniu inputa: wybór jest teraz natychmiast kopiowany do tablicy. Zrzuty ekranowe są podglądami faktycznie wyrenderowanego interfejsu, nie makietą graficzną. Pokazują dane testowe, nie Wasze zdjęcia.

## Ważne ograniczenie środowiska tych testów

Środowisko robocze nie mogło pobierać pakietów z rejestru npm. Zainstalowany Chromium blokował również nawigację sieciową. Dlatego podgląd UI wykonano jako lokalny test DOM: JSX przetłumaczony TypeScriptem, dostępny lokalnie runtime React 19.1.1, transport API przekazywany do tych samych handlerów działających z pamięciowym FakeStore. Routing / storage przeglądarki i transport sieciowy były adapterami testowymi.

**Nie jest to pełny test E2E produkcyjnego buildu.** Produkcyjny manifest zachowuje React 18.3.1. Te adaptery i cudzy runtime testowy nie są dołączone do kodu aplikacji ani ZIP-a. Wynik nie potwierdza CORS, cookie przechodzącego przez prawdziwy proxy SWA, działania SDK na prawdziwym koncie Storage ani zgodności z Safari / iOS. Nie wykonano pełnego builda Vite ani audytu zależności z aktualną bazą podatności.

## Jak powtórzyć testy bez Azure

```powershell
npm run check
npm test
```

Do normalnych testów przeglądarkowych na **produkcyjnym buildzie** zainstaluj pakiety Node i opcjonalne narzędzia Python:

```powershell
npm install
npm run build
python -m pip install playwright
python -m playwright install chromium
# Osobny terminal, pozostaw uruchomiony:
node tests/server.cjs
# W pierwszym terminalu:
npm run test:e2e
```

`tests/server.cjs` nasłuchuje wyłącznie na `127.0.0.1:4180`, nie czyta Twoich kluczy Azure i przechowuje pliki tylko w pamięci. Konta `tester` / `partner` oraz ich jawne hasła w tym serwerze należą wyłącznie do fikcyjnego środowiska testowego. Nie są kontami aplikacji i ten serwer nie jest wdrażany. Zrestartuj serwer przed ponownym testem, aby wyczyścić fixture i liczniki logowania.

Test przeglądarkowy wymaga obsługi MP4 H.264 w wybranym Chromium. Można wskazać własną przeglądarkę zmienną `PV_BROWSER_EXECUTABLE`. Testy wykonują również usuwanie fikcyjnych plików — nigdy nie kieruj ich na produkcyjną aplikację.

## Ostatni etap: prawdziwe wdrożenie

Po poprawnym buildzie trzeba sprawdzić w Azure rzeczywiste logowanie dwóch kont, prywatność kontenera, CORS, duży MP4, zerwane połączenie / Ponów, pobieranie, przewijanie filmu, odświeżenie wygasłego SAS i zachowanie na Waszych telefonach. Te punkty pozostają do potwierdzenia, nie są oznaczone jako zaliczone.

Dołączone JPEG-i do testów to syntetyczne wzory, a MP4 to plansza testowa. Zrzuty podglądowe z przeglądu UI używają również lokalnych przykładowych zdjęć; te zdjęcia nie są dołączone do projektu.
