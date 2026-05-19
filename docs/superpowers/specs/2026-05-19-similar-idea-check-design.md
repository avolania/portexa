# Similar Idea Check Design — Benzer Fikir Kontrolü

## Goal

Fikir oluşturma modalında başlık alanından çıkıldığında (onBlur), PostgreSQL full-text search ile mevcut fikirlerde benzer başlık aranır. Benzer fikir bulunursa kullanıcıya bilgi amaçlı bir modal gösterilir; kullanıcı yine de gönderebilir veya başlığını düzeltebilir. Fikir gönderme hiçbir zaman bloke edilmez.

---

## Scope

**In scope:**
- `GET /api/innovation/ideas/similar` — FTS tabanlı benzer fikir arama endpoint'i
- GIN index migration — `innovation_ideas(title)` üzerine
- `NewIdeaModal` bileşeninde `onBlur` tetikleyici ve spinner
- `SimilarIdeasModal` bileşeni — sonuçları listeler, "İptal" / "Yine de Gönder" butonları
- Hem pipeline hem kampanya detay sayfasındaki `NewIdeaModal`'lara entegrasyon

**Out of scope:**
- Açıklama (description) alanında benzer fikir araması
- AI/embedding tabanlı vektör benzerliği
- Düzenleme (PATCH) akışında benzer fikir kontrolü
- Benzer fikirleri "merge" etme veya birleştirme işlevi

---

## API

### `GET /api/innovation/ideas/similar`

**Auth:** Bearer token — herhangi bir oturum açmış kullanıcı.

**Query params:**
- `q` (zorunlu): Aranacak başlık metni.

**Logic:**
1. Bearer token'dan `org_id` al.
2. `q` boşluklarla ayrıldığında 2'den az kelime içeriyorsa `[]` döndür.
3. Supabase'de PostgreSQL FTS sorgusu çalıştır:
   ```sql
   SELECT id, idea_number, title, description, stage_id, created_at, submitter_id
   FROM innovation_ideas
   WHERE org_id = $orgId
     AND status NOT IN ('rejected', 'archived')
     AND to_tsvector('turkish', title) @@ plainto_tsquery('turkish', $q)
   LIMIT 5
   ```
4. Her fikir için `stage` adı+rengi ve `submitter` adını join'le.
5. `description`'ı ilk 120 karakterle kırp.

**Response:**
```json
[
  {
    "id": "uuid",
    "idea_number": "INN-0042",
    "title": "Paketleme hattı enerji izleme",
    "description": "Hat başına anlık enerji tüketimini...",
    "stage": { "name": "Feasibility", "color": "#3B82F6" },
    "submitter": { "name": "Ahmet Yılmaz" },
    "created_at": "2026-04-10T09:00:00Z"
  }
]
```

Benzer fikir yoksa: `[]`

---

## DB Migration

```sql
-- supabase-innovation-similar-ideas.sql
CREATE INDEX IF NOT EXISTS innovation_ideas_title_fts_idx
  ON innovation_ideas
  USING gin(to_tsvector('turkish', title));
```

---

## UI Akışı

### `NewIdeaModal` değişiklikleri

1. **State eklemeleri:**
   ```ts
   const [similarIdeas, setSimilarIdeas] = useState<SimilarIdea[]>([]);
   const [checkingSimilarity, setCheckingSimilarity] = useState(false);
   const [showSimilarModal, setShowSimilarModal] = useState(false);
   const abortRef = useRef<AbortController | null>(null);
   ```

2. **`handleTitleBlur` fonksiyonu:**
   ```ts
   async function handleTitleBlur() {
     const words = form.title.trim().split(/\s+/).filter(Boolean);
     if (words.length < 2) return;
     abortRef.current?.abort();
     abortRef.current = new AbortController();
     setCheckingSimilarity(true);
     try {
       const res = await fetch(
         `/api/innovation/ideas/similar?q=${encodeURIComponent(form.title)}`,
         { headers: { Authorization: `Bearer ${token}` }, signal: abortRef.current.signal }
       );
       if (res.ok) {
         const data = await res.json() as SimilarIdea[];
         if (data.length > 0) {
           setSimilarIdeas(data);
           setShowSimilarModal(true);
         }
       }
     } catch {
       // Sessizce yutulur (AbortError dahil)
     } finally {
       setCheckingSimilarity(false);
     }
   }
   ```

3. **Title input değişikliği:**
   ```tsx
   <input
     value={form.title}
     onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
     onBlur={handleTitleBlur}
     ...
   />
   {checkingSimilarity && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
   ```

4. **"Gönder" butonuna basıldığında** uçuşta olan benzerlik isteği iptal edilir:
   ```ts
   abortRef.current?.abort();
   ```

### `SimilarIdeasModal` bileşeni

```
┌──────────────────────────────────────────────────┐
│ Bu fikre benzer fikirler bulundu                 │
├──────────────────────────────────────────────────┤
│ INN-0042  Paketleme hattı enerji izleme          │
│           [Feasibility]  Ahmet Y. · 10 Nis       │
│           Hat başına anlık enerji tüketimini...  │
│                                                  │
│ INN-0031  Hat enerji tüketim takibi              │
│           [Concept]  Elif K. · 2 Mar             │
│           Enerji verimliliğini artırmak için...  │
├──────────────────────────────────────────────────┤
│ [İptal]                    [Yine de Gönder]      │
└──────────────────────────────────────────────────┘
```

- **İptal:** Modal kapanır, ana form açık kalır, kullanıcı başlığını düzenleyebilir.
- **Yine de Gönder:** Benzer modal kapanır, ana formdaki `handleSubmit()` çağrılır.

---

## Tip Tanımı

```ts
export interface SimilarIdea {
  id: string;
  idea_number: string;
  title: string;
  description: string | null;
  stage: { name: string; color: string } | null;
  submitter: { name: string } | null;
  created_at: string;
}
```

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase-innovation-similar-ideas.sql` | GIN index migration |
| Create | `src/app/api/innovation/ideas/similar/route.ts` | FTS benzer fikir endpoint'i |
| Modify | `src/lib/innovation/types/index.ts` | `SimilarIdea` tipi ekle |
| Modify | `src/app/(app)/innovation/pipeline/page.tsx` | `NewIdeaModal`'a onBlur + `SimilarIdeasModal` entegrasyonu |
| Modify | `src/app/(app)/innovation/kampanyalar/[id]/page.tsx` | Aynı entegrasyon |

---

## Error Handling

| Senaryo | Davranış |
|---------|---------|
| API 500 veya network hatası | Hata sessizce yutulur, benzer fikir modalı açılmaz |
| Başlık 1 kelimeden kısa | Blur'da istek atılmaz |
| İstek uçuşta, kullanıcı "Gönder"e bastı | `AbortController` ile iptal edilir, modal açılmaz |
| Sonuç 0 fikir | Modal açılmaz |
| `plainto_tsquery` için geçersiz karakter | PostgreSQL hatayı yakalar; API 500 yerine `[]` döner (try/catch) |
