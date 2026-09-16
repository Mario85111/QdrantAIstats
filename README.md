# QdrantAIstats

Interfejs operacyjny nad własnym środowiskiem testowym wiedzy: wsad dokumentów, czat z agentem i odczyt kondycji zasobu wektorowego — bez wchodzenia do n8n i Qdranta.

Łańcuch artefaktów: [intent](intent/2026-09-15-brak-wgladu-w-srodowisko-testowe-rag.md) → [SCOPE.md](SCOPE.md) → [workflow n8n](docs/n8n/README.md) → kod.

**Stan: M0** — szkielet end-to-end. Działa wsad pliku i odczyt stanu kolekcji. Czat, historia i wykresy (M-2…M-6) są w M1.

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # uzupełnij wartości
npm run dev
```

Aplikacja startuje na `http://localhost:3000`. Bez `.env.local` uruchomi się i pokaże `Qdrant offline` z opisem braku — to zachowanie zamierzone, nie błąd.

## Wymagania po stronie zaplecza

1. Qdrant z kolekcją o **wymiarze 1024** (model `baai/bge-m3`) — instrukcja w [docs/n8n/README.md](docs/n8n/README.md).
2. Dwa aktywne workflow n8n — kontrakt w [docs/n8n-contract.md](docs/n8n-contract.md).
3. Opcjonalnie: skoroszyt Google Sheets z zakładką `ingest_jobs` i konto serwisowe z prawem edycji. Bez tego wsad działa, a pomiar oznaczany jest jako niezapisany.

## Zasady, które trzymają ten projekt

- **Status „w zasobie" potwierdza wzrost liczby punktów w Qdrancie, nie kod HTTP z n8n.** Webhook może odpowiedzieć `200`, zanim embedding się skończy — wtedy interfejs kłamałby o tej jednej rzeczy, dla której powstał.
- **Pomiary zapisuje aplikacja, nie n8n.** Narzędzie mierzy między innymi to, czy n8n działa; gdyby pomiary szły przez n8n, jego awaria kasowałaby dane o tej awarii.
- **Żadne zadanie w tle nie wywołuje modelu LLM.** Odświeżanie statystyk odpytuje wyłącznie REST Qdranta — koszt zapytań nie może rosnąć bez udziału operatora.

## Sekrety

`.env.local` i plik klucza konta serwisowego Google **nigdy** nie trafiają do repozytorium — jest publiczne. Klucz trzymaj poza katalogiem projektu.
