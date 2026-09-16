# Kontrakt webhooków n8n

Dokument zdejmuje ryzyko **R-1** ze [SCOPE.md](../SCOPE.md). Aplikacja frontendowa opiera się wyłącznie na tym kontrakcie — nie na zaglądaniu do n8n.

Status: **czat zweryfikowany na działającej instancji (2026-09-16), wsad jeszcze nie.**

| webhook | stan |
|---|---|
| `CHAT_WEBHOOK_URL` | ✅ działa — potwierdzone realnymi requestami: odpowiedź z bazy wiedzy, pamięć rozmowy, brak konfabulacji przy pytaniu spoza zasobu |
| `INGEST_WEBHOOK_URL` | ⚠️ nie istnieje — wsad w n8n obsługuje obecnie **Form Trigger** (formularz n8n), a nie webhook. Dopóki nie powstanie workflow z węzłem Webhook na ścieżce `rag-ingest`, wsad z poziomu aplikacji nie zadziała. Czat działa niezależnie. |

## Wspólne

- Metoda: `POST`
- Uwierzytelnienie: brak (n8n i aplikacja w tej samej sieci prywatnej) [ZAŁOŻENIE | ryzyko MED — jeśli n8n stoi na publicznym VPS, dodać Header Auth]
- Odpowiedź zawsze `application/json`
- Oba webhooki są **synchroniczne** — odpowiedź przychodzi po zakończeniu pracy, nie po jej przyjęciu

## 1. Ingest — `POST {INGEST_WEBHOOK_URL}`

**Żądanie:** `multipart/form-data`, pole pliku o nazwie **`file`**.

**Odpowiedź 200 — sukces:**

```json
{
  "status": "done",
  "doc_id": "12-1757942400000",
  "filename": "regulamin.pdf",
  "chunks": 47,
  "execution_id": "12"
}
```

**Odpowiedź 200 — błąd kontrolowany** (aplikacja traktuje jak `error`, nie jak awarię):

```json
{
  "status": "error",
  "reason": "no_text",
  "message": "Plik nie zawiera warstwy tekstowej (skan bez OCR)",
  "filename": "skan.pdf"
}
```

Wartości `reason`: `no_text` | `unsupported_type` | `pipeline_error`.

`unsupported_type` dotyczy wyłącznie ścieżki z węzłem *Extract from File* (`rag-ingest.json`). Ścieżka z **Default Data Loader** w trybie `binary` obsługuje także `.docx` — zweryfikowane.

**Brak odpowiedzi / timeout:** aplikacja po 120 s ustawia `błąd: timeout`. Workflow może w tym czasie dokończyć pracę — dlatego status końcowy potwierdzany jest wzrostem liczby punktów w Qdrancie (R-2), nie samą odpowiedzią HTTP.

## 2. Czat — `POST {CHAT_WEBHOOK_URL}`

**Żądanie:** `application/json`

```json
{
  "question": "Jakie są terminy wypowiedzenia?",
  "conversation_id": "e7c1a0f2-..."
}
```

`conversation_id` generuje aplikacja i trzyma w arkuszu `conversations`. n8n używa go jako klucza pamięci rozmowy.

**Odpowiedź 200:**

```json
{
  "status": "done",
  "answer": "Zgodnie z dokumentem…",
  "sources": [
    { "filename": "regulamin.pdf", "doc_id": "12-1757942400000", "snippet": "…" }
  ]
}
```

Pole `sources` jest opcjonalne dla frontendu MVP — obsługa podglądu źródeł jest w SHOULD. n8n zwraca je od początku, bo nic nie kosztują.

**Odpowiedź 200 — błąd:**

```json
{ "status": "error", "message": "…" }
```

## 3. Czego webhooki NIE robią

- Nie zapisują niczego do Google Sheets — pomiary zapisuje aplikacja (sekcja 4 SCOPE: diagnostyka nie zależy od diagnozowanego).
- Nie liczą punktów w kolekcji przed i po wsadzie — robi to aplikacja, odpytując Qdranta bezpośrednio.
- Nie deduplikują dokumentów. Ten sam plik wrzucony dwa razy trafi do zasobu dwa razy. Świadomie poza MVP.

## 4. Pamięć rozmowy

Pamięć siedzi w n8n (Simple Memory, klucz = `conversation_id`) i jest **ulotna** — ginie przy restarcie n8n. Źródłem prawdy o historii rozmów jest arkusz `chat_messages`. To celowe: n8n trzyma kontekst, arkusz trzyma zapis.

Klucz sesji musi być pobrany przez referencję do węzła, nie przez `$json`:
```
{{ $('Webhook').first().json.body.conversation_id }}
```
W sub-węźle pamięci `$json` bywa pusty, co objawia się błędem „No session ID found" niezależnie od poprawności samego pola.

## 5. Cytowanie źródeł

Agent dopisuje nazwy plików na końcu treści odpowiedzi (pole `answer`), np. `Źródła: umowa.pdf`. Pole `sources` w odpowiedzi jest obecnie **zawsze pustą tablicą** — strukturalne źródła to pozycja SHOULD ze SCOPE.md, jeszcze niezaimplementowana. Aplikacja tego nie parsuje i nie musi.
