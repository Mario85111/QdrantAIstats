# Intent: Brak wglądu w stan własnego środowiska testowego wiedzy

Autor: Mariusz (właściciel i jedyny operator środowiska testowego „RagQdrant"). Status: draft. Data: 2026-09-15.

## Problem

Każdy eksperyment na własnym środowisku testowym wiedzy zaczyna się od czynności technicznej:
wejścia do narzędzia automatyzacji i ręcznego odpalenia procesu zasilania. Po jego wykonaniu nie
widać, czy dokument faktycznie wszedł, kiedy zasób wiedzy był ostatnio zasilony, jak urósł i czy
odpowiedzi przyspieszyły czy zwolniły. W efekcie po kilku dniach przerwy nie da się stwierdzić, w
jakim stanie jest środowisko, a porównywanie „przed i po" zmianie w konfiguracji opiera się na
pamięci, nie na odczycie. Ślepota diagnostyczna jest tu kosztowniejsza niż sama uciążliwość wsadu —
środowisko testowe, którego stanu nie widać, nie nadaje się do wyciągania wniosków.

## Dowody

- [DANE: autor, 2026-09-15] Dostęp do środowiska ma wyłącznie autor; brak danych osobowych i treści poufnych w dokumentach — to środowisko testowe, nie produkcja.
- [DO WERYFIKACJI] Ile razy w ostatnim miesiącu trzeba było wejść do narzędzia automatyzacji tylko po to, by sprawdzić stan — autor, obserwacja przez 2 tygodnie.
- [DO WERYFIKACJI] Aktualny rozmiar zasobu wiedzy i średni czas odpowiedzi — dziś nie są nigdzie pokazywane, co jest częścią problemu; pierwszy odczyt będzie jednocześnie wartością bazową.
- [DO WERYFIKACJI] Ile razy zdarzyło się prowadzić eksperyment na zasobie, który nie został poprawnie zasilony — dziś niewykrywalne.

## Proponowany rezultat

Autor w jednym miejscu widzi, w jakim stanie jest środowisko: kiedy było ostatnio zasilone, jak duży
jest zasób wiedzy, jak zmieniał się czas odpowiedzi w czasie. Wrzucenie nowego dokumentu jest
czynnością samą w sobie zakończoną jawnym statusem („weszło" / „nie weszło"), bez zaglądania do
narzędzia technicznego. Zadanie pytania i obejrzenie odpowiedzi odbywa się w tym samym miejscu, w
którym widać stan zasobu — więc wniosek z eksperymentu da się od razu powiązać z tym, na czym był
robiony.

## Kryteria sukcesu

| metryka | dziś | oczekiwane | skąd odczyt | horyzont |
|---|---|---|---|---|
| Odczyt stanu środowiska bez wchodzenia do narzędzia automatyzacji | niemożliwy | możliwy, < 10 s | obserwacja własna | 30 dni |
| Odsetek wsadów kończących się jawnym statusem | [DO WERYFIKACJI, dziś brak sygnału] | 100% | licznik w rozwiązaniu | 60 dni |
| Czas od „mam plik" do „wiem, że jest w zasobie" | [DO WERYFIKACJI] | < 2 min pracy człowieka | pomiar na 5 wsadach | 60 dni |
| Historia czasu odpowiedzi możliwa do porównania między eksperymentami | brak | min. 30 dni wstecz | wykres w rozwiązaniu | 90 dni |

## Dotknięci użytkownicy i systemy

| rola / system | jak odczuje zmianę | czy wie, że jest w to wciągnięty |
|---|---|---|
| Autor jako operator | przestaje zgadywać stan środowiska przed eksperymentem | tak — zgłaszający |
| Autor jako eksperymentator | zyskuje porównywalne odczyty między przebiegami | tak |
| Dostawca modelu / budżet na zapytania | każde pytanie i każdy wsad to realny koszt, dziś nigdzie nie widoczny | **nie — nikt o to nie prosił, a rośnie sam** |
| Przyszły odbiorca demo (klient / znajomy) | to, co dziś jest warsztatem, bywa pokazywane — ekran staje się wizytówką | **nie — poza dzisiejszym zakresem, ale odczuje** |
| Istniejący proces automatyzacji + zasób wektorowy | staje się zapleczem obsługiwanym z zewnątrz, nie punktem wejścia | n/d |

## Ograniczenia

- **Brak twardego terminu zewnętrznego** [DANE: autor] — nie ma daty demo ani klienta; to zdejmuje presję, ale też odbiera naturalny moment „skończone".
- **Nie wolno ruszać** istniejącego procesu automatyzacji ani zasobu wektorowego jako źródła prawdy — rozwiązanie ma je obserwować i obsługiwać, nie zastępować.
- **Środowisko testowe, nie produkcyjne** — brak wymogów dostępności, SLA, kopii zapasowych i kontroli dostępu; utrata zasobu jest akceptowalna i odtwarzalna wsadem.
- **RODO nie ma zastosowania** [DANE: autor] — brak danych osobowych w dokumentach. Ograniczenie wraca w chwili, gdy wejdzie pierwszy prawdziwy dokument klienta.
- **Koszt zapytań** jest jedyną granicą ekonomiczną — rozwiązanie nie może zachęcać do pętli zapytań ani odpytywać w tle.

## Poza zakresem

- Porównanie skuteczności RAG vs fine-tuning jako funkcja rozwiązania — kuszące (nazwa projektu to sugeruje), ale to osobny problem badawczy; tutaj powstaje tylko aparat pomiarowy, nie sam eksperyment.
- Konta, role, uwierzytelnianie, praca wielu osób — środowisko jest jednoosobowe.
- Wiele odseparowanych zasobów wiedzy (multi-tenant) i przełączanie się między nimi.
- Edycja i poprawianie treści dokumentów już znajdujących się w zasobie.
- Budowanie i edycja samego procesu automatyzacji z poziomu nowego rozwiązania.

## Sugerowane kierunki (niewiążące)

Product owner i Stage 2 nie są nimi związani.

- Frontend nad istniejącym workflow n8n: wrzucanie plików, czat z agentem, panel diagnostyczny.
- Panel: data ostatniej aktualizacji zasobu wektorowego, jego rozmiar, średni czas odpowiedzi, wykresy zmian w czasie.
- Warstwa wizualna: minimalistyczna i czysta, w duchu estetyki technicznej Qdranta; wyraźna niechęć do szablonowych layoutów.

## Koszt zaniechania

Przez 12 miesięcy środowisko pozostaje sprawne, ale nieobserwowalne — działa i nikt nie ginie, więc
koszt bezpośredni jest **niski i trzeba to powiedzieć wprost**. Realna strata jest pośrednia: każdy
eksperyment na tym środowisku daje wniosek, którego nie da się obronić odczytem, więc czas włożony w
eksperymenty nie zamienia się w wiedzę. Drugi koszt to koszt zapytań rosnący bez żadnego licznika.

## Otwarte pytania

| pytanie | kto odpowiada | blokuje Stage 2 |
|---|---|---|
| Czy statystyki mają kiedyś służyć porównywaniu wariantów (RAG vs fine-tuning), czy wyłącznie diagnostyce bieżącej? | autor | NIE — ale zmienia, czy odczyty trzeba archiwizować od pierwszego dnia |
| Jakie „inne ważne statystyki" poza datą, rozmiarem i czasem odpowiedzi? (liczba dokumentów, koszt zapytań, trafienia wyszukiwania?) | autor | NIE |
| Czy to ma kiedykolwiek wyjść poza Twój komputer (demo, publiczny adres)? | autor | NIE — ale zmienia ograniczenia bezpieczeństwa |
| Jaki jest dzisiejszy rozmiar zasobu i czas odpowiedzi (wartości bazowe)? | autor (pomiar) | NIE |

## Decyzja product ownera

Status: oczekuje / przyjęte do Stage 2 / odrzucone — powód: …
