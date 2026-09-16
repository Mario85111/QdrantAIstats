# HydrantStats — SCOPE

Wsad: [intent/2026-09-15-brak-wgladu-w-srodowisko-testowe-rag.md](intent/2026-09-15-brak-wgladu-w-srodowisko-testowe-rag.md)
Konsument briefu: agent AI (Claude Code). Data: 2026-09-15. Status: draft.

## 1. PROBLEM I CEL

**Problem (1 zdanie):** Stan środowiska testowego wiedzy (data zasilenia, rozmiar zasobu, czas odpowiedzi) jest nieodczytywalny bez wejścia do n8n, przez co wnioski z eksperymentów nie mają oparcia w odczycie.

**Metryka sukcesu MVP:** Stan środowiska odczytany w < 10 s bez otwierania n8n i Qdranta, dla 100% wsadów znany jawny status (weszło / nie weszło), historia czasu odpowiedzi dostępna min. 30 dni wstecz.

**Hipoteza biznesowa, którą MVP testuje:** Jeśli stan zasobu i czas odpowiedzi są widoczne obok czatu, eksperyment „przed i po" zmianie konfiguracji RAG daje wniosek obronialny odczytem, a nie pamięcią.

## 2. UŻYTKOWNICY I ROLE

| rola | kto to | co może | czego NIE może |
|---|---|---|---|
| Operator (jedyna rola) | autor, na własnej maszynie | wszystko: wsad, czat, odczyt statystyk | n/d |

Druga rola nie powstaje. Aplikacja nasłuchuje wyłącznie na `127.0.0.1` — brak logowania jest tu decyzją, nie zaniedbaniem, bo nie ma wystawienia na sieć.

## 3. ZAKRES (MoSCoW)

### MUST (MVP) — 7 funkcji

**M-1 | Wsad pliku z jawnym statusem**
Given uruchomioną aplikację, when operator przeciągnie plik na pole wsadu, then plik trafia POST-em na webhook ingest w n8n, a interfejs pokazuje jeden z trzech stanów: `w toku` / `w zasobie` / `błąd + treść błędu`. Stan `w toku` nigdy nie jest stanem końcowym — po przekroczeniu timeoutu (120 s) przechodzi w `błąd: timeout`.

**M-2 | Trwała historia wsadów**
Given wykonane wcześniej wsady, when operator otworzy aplikację po restarcie, then widzi listę ostatnich 50 wsadów: nazwa pliku, rozmiar, czas rozpoczęcia, czas trwania, status końcowy. Dane przeżywają restart aplikacji i restart maszyny.

**M-3 | Czat z agentem z pomiarem czasu**
Given działający webhook czatu w n8n, when operator wyśle pytanie, then otrzymuje odpowiedź agenta, a aplikacja zapisuje czas do pierwszego bajtu odpowiedzi i całkowity czas odpowiedzi. Każda wymiana jest zapisana trwale wraz z pomiarem.

**M-4 | Panel stanu zasobu wektorowego**
Given dostępny Qdrant, when operator otworzy widok główny, then widzi odczytane bezpośrednio z Qdranta: nazwę kolekcji, liczbę punktów, liczbę segmentów, status kolekcji (`green`/`yellow`/`red`) oraz datę ostatniego udanego wsadu (z M-2). Gdy Qdrant nie odpowiada, panel pokazuje `brak połączenia` z timestampem ostatniego udanego odczytu — nigdy wartości sprzed awarii bez etykiety.

**M-5 | Wykres czasu odpowiedzi i wzrostu zasobu**
Given min. 2 pomiary, when operator otworzy widok statystyk, then widzi dwa wykresy liniowe: czas odpowiedzi czatu w czasie oraz liczba punktów w kolekcji w czasie, z przełącznikiem zakresu 24 h / 7 dni / 30 dni. Retencja jest ręczna — aplikacja niczego nie kasuje (patrz R-6).

**M-6 | Migawka stanu kolekcji w tle**
Given uruchomioną aplikację, when minie interwał 15 minut, then aplikacja zapisuje migawkę stanu kolekcji (liczba punktów, status) do bazy lokalnej. Odpytywanie jest wyłącznie odczytem Qdranta — **nigdy nie wywołuje modelu LLM** (patrz ryzyko R-3).

**M-7 | Reset zasobu do czystego stanu**
Given kolekcję z punktami, when operator kliknie "Wyczyść zasób" i potwierdzi w modalu pokazującym dokładną liczbę punktów do usunięcia, then aplikacja kasuje wszystkie punkty z bieżącej kolekcji (konfiguracja, wymiar wektora — bez zmian) i odświeża panel. Akcja nieodwracalna, bez drugiego potwierdzenia poza modalem — środowisko testowe, dane odtwarzalne ponownym wsadem. Przycisk wyłączony, gdy Qdrant nieosiągalny albo kolekcja pusta.
*Nie jest to obsługa wielu kolekcji (WON'T #4) — to czyszczenie zawartości jednej, tej samej kolekcji, żeby kolejny eksperyment startował z zerowym punktem odniesienia.*

### SHOULD (po MVP)
- Podgląd źródeł (chunków) użytych w ostatniej odpowiedzi agenta.
- Licznik kosztu zapytań (wymaga ustalenia dostawcy modelu — patrz pytanie 2).
- Wsad wielu plików naraz z kolejką.
- Eksport historii pomiarów do CSV.

### COULD (backlog)
- Porównanie dwóch przebiegów eksperymentu obok siebie.
- Usuwanie dokumentu z zasobu z poziomu interfejsu.
- Powiadomienie, gdy wsad się nie powiódł.

### WON'T + OUT OF SCOPE — agent NIE buduje

1. **Logowania, kont, ról, sesji** — żadnej formy uwierzytelniania.
2. **Porównania RAG vs fine-tuning** — kuszące, bo projekt tak się zaczął; MVP buduje wyłącznie aparat pomiarowy, nie eksperyment.
3. **Edycji workflow n8n z poziomu aplikacji** — n8n jest zapleczem, nie jest konfigurowany stąd.
4. **Obsługi wielu kolekcji / wielu środowisk** — jedna kolekcja, nazwa z konfiguracji.
5. **Własnej logiki RAG** — chunkowanie, embedding i retrieval zostają w n8n. Aplikacja ich nie duplikuje ani nie omija.
6. **Wdrożenia w chmurze, Dockerfile produkcyjnego, CI/CD** — uruchomienie lokalne jedną komendą wystarcza.
7. **Testów E2E i pokrycia testami** — wystarczy ręczna weryfikacja acceptance criteria.
8. **Edycji i poprawiania treści dokumentów już obecnych w zasobie.**

## 4. STACK (LOCKED — bez alternatyw)

| warstwa | decyzja |
|---|---|
| Frontend + backend | Next.js 16.3.5, App Router, TypeScript, jeden projekt (route handlers jako BFF) — SCOPE zakładał 15, `create-next-app` zainstalował 16.3.5 jako wersję bieżącą; zmiana przyjęta przy M0 |
| Style | Tailwind CSS v4 |
| Wykresy | Recharts |
| Magazyn pomiarów (historia, czasy, migawki) | Google Sheets, jeden skoroszyt, 4 zakładki; zapis i odczyt przez `googleapis` (Sheets API v4) |
| Uwierzytelnienie do Sheets | konto serwisowe Google (service account), skoroszyt udostępniony na jego adres e-mail z prawem edycji |
| Dostęp do Qdranta | bezpośrednio REST API Qdranta z route handlera (`GET /collections/{name}`) |
| Dostęp do agenta i wsadu | webhooki n8n (dwa: `INGEST_WEBHOOK_URL`, `CHAT_WEBHOOK_URL`) |
| Auth | brak — bind `127.0.0.1` |
| Hosting | lokalny, `npm run dev` / `npm run start` |
| Konfiguracja | `.env.local`: `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`, `INGEST_WEBHOOK_URL`, `CHAT_WEBHOOK_URL`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` (ścieżka do pliku klucza) |

**Dlaczego osobny magazyn, a nie Qdrant:** Qdrant zna stan „teraz", nie zna historii. M-5 wymaga szeregu czasowego — bez osobnego magazynu wykres nie ma z czego powstać.

**Dlaczego Sheets bezpośrednio z aplikacji, a nie przez n8n:** to narzędzie mierzy między innymi to, czy n8n odpowiada i jak szybko. Gdyby pomiary szły przez n8n, awaria n8n kasowałaby dane o tej awarii. Diagnostyka nie zależy od diagnozowanego.

**Konsekwencja wyboru Sheets, którą agent ma uszanować:** odczyt to pobranie zakresu i filtrowanie po stronie aplikacji, nie zapytanie z warunkiem. Dlatego obowiązkowy jest cache w pamięci procesu z TTL 60 s dla danych wykresów oraz zapis wsadowy (`values.append` jednym wywołaniem na zdarzenie, nigdy wiersz po wierszu w pętli).

Warstwa wizualna (minimalistyczna, w duchu estetyki technicznej Qdranta) jest wymogiem z intentu, ale decyzje kolorystyczne i typograficzne **nie należą do tego dokumentu** — agent wykonawczy dostaje je osobno albo podejmuje sam w ramach Tailwinda.

## 5. MODEL DANYCH (Google Sheets — jedna zakładka = jedna encja)

Pierwszy wiersz każdej zakładki to nagłówki, dokładnie w podanej kolejności. Agent nie zmienia kolejności kolumn — odczyt idzie po indeksie.

| zakładka | kolumny |
|---|---|
| `ingest_jobs` | id, filename, size_bytes, started_at, finished_at, status (`pending`/`done`/`error`), error_message, n8n_execution_id, points_before, points_after |
| `conversations` | id, started_at, title |
| `chat_messages` | id, conversation_id, role (`user`/`assistant`), content, created_at, ttfb_ms, total_ms, error_message |
| `collection_snapshots` | id, taken_at, points_count, segments_count, status, reachable (`TRUE`/`FALSE`) |

Zasady zapisu:

- `id` generuje aplikacja (UUID), nie numer wiersza — wiersze w arkuszu mogą być ręcznie przestawione i to nie może niczego zepsuć.
- Wszystkie timestampy w UTC, ISO-8601, zapisywane **jako tekst** (apostrof wiodący), żeby Sheets nie przekonwertował ich na własny format daty.
- Czasy trwania w milisekundach, liczba całkowita.
- `content` w `chat_messages` przycinany do 40 000 znaków przy zapisie — komórka Sheets ma twardy limit [DO WERYFIKACJI: aktualna wartość w dokumentacji Google]. Przycięcie jest oznaczane sufiksem `…[ucięte]`.
- `reachable=FALSE` oznacza migawkę nieudaną — zapisywana świadomie, bo przerwy w odczycie same są danymi diagnostycznymi.
- `points_before` / `points_after` w `ingest_jobs` istnieją po to, by status wsadu dało się obronić liczbą, a nie kodem HTTP (patrz R-2).

## 6. INTEGRACJE

| usługa | rola w systemie | plan / koszt MVP | fallback gdy padnie |
|---|---|---|---|
| Qdrant | źródło prawdy o zasobie wektorowym | instancja własna operatora [DO WERYFIKACJI: lokalna czy Qdrant Cloud] | panel pokazuje `brak połączenia` + czas ostatniego udanego odczytu; aplikacja działa dalej |
| n8n — webhook ingest | przyjmuje plik, wykonuje chunking/embedding/upsert | instancja własna operatora | wsad kończy się statusem `błąd` z treścią; nic nie ginie po cichu |
| n8n — webhook czatu | wykonuje retrieval i wywołanie modelu | instancja własna operatora | czat pokazuje błąd; historia pomiarów nietknięta |
| Dostawca modelu LLM | wywoływany **wyłącznie** wewnątrz n8n, aplikacja nie zna jego klucza | [DO WERYFIKACJI: jaki dostawca i jaki plan] | poza kontrolą aplikacji |
| Google Sheets API v4 | magazyn historii wsadów, pomiarów czasu i migawek kolekcji | darmowy poziom Google Cloud; limity zapisu i odczytu [DO WERYFIKACJI: aktualne wartości w dokumentacji Google] | przy błędzie zapisu aplikacja pokazuje `pomiar niezapisany` przy danym zdarzeniu i działa dalej; **nie** kolejkuje i nie ponawia w tle (poza zakresem MVP) |

Aplikacja nie trzyma i nie widzi klucza do modelu — to celowa granica. Sekrety po jej stronie to wyłącznie `QDRANT_API_KEY` i plik klucza konta serwisowego Google.

**Wolumen wobec limitów:** przy 15-minutowym interwale migawek to ok. 96 zapisów na dobę plus zapisy przy każdym wsadzie i każdej wymianie w czacie. To rząd wielkości daleki od jakichkolwiek progów Sheets — pod warunkiem, że obowiązuje cache i zapis wsadowy z sekcji 4. [SZACUNEK: wyliczenie z interwału M-6]

## 7. NFR + COMPLIANCE

- **RODO: nie ma zastosowania** [DANE: operator, 2026-09-15] — brak danych osobowych i treści poufnych, środowisko testowe. Warunek powrotu wymogu: pierwszy prawdziwy dokument klienta w zasobie. Wtedy SCOPE wymaga rewizji, nie łatki.
- **Bezpieczeństwo:** jeden operator, bind `127.0.0.1`, brak wystawienia na sieć, brak uwierzytelniania. Sekrety wyłącznie w `.env.local`; **`.env.local` oraz plik klucza konta serwisowego Google obowiązkowo w `.gitignore`** — repozytorium jest publiczne, a wyciek klucza serwisowego to jedyny realny incydent bezpieczeństwa możliwy w tym projekcie. Skoroszyt Sheets nie jest udostępniany publicznie, wyłącznie na adres konta serwisowego. Rozmiar wsadu ograniczony do 50 MB na plik [ZAŁOŻENIE].
- **Wydajność:** nie jest krytyczna. Jedyny twardy wymóg: interfejs nie blokuje się na czas wsadu ani odpowiedzi agenta — operacje asynchroniczne ze stanem widocznym na ekranie.
- **Dostępność / SLA / backup:** brak wymogów. Utrata bazy SQLite oznacza utratę historii pomiarów i jest akceptowalna; zasób wektorowy jest odtwarzalny wsadem.

## 8. MILESTONES + BUDŻET

**M0 — szkielet end-to-end (happy path)**
Zakres: projekt Next.js, konfiguracja `.env`, jeden ekran, wsad jednego pliku na webhook n8n, odczyt `GET /collections/{name}` z Qdranta, wyświetlenie liczby punktów, **dopisanie jednego wiersza do zakładki `ingest_jobs` w Sheets**.
*Definition of done:* operator wrzuca plik, po zakończeniu widzi wzrost liczby punktów w panelu i nowy wiersz w arkuszu — bez restartu aplikacji, bez zaglądania do n8n.
*Szacunek:* 8–12 h roboczych (uwzględnia jednorazową konfigurację konta serwisowego Google i udostępnienie skoroszytu).

**M1 — MVP kompletny (wszystkie MUST)**
Zakres: M-1…M-6 wraz z SQLite, historią, czatem, wykresami i migawkami w tle.
*Definition of done:* wszystkie acceptance criteria z sekcji 3 przechodzą ręczną weryfikację; po restarcie maszyny historia i pomiary są na miejscu; odcięcie Qdranta nie wywraca aplikacji, tylko zmienia stan panelu.
*Szacunek:* 22–34 h roboczych łącznie z M0.

**M2 — SHOULD**
Zakres: podgląd źródeł odpowiedzi, licznik kosztu, kolejka wielu plików, eksport CSV.
*Definition of done:* każda pozycja SHOULD dostaje własne kryterium w chwili jej podjęcia — nie wcześniej.
*Szacunek:* 12–20 h.

**Założenia wyceny:** szacunek w godzinach roboczych, nie w pieniądzu — projekt realizuje operator z agentem kodującym, więc stawka nie jest ustalona. [ZAŁOŻENIE | ryzyko MED] Widełki zakładają, że oba webhooki n8n **już istnieją i działają**; jeśli trzeba je zbudować od zera, doliczyć osobny zakres po stronie `n8n-architekt`. Zakładają też, że operator ma konto Google i może założyć projekt w Google Cloud z włączonym Sheets API [ZAŁOŻENIE | ryzyko LOW].

## 9. RYZYKA

| # | ryzyko | prawdop. | wpływ | mitygacja |
|---|---|---|---|---|
| R-1 | Webhooki n8n nie istnieją albo mają inny kontrakt niż zakładany (nazwa pola pliku, kształt odpowiedzi) | **WYSOKIE** | blokuje M0 | Pierwsze zadanie M0: potwierdzić kontrakt obu webhooków ręcznym wywołaniem i **zapisać go w repo** jako `docs/n8n-contract.md`. Agent nie zgaduje kształtu payloadu. |
| R-2 | Wsad w n8n jest asynchroniczny — webhook odpowiada `200` zanim dokument wejdzie do zasobu, więc status `w zasobie` kłamie | ŚREDNIE | podważa M-1, czyli sedno projektu | Status `w zasobie` potwierdzany wzrostem liczby punktów w Qdrancie, nie samym kodem HTTP. Brak wzrostu w oknie timeoutu → `błąd: niepotwierdzone`. |
| R-3 | Migawki w tle (M-6) przypadkowo wywołują model i generują koszt bez udziału operatora | ŚREDNIE | koszt rosnący po cichu — dokładnie to, co intent wskazał jako niewidoczne | Migawka odpytuje **wyłącznie** REST Qdranta. Zakaz wywołania webhooka czatu z jakiegokolwiek zadania w tle jest wiążący dla agenta. |
| R-4 | Przeinżynierowanie narzędzia jednoosobowego (auth, Docker, testy, wiele kolekcji) | ŚREDNIE | zabija projekt czasem, nie błędem | Sekcja OUT OF SCOPE jest wiążąca. Każdy plik spoza MUST wymaga zgody operatora. |
| R-5 | Klucz konta serwisowego Google trafia do publicznego repozytorium | NISKIE | wysoki — dostęp do zasobów Google operatora | `.gitignore` przed pierwszym commitem kodu, klucz poza katalogiem projektu jeśli to możliwe. Agent nigdy nie wkleja treści klucza do pliku śledzonego przez Gita. |
| R-6 | Odczyt 30 dni pomiarów pod wykres = pobranie całej zakładki przy każdym renderze; interfejs zwalnia wraz z historią | ŚREDNIE | degradacja M-5 po kilku tygodniach | Cache w pamięci procesu, TTL 60 s (sekcja 4). Gdy `collection_snapshots` przekroczy 10 000 wierszy, operator archiwizuje ręcznie do drugiego skoroszytu — automatycznej retencji w MVP nie ma. |

## 10. INSTRUKCJE DLA AGENTA WYKONAWCZEGO

- Buduj wyłącznie MUST z sekcji 3. **OUT OF SCOPE jest wiążący** — także pozycje wyglądające na „dopiszę przy okazji, to 5 minut".
- Kolejność: **M0 → akceptacja operatora → M1**. Nie zaczynaj M1 przed potwierdzeniem, że M0 działa end-to-end.
- Zadanie zerowe: `.gitignore` z `.env.local` i plikiem klucza Google **przed pierwszym commitem kodu** (R-5). Repozytorium jest publiczne.
- Zadanie pierwsze: potwierdź kontrakt webhooków n8n (R-1) i zapisz go w `docs/n8n-contract.md`. Dopiero potem kod.
- Google Sheets jest wołany wyłącznie z route handlerów po stronie serwera. Klucz konta serwisowego nigdy nie trafia do kodu klienta ani do zmiennej z prefiksem `NEXT_PUBLIC_`.
- Niejasność w trakcie → **STOP i pytanie**, nigdy zgadywanie. Dotyczy zwłaszcza kształtu payloadów n8n i nazwy kolekcji.
- Żadne zadanie w tle nie wywołuje modelu LLM (R-3).
- Definition of done M1: wszystkie acceptance criteria z MUST przechodzą ręczną weryfikację przy udziale operatora.
