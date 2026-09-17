# Workflow n8n — wdrożenie

Dwa workflow realizujące zaplecze dla [SCOPE.md](../../SCOPE.md). Import: otwórz n8n → nowy workflow → `Ctrl+V` na kanwie po skopiowaniu zawartości pliku.

| plik | rola |
|---|---|
| `rag-ingest.json` | przyjmuje plik z aplikacji, dzieli na chunki, zapisuje wektory w Qdrancie |
| `rag-query.json` | przyjmuje pytanie, odpytuje Qdranta, odpowiada przez agenta AI |

Oba oparte na **Default Data Loaderze w trybie binarnym** — ścieżce zweryfikowanej na PDF i DOCX. Wcześniejsza wersja `rag-ingest.json` używała węzła *Extract from File* z osobną gałęzią per typ pliku; została zastąpiona, bo Default Data Loader radzi sobie z tymi samymi formatami bez routingu, a dodatkowo obsługuje DOCX.

Kontrakt obu webhooków (to, na czym opiera się frontend): [`../n8n-contract.md`](../n8n-contract.md).

---

## 0. Zanim zaimportujesz — zabezpiecz Qdranta

Qdrant stoi na VPS z publicznym IP i **domyślnie startuje bez uwierzytelniania**. Port 6333 na publicznym adresie bez klucza oznacza, że każdy może czytać i skasować kolekcję. To port skanowany rutynowo.

1. W `config/production.yaml` Qdranta ustaw `service.api_key`.
2. Zamknij 6333/6334 firewallem tak, by odpowiadał wyłącznie adresowi n8n i Twojej maszynie.
3. Jeśli to możliwe — postaw Qdranta za reverse proxy z HTTPS.

## 1. Utwórz kolekcję z właściwym wymiarem

Model embeddingów to `baai/bge-m3` → **1024 wymiary**. Kolekcja musi mieć dokładnie tyle. Niezgodność wymiaru to najczęstsza przyczyna sytuacji „działa, ale nic nie znajduje".

```bash
curl -X PUT "https://TWOJ-VPS:6333/collections/ragdcs" \
  -H "api-key: TWOJ_KLUCZ_QDRANT" \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":1024,"distance":"Cosine"}}'
```

Jeśli zmienisz model embeddingów na inny, kolekcję trzeba **utworzyć od nowa** i wgrać dokumenty ponownie. Wektorów nie da się przeliczyć w miejscu.

## 2. Credentials w n8n (3 sztuki)

| credential | typ w n8n | wartości |
|---|---|---|
| `OpenRouter — embeddingi` | **OpenAI API** | API Key: klucz OpenRoutera. **Base URL: `https://openrouter.ai/api/v1`** |
| `OpenRouter — czat` | OpenRouter API | API Key: ten sam klucz OpenRoutera |
| `Qdrant VPS` | Qdrant API | URL: adres Twojego Qdranta, API Key: klucz z kroku 0 |

**Dlaczego embeddingi idą przez credential OpenAI, a nie OpenRouter:** węzeł Qdrant Vector Store wymaga na porcie `ai_embedding` węzła embeddingów — a n8n nie ma dedykowanego węzła embeddingów OpenRoutera. Ponieważ endpoint OpenRoutera jest zgodny z OpenAI, wystarczy podmienić Base URL w credentialu OpenAI. To standardowy zabieg, nie obejście.

## 3. Po imporcie — podepnij i uzupełnij

W obu workflow:

- [ ] Każdy węzeł z żółtym trójkątem → wybierz credential z listy.
- [ ] Nazwa kolekcji w węzłach Qdranta: domyślnie `ragdcs` — podmień, jeśli masz inną.
- [ ] `rag-query` → węzeł **Model czatu (OpenRouter)**: domyślnie `deepseek/deepseek-flash-latest`. To parametr, nie decyzja na zawsze — przetestuj 2–3 modele pod kątem polszczyzny i zostaw najlepszy. [DO WERYFIKACJI: aktualny katalog i ceny na openrouter.ai/models]
- [ ] Zapisz oba workflow i **aktywuj** (webhook produkcyjny działa dopiero po aktywacji; przed aktywacją działa wyłącznie adres testowy).
- [ ] Skopiuj oba adresy produkcyjne webhooków → wpisz do `.env.local` aplikacji jako `INGEST_WEBHOOK_URL` i `CHAT_WEBHOOK_URL`.

## 4. Pułapki — zweryfikowane na działającej instancji

Każda z tych czterech kosztowała realny czas przy uruchamianiu czatu. Sprawdź je, zanim zaczniesz debugować cokolwiek innego.

1. **Webhook: `Respond` musi być ustawione na „Using 'Respond to Webhook' Node".** Domyślne „Immediately" powoduje, że węzeł Respond to Webhook nigdy nie zadziała, a aplikacja dostanie `{"message":"Workflow was started"}` zamiast odpowiedzi agenta.
2. **Dane z webhooka siedzą pod `body`, nie w korzeniu.** Poprawnie: `{{ $json.body.question }}`. `{{ $json.question }}` zawsze będzie `undefined`.
3. **W sub-węźle Simple Memory odwołuj się do węzła po nazwie i używaj `.first()`, nie `.item`:** `{{ $('Webhook').first().json.body.conversation_id }}`. W sub-węzłach `$json` i `.item` bywają niedostępne.
4. **Tylda w nazwie modelu OpenRoutera jest poprawna.** `~deepseek/deepseek-v4-flash-latest` — `~` to część konwencji OpenRoutera dla aliasów „latest", nie literówka. Nie usuwaj jej.

**Jak testować:** webhooka nie da się sprawdzić przyciskiem „Execute step" na pojedynczym węźle — musi przyjść prawdziwy HTTP POST. Pusty request (bez treści JSON) daje `[ { } ]` na wyjściu i wszystkie wyrażenia rozwiązują się na `undefined`, co wygląda jak błąd składni, a nim nie jest.

## 5. Znane ograniczenia i zachowania

- **DOCX działa** — zweryfikowane: Default Data Loader w trybie `binary` poprawnie wyciąga tekst z `.docx` (potwierdzone na pliku Worda, agent odpowiadał z jego treści). Ograniczenie dotyczy wyłącznie węzła *Extract from File* użytego w `rag-ingest.json`, nie ścieżki z Default Data Loaderem.
- **Metadane `filename` mogą zawierać wiodący `=`.** Jeśli wartość pola metadanych wpiszesz w trybie Expression tak, że `=` wejdzie do treści, nazwa pliku zapisze się w Qdrancie jako `=plik.docx` i w takiej formie pojawi się w cytowanych źródłach. Poprawka dotyczy tylko nowych wsadów — istniejące punkty zachowują starą wartość.
- **CSV/XLSX** — każdy wiersz staje się osobnym dokumentem. Dla tabel retrieval działa słabo; to ograniczenie metody RAG, nie tego workflow.
- **Brak deduplikacji.** Ten sam plik wgrany dwa razy trafi do zasobu dwa razy. Świadomie poza MVP.
- **Switch (`typeVersion 3`)** w `rag-ingest.json` — jeśli Twoja wersja n8n zgłosi przy nim błąd, odtwórz ten jeden węzeł ręcznie: 4 reguły po polu `mime` + wyjście zapasowe dla tekstu.

## 6. Jak to przetestujesz

1. **Ingest, plik TXT.** Workflow musi być zapisany i **aktywny**:
   ```bash
   curl -F "file=@test.txt" "https://TWOJ-N8N/webhook/rag-ingest"
   ```
   Oczekiwane: `{"status":"done","doc_id":"...","chunks":N,"execution_id":"..."}`.

   **Jeśli wróci `done`, ale liczba punktów w Qdrancie nie rośnie** — n8n nazwał właściwość binarną inaczej niż `file`. Otwórz węzeł Webhook → Output → zakładka **Binary**, sprawdź faktyczną nazwę i wpisz ją w **Default Data Loader → Binary Data Field Name**. To jedyne miejsce, gdzie ten workflow zależy od nazwy pola.
2. **Sprawdź Qdranta niezależnie od n8n** — to samo zapytanie, którego będzie używać aplikacja:
   ```bash
   curl -H "api-key: TWOJ_KLUCZ_QDRANT" "https://TWOJ-VPS:6333/collections/ragdcs"
   ```
   Oczekiwane: `points_count` większe od zera i równe liczbie chunków z kroku 1.
3. **Ingest, plik PDF.** Ta sama komenda z PDF-em. Jeśli wróci `reason: no_text` — to skan bez warstwy tekstowej, zachowanie poprawne.
4. **Czat** (workflow musi być zapisany i **aktywny** — adres produkcyjny, nie testowy):
   ```bash
   curl -X POST "https://TWOJ-N8N/webhook/rag-query" \
     -H "Content-Type: application/json" \
     -d '{"question":"O czym jest ten dokument?","conversation_id":"test-1"}'
   ```
   Oczekiwane: `{"status":"done","answer":"…","sources":[]}` odwołujące się do treści wgranego pliku. Jeśli agent odpowiada ogólnikami bez treści dokumentu — sprawdź wymiar kolekcji z kroku 1, to prawie zawsze to. Jeśli dostajesz `404 … is not registered` — workflow nie jest aktywny.
5. **Pamięć rozmowy.** Zadaj drugie pytanie z tym samym `conversation_id`, nawiązujące do poprzedniej odpowiedzi („jaki był najważniejszy wniosek z tego, co przed chwilą napisałeś?"). Oczekiwane: odpowiedź odnosi się do poprzedniej tury.
6. **Test negatywny.** Zadaj pytanie spoza dokumentów (np. o stolicę Australii). Oczekiwane: „Nie znalazłem tego w bazie wiedzy." Jeśli model konfabuluje — obniż `temperature` albo zmień model.

**Stan na 2026-09-16:** kroki 4–6 przechodzą na działającej instancji operatora (czat, pamięć rozmowy i test negatywny potwierdzone realnymi requestami).
