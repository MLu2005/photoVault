# photoVault 2.0 — Wasza prywatna biblioteka

Nowa wersja aplikacji dla dwóch zaufanych osób. React + Vite, Azure Static Web Apps / Functions i dotychczasowy Azure Blob Storage. Bez bazy danych, rejestracji publicznej, Entra ID, Auth0, Clerk i dodatkowego serwera do przesyłania filmów.

**Status przekazania:** kod jest przygotowany, testy logiki i scenariusze UI zostały wykonane w odizolowanym środowisku. Nie wykonano wdrożenia do Twojego Azure ani zmian w Twoich plikach. Pełny `npm install` / build Vite i połączenie z prawdziwym Azure wymagają jeszcze weryfikacji. Szczegóły: `docs/TESTY.md`.

## Co jest zaimplementowane

- Wspólna, prywatna biblioteka, dwa niezależne loginy i hasła; oboje macie te same uprawnienia.
- Wielokrotny wybór zdjęć i filmów, przeciąganie plików, kolejka, postęp, anulowanie i ponawianie nieudanych transferów.
- Do trzech jednocześnie przesyłanych plików. Większe niż 8 MiB: bloki po 4 MiB, maksymalnie dwa naraz na plik, z retry błędów przejściowych. Domyślny limit jednego pliku: 1 GiB; maksymalnie 500 pozycji w kolejce.
- Zdjęcia i filmy w tej samej galerii, pełnoekranowy podgląd, natywny odtwarzacz, powiększenie zdjęcia, strzałki klawiatury, Escape i gest przewijania zdjęć.
- Albumy, także puste, wyszukiwanie, filtrowanie, sortowanie, grupowanie miesiącami, siatka / lista, zaznaczanie wielu plików.
- Wspólne ulubione, kosz, przywracanie, potwierdzane trwałe usuwanie i pobieranie oryginału.
- Osobne miniatury nowych plików, kiedy przeglądarka potrafi je utworzyć. Oryginały nie są kompresowane ani konwertowane.
- Responsywny interfejs po polsku, jasny / ciemny motyw, menu mobilne, okna dialogowe z obsługą klawiatury, stany pustej biblioteki i błędów.

Nie ma publicznych galerii. Dawne adresy `/private/nazwa` i `/public/nazwa` mogą otworzyć odpowiedni album dopiero po zalogowaniu. Nie ma kont gości ani domyślnego hasła produkcyjnego.

## Zacznij tutaj

**Masz już repozytorium:** przeczytaj `docs/WDROZENIE-WINDOWS.md`. Zastosuj dostarczony patch na osobnej gałęzi. Nie nakładaj tylko nowych plików na stare — pozostały `postcss.config.js` może zepsuć nowy build.

**Osobny, czysty folder ze źródłami:** potrzebny Node.js 22, przynajmniej 22.12. W terminalu:

```powershell
npm install
npm --prefix api ci
npm run setup
npm run check
npm test
npm run build
```

`npm run setup` pyta o Wasze dwa konta, maskuje hasła i zapisuje wyłącznie ich hashe. Tworzy `.photovault-secrets.json` oraz `api/local.settings.json`. Oba są ignorowane przez Git. **Nie wysyłaj ich do rozmowy ani repozytorium.** W Azure dodaj trzy obowiązkowe wartości: `PV_USERS`, `PV_SESSION_SECRET`, `PV_APP_ORIGIN`. Istniejące ustawienia konta Storage pozostają.

W tej paczce celowo nie ma nowego głównego `package-lock.json`: środowisko przygotowania nie miało dostępu do npm, a stary lock nie odpowiada nowym zależnościom. Pierwsze `npm install` generuje prawdziwy lock; dodaj go do Git. Lock API jest dołączony. Workflow obsługuje pierwszy build bez locka, później korzysta z `npm ci`.

## Uruchomienie lokalne

Uzupełnij klucze w `api/local.settings.json`. Do prób zalecany osobny, prywatny kontener testowy ustawiony przez `AZURE_STORAGE_CONTAINER`; nie zmieniaj produkcyjnego `fullsize`. Korzystanie lokalnie z `fullsize` oznacza działanie na prawdziwych plikach.

```powershell
# Terminal 1
npm run dev:api
# Terminal 2
npm run dev
```

Otwórz `http://127.0.0.1:5173`, nie `localhost` ani inny port. Origin musi odpowiadać konfiguracji. Dev API to mały adapter HTTP do tych samych handlerów, nie pełny emulator Azure. Functions Core Tools nie są potrzebne do tego trybu.

## Struktura

```text
src/App.jsx                  widoki biblioteki i operacje użytkownika
src/components/              login, galeria, podgląd, dialogi i kolejka
src/hooks/                   pobieranie biblioteki i nawigacja
src/lib/upload.js            PUT / blokowy upload przez XMLHttpRequest
src/lib/upload-queue.js      harmonogram, retry, anulowanie
src/lib/thumbnail.js         opcjonalne miniatury w przeglądarce
api/shared/auth.js           hashe, podpisane sesje i CSRF
api/shared/handlers.js       autoryzowane operacje API
api/shared/storage.js        jedyne miejsce z kluczem Azure / SDK
api/shared/rate-limit.js     współdzielony licznik prób logowania w Blob Storage
scripts/setup.cjs            interaktywna konfiguracja dwóch kont
staticwebapp.config.json      routing, nagłówki, Node 22
```

Oryginały nadal leżą pod `album/plik`. Dodatkowe dane mieszczą się w tym samym kontenerze: metadane blobów (ulubione, kosz), `album/.pv-album.json` (pusty album), `album/.pv-thumbs/` (miniatury) i `.pv-system/login/` (liczniki logowania). Nie trzeba migrować plików do bazy.

## Uczciwe granice tej wersji

Nie ma transkodowania HEVC/MOV do uniwersalnego MP4, automatycznego backupu telefonu, synchronizacji desktopowej, rozpoznawania twarzy, wyszukiwania AI, edycji plików ani przenoszenia / zmiany nazw albumów. Data grupowania to dodanie / utworzenie bloba, nie analiza EXIF.

Przesyłanie wymaga otwartej karty. Retry działa w bieżącej kolejce; nie jest to trwałe wznawianie po zamknięciu przeglądarki. iOS/Android mogą wstrzymać upload po wygaszeniu ekranu. Do starych plików nie dodajemy automatycznie miniatur.

Kosz nie opróżnia się sam i nadal zajmuje miejsce. Konto Azure z kluczem nadal ma techniczny dostęp do danych; to nie jest szyfrowanie end-to-end ani system zero-knowledge. Również kosz nie zastępuje oddzielnej kopii zapasowej.

Więcej: `docs/ARCHITEKTURA.md`, `docs/TESTY.md`, `docs/WDROZENIE-WINDOWS.md`.
