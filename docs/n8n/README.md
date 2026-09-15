# Workflow n8n — wdrożenie

Dwa workflow realizujące zaplecze dla [SCOPE.md](../../SCOPE.md). Import: otwórz n8n → nowy workflow → `Ctrl+V` na kanwie po skopiowaniu zawartości pliku.

| plik | rola |
|---|---|
| `rag-ingest.json` | przyjmuje plik, ekstrahuje tekst, dzieli na chunki, zapisuje wektory w Qdrancie |
| `rag-query.json` | przyjmuje pytanie, odpytuje Qdranta, odpowiada przez agenta AI |

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
curl -X PUT "https://TWOJ-VPS:6333/collections/rag_docs" \
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
- [ ] Nazwa kolekcji w węzłach Qdranta: domyślnie `rag_docs` — podmień, jeśli masz inną.
- [ ] `rag-query` → węzeł **Model czatu (OpenRouter)**: domyślnie `deepseek/deepseek-flash-latest`. To parametr, nie decyzja na zawsze — przetestuj 2–3 modele pod kątem polszczyzny i zostaw najlepszy. [DO WERYFIKACJI: aktualny katalog i ceny na openrouter.ai/models]
- [ ] Zapisz oba workflow i **aktywuj** (webhook produkcyjny działa dopiero po aktywacji; przed aktywacją działa wyłącznie adres testowy).
- [ ] Skopiuj oba adresy produkcyjne webhooków → wpisz do `.env.local` aplikacji jako `INGEST_WEBHOOK_URL` i `CHAT_WEBHOOK_URL`.

## 4. Znane ograniczenia tej wersji

- **DOCX nie przechodzi.** Węzeł Extract from File nie obsługuje `.docx` natywnie [DO WERYFIKACJI: sprawdź listę operacji w swojej wersji n8n]. Gałąź `docx` zwraca kontrolowany błąd `unsupported_type`. Obejścia, gdyby było potrzebne: konwersja LibreOffice na VPS przed wsadem, węzeł community, albo zapis dokumentu jako PDF.
- **CSV/XLSX** — każdy wiersz staje się osobnym dokumentem. Dla tabel retrieval działa słabo; to ograniczenie metody RAG, nie tego workflow.
- **Brak deduplikacji.** Ten sam plik wgrany dwa razy trafi do zasobu dwa razy. Świadomie poza MVP.
- **Switch (`typeVersion 3`)** — jeśli Twoja wersja n8n zgłosi przy nim błąd, odtwórz ten jeden węzeł ręcznie: 4 reguły po polu `mime` (`pdf`, `spreadsheet`, `csv`, `wordprocessingml`) + wyjście zapasowe dla tekstu. Reszta workflow jest od niego niezależna.

## 5. Jak to przetestujesz

1. **Ingest, plik TXT.** W `rag-ingest` kliknij `Execute workflow`, wyślij plik `.txt` na adres testowy:
   ```bash
   curl -F "file=@test.txt" "https://TWOJ-N8N/webhook-test/rag-ingest"
   ```
   Oczekiwane: `{"status":"done","chunks":N,...}` i zielona ścieżka na kanwie.
2. **Sprawdź Qdranta niezależnie od n8n** — to samo zapytanie, którego będzie używać aplikacja:
   ```bash
   curl -H "api-key: TWOJ_KLUCZ_QDRANT" "https://TWOJ-VPS:6333/collections/rag_docs"
   ```
   Oczekiwane: `points_count` większe od zera i równe liczbie chunków z kroku 1.
3. **Ingest, plik PDF.** Ta sama komenda z PDF-em. Jeśli wróci `reason: no_text` — to skan bez warstwy tekstowej, zachowanie poprawne.
4. **Czat.**
   ```bash
   curl -X POST "https://TWOJ-N8N/webhook-test/rag-query" \
     -H "Content-Type: application/json" \
     -d '{"question":"O czym jest ten dokument?","conversation_id":"test-1"}'
   ```
   Oczekiwane: `{"status":"done","answer":"…"}` odwołujące się do treści wgranego pliku. Jeśli agent odpowiada ogólnikami bez treści dokumentu — sprawdź wymiar kolekcji z kroku 1, to prawie zawsze to.
5. **Test negatywny.** Zadaj pytanie spoza dokumentów. Oczekiwane: „Nie znalazłem tego w bazie wiedzy". Jeśli model konfabuluje — obniż `temperature` albo zmień model.
