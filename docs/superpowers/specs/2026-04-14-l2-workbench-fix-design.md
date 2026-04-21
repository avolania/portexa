# L2/L3 Specialist Workbench — Kapsamlı Onarım Tasarımı

**Tarih:** 2026-04-14  
**Kapsam:** `/src/app/(app)/itsm/workbench/l2/page.tsx` + servis katmanı eklentileri  
**Yaklaşım:** Cerrahi onarım (Approach A) — mevcut UI'ya dokunmadan store bağlantıları ve eksik handler'lar eklenir  

---

## 1. Sorun Özeti

L2 workbench protip olarak geliştirilmiş; tüm işlevsel sorunlar store bağlantısı eksikliğinden kaynaklanıyor.

| Sorun | Kök Neden |
|-------|-----------|
| SR / CR görünmüyor | `useServiceRequestStore` ve `useChangeRequestStore` import edilmemiş |
| Root cause kaydedilemiyor | Tüm save butonları `!selectedStoreId` ile disabled; SR/CR ve demo ticket'larda `storeId` null |
| Teknik not kaydedilemiyor | Aynı sebep |
| RCA kaydedilemiyor | Aynı sebep |
| Timeline notu kaydedilemiyor | Aynı sebep |
| Eskalasyon çalışmıyor | Sadece INC için kısmen çalışıyor; SR/CR'a dispatch yok |
| Merge/Convert/Link yok | UI butonları mevcut ama `onClick` handler, modal ve Supabase yazısı yok |
| "Çözüldü" butonu | SR/CR'da render edilmiyor; INC'de `!selectedStoreId` ile gizli |
| Static demo data | `TICKETS` fallback array SR/CR içeriyor ama store bağlı olmadığından gerçek veri gelmiyor |

---

## 2. Mimari Tasarım

### 2.1 Mevcut Durum

```
L2 page
  └─ useIncidentStore (tek bağlantı)
       └─ realTickets (sadece INC)
            └─ displayTickets = realTickets.length>0 ? real : TICKETS (static fallback)

  selectedStoreId = selected?.storeId  ← null for SR/CR/demo
  → tüm save butonları: disabled={!selectedStoreId}
```

### 2.2 Hedef Durum

```
L2 page
  ├─ useIncidentStore       → INC listesi
  ├─ useServiceRequestStore → SR listesi  (YENİ)
  └─ useChangeRequestStore  → CR listesi  (YENİ)
       └─ allTickets = [...incTickets, ...srTickets, ...crTickets]
            └─ displayTickets = allTickets (TICKETS static array silinir)

  selectedStoreId:   string | null     (store UUID)
  selectedStoreType: "INC"|"SR"|"CR"   (hangi store'a dispatch edilecek — useMemo ile türetilir)

  save dispatch:
    INC → incStore.addWorkNote / resolve / assign
    SR  → srStore.addWorkNote / fulfill / changeState
    CR  → crStore.addWorkNote / transition / approve
```

### 2.3 Servis Katmanı Eklemeleri

**`incidentService.ts`** — 4 yeni fonksiyon:
- `convertIncidentToSR(incId, dto, orgId, userId, userName)` → SR oluştur, INC kapat
- `convertIncidentToCR(incId, dto, orgId, userId, userName)` → CR oluştur, INC kapat
- `convertIncidentToProblem(incId, note, orgId, userId, userName)` → Problem INC aç, orijinali kapat
- `mergeDuplicateIncident(masterId, duplicateId, note, orgId, userId, userName)` → dup kapat, master'a note

**`serviceRequestService.ts`** — 1 yeni fonksiyon:
- `linkCRToSR(srId, crId, note, orgId, userId, userName)` → SR'a linked CR ekle

---

## 3. Store Entegrasyonu

### 3.1 SR → Ticket Dönüşümü

```typescript
const srTickets: Ticket[] = serviceRequests.map(sr => ({
  storeId: sr.id,
  id: sr.number,
  type: "SR" as const,
  title: sr.shortDescription,
  priority: SR_PRIO_MAP[sr.priority] ?? "3",
  state: SR_STATE_LABEL[sr.state] ?? sr.state,
  slaMin: Math.floor((new Date(sr.sla?.fulfillmentDeadline ?? fallbackDeadline).getTime() - Date.now()) / 60000),
  slaTotal: 480,
  caller: sr.requestedFor?.fullName ?? sr.requestedForId,
  dept: "",
  assignedTo: sr.assignedToId === user?.id ? "Ben" : (sr.assignedTo?.fullName ?? "—"),
  group: sr.assignmentGroupName ?? "",
  description: sr.description,
  technicalNotes: sr.workNotes.filter(n => n.content.startsWith("[TEKNİK]")).map(n => n.content.replace("[TEKNİK] ", "")).join("\n---\n"),
  rootCause: "",
  workaround: "",
  relatedCIs: [],
  timeline: sr.timeline.map(e => ({ time: ..., who: e.actorName, text: e.note ?? e.type })),
  kbArticles: [],
  diagHistory: [],   // SR'da diagnostics tab gösterilmez
  rcaData: null,     // SR'da RCA tab gösterilmez
  pendingReason: sr.state === ServiceRequestState.PENDING_APPROVAL ? "Onay bekleniyor" : undefined,
}));
```

### 3.2 CR → Ticket Dönüşümü

CR için `changeDetails` alanı doldurulur (CAB tab için). `rcaData: null`, `diagHistory: []`.

### 3.3 Unified Liste & Sıralama

```typescript
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const displayTickets = [...incTickets, ...srTickets, ...crTickets]
  .sort((a, b) => {
    // SLA ihlali önce
    if (a.breached !== b.breached) return a.breached ? -1 : 1;
    // Sonra priority
    return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
  });
```

### 3.4 selectedStoreType (useMemo ile türetilir)

```typescript
// Ayrı state tutulmaz — seçili ticket'tan türetilir
const selectedTicket  = useMemo(() => displayTickets.find(t => t.id === selectedId) ?? displayTickets[0], [displayTickets, selectedId]);
const selectedStoreId = selectedTicket?.storeId ?? null;
const selectedStoreType = selectedTicket?.type ?? null;
```

---

## 4. Save Dispatch (Tip Bazlı)

### 4.1 Teknik Not & Root Cause

```typescript
const dispatchWorkNote = async (content: string) => {
  if (!selectedStoreId || !selectedStoreType) return;
  if (selectedStoreType === "INC") await incStore.addWorkNote(selectedStoreId, { content });
  else if (selectedStoreType === "SR") await srStore.addWorkNote(selectedStoreId, { content });
  else if (selectedStoreType === "CR") await crStore.addWorkNote(selectedStoreId, { content });
};

const handleSaveTechNote    = async () => { await dispatchWorkNote(`[TEKNİK] ${noteText}`); setNoteText(""); };
const handleSaveRootCause   = async () => { await dispatchWorkNote(`[ROOT CAUSE] ${rootCauseText}`); setRootCauseText(""); };
const handleSaveTimelineNote = async () => { await dispatchWorkNote(timelineNoteText.trim()); setTimelineNoteText(""); };
```

### 4.2 Çözüldü / Karşılandı / Tamamlandı

```
selectedStoreType === "INC" → "✓ Çözüldü"    → showResolveModal (mevcut modal korunur)
selectedStoreType === "SR"  → "✓ Karşılandı"  → showFulfillModal (yeni: fulfillmentNotes textarea)
selectedStoreType === "CR"  → "✓ Tamamlandı"  → crStore.transition(id, ChangeRequestState.IMPLEMENTED)
```

### 4.3 Eskalasyon

```
INC → mevcut handleEscalate (assignInc + changeState + workNote) — düzeltilir, korunur
SR  → srStore.changeState(id, ServiceRequestState.IN_PROGRESS) + srStore.addWorkNote(...)
CR  → crStore.transition(id, nextState) + crStore.addWorkNote(...)
```

### 4.4 RCA Kaydet

RCA sadece INC tipine özgü — `selectedStoreType === "INC"` kontrolü eklenir, mevcut `handleSaveRCA` korunur.

---

## 5. Tab Görünürlüğü (Tip Bazlı)

| Tab | INC | SR | CR |
|-----|-----|----|----|
| 🔧 Teknik Detay | ✓ | ✓ | ✓ |
| 🖥️ CI & Topoloji | ✓ | ✓ | ✓ |
| 📋 Aktivite / Timeline | ✓ | ✓ | ✓ |
| 📖 KB Makaleleri | ✓ | ✓ | ✓ |
| 🔍 Diagnostics | ✓ | — | — |
| 🎯 Root Cause (5-Why) | ✓ | — | — |
| 📋 CAB / Change | — | — | ✓ |

`getTabs()` fonksiyonu mevcut koşullar zaten doğru — sadece SR için de `rcaData: null` ve `diagHistory: []` olduğundan otomatik gizlenir.

---

## 6. Convert / Merge / Link Modalleri

### 6.1 Convert Modal (INC → SR / CR / Problem)

**Tetikleyici:** Araçlar paneli butonları  
**Gösterildiği tip:** Sadece INC

**State:**
```typescript
const [showConvertModal, setShowConvertModal] = useState(false);
const [convertTarget, setConvertTarget] = useState<"SR"|"CR"|"Problem">("SR");
const [convertNote, setConvertNote] = useState("");
const [convertCategory, setConvertCategory] = useState("");
const [convertPriority, setConvertPriority] = useState("medium");
const [convertChangeType, setConvertChangeType] = useState<"standard"|"normal"|"emergency">("normal");
const [convertRisk, setConvertRisk] = useState("medium");
```

**UI:** 3 radio seçeneği (SR / CR / Problem), seçime göre dinamik form alanları, zorunlu not alanı.

**Handler:**
```typescript
const handleConvert = async () => {
  if (!selectedStoreId || !convertNote.trim() || !user) return;
  setSaving(true);
  try {
    if (convertTarget === "SR")
      await convertIncidentToSR(selectedStoreId, { category: convertCategory, priority: convertPriority, note: convertNote }, user.orgId, user.id, user.name);
    else if (convertTarget === "CR")
      await convertIncidentToCR(selectedStoreId, { changeType: convertChangeType, risk: convertRisk, note: convertNote }, user.orgId, user.id, user.name);
    else
      await convertIncidentToProblem(selectedStoreId, convertNote, user.orgId, user.id, user.name);
    await incStore.load(); // listeyi yenile
    setShowConvertModal(false);
  } finally { setSaving(false); }
};
```

**İnfo notu:** "INC açıklaması ve notları yeni kayda kopyalanır. INC → Resolved (Converted) olarak kapatılır."

### 6.2 Merge Modal (INC + INC)

**Tetikleyici:** Araçlar paneli "🔗 Merge / Duplicate" butonu  
**Gösterildiği tip:** Sadece INC

**State:**
```typescript
const [showMergeModal, setShowMergeModal]   = useState(false);
const [mergeTargetId, setMergeTargetId]     = useState("");   // arama inputu
const [mergeTargetTicket, setMergeTargetTicket] = useState<Ticket | null>(null);
const [mergeNote, setMergeNote]             = useState("");
```

**UI:** Master ticket (seçili, readonly), duplicate arama input + önizleme kartı, birleştirme notu.  
**Arama:** `displayTickets` içinde `id` veya başlık eşleşmesiyle filtreleme (client-side, Supabase çağrısı yok).

**Handler:**
```typescript
const handleMerge = async () => {
  if (!selectedStoreId || !mergeTargetTicket?.storeId || !mergeNote.trim() || !user) return;
  setSaving(true);
  try {
    await mergeDuplicateIncident(selectedStoreId, mergeTargetTicket.storeId, mergeNote, user.orgId, user.id, user.name);
    await incStore.load();
    setShowMergeModal(false);
  } finally { setSaving(false); }
};
```

**Uyarı notu:** "INC-XXXX → Resolved (Duplicate) olarak kapatılır. Notu master INC'ye eklenir."

### 6.3 Link SR→CR Modal

**Tetikleyici:** SR araçlar paneli "🔗 CR Bağla" butonu  
**Gösterildiği tip:** Sadece SR

**State:**
```typescript
const [showLinkCRModal, setShowLinkCRModal] = useState(false);
const [linkCRId, setLinkCRId]               = useState("");
const [linkCRTicket, setLinkCRTicket]       = useState<Ticket | null>(null);
const [linkCRNote, setLinkCRNote]           = useState("");
```

**UI:** CR no arama input + önizleme kartı, opsiyonel not.  
**Arama:** `displayTickets` içinde type==="CR" filtresiyle client-side.

**Handler:**
```typescript
const handleLinkCR = async () => {
  if (!selectedStoreId || !linkCRTicket?.storeId || !user) return;
  setSaving(true);
  try {
    await linkCRToSR(selectedStoreId, linkCRTicket.storeId, linkCRNote, user.orgId, user.id, user.name);
    await srStore.load();
    setShowLinkCRModal(false);
  } finally { setSaving(false); }
};
```

### 6.4 Araçlar Paneli — Tip Bazlı Butonlar

```typescript
const getToolButtons = (t: Ticket) => {
  if (t.type === "INC") return [
    { l: "🎯 Root Cause Analizi",  action: () => setActiveTab("rca") },
    { l: "📌 Problem Kaydı Aç",    action: () => { setConvertTarget("Problem"); setShowConvertModal(true); } },
    { l: "🔄 SR'a Dönüştür",       action: () => { setConvertTarget("SR"); setShowConvertModal(true); } },
    { l: "🔄 CR'a Dönüştür",       action: () => { setConvertTarget("CR"); setShowConvertModal(true); } },
    { l: "🔗 Merge / Duplicate",   action: () => setShowMergeModal(true) },
  ];
  if (t.type === "SR") return [
    { l: "🔗 CR Bağla",            action: () => setShowLinkCRModal(true) },
  ];
  return []; // CR: araçlar paneli yok
};
```

---

## 7. Servis Katmanı Implementasyonu

### 7.1 `convertIncidentToSR`

```typescript
export async function convertIncidentToSR(
  incId: string,
  dto: { category: string; priority: string; note: string },
  incidents: Incident[],
  orgId: string, userId: string, userName: string
): Promise<{ srId: string; srNumber: string }> {
  const inc = incidents.find(i => i.id === incId);
  if (!inc) throw new Error("Incident bulunamadı");

  // 1. SR oluştur (mevcut createServiceRequest kullan)
  const sr = await createServiceRequest({
    shortDescription: inc.shortDescription,
    description: inc.description,
    category: dto.category,
    priority: dto.priority as Priority,
    requestedForId: inc.callerId,
  }, orgId, userId, userName);

  // 2. INC'e work note ekle
  await addIncidentWorkNote(incId, { content: `[CONVERT→SR] ${sr.number} olarak dönüştürüldü. ${dto.note}` }, incidents, userId, userName, orgId);

  // 3. INC'i resolve et
  await resolveIncident(incId, {
    resolutionCode: IncidentResolutionCode.SOLVED_PERMANENTLY,
    resolutionNotes: `SR'a dönüştürüldü: ${sr.number}. ${dto.note}`,
  }, incidents, userId, userName, orgId);

  return { srId: sr.id, srNumber: sr.number };
}
```

### 7.2 `convertIncidentToCR`

Benzer yapı — `createChangeRequest` çağrısı, `changeType` ve `risk` alanlarıyla.

### 7.3 `convertIncidentToProblem`

```typescript
// Yeni INC oluştur, category: "Problem", shortDescription: "Problem: " + inc.shortDescription
// Orijinal INC'i resolve et
```

### 7.4 `mergeDuplicateIncident`

```typescript
export async function mergeDuplicateIncident(
  masterId: string, duplicateId: string, note: string,
  incidents: Incident[], orgId: string, userId: string, userName: string
): Promise<void> {
  const master = incidents.find(i => i.id === masterId);
  const dup    = incidents.find(i => i.id === duplicateId);
  if (!master || !dup) throw new Error("Incident bulunamadı");

  // 1. Duplicate'i resolve et
  await resolveIncident(duplicateId, {
    resolutionCode: IncidentResolutionCode.DUPLICATE,
    resolutionNotes: `${master.number} ile birleştirildi. ${note}`,
  }, incidents, userId, userName, orgId);

  // 2. Master'a note ekle
  await addIncidentWorkNote(masterId, {
    content: `[MERGE] ${dup.number} bu incident ile birleştirildi. ${note}`,
  }, incidents, userId, userName, orgId);
}
```

**Not:** `IncidentResolutionCode` enum'unda `DUPLICATE` değeri yoksa eklenir.

### 7.5 `linkCRToSR`

```typescript
export async function linkCRToSR(
  srId: string, crId: string, note: string,
  serviceRequests: ServiceRequest[], orgId: string, userId: string, userName: string
): Promise<void> {
  const sr = serviceRequests.find(s => s.id === srId);
  if (!sr) throw new Error("SR bulunamadı");

  // 1. SR güncelle — linked CR ekle
  const linkedCRIds = [...(sr.linkedCRIds ?? []), crId];
  await updateServiceRequest(srId, { linkedCRIds }, serviceRequests, userId, userName, orgId);

  // 2. CR number'ı bul (store array'inden — Supabase çağrısı yok)
  // Not: changeRequests array'i parametre olarak alınır
  const crNumber = changeRequests.find(c => c.id === crId)?.number ?? crId;
  await addSRWorkNote(srId, {
    content: `[CR BAĞLANDI] ${crNumber}${note ? ": " + note : ""}`,
  }, serviceRequests, userId, userName, orgId);
}
```

**Not:** `ServiceRequest` tipinde `linkedCRIds?: string[]` alanı yoksa hem tipe hem Supabase şemasına eklenir (JSONB array veya ayrı kolon). `linkCRToSR` fonksiyonu `changeRequests: ChangeRequest[]` parametresi de alır (CR number lookup için).

---

## 8. Fulfill Modal (SR)

```typescript
// State
const [showFulfillModal, setShowFulfillModal] = useState(false);
const [fulfillNotes, setFulfillNotes]         = useState("");

// Handler
const handleFulfill = async () => {
  if (!selectedStoreId || !fulfillNotes.trim()) return;
  setSaving(true);
  try {
    await srStore.fulfill(selectedStoreId, { fulfillmentNotes: fulfillNotes });
    setShowFulfillModal(false);
    setFulfillNotes("");
  } finally { setSaving(false); }
};
```

Modal UI: resolve modal ile aynı pattern, sadece label "Karşılama Notu" olur.

---

## 9. Implementasyon Sırası

1. **Enum genişletme** — `IncidentResolutionCode.DUPLICATE` ekle (varsa atla), `ServiceRequest` tipine `linkedCRIds` ekle
2. **Servis fonksiyonları** — 5 yeni fonksiyon (`incidentService.ts` × 4, `serviceRequestService.ts` × 1)
3. **L2 page — store bağlantıları** — SR/CR import, `useEffect` ile load, Ticket dönüşümleri, `displayTickets` unified
4. **L2 page — selectedStoreType + dispatch** — `useMemo`, `dispatchWorkNote`, tüm save handler'lar
5. **L2 page — aksiyon butonları** — Çözüldü/Karşılandı/Tamamlandı tip bazlı, Eskalasyon düzeltme
6. **L2 page — Fulfill Modal** — SR için yeni modal
7. **L2 page — Convert Modal** — 3 dönüşüm seçeneği
8. **L2 page — Merge Modal** — Duplicate birleştirme
9. **L2 page — Link CR Modal** — SR→CR bağlantısı
10. **L2 page — Araçlar paneli** — `getToolButtons()` tip bazlı

---

## 10. Değişmeyen Parçalar

- Tüm UI layout (split-pane, kart tasarımları, renkler, animasyonlar)
- Diagnostics terminal ve `DIAG_CMDS` simülasyonu
- RCA 5-Why UI ve state (`rcaLocal`)
- CAB/Change tab UI (`cabSteps`, `cabChecks`)
- KB makaleleri tab
- CI & Topoloji tab
- SLA hesaplama (`fmtSla`)
- Filter bar (All/INC/SR/CR, "Benim", arama)
- Timeline render

---

## 11. Kapsam Dışı

- Problem yönetimi için ayrı bir ekran/store (bu spec'te Problem, INC kategorisi olarak açılır)
- SR için diagnostics terminal (L2 için anlamsız)
- CR CAB onay akışı değişikliği (mevcut CAB tab korunur)
- L1 workbench değişikliği
