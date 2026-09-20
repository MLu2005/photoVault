# Architektura, model danych i granice ochrony

## Założenia

Dwie zaufane osoby, jedna wspólna przestrzeń. To nie jest aplikacja wielodostępna z izolowanymi kontami klientów. Oboje możecie dodawać, oglądać, oznaczać i usuwać wszystkie media. Nie ma publicznej rejestracji ani udostępniania albumów osobom trzecim.

## Przepływ

Przeglądarka → API na `/api/*` (uwierzytelnienie) → krótkotrwały SAS do jednego bloba → bezpośredni transfer przeglądarka / Blob Storage. Plik nie jest buforowany w Azure Function. Nie dodano SDK Azure do frontendu.

| Endpoint | Metoda | Sesja |
|---|---|---|
| authLogin | POST | Nie; wymagane origin i nagłówek klienta; rate limit. |
| authSession | GET | Opcjonalna; anonimowo tylko user:null. |
| authLogout | POST | Tak. |
| getPhotosByEvent | GET | Tak, także gdy event jest znany. |
| getEventsList | GET | Tak. |
| createEvent | POST | Tak. |
| getUploadUrl | POST | Tak; dawny GET nie jest obsługiwany. |
| completeUpload | POST | Tak. |
| updateMedia | PATCH | Tak. |
| deletePhoto | DELETE | Tak. |
| deleteEvent | DELETE | Tak. |
| getMediaLink | POST | Tak. |

Bindings Functions mają `authLevel: anonymous`, ponieważ uwierzytelnienie odbywa się w kodzie wspólnego handlera, a nie przez klucze Functions / logowanie SWA. Nie należy mylić tego z anonimowym dostępem do danych. Stara luka w `getPhotosByEvent` została usunięta w tym modelu: endpoint nie wygeneruje linków bez prawidłowej sesji.

## Hasła i sesja

Konfiguracja `PV_USERS` po stronie API: JSON z username, displayName i passwordHash. Hash: scrypt N=32768, r=8, p=3, losowa sól, 64-bajtowy wynik. Parametry odpowiadają jednemu z wariantów opisanych przez OWASP. Nie są to hasła wprost ani zwykły SHA-256.

Sesja to podpisany HMAC-SHA256 token w cookie `__Host-pv_session; Path=/; Secure; HttpOnly; SameSite=Strict`. Nie jest zapisywana w localStorage. Token ma datę wygaśnięcia, użytkownika, token CSRF oraz wersję zależną od hasha hasła. Wszystkie zapisy wymagają dokładnego Origin, JSON, `X-PV-Request` i tokena CSRF. `PV_DEV_HTTP=true` zmienia nazwę cookie i dopuszcza HTTP wyłącznie lokalnie, nie przy wykrytym hostingu Functions.

Ograniczenie logowania: 8 prób na nazwę konta / 15 minut, także prawidłowych. Nieznane nazwy korzystają z jednej wspólnej puli. Stan jest w małym pliku Blob, aktualizowany warunkowo przez ETag, więc limit nie znika po cold starcie funkcji. To podstawowa ochrona przed zgadywaniem, nie infrastruktura DDoS ani wieloskładnikowe logowanie. Ktoś może spowodować czasową blokadę konta, generując nieudane próby.

**Granice:** wylogowanie usuwa cookie z danej przeglądarki, ale nie prowadzi centralnej listy unieważnionych podpisanych tokenów. Zmiana sekretu usuwa ważność wszystkich starych sesji; zmiana hasha lub usunięcie konta unieważnia jego sesje. Już wydany SAS może nadal działać do końca swojego godzinnego terminu, także po wylogowaniu. Osoba, która skopiuje pełny SAS URL, ma czasowy dostęp do tego konkretnego pliku. Nie udostępniaj takich linków publicznie.

## Kompatybilność i metadane

Stare pliki `album/1759861234567_nazwa.jpg` są odczytywane bez przepisywania. Nowe mają `album/UUID_nazwa.jpg`. Obsługiwane są zdefiniowane rozszerzenia zdjęć i filmów; pliki bez rozszerzenia, nietypowe nazwy albumów z ukośnikami / wiodącą kropką oraz ukryte pliki systemowe nie są elementami galerii. Oryginały pozostają w Storage nawet wtedy, gdy nie mają podglądu.

| Element | Znaczenie |
|---|---|
| `pv_favorite` | Wspólne ulubione; string true/false. |
| `pv_trashed` | Data przeniesienia do kosza; brak oznacza aktywny plik. |
| `pv_uploaded` | Data finalizacji uploadu; w starych plikach stosowany createdOn. |
| `pv_uploader` | Login osoby finalizującej upload. |
| `pv_thumb` | Czy dostępna jest miniatura JPEG. |
| `album/.pv-album.json` | Marker istnienia pustego albumu. |
| `album/.pv-thumbs/hash.jpg` | Oddzielna miniatura danego bloba. |
| `.pv-system/login/HMAC.json` | Licznik logowania, bez nazwy konta w nazwie pliku i bez haseł. |

Zmiany metadanych zachowują inne istniejące metadane i stosują ETag, aby ograniczyć nadpisywanie równoległych zmian. Kosz nie przemieszcza binarnych danych. Trwałe usunięcie wymaga uprzedniego oznaczenia jako kosz. Usunięcie zawartości albumu pracuje stronami po 60 surowych wpisów, najwyżej cztery operacje metadanych naraz; nie kasuje samego albumu.

## Upload i ograniczenia

API sprawdza nazwy, dozwolone rozszerzenia i deklarowany rozmiar. Finalizacja sprawdza rozmiar zapisanego bloba i opcjonalną miniaturę. Format jest rozpoznawany na podstawie rozszerzenia; to nie pełna analiza binarna, skaner malware ani walidator kodeków.

SAS `cw` jest ograniczony do jednego bloba i nie daje odczytu / listowania kontenera. Uprawnienia są wydawane z wyprzedzeniem, dlatego limit rozmiaru to mechanizm aplikacji, nie twarda kwota Storage przeciwko złośliwemu zalogowanemu użytkownikowi. Ten model zakłada zaufanie pomiędzy Wami.

Plik do 8 MiB używa pojedynczego PUT. Większy: 4 MiB / blok, dwa bloki naraz, commit BlockList. Błąd jednej części wstrzymuje pozostałe danego pliku; inne pliki kolejki nadal działają. Ręczne Ponów zachowuje UUID i pobiera nowy SAS. Jeżeli oryginał już został zapisany, a zawiodła finalizacja, ponowienie nie wysyła oryginału jeszcze raz w tej samej karcie. Po przeładowaniu nie ma trwałej kolejki.

Anulowanie po zapisaniu oryginału nie wycofuje go automatycznie. Może pozostać bez miniatury, ale będzie widoczny po odświeżeniu. Anulowanie przesyłania bloków przed commit nie tworzy kompletnego, widocznego pliku. Przy ręcznym usuwaniu / zmianach poza aplikacją mogą pozostać osierocone miniatury; nie ma agresywnego automatycznego sprzątania.

Miniatury zdjęć powstają tylko dla plików do 40 MiB, żeby ograniczyć użycie pamięci telefonu. Gdy przeglądarka nie dekoduje zdjęcia / filmu, miniatura jest pomijana; oryginał nie przepada. Wideo w galerii nie pobiera automatycznie wszystkich oryginałów.

## Skala i odświeżanie

API stronicuje listę po 200 surowych blobów. Klient pobiera wszystkie strony metadanych, a w DOM pokazuje porcje po 60 mediów. Wyszukiwanie jest lokalne; brak bazy / indeksu oznacza O(n) listowanie biblioteki. Przy bardzo dużym archiwum potrzebny będzie osobny indeks; ta wersja nie udaje rozwiązania dla milionów plików.

Biblioteka odświeża się po Waszych operacjach w tej karcie i ręcznie przyciskiem Odśwież. Co minutę sprawdza, czy widoczna karta ma dane starsze niż 30 minut, i w razie potrzeby odnawia listę / SAS. Nie ma natychmiastowego push pomiędzy dwoma telefonami. W localStorage są tylko preferencje motywu i układu, nie pliki / tokeny.

## Czego nie zmieniono automatycznie

Nie skonfigurowano za Ciebie dostępu publicznego Storage, CORS, kopii zapasowych, kluczy, DNS, domeny niestandardowej, kosztów, subskrypcji ani deploymentu. Te ustawienia zależą od Twojego istniejącego Azure. Statyczny HTML / JS może być pobrany bez logowania — to normalne; nie zawiera sekretów. Dostęp do mediów wymaga sesji oraz prywatnego kontenera.
