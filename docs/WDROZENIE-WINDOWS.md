# Wdrożenie na Twoim istniejącym Azure

## 1. Najpierw osobna gałąź i sprawdzenie patcha

Ta aktualizacja dotyczy snapshotu `photoVault-main.zip` przekazanego w rozmowie. Nie znam niezatwierdzonych zmian na Twoim komputerze. Jeżeli `git status --short` pokazuje zmiany, najpierw je zachowaj w bezpiecznej kopii / osobnym commicie. Nie używaj `git reset --hard` ani `git clean` do wymuszania aktualizacji.

Zapisz `photo-vault-v2.patch` w Pobranych. W PowerShell:

```powershell
Set-Location 'C:\Users\Dell\Desktop\azure\photo-vault'
git status --short
# Kontynuuj dopiero, gdy drzewo robocze jest czyste.
git switch -c feature/photovault-v2
$patch = Join-Path $env:USERPROFILE 'Downloads\photo-vault-v2.patch'
git apply --check $patch
if ($LASTEXITCODE -ne 0) { throw 'Patch nie pasuje. Nie stosuj go na sile.' }
git apply $patch
if ($LASTEXITCODE -ne 0) { throw 'Aktualizacja nie zostala zastosowana poprawnie.' }
git diff --stat
```

Patch usuwa stare strony, martwe komponenty i dawną konfigurację Tailwind/PostCSS. Nie usuwa `.git`, lokalnych kluczy ani zawartości Azure. Przy konflikcie najlepiej porównać nowy ZIP z bieżącą wersją; nie wymuszać aplikowania patcha. ZIP można rozpakować do osobnego folderu do przeglądu.

## 2. Pakiety, testy i build

Potrzebny Node.js 22 (22.12 lub nowszy z linii 22.x). Jeżeli PowerShell blokuje `npm.ps1`, użyj `npm.cmd` zamiast zmiany polityki uruchamiania całego komputera.

```powershell
node --version
npm install
npm --prefix api ci
npm run check
npm test
npm run build
```

Pierwsze `npm install` tworzy główny `package-lock.json`. Zachowaj go w repozytorium. `npm run build` powinno utworzyć `dist/index.html` i skopiować `staticwebapp.config.json` do `dist`. Bez poprawnego buildu nie scalaj zmian do `main`.

Opcjonalnie wykonaj `npm audit` i `npm --prefix api audit`, a wyniki oceń przed wdrożeniem. Nie stosuj automatycznie `npm audit fix --force` do całego projektu.

## 3. Ustaw Wasze dwa konta

```powershell
npm run setup
```

Skrypt zapyta kolejno o login, wyświetlane imię i hasło każdej osoby, a następnie o pełny adres aplikacji Azure. Login: 3–40 znaków `a-z`, cyfry, kropka, podkreślenie, myślnik. Hasło: przynajmniej 14 znaków, najlepiej kilka losowych słów. Hasła nie trafiają do pliku ani historii poleceń.

Powstaną dwa lokalne, ignorowane przez Git pliki:

- `.photovault-secrets.json`: gotowe wartości do ustawienia w Azure.
- `api/local.settings.json`: konfiguracja do pracy lokalnej; istniejące wartości konta Storage są zachowane.

W `PV_USERS` znajduje się JSON z nazwami użytkowników i hashami haseł. Nie kopiuj całego zewnętrznego JSON jako wartości tej jednej zmiennej. Aby uzyskać prawidłowe wartości bez ręcznego usuwania znaków ucieczki, w PowerShell możesz skopiować je pojedynczo do schowka:

```powershell
$pv = Get-Content '.photovault-secrets.json' -Raw | ConvertFrom-Json
$pv.PV_USERS | Set-Clipboard
# Wklej do pola Value zmiennej PV_USERS w Azure.
$pv.PV_SESSION_SECRET | Set-Clipboard
# Wklej do pola Value zmiennej PV_SESSION_SECRET.
$pv.PV_APP_ORIGIN | Set-Clipboard
# Wklej do pola Value zmiennej PV_APP_ORIGIN.
Set-Clipboard -Value ''
Remove-Variable pv
```

Nie przesyłaj tych wartości do rozmowy, Issues, README ani GitHub Actions logs. Powtórne uruchomienie setupa za zgodą zastępuje oba konta i sekret sesji; po aktualizacji Azure trzeba będzie ponownie się zalogować.

## 4. Zmienne w Azure Static Web App

Azure Portal → Twoja **Static Web App** → Settings → **Environment variables** → wybierz środowisko **Production**. Dodaj / zachowaj:

| Nazwa | Wartość |
|---|---|
| `AZURE_STORAGE_ACCOUNT` | Dotychczasowa nazwa konta Storage. |
| `AZURE_STORAGE_KEY` | Dotychczasowy klucz, tylko po stronie backendu. |
| `PV_USERS` | Wartość wygenerowana przez setup, jako jeden JSON. |
| `PV_SESSION_SECRET` | Wygenerowany losowy sekret. |
| `PV_APP_ORIGIN` | Dokładny adres HTTPS, np. adres Twojej aplikacji, bez końcowego `/` i bez ścieżki. |
| `AZURE_STORAGE_CONTAINER` | Opcjonalnie `fullsize`; to jest wartość domyślna. |
| `PV_MAX_UPLOAD_MB` | Opcjonalnie `1024`; limit aplikacyjny w MiB, nie całkowity limit konta. |
| `PV_SESSION_DAYS` | Opcjonalnie `7`; dopuszczalne 1–30. |

**Nie dodawaj `PV_DEV_HTTP=true` do Azure. Nie używaj prefiksu `VITE_` dla sekretów.** Te ustawienia muszą być dostępne dla API, a nie wbudowane w kod JavaScript wysyłany do przeglądarki. Nie trzeba zakładać nowej bazy, dostawcy logowania ani aplikacji w Entra ID.

Wybierz jeden kanoniczny adres aplikacji. Gdy korzystacie z domeny niestandardowej, wpisz ją do `PV_APP_ORIGIN` i wchodźcie przez nią. Logowanie z innego aliasu zostanie odrzucone jako inny origin.

## 5. Sprawdź prywatność kontenera i CORS

W koncie **Storage**, kontener `fullsize` powinien mieć poziom dostępu **Private / brak anonimowego dostępu**. Sam ekran logowania nie ukryje plików, jeśli kontener jest publiczny. Nie włączaj publicznego dostępu w celu naprawy uploadu.

W ustawieniach CORS usługi **Blob service** dodaj / uzupełnij regułę dla tej aplikacji. Nie kasuj bez sprawdzenia reguł innych aplikacji korzystających z tego samego konta.

| Pole | Ustawienie |
|---|---|
| Allowed origins | Dokładny `PV_APP_ORIGIN`, np. adres HTTPS aplikacji; nie `*`. |
| Allowed methods | `GET`, `HEAD`, `PUT`, `OPTIONS`. |
| Allowed headers | `content-type`, `x-ms-*`. Dla prostszej konfiguracji może być `*`, ale nadal przy konkretnym originie. |
| Exposed headers | `ETag`, `Content-Length`, `Content-Type`, `Content-Range`, `Accept-Ranges`, `x-ms-*`. |
| Max age | Np. `3600`. |

Dla lokalnego developmentu dodaj osobną regułę z originem `http://127.0.0.1:5173`. Funkcje API pozostają na tym samym originie co frontend; ta reguła CORS dotyczy bezpośredniego przesyłania do Blob Storage. CORS nie zastępuje autoryzacji; dostęp do blobów zapewnia ograniczony SAS.

## 6. Weryfikacja i publikacja

```powershell
git status --short
git check-ignore .photovault-secrets.json api/local.settings.json
git add .
git diff --cached --stat
# Przejrzyj zmiany i upewnij sie, ze nie ma lokalnych sekretow.
git commit -m "Modernize private PhotoVault with multi-upload and video"
git push -u origin feature/photovault-v2
```

Zrób Pull Request do `main` i sprawdź GitHub Actions. Workflow zachowuje nazwę istniejącego sekretu wdrożeniowego `AZURE_STATIC_WEB_APPS_API_TOKEN_ORANGE_MUD_0D4947503`, buduje frontend, wykonuje testy, a następnie przesyła `dist` i `api`. Runtime backendu to Node 22.

**Preview z PR ma inny adres niż produkcja.** Jeśli chcesz testować logowanie na preview, ustaw dla tego środowiska jego własny `PV_APP_ORIGIN`, CORS i najlepiej osobny prywatny kontener. Nie testuj trwałego usuwania na preview współdzielącym produkcyjny `fullsize`. Nie zmieniaj originu produkcji na adres preview.

Przed scaleniem / po wdrożeniu sprawdź: logowanie obu kont; stary album; jednoczesny upload 2 zdjęć i MP4; pasek postępu; odtwarzanie i przewijanie filmu; ulubione; przeniesienie testowego pliku do kosza i przywrócenie; pobranie oryginału; telefon; wylogowanie.

W osobnym oknie incognito `GET /api/getPhotosByEvent?event=NAZWA` ma zwrócić **401**, nie listę linków. Zwykły adres prywatnego bloba bez SAS nie powinien udostępniać pliku. Nie traktuj samego zielonego buildu jako potwierdzenia ustawionych sekretów i CORS.

## Diagnostyka

| Objaw | Co sprawdzić |
|---|---|
| `CONFIGURATION` / 503 na logowaniu | Wartości PV_USERS, PV_SESSION_SECRET i PV_APP_ORIGIN w odpowiednim środowisku SWA. |
| 403 / CSRF przy logowaniu lub zmianie | Dokładne dopasowanie adresu do PV_APP_ORIGIN; bez `/`; lokalnie 127.0.0.1:5173. |
| 429 przy logowaniu | Osiągnięto 8 prób na konto w 15 minut. Poczekaj; prawidłowe próby też są liczone. |
| Upload: CORS / Network error | Reguła Blob service: właściwy origin, PUT i nagłówki x-ms-*. Nie upubliczniaj kontenera. |
| Upload: 403 po długim czasie | Link do konkretnego pliku wygasa po godzinie. Użyj Ponów, aby dostać nowy. |
| Film zapisany, bez obrazu | Sprawdź kodek. MP4 H.264 + AAC jest sensownym formatem roboczym; MOV / HEVC nie daje gwarancji obsługi. |
| Nowy album pusty po uploadzie | Sprawdź błędy w kolejce, kliknij Odśwież, sprawdź ustawiony kontener. |
| Stary postcss / tailwind module not found | Prawdopodobnie skopiowano pliki na stare bez usunięć. Zastosuj pełny patch lub pracuj w czystym folderze. |

## Zmiana hasła i kopie zapasowe

Ponownie uruchom `npm run setup`, ustaw oba konta i przepisz wygenerowane wartości do Azure. Zmiana hasha unieważnia stare sesje tego konta; zmiana sekretu — wszystkie sesje. Nie ma mailowego resetu haseł.

Zanim zaczniecie używać apki jako jedynego archiwum, zachowajcie niezależną kopię oryginałów. Opcjonalna ochrona przed usunięciem po stronie Azure jest osobną funkcją; aplikacyjny kosz sam w sobie nie jest backupem.

## Dokumentacja producentów

- [Zmienne API w Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/application-settings)
- [Routing, konfiguracja i runtime Node 22](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration)
- [CORS dla Azure Storage](https://learn.microsoft.com/en-us/rest/api/storageservices/cross-origin-resource-sharing--cors--support-for-the-azure-storage-services)
- [Przechowywanie haseł: OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Kodeki wideo: MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs)
