# L2/L3 Specialist Workbench — Kapsamlı Onarım Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L2/L3 Specialist Workbench ekranını tam işlevsel hale getir: SR/CR'ı store'dan yükle, tüm save operasyonlarını tipe göre doğru store'a yönlendir, eskalasyonu düzelt, ve Convert/Merge/LinkCR modallerini Supabase yazısıyla implement et.

**Architecture:** Cerrahi onarım — mevcut UI'ye dokunulmaz. `useServiceRequestStore` ve `useChangeRequestStore` eklenir, `selectedStoreType` useMemo ile türetilir, `dispatchWorkNote` yardımcısı tüm save handler'larını birleştirir. 3 yeni modal ve 5 yeni servis fonksiyonu eklenir.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zustand, Supabase (dbUpsert/dbLoadAll), Tailwind CSS (inline styles)

**Spec:** `docs/superpowers/specs/2026-04-14-l2-workbench-fix-design.md`

---

## Dosya Haritası

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| `src/lib/itsm/types/enums.ts` | Modify | `IncidentResolutionCode` enum'una `DUPLICATE` + `CONVERTED` ekle |
| `src/lib/itsm/types/service-request.types.ts` | Modify | `ServiceRequest` arayüzüne `linkedCRIds?: string[]` ekle |
| `src/services/incidentService.ts` | Modify | 4 yeni fonksiyon: `convertIncidentToSR`, `convertIncidentToCR`, `convertIncidentToProblem`, `mergeDuplicateIncident` |
| `src/services/serviceRequestService.ts` | Modify | 1 yeni fonksiyon: `linkCRToSR` |
| `src/app/(app)/itsm/workbench/l2/page.tsx` | Modify | SR/CR store + dönüşümler + save dispatch + 3 modal + araçlar paneli |

---

## Task 1: Enum Genişletme ve SR Tip Güncellemesi

**Files:**
- Modify: `src/lib/itsm/types/enums.ts:29-37`
- Modify: `src/lib/itsm/types/service-request.types.ts:32-69`

- [ ] **Step 1: `IncidentResolutionCode` enum'una DUPLICATE ve CONVERTED ekle**

`src/lib/itsm/types/enums.ts` dosyasındaki `IncidentResolutionCode` enum'unu bul ve 2 yeni değer ekle:

```typescript
export enum IncidentResolutionCode {
  SOLVED_WORKAROUND = 'Solved (Work Around)',
  SOLVED_PERMANENTLY = 'Solved (Permanently)',
  SOLVED_REMOTELY_WORKAROUND = 'Solved Remotely (Work Around)',
  SOLVED_REMOTELY_PERMANENTLY = 'Solved Remotely (Permanently)',
  NOT_SOLVED_NOT_REPRODUCIBLE = 'Not Solved (Not Reproducible)',
  NOT_SOLVED_TOO_COSTLY = 'Not Solved (Too Costly)',
  CLOSED_BY_CALLER = 'Closed/Resolved by Caller',
  DUPLICATE = 'Duplicate',           // ← YENİ
  CONVERTED = 'Converted',           // ← YENİ
}
```

- [ ] **Step 2: `ServiceRequest` arayüzüne `linkedCRIds` ekle**

`src/lib/itsm/types/service-request.types.ts` dosyasındaki `ServiceRequest` interface'inde `closureCode` satırının hemen altına ekle:

```typescript
  closureCode?: ServiceRequestClosureCode;
  linkedCRIds?: string[];             // ← YENİ — bağlı Change Request ID listesi
  sla: ServiceRequestSLA;
```

- [ ] **Step 3: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | head -30
```

Beklenen: Hata yok veya sadece bu dosyayla ilgisiz önceden var olan hatalar.

- [ ] **Step 4: Commit**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
git add src/lib/itsm/types/enums.ts src/lib/itsm/types/service-request.types.ts
git commit -m "feat(itsm): add DUPLICATE/CONVERTED resolution codes and linkedCRIds to SR"
```

---

## Task 2: incidentService — Convert ve Merge Fonksiyonları

**Files:**
- Modify: `src/services/incidentService.ts` (dosyanın sonuna ekle)

Bu 4 fonksiyon `incidentService.ts`'in mevcut import'larını kullanır (`createIncident`, `resolveIncident`, `addIncidentWorkNote`, `changeIncidentState`). Aynı dosya içinde oldukları için import gerekmez — fonksiyonları doğrudan çağırabilirler.

- [ ] **Step 1: `ensureResolvable` yardımcı fonksiyonu ekle**

`incidentService.ts` dosyasının sonuna ekle:

```typescript
// ─── L2 Workbench: Convert & Merge ───────────────────────────────────────────

/**
 * INC'in resolve edilebilir duruma getirilmesini sağlar.
 * New veya Assigned ise önce In Progress'e alır.
 */
async function ensureResolvable(
  id: string,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<Incident[]> {
  const inc = current.find((i) => i.id === id);
  if (!inc) return current;
  if (inc.state === IncidentState.NEW || inc.state === IncidentState.ASSIGNED) {
    const updated = await changeIncidentState(
      id,
      { state: IncidentState.IN_PROGRESS },
      current,
      actorId,
      actorName,
      orgId,
    );
    if (updated) {
      return current.map((i) => (i.id === id ? updated : i));
    }
  }
  return current;
}
```

- [ ] **Step 2: `convertIncidentToSR` fonksiyonu ekle**

`ensureResolvable` fonksiyonunun hemen altına ekle:

```typescript
/**
 * Bir Incident'ı Service Request'e dönüştürür.
 * INC → Resolved (Converted) olarak kapatılır, yeni SR oluşturulur.
 * Çağıran: L2 workbench Convert Modal
 */
export async function convertIncidentToSR(
  incId: string,
  dto: {
    requestType: string;
    category: string;
    impact: import('@/lib/itsm/types/enums').Impact;
    urgency: import('@/lib/itsm/types/enums').Urgency;
    note: string;
  },
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ srId: string; srNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  // 1. SR oluştur
  const { createServiceRequest } = await import('./serviceRequestService');
  const sr = await createServiceRequest(
    {
      requestedForId: inc.callerId,
      requestedById:  actorId,
      requestType:    dto.requestType,
      category:       dto.category,
      impact:         dto.impact,
      urgency:        dto.urgency,
      shortDescription: inc.shortDescription,
      description:    inc.description,
      sourceIncidentNumber: inc.number,
    },
    orgId,
    actorId,
    actorName,
  );

  // 2. INC'i resolve edilebilir duruma getir
  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  // 3. INC'e work note ekle
  await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→SR] ${sr.number} numaralı Service Request oluşturuldu. ${dto.note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  // 4. INC'i resolve et
  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Service Request'e dönüştürüldü: ${sr.number}. ${dto.note}`,
    },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  return { srId: sr.id, srNumber: sr.number };
}
```

- [ ] **Step 3: `convertIncidentToCR` fonksiyonu ekle**

```typescript
/**
 * Bir Incident'ı Change Request'e dönüştürür.
 * INC → Resolved (Converted), yeni CR oluşturulur.
 */
export async function convertIncidentToCR(
  incId: string,
  dto: {
    changeType: import('@/lib/itsm/types/enums').ChangeType;
    risk: import('@/lib/itsm/types/enums').ChangeRisk;
    note: string;
  },
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ crId: string; crNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  const { createChangeRequest } = await import('./changeRequestService');
  const now = new Date();
  const plannedEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const cr = await createChangeRequest(
    {
      requestedById:    actorId,
      changeManagerId:  actorId,
      type:             dto.changeType,
      category:         inc.category,
      risk:             dto.risk,
      impact:           inc.impact,
      shortDescription: inc.shortDescription,
      description:      inc.description,
      justification:    dto.note,
      plannedStartDate: now.toISOString(),
      plannedEndDate:   plannedEnd.toISOString(),
      implementationPlan: '',
      backoutPlan:        '',
      relatedIncidentIds: [incId],
      sourceIncidentNumber: inc.number,
    },
    orgId,
    actorId,
    actorName,
  );

  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→CR] ${cr.number} numaralı Change Request oluşturuldu. ${dto.note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Change Request'e dönüştürüldü: ${cr.number}. ${dto.note}`,
    },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  return { crId: cr.id, crNumber: cr.number };
}
```

- [ ] **Step 4: `convertIncidentToProblem` fonksiyonu ekle**

```typescript
/**
 * Bir Incident'tan Problem kaydı açar (INC category="Problem").
 * Orijinal INC → Resolved (Converted).
 */
export async function convertIncidentToProblem(
  incId: string,
  note: string,
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ problemId: string; problemNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  const problem = await createIncident(
    {
      callerId:         inc.callerId,
      reportedById:     actorId,
      category:         'Problem',
      subcategory:      inc.category,
      impact:           inc.impact,
      urgency:          inc.urgency,
      shortDescription: `Problem: ${inc.shortDescription}`,
      description:      `${inc.description}\n\n---\nKaynak Incident: ${inc.number}\n${note}`,
      assignedToId:     actorId,
    },
    orgId,
    actorId,
    actorName,
  );

  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→PROBLEM] ${problem.number} numaralı Problem kaydı açıldı. ${note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Problem kaydına dönüştürüldü: ${problem.number}. ${note}`,
    },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  return { problemId: problem.id, problemNumber: problem.number };
}
```

- [ ] **Step 5: `mergeDuplicateIncident` fonksiyonu ekle**

```typescript
/**
 * İki incident'ı birleştirir: duplicate → Resolved (Duplicate), master'a note eklenir.
 */
export async function mergeDuplicateIncident(
  masterId: string,
  duplicateId: string,
  note: string,
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const master = current.find((i) => i.id === masterId);
  const dup    = current.find((i) => i.id === duplicateId);
  if (!master || !dup) throw new Error('Incident bulunamadı');

  // Duplicate'i resolve edilebilir duruma getir
  const freshList = await ensureResolvable(duplicateId, current, actorId, actorName, orgId);

  // Duplicate'i resolve et (Duplicate resolution code)
  await resolveIncident(
    duplicateId,
    {
      resolutionCode: IncidentResolutionCode.DUPLICATE,
      resolutionNotes: `${master.number} numaralı incident ile birleştirildi. ${note}`,
    },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  // Master'a birleştirme notu ekle
  await addIncidentWorkNote(
    masterId,
    { content: `[MERGE] ${dup.number} numaralı incident bu kayıtla birleştirildi (duplicate olarak kapatıldı). ${note}` },
    current,
    actorId,
    actorName,
    orgId,
  );
}
```

- [ ] **Step 6: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | head -30
```

Beklenen: Hata yok.

- [ ] **Step 7: Commit**

```bash
git add src/services/incidentService.ts
git commit -m "feat(itsm): add convertIncidentToSR/CR/Problem and mergeDuplicateIncident services"
```

---

## Task 3: serviceRequestService — linkCRToSR Fonksiyonu

**Files:**
- Modify: `src/services/serviceRequestService.ts` (dosyanın sonuna ekle)

- [ ] **Step 1: Dosyanın mevcut import'larını kontrol et**

`serviceRequestService.ts` dosyasının ilk 10 satırını oku ve `dbUpsert` import edilip edilmediğini gör. Zaten import edilmişse bir sonraki adıma geç.

```bash
head -10 /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet/src/services/serviceRequestService.ts
```

- [ ] **Step 2: `linkCRToSR` fonksiyonu ekle**

`serviceRequestService.ts` dosyasının sonuna ekle:

```typescript
// ─── L2 Workbench: Link CR to SR ──────────────────────────────────────────────

/**
 * Bir Service Request'e Change Request bağlar.
 * SR'ın linkedCRIds dizisine crId eklenir, work note yazılır.
 */
export async function linkCRToSR(
  srId: string,
  crId: string,
  crNumber: string,
  note: string,
  current: ServiceRequest[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((s) => s.id === srId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const linkedCRIds = [...(existing.linkedCRIds ?? [])];
  if (!linkedCRIds.includes(crId)) {
    linkedCRIds.push(crId);
  }

  const noteContent = `[CR BAĞLANDI] ${crNumber}${note ? ': ' + note : ''}`;
  const uuid = () => crypto.randomUUID();

  const updated: ServiceRequest = {
    ...existing,
    linkedCRIds,
    workNotes: [
      ...existing.workNotes,
      { id: uuid(), authorId: actorId, authorName: actorName, content: noteContent, createdAt: now },
    ],
    timeline: [
      ...existing.timeline,
      {
        id: uuid(),
        type: TicketEventType.RELATED_CR_LINKED,
        actorId,
        actorName,
        newValue: crNumber,
        timestamp: now,
      },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, srId, updated, orgId);
  return updated;
}
```

`TicketEventType` zaten dosyada import edilmişse ekleme yapma. Import yoksa `serviceRequestService.ts` dosyasının import bölümüne ekle:

```typescript
import { ..., TicketEventType } from '@/lib/itsm/types/enums';
```

- [ ] **Step 3: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | head -30
```

Beklenen: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add src/services/serviceRequestService.ts
git commit -m "feat(itsm): add linkCRToSR service function"
```

---

## Task 4: L2 Page — SR/CR Store Bağlantıları ve Ticket Dönüşümleri

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

Bu task sadece **store import'ları, useEffect yüklemeleri ve Ticket dönüşümlerini** ekler. UI'ya dokunulmaz.

- [ ] **Step 1: SR ve CR store import'larını ekle**

Dosyanın başındaki import bölümünü bul. `useIncidentStore` import satırının altına ekle:

```typescript
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
```

- [ ] **Step 2: Component içinde store hook'larını ekle**

`SpecialistWorkbenchPage` bileşeninin başında mevcut store destructuring satırına ek olarak SR/CR store'larını ekle. Mevcut:

```typescript
const { incidents, load: loadInc, resolve: resolveInc, assign: assignInc, addWorkNote, changeState } = useIncidentStore();
```

Hemen altına ekle:

```typescript
const { serviceRequests, load: loadSR, addWorkNote: addSRWorkNote, fulfill: fulfillSR, changeState: changeSRState } = useServiceRequestStore();
const { changeRequests, load: loadCR, addWorkNote: addCRWorkNote, transition: transitionCR } = useChangeRequestStore();
```

- [ ] **Step 3: useEffect'e SR/CR yüklemesini ekle**

Mevcut:

```typescript
useEffect(() => { loadInc(); }, [loadInc]);
```

Şuna değiştir:

```typescript
useEffect(() => { loadInc(); loadSR(); loadCR(); }, [loadInc, loadSR, loadCR]);
```

- [ ] **Step 4: SR_PRIO_MAP ve SR_STATE_LABEL sabitlerini ekle**

`PRIO_NUM` sabitinin hemen altına (yaklaşık satır 347-361 arasına) ekle:

```typescript
const SR_STATE_LABEL: Record<string, string> = {
  Draft:           "Draft",
  Submitted:       "Submitted",
  "Pending Approval": "Pending",
  Approved:        "Approved",
  "In Progress":   "In Progress",
  Pending:         "Pending",
  Fulfilled:       "Resolved",
  Closed:          "Closed",
  Rejected:        "Closed",
  Cancelled:       "Closed",
};

const CR_STATE_LABEL: Record<string, string> = {
  "Pending Approval": "Pending",
  Scheduled:       "Scheduled",
  Implement:       "In Progress",
  Review:          "Pending",
  Closed:          "Closed",
  Cancelled:       "Closed",
};
```

- [ ] **Step 5: SR ve CR için Ticket dönüşümlerini ekle**

Mevcut `realTickets` tanımının hemen altına (`displayTickets` satırından önce) ekle:

```typescript
  const srTickets: Ticket[] = serviceRequests.map((sr) => {
    const slaDeadline = sr.sla?.fulfillmentDeadline ?? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    return {
      storeId: sr.id,
      id: sr.number,
      type: "SR" as const,
      title: sr.shortDescription,
      priority: (() => {
        if (sr.priority === Priority.HIGH)   return "2";
        if (sr.priority === Priority.MEDIUM) return "3";
        return "4";
      })(),
      state: SR_STATE_LABEL[sr.state] ?? sr.state,
      slaMin: Math.floor((new Date(slaDeadline).getTime() - Date.now()) / 60000),
      slaTotal: 480,
      category: sr.category,
      subcategory: sr.subcategory ?? "",
      caller: sr.requestedFor?.fullName ?? sr.requestedForId,
      dept: "",
      assignedTo: sr.assignedToId === user?.id ? "Ben" : (sr.assignedTo?.fullName ?? "—"),
      group: sr.assignmentGroupName ?? "",
      escalatedFrom: "", escalatedBy: "", escalatedAt: "",
      created: sr.createdAt,
      updated: sr.updatedAt,
      breached: sr.sla?.slaBreached ?? false,
      configItem: { name: "", type: "", os: "", ip: "", env: "" },
      description: sr.description,
      technicalNotes: sr.workNotes
        .filter((n) => n.content.startsWith("[TEKNİK]"))
        .map((n) => n.content.replace("[TEKNİK] ", ""))
        .join("\n---\n"),
      rootCause: "",
      workaround: "",
      relatedCIs: [],
      timeline: sr.timeline.map((e) => ({
        time: new Date(e.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        who: e.actorName,
        text: e.note ?? e.type,
      })),
      kbArticles: [],
      diagHistory: [],
      rcaData: null,
      pendingReason:
        sr.state === "Pending Approval" ? "Onay bekleniyor" :
        sr.state === "Pending"          ? "Bekleniyor" : undefined,
    };
  });

  const crTickets: Ticket[] = changeRequests.map((cr) => ({
    storeId: cr.id,
    id: cr.number,
    type: "CR" as const,
    title: cr.shortDescription,
    priority: (() => {
      if (cr.priority === Priority.CRITICAL) return "1";
      if (cr.priority === Priority.HIGH)     return "2";
      if (cr.priority === Priority.MEDIUM)   return "3";
      return "4";
    })(),
    state: CR_STATE_LABEL[cr.state] ?? cr.state,
    slaMin: Math.floor((new Date(cr.plannedEndDate).getTime() - Date.now()) / 60000),
    slaTotal: 4320,
    category: cr.category,
    subcategory: cr.subcategory ?? "",
    caller: cr.requestedBy?.fullName ?? cr.requestedById,
    dept: "",
    assignedTo: cr.assignedToId === user?.id ? "Ben" : (cr.assignedTo?.fullName ?? "—"),
    group: cr.assignmentGroupName ?? "",
    escalatedFrom: "", escalatedBy: "", escalatedAt: "",
    created: cr.createdAt,
    updated: cr.updatedAt,
    breached: false,
    configItem: { name: "", type: "", os: "", ip: "", env: "" },
    description: cr.description,
    technicalNotes: cr.workNotes
      .filter((n) => n.content.startsWith("[TEKNİK]"))
      .map((n) => n.content.replace("[TEKNİK] ", ""))
      .join("\n---\n"),
    rootCause: "",
    workaround: "",
    relatedCIs: [],
    timeline: cr.timeline.map((e) => ({
      time: new Date(e.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
      who: e.actorName,
      text: e.note ?? e.type,
    })),
    kbArticles: [],
    diagHistory: [],
    rcaData: null,
    changeDetails: {
      type: cr.type,
      risk: cr.risk,
      impact: cr.impact,
      implementationWindow: `${cr.plannedStartDate} – ${cr.plannedEndDate}`,
      cabDate: "",
      businessJustification: cr.justification,
      approvers: cr.approvers.map((a) => ({
        name: a.approverName,
        role: "",
        status: a.approvalState === "Approved" ? "Approved" :
                a.approvalState === "Rejected"  ? "Rejected" : "Pending",
        at: a.decidedAt ?? null,
      })),
      implementationSteps: cr.implementationPlan
        ? [{ step: cr.implementationPlan, done: false }]
        : [],
      rollbackPlan: cr.backoutPlan ?? "",
      testResults: cr.testPlan ?? "",
      preChecks: [],
    },
  }));
```

- [ ] **Step 6: `displayTickets`'ı unified listeyle değiştir**

Mevcut:

```typescript
  const displayTickets = realTickets.length > 0 ? realTickets : TICKETS;
```

Şuna değiştir:

```typescript
  const PRIORITY_WEIGHT: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, H: 1 };
  const displayTickets = [...realTickets, ...srTickets, ...crTickets].sort((a, b) => {
    if (a.breached !== b.breached) return a.breached ? -1 : 1;
    return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
  });
```

- [ ] **Step 7: selectedId'nin SR/CR ticket'larını da kapsayacak şekilde düzelt**

Mevcut `useEffect` (selectedId sync):

```typescript
  useEffect(() => {
    if (realTickets.length > 0 && !realTickets.find(t => t.id === selectedId)) {
      setSelectedId(realTickets[0].id);
    } else if (realTickets.length === 0 && !TICKETS.find(t => t.id === selectedId)) {
      setSelectedId(TICKETS[0]?.id ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents]);
```

Şuna değiştir:

```typescript
  useEffect(() => {
    if (displayTickets.length > 0 && !displayTickets.find(t => t.id === selectedId)) {
      setSelectedId(displayTickets[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, serviceRequests, changeRequests]);
```

- [ ] **Step 8: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | grep "l2/page" | head -20
```

Beklenen: l2/page.tsx'e dair hata yok.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): connect SR/CR stores and build unified ticket list"
```

---

## Task 5: L2 Page — selectedStoreType, dispatchWorkNote ve Tüm Save Handler'lar

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: `selectedStoreType`'ı useMemo ile türet**

`selected` tanımının hemen altına (yaklaşık satır 437-440) ekle:

```typescript
  const selectedStoreType = selected?.type ?? null; // "INC" | "SR" | "CR" | null
```

Not: `selectedStoreId` zaten `selected?.storeId ?? null` olarak tanımlı — bu satır değişmiyor.

- [ ] **Step 2: `dispatchWorkNote` yardımcı fonksiyonunu ekle**

`handleResolve` fonksiyonunun hemen üstüne ekle:

```typescript
  const dispatchWorkNote = async (content: string): Promise<void> => {
    if (!selectedStoreId || !selectedStoreType) return;
    if (selectedStoreType === "INC") {
      await addWorkNote(selectedStoreId, { content });
    } else if (selectedStoreType === "SR") {
      await addSRWorkNote(selectedStoreId, { content });
    } else if (selectedStoreType === "CR") {
      await addCRWorkNote(selectedStoreId, { content });
    }
  };
```

- [ ] **Step 3: `handleSaveTechNote`'u düzelt**

Mevcut:

```typescript
  const handleSaveTechNote = async () => {
    if (!selectedStoreId || !noteText.trim()) return;
    setSaving(true);
    try {
      await addWorkNote(selectedStoreId, { content: `[TEKNİK] ${noteText}` });
      setNoteText("");
    } finally { setSaving(false); }
  };
```

Şuna değiştir:

```typescript
  const handleSaveTechNote = async () => {
    if (!selectedStoreId || !noteText.trim()) return;
    setSaving(true);
    try {
      await dispatchWorkNote(`[TEKNİK] ${noteText}`);
      setNoteText("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 4: `handleSaveRootCause`'u düzelt**

Mevcut:

```typescript
  const handleSaveRootCause = async () => {
    if (!selectedStoreId || !rootCauseText.trim()) return;
    setSaving(true);
    try {
      await addWorkNote(selectedStoreId, { content: `[ROOT CAUSE] ${rootCauseText}` });
      setRootCauseText("");
    } finally { setSaving(false); }
  };
```

Şuna değiştir:

```typescript
  const handleSaveRootCause = async () => {
    if (!selectedStoreId || !rootCauseText.trim()) return;
    setSaving(true);
    try {
      await dispatchWorkNote(`[ROOT CAUSE] ${rootCauseText}`);
      setRootCauseText("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 5: Timeline notu kaydet inline handler'ını düzelt**

`activeTab === "timeline"` içindeki "Kaydet" butonunun `onClick` handler'ını bul. Mevcut:

```typescript
onClick={async () => {
  if (!selectedStoreId || !timelineNoteText.trim()) return;
  setSaving(true);
  try {
    await addWorkNote(selectedStoreId, { content: timelineNoteText.trim() });
    setTimelineNoteText("");
  } finally { setSaving(false); }
}}
```

Şuna değiştir:

```typescript
onClick={async () => {
  if (!selectedStoreId || !timelineNoteText.trim()) return;
  setSaving(true);
  try {
    await dispatchWorkNote(timelineNoteText.trim());
    setTimelineNoteText("");
  } finally { setSaving(false); }
}}
```

Aynı butonun `disabled` prop'unu da güncelle — `!selectedStoreId` yerine `!selectedStoreId || !selectedStoreType` kalabilir (zaten selectedStoreType null ise selectedStoreId da null).

- [ ] **Step 6: Tüm disabled prop'larında `!selectedStoreId` kontrolü geçerliliğini koru**

`rootCauseText` kaydet butonu, `noteText` kaydet butonu, timeline kaydet butonu — bunların `disabled` prop'ları `!selectedStoreId` kontrolüne bağlı. `selectedStoreId` artık SR/CR için de dolu olacağından bu kontroller otomatik çalışır. **Değişiklik gerekmez.**

- [ ] **Step 7: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | grep "l2/page" | head -20
```

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): add dispatchWorkNote and fix all save handlers for SR/CR"
```

---

## Task 6: L2 Page — Aksiyon Butonları (Çözüldü/Karşılandı/Tamamlandı + Eskalasyon)

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: Fulfill modal state'lerini ekle**

Mevcut `showResolveModal` state'inin hemen altına ekle:

```typescript
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillNotes, setFulfillNotes]         = useState("");
```

- [ ] **Step 2: `handleFulfill` handler'ını ekle**

`handleResolve` fonksiyonunun hemen altına ekle:

```typescript
  const handleFulfill = async () => {
    if (!selectedStoreId || !fulfillNotes.trim()) return;
    setSaving(true);
    try {
      await fulfillSR(selectedStoreId, {
        fulfillmentNotes: fulfillNotes,
        closureCode: "Fulfilled" as import("@/lib/itsm/types/service-request.types").ServiceRequestClosureCode,
      });
      setShowFulfillModal(false);
      setFulfillNotes("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 3: Header action butonlarını tip bazlı hale getir**

Detail Header'ındaki mevcut buton bloğunu bul (yaklaşık satır 693-711):

```tsx
<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
  {selected.state !== "Resolved" && selected.state !== "Closed" && selectedStoreId && (
    <button onClick={() => setShowResolveModal(true)} disabled={saving}
      style={{ ... }}>✓ Çözüldü</button>
  )}
  <div style={{ position: "relative" }}>
    <button onClick={() => setShowEscalateMenu(!showEscalateMenu)} ...>⬆ L3 Eskalasyon</button>
    ...
  </div>
</div>
```

Şuna değiştir:

```tsx
<div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
  {selected.state !== "Resolved" && selected.state !== "Closed" && selectedStoreId && (
    <>
      {selectedStoreType === "INC" && (
        <button onClick={() => setShowResolveModal(true)} disabled={saving}
          style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          ✓ Çözüldü
        </button>
      )}
      {selectedStoreType === "SR" && (
        <button onClick={() => setShowFulfillModal(true)} disabled={saving}
          style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          ✓ Karşılandı
        </button>
      )}
      {selectedStoreType === "CR" && selected.state === "In Progress" && (
        <button
          onClick={async () => {
            if (!selectedStoreId) return;
            setSaving(true);
            try {
              await transitionCR(selectedStoreId, "Review" as import("@/lib/itsm/types/enums").ChangeRequestState);
            } finally { setSaving(false); }
          }}
          disabled={saving}
          style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          ✓ Tamamlandı
        </button>
      )}
    </>
  )}
  <div style={{ position: "relative" }}>
    <button onClick={() => setShowEscalateMenu(!showEscalateMenu)}
      style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
      ⬆ L3 Eskalasyon
    </button>
    {showEscalateMenu && (
      <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.1)", overflow: "hidden", zIndex: 50, minWidth: 180, animation: "slideUp .15s ease" }}>
        {["Security - L3", "DBA - L3", "Network - L3", "Vendor Support"].map(g => (
          <button key={g} onClick={() => handleEscalate(g)}
            style={{ width: "100%", padding: "8px 12px", border: "none", cursor: "pointer", background: "#fff", color: "#1E293B", fontSize: 12, textAlign: "left" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
            ⬆ {g}
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

- [ ] **Step 4: `handleEscalate`'i SR/CR için de çalışır hale getir**

Mevcut `handleEscalate`:

```typescript
  const handleEscalate = async (group: string) => {
    setShowEscalateMenu(false);
    if (!selectedStoreId || !user) return;
    setSaving(true);
    try {
      await assignInc(selectedStoreId, { assignedToId: user.id, assignmentGroupId: group });
      const inc = incidents.find(i => i.id === selectedStoreId);
      if (inc && (inc.state === IncidentState.NEW || inc.state === IncidentState.ASSIGNED)) {
        await changeState(selectedStoreId, { state: IncidentState.IN_PROGRESS });
      }
      await addWorkNote(selectedStoreId, { content: `[ESKALASYoN] ${group} grubuna eskalasyon yapıldı` });
    } finally { setSaving(false); }
  };
```

Şuna değiştir:

```typescript
  const handleEscalate = async (group: string) => {
    setShowEscalateMenu(false);
    if (!selectedStoreId || !selectedStoreType || !user) return;
    setSaving(true);
    try {
      if (selectedStoreType === "INC") {
        await assignInc(selectedStoreId, { assignedToId: user.id, assignmentGroupId: group });
        const inc = incidents.find(i => i.id === selectedStoreId);
        if (inc && (inc.state === IncidentState.NEW || inc.state === IncidentState.ASSIGNED)) {
          await changeState(selectedStoreId, { state: IncidentState.IN_PROGRESS });
        }
      } else if (selectedStoreType === "SR") {
        const sr = serviceRequests.find(s => s.id === selectedStoreId);
        if (sr && sr.state !== "In Progress") {
          await changeSRState(selectedStoreId, "In Progress" as import("@/lib/itsm/types/enums").ServiceRequestState);
        }
      }
      await dispatchWorkNote(`[ESKALASYoN] ${group} grubuna eskalasyon yapıldı`);
    } finally { setSaving(false); }
  };
```

- [ ] **Step 5: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | grep "l2/page" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): type-based action buttons and escalation for SR/CR"
```

---

## Task 7: L2 Page — Fulfill Modal (SR)

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: Fulfill Modal JSX'ini ekle**

Mevcut Resolve Modal JSX'inin (`showResolveModal && (...)`) hemen altına ekle:

```tsx
      {/* ── Fulfill Modal (SR) ── */}
      {showFulfillModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 460, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✓ Service Request Karşılandı</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>{selected.id} — {selected.title}</p>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Karşılama Notu <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea
              value={fulfillNotes}
              onChange={e => setFulfillNotes(e.target.value)}
              placeholder="Talebin nasıl karşılandığını açıklayın..."
              rows={4}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#059669"; e.target.style.boxShadow = "0 0 0 3px rgba(5,150,105,.08)"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; e.target.style.boxShadow = "none"; }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { setShowFulfillModal(false); setFulfillNotes(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                İptal
              </button>
              <button onClick={handleFulfill} disabled={saving || !fulfillNotes.trim()}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !fulfillNotes.trim()) ? 0.6 : 1 }}>
                {saving ? "Kaydediliyor..." : "✓ Karşılandı Olarak Kapat"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 2: CSS animasyonu kontrol et**

`scaleIn` animasyonu `css` string'inde mevcut olduğunu doğrula:

```bash
grep -n "scaleIn" /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet/src/app/\(app\)/itsm/workbench/l2/page.tsx
```

Yoksa `css` string değişkenine ekle: `@keyframes scaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): add SR fulfill modal"
```

---

## Task 8: L2 Page — Convert Modal (INC → SR / CR / Problem)

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: Convert servis fonksiyonlarını import et**

Dosyanın en üstündeki import bölümüne ekle:

```typescript
import {
  convertIncidentToSR,
  convertIncidentToCR,
  convertIncidentToProblem,
  mergeDuplicateIncident,
} from "@/services/incidentService";
import { linkCRToSR } from "@/services/serviceRequestService";
```

- [ ] **Step 2: Convert modal state'lerini ekle**

Mevcut modal state'lerinin altına ekle:

```typescript
  const [showConvertModal, setShowConvertModal]       = useState(false);
  const [convertTarget, setConvertTarget]             = useState<"SR" | "CR" | "Problem">("SR");
  const [convertNote, setConvertNote]                 = useState("");
  const [convertCategory, setConvertCategory]         = useState("General");
  const [convertChangeType, setConvertChangeType]     = useState<"Standard" | "Normal" | "Emergency">("Normal");
  const [convertRisk, setConvertRisk]                 = useState<"1-Critical" | "2-High" | "3-Moderate" | "4-Low">("3-Moderate");
```

- [ ] **Step 3: `handleConvert` handler'ını ekle**

`handleFulfill` fonksiyonunun hemen altına ekle:

```typescript
  const handleConvert = async () => {
    if (!selectedStoreId || !convertNote.trim() || !user) return;
    setSaving(true);
    try {
      if (convertTarget === "SR") {
        await convertIncidentToSR(
          selectedStoreId,
          {
            requestType: "Service Request",
            category: convertCategory,
            impact: "2-Medium" as import("@/lib/itsm/types/enums").Impact,
            urgency: "2-Medium" as import("@/lib/itsm/types/enums").Urgency,
            note: convertNote,
          },
          incidents,
          user.orgId,
          user.id,
          user.name,
        );
        await loadInc();
        await loadSR();
      } else if (convertTarget === "CR") {
        await convertIncidentToCR(
          selectedStoreId,
          {
            changeType: convertChangeType as import("@/lib/itsm/types/enums").ChangeType,
            risk: convertRisk as import("@/lib/itsm/types/enums").ChangeRisk,
            note: convertNote,
          },
          incidents,
          user.orgId,
          user.id,
          user.name,
        );
        await loadInc();
        await loadCR();
      } else {
        await convertIncidentToProblem(
          selectedStoreId,
          convertNote,
          incidents,
          user.orgId,
          user.id,
          user.name,
        );
        await loadInc();
      }
      setShowConvertModal(false);
      setConvertNote("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 4: Convert Modal JSX'ini ekle**

Fulfill Modal JSX'inin hemen altına ekle:

```tsx
      {/* ── Convert Modal (INC → SR / CR / Problem) ── */}
      {showConvertModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 500, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔄 Belge Dönüştür</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>{selected.id} — {selected.title}</p>

            {/* Target seçimi */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["SR", "CR", "Problem"] as const).map(t => (
                <button key={t} onClick={() => setConvertTarget(t)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: convertTarget === t ? "2px solid #3B82F6" : "1px solid #E2E8F0", background: convertTarget === t ? "#EFF6FF" : "#fff", color: convertTarget === t ? "#2563EB" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {t === "SR" ? "🎫 Service Request" : t === "CR" ? "🔧 Change Request" : "⚠️ Problem Kaydı"}
                </button>
              ))}
            </div>

            {/* SR alanları */}
            {convertTarget === "SR" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Kategori</label>
                <input value={convertCategory} onChange={e => setConvertCategory(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}

            {/* CR alanları */}
            {convertTarget === "CR" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Değişiklik Tipi</label>
                  <select value={convertChangeType} onChange={e => setConvertChangeType(e.target.value as typeof convertChangeType)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none" }}>
                    <option value="Standard">Standard</option>
                    <option value="Normal">Normal</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Risk</label>
                  <select value={convertRisk} onChange={e => setConvertRisk(e.target.value as typeof convertRisk)}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none" }}>
                    <option value="4-Low">Low</option>
                    <option value="3-Moderate">Moderate</option>
                    <option value="2-High">High</option>
                    <option value="1-Critical">Critical</option>
                  </select>
                </div>
              </div>
            )}

            {/* Not alanı (tüm tipler için) */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Dönüştürme Notu <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea value={convertNote} onChange={e => setConvertNote(e.target.value)}
              placeholder="Dönüştürme gerekçesini yazın..." rows={3}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 11, color: "#92400E" }}>
              ℹ️ INC açıklaması ve notları yeni kayda kopyalanır. INC → Resolved (Converted) olarak kapatılır.
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { setShowConvertModal(false); setConvertNote(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                İptal
              </button>
              <button onClick={handleConvert} disabled={saving || !convertNote.trim()}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !convertNote.trim()) ? 0.6 : 1 }}>
                {saving ? "Dönüştürülüyor..." : `🔄 ${convertTarget === "SR" ? "SR" : convertTarget === "CR" ? "CR" : "Problem"} Oluştur`}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | grep "l2/page" | head -20
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): add Convert modal (INC→SR/CR/Problem)"
```

---

## Task 9: L2 Page — Merge Modal (INC + INC)

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: Merge modal state'lerini ekle**

Convert modal state'lerinin hemen altına ekle:

```typescript
  const [showMergeModal, setShowMergeModal]               = useState(false);
  const [mergeSearchQ, setMergeSearchQ]                   = useState("");
  const [mergeTargetTicket, setMergeTargetTicket]         = useState<Ticket | null>(null);
  const [mergeNote, setMergeNote]                         = useState("");
```

- [ ] **Step 2: `handleMerge` handler'ını ekle**

`handleConvert` fonksiyonunun hemen altına ekle:

```typescript
  const handleMerge = async () => {
    if (!selectedStoreId || !mergeTargetTicket?.storeId || !mergeNote.trim() || !user) return;
    setSaving(true);
    try {
      await mergeDuplicateIncident(
        selectedStoreId,
        mergeTargetTicket.storeId,
        mergeNote,
        incidents,
        user.orgId,
        user.id,
        user.name,
      );
      await loadInc();
      setShowMergeModal(false);
      setMergeNote("");
      setMergeTargetTicket(null);
      setMergeSearchQ("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 3: Merge Modal JSX'ini ekle**

Convert Modal JSX'inin hemen altına ekle:

```tsx
      {/* ── Merge Modal ── */}
      {showMergeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 520, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔗 Incident Birleştir</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>Duplicate incident'ı kapatıp bu kayıtla birleştir.</p>

            {/* Master */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Master (bu kalır)</label>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#059669" }}>{selected.id}</span>
                <span style={{ fontSize: 12, color: "#334155", marginLeft: 8 }}>{selected.title}</span>
              </div>
            </div>

            {/* Duplicate arama */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Duplicate (kapatılacak)</label>
              <input
                value={mergeSearchQ}
                onChange={e => {
                  setMergeSearchQ(e.target.value);
                  const q = e.target.value.toLowerCase();
                  const found = q.length >= 3
                    ? displayTickets.find(t =>
                        t.type === "INC" &&
                        t.id !== selected.id &&
                        (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
                      ) ?? null
                    : null;
                  setMergeTargetTicket(found);
                }}
                placeholder="INC no veya başlık ile ara (min. 3 karakter)..."
                style={{ width: "100%", padding: "9px 14px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
                onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
              />
              {mergeTargetTicket && (
                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#D97706" }}>{mergeTargetTicket.id}</span>
                  <span style={{ fontSize: 12, color: "#334155", marginLeft: 8 }}>{mergeTargetTicket.title}</span>
                </div>
              )}
              {mergeSearchQ.length >= 3 && !mergeTargetTicket && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>Eşleşen INC bulunamadı.</div>
              )}
            </div>

            {/* Birleştirme notu */}
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Birleştirme Notu <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea value={mergeNote} onChange={e => setMergeNote(e.target.value)}
              placeholder="Neden birleştiriliyor?" rows={3}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

            {mergeTargetTicket && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11, color: "#991B1B" }}>
                ⚠️ {mergeTargetTicket.id} → "Resolved (Duplicate)" olarak kapatılır. Bu işlem geri alınamaz.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { setShowMergeModal(false); setMergeNote(""); setMergeTargetTicket(null); setMergeSearchQ(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                İptal
              </button>
              <button onClick={handleMerge} disabled={saving || !mergeTargetTicket || !mergeNote.trim()}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#DC2626", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !mergeTargetTicket || !mergeNote.trim()) ? 0.6 : 1 }}>
                {saving ? "Birleştiriliyor..." : "🔗 Birleştir"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | grep "l2/page" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): add Merge modal (duplicate incident merge)"
```

---

## Task 10: L2 Page — Link CR Modal ve Araçlar Paneli

**Files:**
- Modify: `src/app/(app)/itsm/workbench/l2/page.tsx`

- [ ] **Step 1: Link CR modal state'lerini ekle**

Merge modal state'lerinin hemen altına ekle:

```typescript
  const [showLinkCRModal, setShowLinkCRModal]             = useState(false);
  const [linkCRSearchQ, setLinkCRSearchQ]                 = useState("");
  const [linkCRTargetTicket, setLinkCRTargetTicket]       = useState<Ticket | null>(null);
  const [linkCRNote, setLinkCRNote]                       = useState("");
```

- [ ] **Step 2: `handleLinkCR` handler'ını ekle**

`handleMerge` fonksiyonunun hemen altına ekle:

```typescript
  const handleLinkCR = async () => {
    if (!selectedStoreId || !linkCRTargetTicket?.storeId || !user) return;
    setSaving(true);
    try {
      await linkCRToSR(
        selectedStoreId,
        linkCRTargetTicket.storeId,
        linkCRTargetTicket.id,
        linkCRNote,
        serviceRequests,
        user.orgId,
        user.id,
        user.name,
      );
      await loadSR();
      setShowLinkCRModal(false);
      setLinkCRNote("");
      setLinkCRTargetTicket(null);
      setLinkCRSearchQ("");
    } finally { setSaving(false); }
  };
```

- [ ] **Step 3: Link CR Modal JSX'ini ekle**

Merge Modal JSX'inin hemen altına ekle:

```tsx
      {/* ── Link CR Modal (SR → CR) ── */}
      {showLinkCRModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔗 Change Request Bağla</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>{selected.id} — {selected.title}</p>

            <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Change Request Ara</label>
            <input
              value={linkCRSearchQ}
              onChange={e => {
                setLinkCRSearchQ(e.target.value);
                const q = e.target.value.toLowerCase();
                const found = q.length >= 3
                  ? displayTickets.find(t =>
                      t.type === "CR" &&
                      (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
                    ) ?? null
                  : null;
                setLinkCRTargetTicket(found);
              }}
              placeholder="CR no veya başlık ile ara (min. 3 karakter)..."
              style={{ width: "100%", padding: "9px 14px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#7C3AED"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
            />
            {linkCRTargetTicket && (
              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#7C3AED" }}>{linkCRTargetTicket.id}</span>
                <span style={{ fontSize: 12, color: "#334155", marginLeft: 8 }}>{linkCRTargetTicket.title}</span>
              </div>
            )}
            {linkCRSearchQ.length >= 3 && !linkCRTargetTicket && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#94A3B8", fontStyle: "italic" }}>Eşleşen CR bulunamadı.</div>
            )}

            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6, marginTop: 16 }}>Not (opsiyonel)</label>
            <textarea value={linkCRNote} onChange={e => setLinkCRNote(e.target.value)}
              placeholder="Bağlantı gerekçesi..." rows={2}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#7C3AED"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => { setShowLinkCRModal(false); setLinkCRNote(""); setLinkCRTargetTicket(null); setLinkCRSearchQ(""); }}
                style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                İptal
              </button>
              <button onClick={handleLinkCR} disabled={saving || !linkCRTargetTicket}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#7C3AED", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !linkCRTargetTicket) ? 0.6 : 1 }}>
                {saving ? "Bağlanıyor..." : "🔗 Bağla"}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Araçlar panelini tip bazlı hale getir**

Mevcut araçlar paneli JSX'ini bul (yaklaşık satır 812-822, `getToolButtons` veya inline buton listesi). Şu anda şöyle görünüyor:

```tsx
{[
  { l: "🎯 Root Cause Analizi", c: "#2563EB", tab: "rca" },
  { l: "📖 KB Makalesi Oluştur", c: "#059669" },
  { l: "📌 Problem Kaydı Aç", c: "#7C3AED" },
  { l: "🔗 Merge / İlişkilendir", c: "#D97706" }
].map(tool => (
  <button key={tool.l} onClick={() => tool.tab && setActiveTab(tool.tab)}
    ...>{tool.l}</button>
))}
```

Tüm bu map bloğunu şununla değiştir:

```tsx
{selected.type === "INC" && ([
  { l: "🎯 Root Cause Analizi",  c: "#2563EB", action: () => setActiveTab("rca") },
  { l: "📌 Problem Kaydı Aç",    c: "#7C3AED", action: () => { setConvertTarget("Problem"); setShowConvertModal(true); } },
  { l: "🔄 SR'a Dönüştür",       c: "#059669", action: () => { setConvertTarget("SR");      setShowConvertModal(true); } },
  { l: "🔄 CR'a Dönüştür",       c: "#0891B2", action: () => { setConvertTarget("CR");      setShowConvertModal(true); } },
  { l: "🔗 Merge / Duplicate",   c: "#D97706", action: () => setShowMergeModal(true) },
] as { l: string; c: string; action: () => void }[]).map(tool => (
  <button key={tool.l} onClick={tool.action}
    style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: tool.c, fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all .15s" }}
    onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = tool.c; }}
    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
    {tool.l}
  </button>
))}
{selected.type === "SR" && (
  <button onClick={() => setShowLinkCRModal(true)}
    style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#7C3AED", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", transition: "all .15s" }}
    onMouseEnter={e => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.borderColor = "#7C3AED"; }}
    onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#E2E8F0"; }}>
    🔗 CR Bağla
  </button>
)}
```

- [ ] **Step 5: Son TypeScript derleme kontrolü**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npx tsc --noEmit 2>&1 | head -40
```

Beklenen: Hata yok (veya bu dosyayla ilgisiz önceki hatalar).

- [ ] **Step 6: Dev server ile manuel test**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet
npm run dev
```

Test senaryoları:
1. `/itsm/workbench/l2` adresine git
2. INC ticket seç → Teknik Not yaz → "Kaydet" tıkla → Timeline sekmesinde note görünüyor mu?
3. INC ticket seç → Root Cause yaz → "Root Cause Kaydet" tıkla → Timeline'da görünüyor mu?
4. SR ticket seç → "✓ Karşılandı" butonu görünüyor mu?
5. INC ticket seç → "🔄 SR'a Dönüştür" tıkla → Modal açılıyor mu? → Not gir → "SR Oluştur" tıkla → INC listeden kayboluyor, SR listesinde yeni kayıt görünüyor mu?
6. İki INC seçili iken → "🔗 Merge / Duplicate" tıkla → Diğer INC no ara → Birleştir → Duplicate kapanıyor mu?
7. SR seç → "🔗 CR Bağla" → CR ara → Bağla → Work note eklendi mi?

- [ ] **Step 7: Final commit**

```bash
git add src/app/\(app\)/itsm/workbench/l2/page.tsx
git commit -m "feat(l2-workbench): add LinkCR modal and type-based tools panel — workbench complete"
```

---

## Self-Review

### Spec Coverage Check

| Spec Gereksinimi | Task |
|-----------------|------|
| SR/CR store bağlantısı | Task 4 |
| selectedStoreType türetme | Task 5 Step 1 |
| dispatchWorkNote | Task 5 Step 2 |
| Root cause kaydet | Task 5 Step 3-4 |
| Timeline notu kaydet | Task 5 Step 5 |
| Eskalasyon SR/CR | Task 6 Step 4 |
| Çözüldü/Karşılandı/Tamamlandı tip bazlı | Task 6 Step 3 |
| Fulfill Modal | Task 7 |
| Convert Modal (SR/CR/Problem) | Task 8 |
| convertIncidentToSR service | Task 2 Step 2 |
| convertIncidentToCR service | Task 2 Step 3 |
| convertIncidentToProblem service | Task 2 Step 4 |
| mergeDuplicateIncident service | Task 2 Step 5 |
| Merge Modal | Task 9 |
| linkCRToSR service | Task 3 |
| Link CR Modal | Task 10 Step 1-3 |
| Araçlar paneli tip bazlı | Task 10 Step 4 |
| DUPLICATE enum | Task 1 Step 1 |
| CONVERTED enum | Task 1 Step 1 |
| linkedCRIds tip ekleme | Task 1 Step 2 |

**Tüm gereksinimler kapsandı. ✓**
