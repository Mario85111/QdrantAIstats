# HydrantStats

Interfejs operacyjny nad własnym środowiskiem testowym wiedzy: wsad dokumentów, czat z agentem i odczyt kondycji zasobu wektorowego — bez wchodzenia do n8n i Qdranta.

Łańcuch artefaktów: [intent](intent/2026-09-15-brak-wgladu-w-srodowisko-testowe-rag.md) → [SCOPE.md](SCOPE.md) → [workflow n8n](docs/n8n/README.md) → kod.

**Stan: M1** — wszystkie MUST ze SCOPE.md zaimplementowane: wsad pliku (M-1), historia wsadów (M-2), czat z pomiarem czasu (M-3), panel stanu kolekcji (M-4), wykresy (M-5), migawki w tle co 15 min (M-6).

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # uzupełnij wartości
npm run dev
```

Aplikacja startuje na `http://localhost:3000`. Bez `.env.local` uruchomi się i pokaże `Qdrant offline` z opisem braku — to zachowanie zamierzone, nie błąd.

## Wymagania po stronie zaplecza

1. Qdrant z kolekcją o **wymiarze 1024** (model `baai/bge-m3`) — instrukcja w [docs/n8n/README.md](docs/n8n/README.md).
2. Aktywne workflow n8n — kontrakt w [docs/n8n-contract.md](docs/n8n-contract.md). Stan:
   - **czat** ✅ zweryfikowany end-to-end (odpowiedź z bazy wiedzy, pamięć rozmowy, brak konfabulacji),
   - **wsad** ⚠️ obsługiwany w n8n przez formularz (Form Trigger), nie przez webhook — wsad z poziomu aplikacji zadziała dopiero po dorobieniu workflow z węzłem Webhook na ścieżce `rag-ingest`.
3. Opcjonalnie: skoroszyt Google Sheets z 4 zakładkami i konto serwisowe z prawem edycji. Bez tego wsad, czat i migawki w tle działają, a każdy pomiar jest po prostu oznaczany jako niezapisany — historia, czat i wykresy pokażą wtedy komunikat "Sheets nie jest skonfigurowany".

### Zakładanie Google Sheets

1. Utwórz nowy skoroszyt Google Sheets.
2. Dodaj 4 zakładki z **dokładnie takimi nazwami i nagłówkami w pierwszym wierszu** (kolejność kolumn ma znaczenie — kod czyta po indeksie, nie po nazwie nagłówka):

   | zakładka | nagłówki (wiersz 1) |
   |---|---|
   | `ingest_jobs` | `id, filename, size_bytes, started_at, finished_at, status, error_message, n8n_execution_id, points_before, points_after` |
   | `conversations` | `id, started_at, title` |
   | `chat_messages` | `id, conversation_id, role, content, created_at, ttfb_ms, total_ms, error_message` |
   | `collection_snapshots` | `id, taken_at, points_count, segments_count, status, reachable` |

3. Załóż konto serwisowe w Google Cloud (projekt z włączonym Sheets API) i pobierz plik klucza JSON. Trzymaj go **poza katalogiem projektu**.
4. Udostępnij skoroszyt na adres e-mail konta serwisowego (widoczny w pliku klucza, pole `client_email`) z prawem **edycji**.
5. Wpisz w `.env.local`: `GOOGLE_SHEETS_ID` (z adresu URL skoroszytu) i `GOOGLE_SERVICE_ACCOUNT_JSON` (ścieżka do pliku klucza).

Pełny opis schematu: [SCOPE.md, sekcja 5](SCOPE.md#5-model-danych-google-sheets--jedna-zakładka--jedna-encja).

## Zasady, które trzymają ten projekt

- **Status „w zasobie" potwierdza wzrost liczby punktów w Qdrancie, nie kod HTTP z n8n.** Webhook może odpowiedzieć `200`, zanim embedding się skończy — wtedy interfejs kłamałby o tej jednej rzeczy, dla której powstał.
- **Pomiary zapisuje aplikacja, nie n8n.** Narzędzie mierzy między innymi to, czy n8n działa; gdyby pomiary szły przez n8n, jego awaria kasowałaby dane o tej awarii.
- **Żadne zadanie w tle nie wywołuje modelu LLM.** Odświeżanie statystyk odpytuje wyłącznie REST Qdranta — koszt zapytań nie może rosnąć bez udziału operatora.

## Sekrety

`.env.local` i plik klucza konta serwisowego Google **nigdy** nie trafiają do repozytorium — jest publiczne. Klucz trzymaj poza katalogiem projektu.
