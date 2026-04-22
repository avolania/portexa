"use client";

import { useState, useRef, useEffect } from "react";
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Priority, IncidentState, IncidentResolutionCode, ChangeRequestState, Impact, Urgency, ChangeType, ChangeRisk } from "@/lib/itsm/types/enums";
import { ServiceRequestClosureCode } from "@/lib/itsm/types/service-request.types";
import { convertIncidentToSR, convertIncidentToCR, convertIncidentToProblem, mergeDuplicateIncident } from "@/services/incidentService";
import { linkCRToSR } from "@/services/serviceRequestService";

// ─── Diagnostic Command Palette ───────────────────────────────────────────────
interface DiagCmd {
  cat: string;
  id: string;
  label: string;
  cmd: string;
  sim: string;
}

const DIAG_CMDS: DiagCmd[] = [
  { cat: "🌐 Ağ",      id: "ping",     label: "Ping Test",           cmd: "ping -c 4 {ip}",                        sim: "ping" },
  { cat: "🌐 Ağ",      id: "tracert",  label: "Traceroute",          cmd: "traceroute -m 15 {ip}",                 sim: "traceroute" },
  { cat: "🌐 Ağ",      id: "netstat",  label: "Aktif Bağlantılar",   cmd: "netstat -an | grep ESTABLISHED",        sim: "netstat" },
  { cat: "⚙️ Servis", id: "svc_fail", label: "Başarısız Servisler",  cmd: "systemctl --failed",                    sim: "svc_failed" },
  { cat: "⚙️ Servis", id: "win_svc",  label: "Windows Servis",      cmd: "Get-Service | Where Status -eq Stopped", sim: "win_svc" },
  { cat: "⚙️ Servis", id: "exch",     label: "Exchange DB Durum",   cmd: "Get-MailboxDatabase -Status",           sim: "exchange" },
  { cat: "💻 Sistem",  id: "cpu",      label: "CPU Kullanım",        cmd: "top -bn1 | head -15",                   sim: "cpu" },
  { cat: "💻 Sistem",  id: "mem",      label: "Bellek",              cmd: "free -m",                               sim: "mem" },
  { cat: "💻 Sistem",  id: "disk",     label: "Disk Kullanım",       cmd: "df -h",                                 sim: "disk" },
  { cat: "📝 Log",     id: "evtlog",   label: "Windows Event Log",   cmd: "Get-EventLog -LogName App -Newest 20",  sim: "event" },
  { cat: "📝 Log",     id: "syslog",   label: "Sistem Log (son 50)", cmd: "journalctl -xe | tail -50",             sim: "syslog" },
  { cat: "🔍 SAP",     id: "su53",     label: "SU53 Auth Check",     cmd: "SU53 → Kullanıcı yetki analizi",        sim: "su53" },
  { cat: "🔍 SAP",     id: "sm21",     label: "SM21 System Log",     cmd: "SM21 → Son 30 dk hata log",             sim: "sm21" },
  { cat: "🔒 VPN",     id: "vpn_ses",  label: "VPN Session Özeti",   cmd: "show vpn-sessiondb summary",            sim: "vpn" },
  { cat: "🔒 VPN",     id: "vpn_dap",  label: "DAP Policy Events",   cmd: "show vpn-sessiondb detail any",         sim: "vpn_dap" },
];

interface CIInfo { ip: string; name: string }

const SIM: Record<string, (ci: CIInfo) => string> = {
  ping: (ci) => `PING ${ci.ip} (${ci.ip}): 56 data bytes\n64 bytes from ${ci.ip}: icmp_seq=0 ttl=64 time=0.876 ms\n64 bytes from ${ci.ip}: icmp_seq=1 ttl=64 time=1.124 ms\n64 bytes from ${ci.ip}: icmp_seq=2 ttl=64 time=0.934 ms\n64 bytes from ${ci.ip}: icmp_seq=3 ttl=64 time=1.055 ms\n\n--- ${ci.ip} ping statistics ---\n4 packets transmitted, 4 received, 0.0% packet loss\nrtt min/avg/max = 0.876/0.997/1.124 ms`,
  traceroute: (ci) => ` 1  10.0.0.1   0.45 ms  0.39 ms  0.41 ms\n 2  10.0.1.1   0.58 ms  0.62 ms  0.58 ms\n 3  ${ci.ip}  0.89 ms  0.88 ms  0.90 ms`,
  netstat: () => `Proto  Local Address      Foreign Address    State\ntcp    10.0.1.50:443     10.1.0.12:5234    ESTABLISHED\ntcp    10.0.1.50:443     10.1.0.45:8892    ESTABLISHED\ntcp    10.0.1.50:25      10.0.0.5:62441    ESTABLISHED\ntcp    10.0.1.50:143     10.1.0.78:9912    TIME_WAIT\n--- 4 active connections ---`,
  svc_failed: () => `UNIT                        LOAD    ACTIVE  SUB    DESCRIPTION\n● msexchangeIS.service      loaded  failed  failed  Microsoft Exchange Info Store\n● msexchangeRPC.service     loaded  failed  failed  Microsoft Exchange RPC Client\n\n2 loaded units listed.`,
  win_svc: () => `Status   Name                  DisplayName\n------   ----                  -----------\nStopped  MSExchangeIS          Microsoft Exchange Information Store\nStopped  MSExchangeRPC         Microsoft Exchange RPC Client Access\nRunning  W3SVC                 World Wide Web Publishing Service\nRunning  MSSQLSERVER           SQL Server (MSSQLSERVER)`,
  exchange: () => `Name           Mounted  DatabaseSize  LastFullBackup\n----           -------  ------------  --------------\nMailboxDB01    False    487.3 GB      2026-04-08 02:00\nMailboxDB02    False    312.1 GB      2026-04-08 02:00\n\nWARNING: Databases are dismounted.\nESE Error 1018 (page checksum mismatch) detected.\nLast successful mount: 2026-04-09 08:02:14`,
  cpu: () => `top - 09:52:14 up 47 days, 3:21, load: 7.82, 6.94, 6.11\n\nPID    USER    %CPU  %MEM  COMMAND\n1234   system  85.2   5.6  store.exe       ← HIGH I/O\n5678   system  12.4   2.7  sqlservr.exe\n9012   system   1.2   0.4  svchost.exe\n\nWARNING: Load average 7.82 — disk I/O saturation`,
  mem: () => `              total    used    free   shared  buff/cache  available\nMem:          32768   28934    1024      512        2810       3834\nSwap:          8192    4096    4096\n\nWARNING: Memory %88.3 kullanımda. Uyarı eşiği: %85`,
  disk: () => `Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   42G    8G   84% /\n/dev/sdb1       500G  470G   30G   94% /data/exchange  ← CRITICAL\n/dev/sdc1       200G   80G  120G   40% /backup\n\nCRITICAL: /data/exchange %94 dolu — ESE 1018 hatasının muhtemel nedeni`,
  event: () => `TimeGenerated       EntryType  Source          Message\n------------------  ---------  ------          -------\n2026-04-09 08:05    Error      MSExchangeIS    ESE Error -1018: Page checksum mismatch\n2026-04-09 08:05    Error      MSExchangeIS    Information Store terminated abnormally\n2026-04-09 08:05    Warning    MSExchangeIS    MailboxDB01 dismounted\n2026-04-09 07:58    Warning    Disk            Volume /data/exchange: 94% full\n2026-04-09 07:45    Warning    Disk            Volume /data/exchange: 92% full`,
  syslog: () => `Apr 09 08:05:23 MAIL-SRV-01 kernel: I/O error, dev sdb, sector 982341234\nApr 09 08:05:24 MAIL-SRV-01 kernel: lost page write due to I/O error on sdb1\nApr 09 08:05:25 MAIL-SRV-01 store.exe[1234]: ESE checksum failure page 4521 in DB01\nApr 09 08:05:30 MAIL-SRV-01 store.exe[1234]: DB01 dismounted unexpectedly\nApr 09 07:58:12 MAIL-SRV-01 smartd[891]: /dev/sdb: reallocated sectors 847 (threshold: 100)`,
  su53: () => `Authorization Check — User: BARSLAN\n\nFailed Object:\n  Object:   F_BKPF_BUK\n  Field:    BUKRS (Company Code) = 1000\n  Activity: 01 (Create/Post)\n\nCurrent Roles:\n  SAP_FI_USER       → F_BKPF_BUK bulunamadı\n  SAP_FI_REPORTING  → F_BKPF_BUK bulunamadı\n\nNOTE: SAP_FI_POSTING transport TR-12345 ile değiştirildi (2026-04-08 23:15)`,
  sm21: () => `System Log — Son 30 dakika (SAP-APP-01)\n\nSaat     Tip   Kullanıcı   Mesaj\n-------- ----- ----------  ----------------------------------------\n08:10:23 SEC   BARSLAN     Authorization check başarısız F_BKPF_BUK:1000\n08:10:45 SEC   CDEMIR      Authorization check başarısız F_BKPF_BUK:1000\n08:11:02 SEC   MARSLAN     Authorization check başarısız F_BKPF_BUK:1000\n08:11:15 BASIS DDEPLOY     Transport TR-12345 import tamamlandı (PROD)\n05:00:12 BASIS DDEPLOY     Transport TR-12345 import başladı`,
  vpn: () => `VPN Session Summary — VPN-GW-01 (ASA 9.18)\n-------------------------------------------\nMax Sessions Configured : 250\nActive Sessions         : 247  ← SINIRA YAKLAŞILDI (%98.8)\nPeak Sessions Today     : 249\n\nAnyConnect Client Sessions\n  Active    : 247\n  Cumulative: 1,847\n\nSession Timeouts (son 1 saat): 23\nDAP Policy Denials (son 1 saat): 8\n\nWARNING: Concurrent session limiti neredeyse doldu`,
  vpn_dap: () => `DAP Policy Events — Son 1 Saat\n--------------------------------\n08:00  REJECT  ecompak   DAP_TIMEOUT — 30dk idle\n08:12  REJECT  mtoprak   DAP_TIMEOUT — 30dk idle\n08:23  REJECT  ataş      SPLIT_TUNNEL_BLOCK — Full tunnel yetkisi yok\n08:45  REJECT  dkaya     DAP_TIMEOUT — 30dk idle\n\nAktif DAP Politikaları:\n  DefaultAnyConnect  → 230 session (split-tunnel)\n  SalesFullTunnel    → 17 session (7/24 full-tunnel)\n  GuestVPN           → 0 session`,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ConfigItem { name: string; type: string; os: string; ip: string; env: string }
interface RelatedCI  { name: string; type: string; status: string; relation: string }
interface TimelineEvent { time: string; who: string; text: string }
interface KBArticle  { id: string; title: string; relevance: number }
interface DiagEntry  { cmd: string; time: string; status: "ok" | "warning" | "error"; output: string }
interface ContribFactor { id: string; label: string; checked: boolean }
interface PreventiveAction { id: string; action: string; owner: string; due: string; status: string }
interface RCAData {
  why1: string; why2: string; why3: string; why4: string; why5: string;
  rootCause: string;
  contributingFactors: ContribFactor[];
  preventiveActions: PreventiveAction[];
}
interface Approver { name: string; role: string; status: "Approved" | "Pending" | "Rejected"; at: string | null }
interface ImplStep  { step: string; done: boolean }
interface PreCheck  { check: string; done: boolean }
interface ChangeDetails {
  type: string; risk: string; impact: string;
  implementationWindow: string; cabDate: string; businessJustification: string;
  approvers: Approver[];
  implementationSteps: ImplStep[];
  rollbackPlan: string; testResults: string;
  preChecks: PreCheck[];
}
interface AttachmentItem { id: string; name: string; url: string; size: number; type: string; uploadedBy: string; uploadedAt: string; }
interface Ticket {
  id: string; storeId?: string; type: "INC" | "SR" | "CR"; title: string;
  priority: string; state: string; slaMin: number; slaTotal: number;
  category: string; subcategory: string;
  caller: string; dept: string; assignedTo: string; group: string;
  escalatedFrom: string; escalatedBy: string; escalatedAt: string;
  created: string; updated: string; breached: boolean;
  configItem: ConfigItem;
  description: string; technicalNotes: string; rootCause: string; workaround: string;
  relatedCIs: RelatedCI[];
  timeline: TimelineEvent[];
  kbArticles: KBArticle[];
  diagHistory: DiagEntry[];
  rcaData: RCAData | null;
  changeDetails?: ChangeDetails;
  pendingReason?: string;
  attachments: AttachmentItem[];
}

// ─── Static Demo Data ─────────────────────────────────────────────────────────
const mkDiagEntry = (cmd: string, time: string, status: DiagEntry["status"], output: string): DiagEntry => ({ cmd, time, status, output });

const TICKETS: Ticket[] = [
  {
    id: "INC0011042", type: "INC",
    title: "Email sunucusu yanıt vermiyor – Exchange DB mount hatası",
    priority: "1", state: "In Progress", slaMin: -30, slaTotal: 60,
    category: "Infrastructure", subcategory: "Server",
    caller: "Fatma Demir", dept: "HR", assignedTo: "Ben", group: "Infrastructure - L2",
    escalatedFrom: "Service Desk - L1", escalatedBy: "Ahmet Yılmaz", escalatedAt: "08:20",
    created: "2s önce", updated: "45dk önce", breached: true,
    configItem: { name: "MAIL-SRV-01", type: "Exchange Server", os: "Windows Server 2022", ip: "10.0.1.50", env: "Production" },
    description: "Exchange sunucusu 08:00'den itibaren yanıt vermiyor. Tüm departmanlar e-posta gönderip alamıyor. Outlook istemcileri bağlantı hatası veriyor. ~450 kullanıcı etkilendi.",
    technicalNotes: "Exchange Information Store servisi running ama DB mount edilemiyor. Event Log'da ESE error 1018 (checksum mismatch) var. Muhtemel disk I/O problemi.",
    rootCause: "", workaround: "OWA üzerinden webmail erişimi kısmen çalışıyor. Kullanıcılara webmail yönlendirmesi yapıldı.",
    relatedCIs: [
      { name: "SAN-PROD-01", type: "Storage", status: "Warning", relation: "Depends On" },
      { name: "DC-01", type: "Domain Controller", status: "OK", relation: "Connected To" },
      { name: "BACKUP-SRV-01", type: "Backup Server", status: "OK", relation: "Backed Up By" },
    ],
    timeline: [
      { time: "08:00", who: "Sistem", text: "Monitoring alert: MAIL-SRV-01 service degradation" },
      { time: "08:15", who: "Ahmet Y.", text: "L1: Incident açıldı. Exchange servisi kontrol edildi." },
      { time: "08:20", who: "Ahmet Y.", text: "L2'ye eskalasyon – DB mount problemi tespit edildi." },
      { time: "08:30", who: "Ben", text: "L2: İnceleme başlatıldı. ESE error 1018 tespit edildi." },
      { time: "09:15", who: "Sistem", text: "SLA ihlal edildi – P1 hedef: 1 saat" },
      { time: "09:45", who: "Ben", text: "L2: SAN-PROD-01 disk latency yüksek. Storage ekibi bilgilendirildi." },
    ],
    kbArticles: [
      { id: "KB-0451", title: "Exchange DB Mount Failure – ESE Error Recovery", relevance: 92 },
      { id: "KB-0389", title: "SAN Disk I/O Troubleshooting Guide", relevance: 78 },
    ],
    diagHistory: [
      mkDiagEntry("ping -c 4 10.0.1.50", "08:32", "ok", SIM.ping({ ip: "10.0.1.50", name: "MAIL-SRV-01" })),
      mkDiagEntry("Get-MailboxDatabase -Status", "08:35", "error", SIM.exchange({ ip: "10.0.1.50", name: "MAIL-SRV-01" })),
      mkDiagEntry("Get-EventLog -LogName App -Newest 10", "08:36", "error", SIM.event({ ip: "10.0.1.50", name: "MAIL-SRV-01" })),
    ],
    rcaData: {
      why1: "Exchange veritabanı mount edilemiyor",
      why2: "Disk I/O hataları nedeniyle DB sayfaları corrupt oldu",
      why3: "SAN-PROD-01 disk latency 220ms+ (normal: <10ms), checksum hataları oluştu",
      why4: "SAN diski %94 dolulukta, yüksek I/O baskısı altında write başarısız",
      why5: "Kapasite uyarıları (3 gündür %90+) alert yorgunluğu nedeniyle acknowledge edilmedi",
      rootCause: "",
      contributingFactors: [
        { id: "cf1", label: "SAN kapasite alertleri ignore edildi", checked: true },
        { id: "cf2", label: "Proaktif disk kapasitesi yönetimi eksikliği", checked: true },
        { id: "cf3", label: "Exchange DB backup integrity check 14 gündür çalışmıyor", checked: true },
        { id: "cf4", label: "SAN bakım penceresi planlanmamış", checked: false },
        { id: "cf5", label: "Monitoring alert yorgunluğu", checked: true },
      ],
      preventiveActions: [
        { id: "pa1", action: "SAN disk kapasite alert threshold'unu %85'e düşür", owner: "Storage Team", due: "2026-04-15", status: "Open" },
        { id: "pa2", action: "Exchange DB sağlık check otomasyonu ekle (günlük)", owner: "Infrastructure L2", due: "2026-04-20", status: "Open" },
        { id: "pa3", action: "Alert yorgunluğu için monitoring kurallarını revize et", owner: "NOC", due: "2026-04-30", status: "Open" },
        { id: "pa4", action: "SAN kapasite planlama toplantısı (Q2)", owner: "IT Manager", due: "2026-04-30", status: "Open" },
      ],
    },
    attachments: [],
  },
  {
    id: "INC0011040", type: "INC",
    title: "SAP GUI login hatası – Authorization failure FI modülü",
    priority: "2", state: "In Progress", slaMin: 52, slaTotal: 240,
    category: "Application", subcategory: "SAP",
    caller: "Burak Arslan", dept: "Finans", assignedTo: "Ben", group: "App Support - L2",
    escalatedFrom: "Service Desk - L1", escalatedBy: "Can Demir", escalatedAt: "05:30",
    created: "5s önce", updated: "1s önce", breached: false,
    configItem: { name: "SAP-APP-01", type: "SAP Application Server", os: "SUSE Linux 15", ip: "10.0.2.20", env: "Production" },
    description: "SAP GUI ile FI modülüne giriş yapılamıyor. 3 kullanıcıda 'Authorization failure' hatası. SAP Basis ekibi ile koordinasyon gerekebilir.",
    technicalNotes: "SU53 analizi yapıldı. Eksik yetki objesi: F_BKPF_BUK (Company Code authorization). Son transport (TR-12345) ile roller değişmiş olabilir.",
    rootCause: "", workaround: "SAP* kullanıcısı ile acil işlemler yapılabiliyor (güvenlik onaylı).",
    relatedCIs: [{ name: "SAP-DB-01", type: "HANA Database", status: "OK", relation: "Database" }],
    timeline: [
      { time: "05:00", who: "Can D.", text: "L1: Incident açıldı. 3 kullanıcı login olamıyor." },
      { time: "05:30", who: "Can D.", text: "L2'ye eskalasyon – authorization problemi." },
      { time: "08:15", who: "Ben", text: "L2: SU53 ile eksik yetki objesi tespit edildi." },
    ],
    kbArticles: [
      { id: "KB-0612", title: "SAP Authorization Failure – SU53 Diagnosis", relevance: 95 },
      { id: "KB-0580", title: "SAP Transport Impact Analysis", relevance: 70 },
    ],
    diagHistory: [
      mkDiagEntry("SM21 – System Log (Son 30 dk)", "08:15", "ok", SIM.sm21({ ip: "10.0.2.20", name: "SAP-APP-01" })),
      mkDiagEntry("SU53 – User BARSLAN auth check", "08:20", "error", SIM.su53({ ip: "10.0.2.20", name: "SAP-APP-01" })),
    ],
    rcaData: {
      why1: "FI modülüne login sırasında authorization failure",
      why2: "F_BKPF_BUK yetki objesi rollerde mevcut değil",
      why3: "TR-12345 transportu SAP_FI_POSTING rolünden yetki objesini kaldırdı",
      why4: "Transport test ortamında test edilmedi (düşük risk kategorize edildi)",
      why5: "Change management prosedürü küçük role değişikliklerinde test adımını zorunlu kılmıyor",
      rootCause: "",
      contributingFactors: [
        { id: "cf1", label: "Transport management prosedürü eksikliği", checked: true },
        { id: "cf2", label: "Test ortamı bypass edildi", checked: true },
        { id: "cf3", label: "Role değişiklik review süreci yok", checked: true },
        { id: "cf4", label: "Transport etki analizi yapılmadı", checked: false },
      ],
      preventiveActions: [
        { id: "pa1", action: "Tüm SAP transportları için test ortamı zorunlu hale getir", owner: "SAP Basis", due: "2026-04-20", status: "Open" },
        { id: "pa2", action: "Role değişiklik checklist oluştur", owner: "SAP Security", due: "2026-04-25", status: "Open" },
      ],
    },
    attachments: [],
  },
  {
    id: "INC0011041", type: "INC",
    title: "VPN bağlantı kopmaları – Cisco AnyConnect timeout",
    priority: "2", state: "In Progress", slaMin: 88, slaTotal: 240,
    category: "Network", subcategory: "VPN",
    caller: "Emre Taş", dept: "Satış", assignedTo: "Fatma Bilgin", group: "Network Ops - L2",
    escalatedFrom: "Service Desk - L1", escalatedBy: "Ahmet Yılmaz", escalatedAt: "07:45",
    created: "3s önce", updated: "1s önce", breached: false,
    configItem: { name: "VPN-GW-01", type: "VPN Gateway", os: "Cisco ASA 9.18", ip: "10.0.0.5", env: "Production" },
    description: "Uzak çalışan kullanıcılar VPN bağlantısında sürekli kopmalar yaşıyor. 5+ kullanıcıdan şikayet. Cisco AnyConnect 'Connection attempt has failed' hatası.",
    technicalNotes: "ASA log'larında DAP policy timeout görülüyor. Split-tunnel config kontrolü gerekli. Concurrent session limit'e yaklaşılmış olabilir.",
    rootCause: "", workaround: "",
    relatedCIs: [
      { name: "FW-CORE-01", type: "Firewall", status: "OK", relation: "Routes Through" },
      { name: "ISP-LINK-01", type: "ISP Connection", status: "Warning", relation: "Depends On" },
    ],
    timeline: [
      { time: "07:30", who: "Ahmet Y.", text: "L1: 5 kullanıcıdan VPN şikayeti." },
      { time: "07:45", who: "Ahmet Y.", text: "L2 Network Ops'a eskalasyon." },
      { time: "08:00", who: "Fatma B.", text: "L2: ASA log incelemesi başlatıldı." },
    ],
    kbArticles: [{ id: "KB-0332", title: "Cisco AnyConnect Troubleshooting – Common Errors", relevance: 88 }],
    diagHistory: [mkDiagEntry("show vpn-sessiondb summary", "08:05", "warning", SIM.vpn({ ip: "10.0.0.5", name: "VPN-GW-01" }))],
    rcaData: {
      why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "",
      contributingFactors: [
        { id: "cf1", label: "VPN session limiti yetersiz", checked: false },
        { id: "cf2", label: "DAP policy timeout değeri çok düşük", checked: false },
        { id: "cf3", label: "ISP bağlantı instabilitesi", checked: false },
        { id: "cf4", label: "Split-tunnel konfigürasyonu yanlış", checked: false },
      ],
      preventiveActions: [],
    },
    attachments: [],
  },
  {
    id: "SR0002085", type: "SR",
    title: "VPN erişim yetkisi genişletme – 7/24 full-tunnel",
    priority: "H", state: "Pending", slaMin: -120, slaTotal: 480,
    category: "Access", subcategory: "VPN",
    caller: "Emre Taş", dept: "Satış", assignedTo: "Ben", group: "Security Team",
    escalatedFrom: "Service Desk - L1", escalatedBy: "Can Demir", escalatedAt: "Dün 14:00",
    created: "2g önce", updated: "30dk önce", breached: true,
    configItem: { name: "VPN-GW-01", type: "VPN Gateway", os: "Cisco ASA 9.18", ip: "10.0.0.5", env: "Production" },
    description: "Satış ekibinden Emre Taş'ın VPN erişiminin 7/24 full-tunnel'a genişletilmesi. Firewall kural değişikliği gerekiyor.",
    technicalNotes: "CR-0316 açıldı, firewall değişikliği için CAB onayı bekleniyor. MFA policy güncellemesi de gerekli.",
    rootCause: "", workaround: "",
    relatedCIs: [],
    timeline: [
      { time: "11:00", who: "Can D.", text: "L1: SR açıldı." },
      { time: "14:00", who: "Can D.", text: "Security Team'e eskalasyon." },
      { time: "08:30", who: "Ben", text: "CR-0316 açıldı. CAB bekleniyor." },
    ],
    kbArticles: [], diagHistory: [], rcaData: null,
    pendingReason: "CR-0316 CAB onayı bekleniyor",
    attachments: [],
  },
  {
    id: "CR0000312", type: "CR",
    title: "Firewall kural güncellemesi – DMZ segmentasyonu",
    priority: "H", state: "In Progress", slaMin: 2880, slaTotal: 4320,
    category: "Network", subcategory: "Firewall",
    caller: "Hakan Öz", dept: "IT", assignedTo: "Mehmet Sarı", group: "Network Ops - L2",
    escalatedFrom: "", escalatedBy: "", escalatedAt: "",
    created: "3g önce", updated: "5s önce", breached: false,
    configItem: { name: "FW-CORE-01", type: "Palo Alto Firewall", os: "PAN-OS 11.1", ip: "10.0.0.1", env: "Production" },
    description: "DMZ segmentasyonunun güçlendirilmesi için firewall kurallarının güncellenmesi. PCI-DSS uyumluluğu kapsamında.",
    technicalNotes: "Mevcut any-any kuralları spesifik port/IP tabanlıya dönüştürülecek. Test ortamında 47 kural test edildi, 3'ünde false-positive düzeltildi.",
    rootCause: "", workaround: "",
    relatedCIs: [
      { name: "SW-CORE-01", type: "Core Switch", status: "OK", relation: "Connected To" },
      { name: "DMZ-WEB-01", type: "Web Server", status: "OK", relation: "Protected By" },
    ],
    timeline: [
      { time: "09:00", who: "Hakan Ö.", text: "RFC açıldı." },
      { time: "10:00", who: "Mehmet S.", text: "Test ortamı kural seti hazırlandı." },
      { time: "Dün 15:00", who: "CAB", text: "CAB toplantısı – kısmi onay, ek test istendi." },
      { time: "Bugün 08:00", who: "Mehmet S.", text: "Ek test tamamlandı, CAB'a sunuldu." },
    ],
    kbArticles: [{ id: "KB-0501", title: "Palo Alto Firewall – Rule Migration Best Practices", relevance: 85 }],
    diagHistory: [], rcaData: null,
    changeDetails: {
      type: "Normal", risk: "Medium", impact: "High",
      implementationWindow: "2026-04-12 Cmt 22:00 – 02:00",
      cabDate: "2026-04-10 Prş 14:00",
      businessJustification: "Mevcut DMZ güvenlik açıklarını kapatmak ve PCI-DSS uyumluluğunu sağlamak",
      approvers: [
        { name: "Hakan Öz", role: "IT Manager", status: "Approved", at: "Dün 16:30" },
        { name: "Güvenlik Ekibi", role: "Security Lead", status: "Pending", at: null },
        { name: "NOC Lead", role: "Operations", status: "Pending", at: null },
        { name: "Finans Sistemi Sahibi", role: "Business Owner", status: "Approved", at: "Bugün 09:00" },
      ],
      implementationSteps: [
        { step: "Pre-change: Mevcut kural setini backup al (Panorama snapshot)", done: true },
        { step: "Step 1: DMZ → Internal kuralları güncelle (25 kural)", done: false },
        { step: "Step 2: External → DMZ kuralları güncelle (12 kural)", done: false },
        { step: "Step 3: Internal → External kuralları güncelle (10 kural)", done: false },
        { step: "Validation: Servis bağlantılarını doğrula (test script)", done: false },
        { step: "Post-change: 30 dakika monitoring window", done: false },
      ],
      rollbackPlan: "Panorama'dan önceki kural seti configuration snapshot'ı restore edilir.\nPanorama → FW-CORE-01 commit & push.\nTahmini RTO: 10 dakika.",
      testResults: "Test ortamı sonuçları:\n✓ 44 kural başarılı\n⚠  3 false-positive tespit edildi ve düzeltildi\n✓ Kritik servisler (SAP, Exchange, VPN) test geçti\n✓ DMZ web servisleri erişim testi geçti\n✓ Rollback prosedürü test edildi (8 dk)",
      preChecks: [
        { check: "Backup / Panorama snapshot alındı", done: true },
        { check: "Test ortamı onayı alındı", done: true },
        { check: "Rollback prosedürü test edildi", done: true },
        { check: "NOC on-call bildirildi", done: false },
        { check: "Etkilenen uygulama sahipleri bildirildi", done: false },
        { check: "Değişiklik penceresi takvime alındı", done: true },
      ],
    },
    attachments: [],
  },
];

// ─── Visual Constants ─────────────────────────────────────────────────────────
const TYPE_C = {
  INC: { l: "INC", c: "#DC2626", bg: "#FEE2E2" },
  SR:  { l: "SR",  c: "#2563EB", bg: "#DBEAFE" },
  CR:  { l: "CR",  c: "#7C3AED", bg: "#F3E8FF" },
} as const;

const PRIO_C: Record<string, { l: string; c: string; bg: string }> = {
  "1": { l: "P1",   c: "#fff", bg: "#DC2626" },
  "2": { l: "P2",   c: "#fff", bg: "#D97706" },
  "3": { l: "P3",   c: "#fff", bg: "#2563EB" },
  H:   { l: "HIGH", c: "#fff", bg: "#D97706" },
};

const STATE_C: Record<string, { c: string; i: string }> = {
  New:          { c: "#3B82F6", i: "○" },
  "In Progress":{ c: "#D97706", i: "◎" },
  Pending:      { c: "#7C3AED", i: "⏷" },
  Resolved:     { c: "#059669", i: "✓" },
};

const CI_STATUS_C: Record<string, string> = {
  OK: "#059669", Warning: "#D97706", Critical: "#DC2626", Unknown: "#6B7280",
};

const APPROVER_STATUS = {
  Approved: { c: "#059669", bg: "#D1FAE5", i: "✓" },
  Pending:  { c: "#D97706", bg: "#FEF3C7", i: "⏳" },
  Rejected: { c: "#DC2626", bg: "#FEE2E2", i: "✗" },
} as const;

// ─── Priority / State mapping helpers ────────────────────────────────────────
const PRIO_NUM: Record<Priority, string> = {
  [Priority.CRITICAL]: "1",
  [Priority.HIGH]: "2",
  [Priority.MEDIUM]: "3",
  [Priority.LOW]: "4",
};
const INC_STATE_LABEL: Record<IncidentState, string> = {
  [IncidentState.NEW]: "New",
  [IncidentState.ASSIGNED]: "Assigned",
  [IncidentState.IN_PROGRESS]: "In Progress",
  [IncidentState.PENDING]: "Pending",
  [IncidentState.RESOLVED]: "Resolved",
  [IncidentState.CLOSED]: "Closed",
};

const SR_STATE_LABEL: Record<string, string> = {
  Draft:                "Draft",
  Submitted:            "Submitted",
  "Pending Approval":   "Pending",
  Approved:             "Approved",
  "In Progress":        "In Progress",
  Pending:              "Pending",
  Fulfilled:            "Resolved",
  Closed:               "Closed",
  Rejected:             "Closed",
  Cancelled:            "Closed",
};

const CR_STATE_LABEL: Record<string, string> = {
  "Pending Approval":   "Pending",
  Scheduled:            "Scheduled",
  Implement:            "In Progress",
  Review:               "Pending",
  Closed:               "Closed",
  Cancelled:            "Closed",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function SpecialistWorkbenchPage() {
  const { incidents, load: loadInc, resolve: resolveInc, assign: assignInc, addWorkNote, changeState, update: updateInc, addAttachment: addIncAttachment, loadTicketActivity: loadIncActivity, activeWorkNotes: incWorkNotes } = useIncidentStore();
  const { user } = useAuthStore();
  const { serviceRequests, load: loadSR, addWorkNote: addSRWorkNote, fulfill: fulfillSR, addAttachment: addSRAttachment, loadTicketActivity: loadSRActivity, activeWorkNotes: srWorkNotes } = useServiceRequestStore();
  const { changeRequests, load: loadCR, addWorkNote: addCRWorkNote, transition: transitionCR, addAttachment: addCRAttachment, loadTicketActivity: loadCRActivity, activeWorkNotes: crWorkNotes } = useChangeRequestStore();

  // Gerçek incident'ları Ticket formatına dönüştür
  const realTickets: Ticket[] = incidents.map((inc) => ({
    storeId: inc.id,
    id: inc.number,
    type: "INC" as const,
    title: inc.shortDescription,
    priority: PRIO_NUM[inc.priority] ?? "3",
    state: INC_STATE_LABEL[inc.state] ?? inc.state,
    slaMin: Math.floor((new Date(inc.sla.resolutionDeadline).getTime() - Date.now()) / 60000),
    slaTotal: 240,
    category: inc.category,
    subcategory: inc.subcategory ?? "",
    caller: inc.callerId,
    dept: "",
    assignedTo: inc.assignedToId === user?.id ? "Ben" : (inc.assignedToId ?? "—"),
    group: inc.assignmentGroupName ?? "",
    escalatedFrom: "",
    escalatedBy: "",
    escalatedAt: "",
    created: inc.createdAt,
    updated: inc.updatedAt,
    breached: inc.sla.resolutionBreached,
    configItem: { name: "", type: "", os: "", ip: "", env: "" },
    description: inc.description,
    technicalNotes: (inc.workNotes ?? []).filter(n => n.content.startsWith("[TEKNİK]")).map(n => n.content.replace("[TEKNİK] ", "")).join("\n---\n"),
    rootCause: (inc.workNotes ?? []).filter(n => n.content.startsWith("[ROOT CAUSE]")).map(n => n.content.replace("[ROOT CAUSE] ", "")).join("\n---\n"),
    workaround: "",
    relatedCIs: [],
    timeline: (inc.timeline ?? []).map(e => ({ time: new Date(e.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }), who: e.actorName, text: (e.note ?? e.type) })),
    kbArticles: [],
    diagHistory: [],
    rcaData: inc.rcaData
      ? (inc.rcaData as unknown as RCAData)
      : { why1: "", why2: "", why3: "", why4: "", why5: "", rootCause: "", contributingFactors: [], preventiveActions: [] },
    attachments: inc.attachments ?? [],
  }));

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
      technicalNotes: (sr.workNotes ?? [])
        .filter((n) => n.content.startsWith("[TEKNİK]"))
        .map((n) => n.content.replace("[TEKNİK] ", ""))
        .join("\n---\n"),
      rootCause: "",
      workaround: "",
      relatedCIs: [],
      timeline: (sr.timeline ?? []).map((e) => ({
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
      attachments: sr.attachments ?? [],
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
    technicalNotes: (cr.workNotes ?? [])
      .filter((n) => n.content.startsWith("[TEKNİK]"))
      .map((n) => n.content.replace("[TEKNİK] ", ""))
      .join("\n---\n"),
    rootCause: "",
    workaround: "",
    relatedCIs: [],
    timeline: (cr.timeline ?? []).map((e) => ({
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
    attachments: cr.attachments ?? [],
  }));

  // Unified sorted list: breached first, then by priority
  const PRIORITY_WEIGHT: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, H: 1 };
  const displayTickets = [...realTickets, ...srTickets, ...crTickets].sort((a, b) => {
    if (a.breached !== b.breached) return a.breached ? -1 : 1;
    return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
  });

  const [selectedId, setSelectedId]         = useState<string>("");
  const [activeTab, setActiveTab]           = useState("technical");
  const [filterType, setFilterType]         = useState<"all" | "INC" | "SR" | "CR">("all");
  const [filterMine, setFilterMine]         = useState(false);
  const [searchQ, setSearchQ]               = useState("");
  const [rootCauseText, setRootCauseText]   = useState("");
  const [noteText, setNoteText]             = useState("");
  const [timelineNoteText, setTimelineNoteText] = useState("");
  const [saving, setSaving]                 = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);
  const [showEscalateMenu, setShowEscalateMenu] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveNotes, setResolveNotes]     = useState("");
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [fulfillNotes, setFulfillNotes]         = useState("");
  const [showConvertModal, setShowConvertModal]       = useState(false);
  const [convertTarget, setConvertTarget]             = useState<"SR" | "CR" | "Problem">("SR");
  const [convertNote, setConvertNote]                 = useState("");
  const [convertCategory, setConvertCategory]         = useState("General");
  const [convertChangeType, setConvertChangeType]     = useState<"Standard" | "Normal" | "Emergency">("Normal");
  const [convertRisk, setConvertRisk]                 = useState<"1-Critical" | "2-High" | "3-Moderate" | "4-Low">("3-Moderate");
  const [showMergeModal, setShowMergeModal]               = useState(false);
  const [mergeSearchQ, setMergeSearchQ]                   = useState("");
  const [mergeTargetTicket, setMergeTargetTicket]         = useState<Ticket | null>(null);
  const [mergeNote, setMergeNote]                         = useState("");
  const [showLinkCRModal, setShowLinkCRModal]             = useState(false);
  const [linkCRSearchQ, setLinkCRSearchQ]                 = useState("");
  const [linkCRTargetTicket, setLinkCRTargetTicket]       = useState<Ticket | null>(null);
  const [linkCRNote, setLinkCRNote]                       = useState("");

  // Store'dan yükle; selectedId'yi ilk gerçek ticket'a senkronize et
  useEffect(() => { loadInc(); loadSR(); loadCR(); }, [loadInc, loadSR, loadCR]);
  useEffect(() => {
    if (displayTickets.length > 0 && !displayTickets.find(t => t.id === selectedId)) {
      setSelectedId(displayTickets[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, serviceRequests, changeRequests]);

  const [diagRunning, setDiagRunning]       = useState(false);
  const [diagSelected, setDiagSelected]     = useState<string | null>(null);
  const [diagSession, setDiagSession]       = useState<DiagEntry[]>([]);
  const termRef                             = useRef<HTMLDivElement>(null);
  const [attachSaving, setAttachSaving]     = useState(false);
  const attachFileRef                       = useRef<HTMLInputElement>(null);

  const [rcaLocal, setRcaLocal]             = useState<Record<string, Partial<RCAData>>>({});
  const [cabSteps, setCabSteps]             = useState<Record<string, Record<number, boolean>>>({});
  const [cabChecks, setCabChecks]           = useState<Record<string, Record<number, boolean>>>({});

  const selected = (displayTickets.find(t => t.id === selectedId) ?? displayTickets[0])!;

  // Seçili ticket'ın store UUID'si — storeId alanı yoksa ticket numarasından fallback lookup
  const selectedStoreId: string | null = (() => {
    if (!selected) return null;
    if (selected.storeId) return selected.storeId;
    if (selected.type === "INC") return incidents.find(i => i.number === selected.id)?.id ?? null;
    if (selected.type === "SR") return serviceRequests.find(s => s.number === selected.id)?.id ?? null;
    if (selected.type === "CR") return changeRequests.find(c => c.number === selected.id)?.id ?? null;
    return null;
  })();
  const selectedStoreType = selected?.type ?? null; // "INC" | "SR" | "CR" | null
  const activeWorkNotes = selectedStoreType === "INC" ? incWorkNotes : selectedStoreType === "SR" ? srWorkNotes : crWorkNotes;
  const activeTechNotes = activeWorkNotes.filter(n => n.content.startsWith("[TEKNİK]")).map(n => n.content.replace("[TEKNİK] ", "")).join("\n---\n");

  useEffect(() => {
    if (!selectedStoreId || !selectedStoreType) return;
    if (selectedStoreType === "INC") loadIncActivity(selectedStoreId);
    else if (selectedStoreType === "SR") loadSRActivity(selectedStoreId);
    else if (selectedStoreType === "CR") loadCRActivity(selectedStoreId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, selectedStoreType]);

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

  const handleResolve = async () => {
    if (!selectedStoreId || !resolveNotes.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await resolveInc(selectedStoreId, {
        resolutionCode: IncidentResolutionCode.SOLVED_PERMANENTLY,
        resolutionNotes: resolveNotes,
      });
      setShowResolveModal(false);
      setResolveNotes("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Kayıt sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const handleFulfill = async () => {
    if (!selectedStoreId || !fulfillNotes.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await fulfillSR(selectedStoreId, {
        fulfillmentNotes: fulfillNotes,
        closureCode: ServiceRequestClosureCode.FULFILLED,
      });
      setShowFulfillModal(false);
      setFulfillNotes("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Kayıt sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const handleConvert = async () => {
    if (!selectedStoreId || !convertNote.trim() || !user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (convertTarget === "SR") {
        const { srNumber } = await convertIncidentToSR(
          selectedStoreId,
          { requestType: "Service Request", category: convertCategory, impact: Impact.MEDIUM, urgency: Urgency.MEDIUM, note: convertNote },
          incidents, user.orgId, user.id, user.name,
        );
        await loadInc();
        await loadSR();
        setShowConvertModal(false);
        setConvertNote("");
        setFilterType("SR");
        setSelectedId(srNumber);
        setConvertSuccessMsg(`✓ ${srNumber} numaralı Service Request oluşturuldu ve listeye eklendi.`);
      } else if (convertTarget === "CR") {
        const { crNumber } = await convertIncidentToCR(
          selectedStoreId,
          { changeType: convertChangeType as ChangeType, risk: convertRisk as ChangeRisk, note: convertNote },
          incidents, user.orgId, user.id, user.name,
        );
        await loadInc();
        await loadCR();
        setShowConvertModal(false);
        setConvertNote("");
        setFilterType("CR");
        setSelectedId(crNumber);
        setConvertSuccessMsg(`✓ ${crNumber} numaralı Change Request oluşturuldu ve listeye eklendi.`);
      } else {
        const { problemNumber } = await convertIncidentToProblem(selectedStoreId, convertNote, incidents, user.orgId, user.id, user.name);
        await loadInc();
        setShowConvertModal(false);
        setConvertNote("");
        setFilterType("INC");
        setSelectedId(problemNumber);
        setConvertSuccessMsg(`✓ ${problemNumber} numaralı Problem kaydı oluşturuldu.`);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Dönüştürme sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const handleMerge = async () => {
    if (!selectedStoreId || !mergeTargetTicket?.storeId || !mergeNote.trim() || !user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await mergeDuplicateIncident(selectedStoreId, mergeTargetTicket.storeId, mergeNote, incidents, user.orgId, user.id, user.name);
      await loadInc();
      setShowMergeModal(false);
      setMergeNote("");
      setMergeTargetTicket(null);
      setMergeSearchQ("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Birleştirme sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const handleLinkCR = async () => {
    if (!selectedStoreId || !linkCRTargetTicket?.storeId || !user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await linkCRToSR(selectedStoreId, linkCRTargetTicket.storeId, linkCRTargetTicket.id, linkCRNote, serviceRequests, user.orgId, user.id, user.name);
      await loadSR();
      setShowLinkCRModal(false);
      setLinkCRNote("");
      setLinkCRTargetTicket(null);
      setLinkCRSearchQ("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'CR bağlama sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const handleSaveTechNote = async () => {
    if (!selectedStoreId || !noteText.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await dispatchWorkNote(`[TEKNİK] ${noteText}`);
      setNoteText("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Teknik not kaydedilemedi');
    } finally { setSaving(false); }
  };

  const handleAddAttachment = async (file: File) => {
    if (!selectedStoreId || !selectedStoreType) return;
    setAttachSaving(true);
    setErrorMsg(null);
    try {
      if (selectedStoreType === "INC") await addIncAttachment(selectedStoreId, file);
      else if (selectedStoreType === "SR") await addSRAttachment(selectedStoreId, file);
      else if (selectedStoreType === "CR") await addCRAttachment(selectedStoreId, file);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Dosya yüklenemedi');
    } finally { setAttachSaving(false); }
  };

  const handleSaveRootCause = async () => {
    if (!selectedStoreId || !rootCauseText.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await dispatchWorkNote(`[ROOT CAUSE] ${rootCauseText}`);
      setRootCauseText("");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Root cause kaydedilemedi');
    } finally { setSaving(false); }
  };

  const handleSaveRCA = async () => {
    if (!selectedStoreId || !user) return;
    const rca = getRca();
    if (!rca) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      // 1. RCA verisini incident'a persist et (Supabase'e yazar, reload'da geri gelir)
      await updateInc(selectedStoreId, { rcaData: rca as unknown as Record<string, unknown> });

      // 2. Human-readable work note (timeline'da görünmesi için)
      const whyLines = ([1,2,3,4,5] as const)
        .map(n => {
          const v = (rca[`why${n}` as keyof RCAData] as string) || "";
          return v.trim() ? `Why ${n}: ${v.trim()}` : null;
        })
        .filter(Boolean)
        .join("\n");
      if (whyLines) {
        await dispatchWorkNote(`[RCA 5-WHY]\n${whyLines}`);
      }
      if (rca.rootCause?.trim()) {
        await dispatchWorkNote(`[ROOT CAUSE] ${rca.rootCause.trim()}`);
      }

      // 3. Kaydedilen RCA'yı local state'den temizle
      setRcaLocal(prev => { const n = { ...prev }; delete n[selected.id]; return n; });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'RCA kaydedilemedi');
    } finally { setSaving(false); }
  };

  const handleEscalate = async (group: string) => {
    setShowEscalateMenu(false);
    if (!selectedStoreId || !selectedStoreType || !user) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (selectedStoreType === "INC") {
        await assignInc(selectedStoreId, { assignedToId: user.id, assignmentGroupId: group });
        const inc = incidents.find(i => i.id === selectedStoreId);
        if (inc && (inc.state === IncidentState.NEW || inc.state === IncidentState.ASSIGNED)) {
          await changeState(selectedStoreId, { state: IncidentState.IN_PROGRESS });
        }
      }
      await dispatchWorkNote(`[ESKALASYoN] ${group} grubuna eskalasyon yapıldı`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Eskalasyon sırasında hata oluştu');
    } finally { setSaving(false); }
  };

  const filtered = displayTickets
    .filter(t => filterType === "all" || t.type === filterType)
    .filter(t => !filterMine || t.assignedTo === "Ben")
    .filter(t => !searchQ || t.id.toLowerCase().includes(searchQ.toLowerCase()) || t.title.toLowerCase().includes(searchQ.toLowerCase()));

  const myCount      = displayTickets.filter(t => t.assignedTo === "Ben" && t.state !== "Resolved").length;
  const breachedCount = displayTickets.filter(t => t.breached).length;

  const fmtSla = (m: number) => {
    if (m <= 0) return { t: `${Math.abs(m)}dk aşıldı`, c: "#DC2626", b: true };
    if (m < 60)  return { t: `${m}dk`, c: m < 30 ? "#DC2626" : "#D97706", b: false };
    const h = Math.floor(m / 60);
    if (h < 24)  return { t: `${h}s ${m % 60}dk`, c: h < 2 ? "#D97706" : "#059669", b: false };
    return { t: `${Math.floor(h / 24)}g ${h % 24}s`, c: "#059669", b: false };
  };

  const getTabs = (t: Ticket) => {
    const base: { k: string; l: string; count?: number }[] = [
      { k: "technical", l: "🔧 Teknik Detay" },
      { k: "timeline",  l: "📋 Aktivite" },
      { k: "ekler",     l: "📎 Ekler", count: t.attachments.length },
    ];
    if (t.type === "INC") {
      base.push({ k: "rca", l: "🎯 Root Cause" });
    }
    if (t.type === "CR") {
      base.push({ k: "cab", l: "📋 CAB / Change" });
    }
    return base;
  };

  const Badge = ({ bg, color, children, mono = true }: { bg: string; color: string; children: React.ReactNode; mono?: boolean }) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: bg, color, fontFamily: mono ? "'IBM Plex Mono',monospace" : "inherit", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}>{children}</span>
  );

  const runDiag = (dcmd: DiagCmd) => {
    if (diagRunning) return;
    setDiagRunning(true);
    setDiagSelected(dcmd.id);
    const ci = selected.configItem;
    setTimeout(() => {
      const fn = SIM[dcmd.sim];
      const output = fn ? fn(ci) : `[Simülasyon: ${dcmd.cmd}]\nKomut çalıştırıldı.`;
      const entry: DiagEntry = {
        cmd: dcmd.cmd.replace("{ip}", ci.ip),
        time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        status: output.toLowerCase().includes("critical") || output.toLowerCase().includes("error") ? "error"
               : output.toLowerCase().includes("warning") ? "warning" : "ok",
        output,
      };
      setDiagSession(prev => [...prev, entry]);
      setDiagRunning(false);
      setTimeout(() => termRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    }, 900 + Math.random() * 600);
  };

  const getRca = (): RCAData | null => {
    if (!selected?.rcaData) return null;
    return { ...selected.rcaData, ...rcaLocal[selected.id] } as RCAData;
  };

  const setRca = (field: string, val: unknown) => {
    setRcaLocal(prev => ({ ...prev, [selected.id]: { ...(prev[selected.id] || {}), [field]: val } }));
  };

  const getCabSteps = (): ImplStep[] => {
    if (!selected?.changeDetails) return [];
    const ov = cabSteps[selected.id] || {};
    return selected.changeDetails.implementationSteps.map((s, i) => ({ ...s, done: ov[i] !== undefined ? ov[i] : s.done }));
  };
  const toggleCabStep = (i: number) => {
    const steps = getCabSteps();
    setCabSteps(prev => ({ ...prev, [selected.id]: { ...(prev[selected.id] || {}), [i]: !steps[i].done } }));
  };
  const getCabChecks = (): PreCheck[] => {
    if (!selected?.changeDetails) return [];
    const ov = cabChecks[selected.id] || {};
    return selected.changeDetails.preChecks.map((c, i) => ({ ...c, done: ov[i] !== undefined ? ov[i] : c.done }));
  };
  const toggleCabCheck = (i: number) => {
    const chks = getCabChecks();
    setCabChecks(prev => ({ ...prev, [selected.id]: { ...(prev[selected.id] || {}), [i]: !chks[i].done } }));
  };

  const diagCats = [...new Set(DIAG_CMDS.map(d => d.cat))];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
    .wb-root ::-webkit-scrollbar{width:5px}.wb-root ::-webkit-scrollbar-track{background:transparent}.wb-root ::-webkit-scrollbar-thumb{background:#CBD5E0;border-radius:3px}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .diag-btn:hover{background:#1E293B!important;color:#F8FAFC!important}
    .step-row:hover{background:#F8FAFC}
  `;

  return (
    <div className="wb-root" style={{ fontFamily: "'IBM Plex Sans',sans-serif", background: "#F1F5F9", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", color: "#0F172A" }}>
      <style>{css}</style>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 14, color: "#DC2626" }}>⚠</span>
          <span style={{ flex: 1, fontSize: 12, color: "#991B1B", fontFamily: "'IBM Plex Mono',monospace" }}>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* Convert Success Banner */}
      {convertSuccessMsg && (
        <div style={{ background: "#ECFDF5", borderBottom: "1px solid #6EE7B7", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 12, color: "#065F46", fontFamily: "'IBM Plex Mono',monospace" }}>{convertSuccessMsg}</span>
          <button onClick={() => setConvertSuccessMsg(null)} style={{ background: "none", border: "none", color: "#059669", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ height: 46, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0 }}>
        {[
          { l: "Eskalasyonlar", v: myCount, c: "#F59E0B", ic: "⬆", p: false },
          { l: "SLA İhlal", v: breachedCount, c: "#DC2626", ic: "🔴", p: breachedCount > 0 },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 6, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12 }}>{s.ic}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#64748B" }}>{s.l}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'IBM Plex Mono',monospace", animation: s.p ? "pulse 1.2s ease infinite" : "none" }}>{s.v}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 24, background: "#E2E8F0", margin: "0 4px" }} />
        <div style={{ display: "flex", gap: 2, background: "#F8FAFC", borderRadius: 6, padding: 2, border: "1px solid #E2E8F0" }}>
          {(["all", "INC", "SR", "CR"] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)} style={{ padding: "4px 10px", borderRadius: 4, border: "none", cursor: "pointer", background: filterType === f ? "#1E293B" : "transparent", color: filterType === f ? "#fff" : "#64748B", fontSize: 11, fontWeight: 600, fontFamily: f !== "all" ? "'IBM Plex Mono',monospace" : "inherit" }}>{f === "all" ? "All" : f}</button>
          ))}
        </div>
        <button onClick={() => setFilterMine(!filterMine)} style={{ padding: "4px 12px", borderRadius: 6, border: filterMine ? "1.5px solid #3B82F6" : "1px solid #E2E8F0", background: filterMine ? "#EFF6FF" : "#fff", color: filterMine ? "#2563EB" : "#64748B", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>👤 Benim ({myCount})</button>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 10px", width: 200 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Ticket ara..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 11, fontFamily: "'IBM Plex Sans',sans-serif", color: "#334155" }} />
        </div>
        <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "'IBM Plex Mono',monospace" }}>{filtered.length} eskalasyon</span>
      </div>

      {/* Main Split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left Queue */}
        <div style={{ width: 380, flexShrink: 0, background: "#fff", borderRight: "1px solid #E2E8F0", overflowY: "auto" }}>
          {filtered.map((t, i) => {
            const isSel = t.id === selectedId;
            const tc = TYPE_C[t.type as keyof typeof TYPE_C] ?? { l: t.type, c: "#64748B", bg: "#F1F5F9" }; const pc = PRIO_C[String(t.priority) as keyof typeof PRIO_C] ?? { l: String(t.priority), c: "#fff", bg: "#6B7280" }; const sc = STATE_C[t.state] || { c: "#94A3B8", i: "○" };
            const sla = fmtSla(t.slaMin);
            return (
              <div key={t.id} onClick={() => { setSelectedId(t.id); setActiveTab("technical"); setDiagSession([]); setRootCauseText(""); setNoteText(""); setTimelineNoteText(""); }}
                style={{ padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", borderLeft: `3px solid ${isSel ? tc.c : "transparent"}`, background: isSel ? "#F8FAFC" : t.breached ? "#FFFBFB" : "#fff", transition: "all .12s", animation: `slideUp .2s ease ${i * 0.03}s both` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <Badge bg={tc.bg} color={tc.c}>{tc.l}</Badge>
                  <Badge bg={pc.bg} color={pc.c}>{pc.l}</Badge>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: isSel ? tc.c : "#64748B" }}>{t.id.replace(/^(INC|SR|CR)0+/, "$1-")}</span>
                  <div style={{ flex: 1 }} />
                  {t.state !== "Resolved" && <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: sla.c, animation: sla.b ? "pulse 1s ease infinite" : "none" }}>{sla.t}</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#1E293B", lineHeight: 1.35, marginBottom: 5 }}>{t.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94A3B8" }}>
                  <Badge bg={`${sc.c}15`} color={sc.c} mono={false}><span style={{ fontSize: 8 }}>{sc.i}</span> {t.state}</Badge>
                  {t.escalatedFrom && <span style={{ color: "#F59E0B", fontWeight: 600 }}>⬆ {t.escalatedFrom}</span>}
                  <span>·</span>
                  <span>{t.configItem.name}</span>
                </div>
                {t.pendingReason && <div style={{ marginTop: 5, fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 4, background: "#F5F3FF", border: "1px solid #E9D5FF", color: "#7C3AED", display: "inline-block" }}>⏳ {t.pendingReason}</div>}
              </div>
            );
          })}
        </div>

        {/* Right Detail */}
        {selected && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: "fadeIn .2s ease" }}>

            {/* Detail Header */}
            <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "14px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <Badge bg={(TYPE_C[selected.type as keyof typeof TYPE_C] ?? { bg: "#F1F5F9", c: "#64748B", l: selected.type }).bg} color={(TYPE_C[selected.type as keyof typeof TYPE_C] ?? { bg: "#F1F5F9", c: "#64748B", l: selected.type }).c}>{(TYPE_C[selected.type as keyof typeof TYPE_C] ?? { l: selected.type }).l}</Badge>
                    <Badge bg={(PRIO_C[String(selected.priority) as keyof typeof PRIO_C] ?? { bg: "#6B7280", c: "#fff", l: String(selected.priority) }).bg} color={(PRIO_C[String(selected.priority) as keyof typeof PRIO_C] ?? { bg: "#6B7280", c: "#fff", l: String(selected.priority) }).c}>{(PRIO_C[String(selected.priority) as keyof typeof PRIO_C] ?? { l: String(selected.priority) }).l}</Badge>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#475569" }}>{selected.id}</span>
                    {STATE_C[selected.state] && <Badge bg={`${STATE_C[selected.state].c}15`} color={STATE_C[selected.state].c}>{STATE_C[selected.state].i} {selected.state}</Badge>}
                    {selected.breached && <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: "#DC2626", color: "#fff", animation: "pulse 1.2s ease infinite" }}>SLA İHLALİ</span>}
                  </div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", lineHeight: 1.35 }}>{selected.title}</h2>
                </div>
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
                            setErrorMsg(null);
                            try {
                              await transitionCR(selectedStoreId, ChangeRequestState.REVIEW);
                            } catch (e) {
                              setErrorMsg(e instanceof Error ? e.message : 'Durum güncellenemedi');
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
              </div>
              {selected.escalatedFrom && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <span style={{ fontSize: 12 }}>⬆</span>
                  <span style={{ fontSize: 11, color: "#92400E" }}>
                    <strong>{selected.escalatedFrom}</strong> → <strong>{selected.group}</strong>
                    {selected.escalatedBy && <span style={{ color: "#B45309" }}> · {selected.escalatedBy} · {selected.escalatedAt}</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", padding: "0 24px", flexShrink: 0, overflowX: "auto" }}>
              {getTabs(selected).map(tab => (
                <button key={tab.k} onClick={() => setActiveTab(tab.k)} style={{ padding: "10px 14px", border: "none", cursor: "pointer", background: "transparent", fontSize: 12, fontWeight: activeTab === tab.k ? 700 : 500, color: activeTab === tab.k ? "#1E293B" : "#64748B", borderBottom: activeTab === tab.k ? "2px solid #3B82F6" : "2px solid transparent", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                  {tab.l}
                  {"count" in tab && tab.count != null && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", background: activeTab === tab.k ? "#3B82F6" : "#E2E8F0", color: activeTab === tab.k ? "#fff" : "#64748B", padding: "1px 6px", borderRadius: 8 }}>{tab.count}</span>}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", animation: "fadeIn .2s ease" }}>

              {/* ── Technical ── */}
              {activeTab === "technical" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
                  <div>
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "16px 20px", marginBottom: 14 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Açıklama</h4>
                      <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{selected.description}</p>
                    </div>
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #BFDBFE", padding: "16px 20px", marginBottom: 14 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>🔧 Teknik Notlar</h4>
                      <p style={{ fontSize: 13, color: "#1E293B", lineHeight: 1.6, fontFamily: "'IBM Plex Mono',monospace", background: "#F8FAFC", padding: "10px 14px", borderRadius: 6, whiteSpace: "pre-wrap" }}>{activeTechNotes || <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Henüz teknik not eklenmedi</span>}</p>
                    </div>
                    {selected.workaround && (
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #FDE68A", padding: "16px 20px", marginBottom: 14 }}>
                        <h4 style={{ fontSize: 11, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>⚡ Workaround</h4>
                        <p style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>{selected.workaround}</p>
                      </div>
                    )}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "16px 20px" }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>Teknik Not Ekle</h4>
                      <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Teknik çalışma notunu ekleyin..." rows={3}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <button onClick={handleSaveTechNote} disabled={saving || !noteText.trim() || !selectedStoreId}
                          style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: (saving || !noteText.trim() || !selectedStoreId) ? 0.5 : 1 }}>
                          {saving ? "Kaydediliyor..." : "Kaydet"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "16px", marginBottom: 14 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🖥️ Configuration Item</h4>
                      <div style={{ padding: "12px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#1E293B", marginBottom: 6 }}>{selected.configItem.name}</div>
                        {([["Type", selected.configItem.type], ["OS", selected.configItem.os], ["IP", selected.configItem.ip], ["Env", selected.configItem.env]] as [string,string][]).map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                            <span style={{ color: "#94A3B8", fontWeight: 600 }}>{l}</span>
                            <span style={{ color: "#1E293B", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500 }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selected.state !== "Resolved" && (() => {
                      const sla = fmtSla(selected.slaMin);
                      return (
                        <div style={{ background: "#fff", borderRadius: 8, border: sla.b ? "1px solid #FCA5A5" : "1px solid #E2E8F0", padding: "14px 16px", marginBottom: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>SLA Durumu</span>
                            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace", color: sla.c, animation: sla.b ? "pulse 1s ease infinite" : "none" }}>{sla.t}</span>
                          </div>
                          <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, ((selected.slaTotal - selected.slaMin) / selected.slaTotal) * 100))}%`, height: "100%", borderRadius: 2, background: sla.c }} />
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden", marginBottom: 14 }}>
                      {([["Arayan", `${selected.caller} — ${selected.dept}`], ["Kategori", `${selected.category} › ${selected.subcategory}`], ["Grup", selected.group], ["Atanan", selected.assignedTo || "—"], ["Oluşturulma", selected.created]] as [string,string][]).map(([l, v], i) => (
                        <div key={l} style={{ padding: "8px 14px", borderBottom: i < 4 ? "1px solid #F1F5F9" : "none" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em" }}>{l}</div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: v === "—" ? "#CBD5E0" : "#1E293B" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "14px 16px" }}>
                      <h4 style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Araçlar</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CI Tab ── */}
              {/* CI tab removed */}

              {/* ── Timeline ── */}
              {activeTab === "timeline" && (
                <div style={{ maxWidth: 680 }}>
                  <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "14px 18px", marginBottom: 18 }}>
                    <textarea
                      value={timelineNoteText}
                      onChange={e => setTimelineNoteText(e.target.value)}
                      placeholder="Teknik not ekleyin..."
                      rows={2}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical" }}
                      onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
                      onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <button
                        onClick={async () => {
                          if (!selectedStoreId || !timelineNoteText.trim()) return;
                          setSaving(true);
                          setErrorMsg(null);
                          try {
                            await dispatchWorkNote(timelineNoteText.trim());
                            setTimelineNoteText("");
                          } catch (e) {
                            setErrorMsg(e instanceof Error ? e.message : 'Not kaydedilemedi');
                          } finally { setSaving(false); }
                        }}
                        disabled={saving || !timelineNoteText.trim() || !selectedStoreId}
                        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: (saving || !timelineNoteText.trim() || !selectedStoreId) ? 0.5 : 1 }}>
                        {saving ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                    </div>
                  </div>
                  {selected.timeline.map((ev, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, animation: `slideUp .2s ease ${i * 0.04}s both` }}>
                      <div style={{ width: 50, textAlign: "right", paddingTop: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", color: "#475569" }}>{ev.time}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: ev.who === "Sistem" ? "#DC2626" : ev.who === "Ben" ? "#3B82F6" : ev.who === "CAB" ? "#7C3AED" : "#94A3B8" }} />
                        {i < selected.timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "#E2E8F0", minHeight: 24 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 16 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: ev.who === "Ben" ? "#2563EB" : ev.who === "Sistem" ? "#DC2626" : ev.who === "CAB" ? "#7C3AED" : "#475569" }}>{ev.who}</span>
                        <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.45, marginTop: 2 }}>{ev.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* KB tab removed */}

              {/* ── Ekler ── */}
              {activeTab === "ekler" && (
                <div style={{ maxWidth: 720 }}>
                  {/* Upload alanı */}
                  <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "16px 20px", marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        ref={attachFileRef}
                        type="file"
                        style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAddAttachment(f); e.target.value = ""; }}
                      />
                      <button
                        onClick={() => attachFileRef.current?.click()}
                        disabled={attachSaving || !selectedStoreId}
                        style={{
                          padding: "8px 18px", borderRadius: 7, border: "none",
                          background: "#3B82F6", color: "#fff", fontSize: 12, fontWeight: 600,
                          cursor: (attachSaving || !selectedStoreId) ? "not-allowed" : "pointer",
                          opacity: (attachSaving || !selectedStoreId) ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {attachSaving ? (
                          <>
                            <span style={{ animation: "pulse 0.8s ease infinite" }}>●</span> Yükleniyor...
                          </>
                        ) : (
                          <>📎 Dosya Ekle</>
                        )}
                      </button>
                      <span style={{ fontSize: 11, color: "#94A3B8" }}>
                        {selected.attachments.length} ek · Herhangi bir dosya türü desteklenir
                      </span>
                    </div>
                  </div>

                  {/* Ek listesi */}
                  {selected.attachments.length === 0 ? (
                    <div style={{
                      background: "#fff", borderRadius: 8, border: "1px dashed #E2E8F0",
                      padding: "40px 24px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📎</div>
                      <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>Henüz ek yüklenmedi</div>
                      <div style={{ fontSize: 11, color: "#CBD5E1" }}>Yukarıdaki butonu kullanarak dosya ekleyebilirsiniz</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selected.attachments.map((att, i) => {
                        const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
                        const isImg = ["jpg","jpeg","png","gif","webp","svg"].includes(ext);
                        const isPdf = ext === "pdf";
                        const icon = isImg ? "🖼️" : isPdf ? "📄" : ext === "zip" || ext === "rar" ? "🗜️" : "📎";
                        const sizeLabel = att.size < 1024 ? `${att.size} B`
                          : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB`
                          : `${(att.size / 1024 / 1024).toFixed(1)} MB`;
                        return (
                          <div key={att.id} style={{
                            display: "flex", alignItems: "center", gap: 12,
                            background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0",
                            padding: "12px 16px",
                            animation: `slideUp .2s ease ${i * 0.05}s both`,
                            transition: "border-color .15s",
                          }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = "#3B82F6")}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
                          >
                            <div style={{
                              width: 38, height: 38, borderRadius: 8, background: "#F1F5F9",
                              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
                            }}>{icon}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.name}</div>
                              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                                {sizeLabel} · {att.uploadedBy} · {new Date(att.uploadedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: "6px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                                background: "#F8FAFC", color: "#3B82F6", fontSize: 11, fontWeight: 600,
                                textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                              }}
                            >⬇ İndir</a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── DIAGNOSTICS ── */}
              {false && activeTab === "diagnostics" && (
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, height: "calc(100vh - 280px)", minHeight: 400 }}>
                  {/* Command Palette */}
                  <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".06em" }}>Komut Paleti</div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{selected.configItem.name}</div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {diagCats.map(cat => (
                        <div key={cat}>
                          <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", background: "#FAFBFC", borderBottom: "1px solid #F1F5F9" }}>{cat}</div>
                          {DIAG_CMDS.filter(d => d.cat === cat).map(dcmd => (
                            <button key={dcmd.id} className="diag-btn"
                              onClick={() => runDiag(dcmd)}
                              style={{ width: "100%", padding: "8px 14px", border: "none", cursor: diagRunning ? "not-allowed" : "pointer", background: diagSelected === dcmd.id ? "#1E293B" : "#fff", color: diagSelected === dcmd.id ? "#F8FAFC" : "#334155", fontSize: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #F8FAFC", transition: "all .1s", opacity: diagRunning && diagSelected !== dcmd.id ? 0.5 : 1 }}>
                              <span style={{ flex: 1 }}>{dcmd.label}</span>
                              {diagRunning && diagSelected === dcmd.id && <span style={{ fontSize: 9, animation: "pulse 0.8s ease infinite", color: "#60A5FA" }}>●</span>}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Terminal */}
                  <div style={{ background: "#0F172A", borderRadius: 8, border: "1px solid #1E293B", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ display: "flex", gap: 5 }}>
                        {["#FF5F57","#FEBC2E","#28C840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
                      </div>
                      <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#64748B", marginLeft: 4 }}>specialist@{selected.configItem.name.toLowerCase()}</span>
                      <div style={{ flex: 1 }} />
                      <button onClick={() => setDiagSession([])} style={{ fontSize: 10, color: "#475569", background: "transparent", border: "1px solid #334155", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>Temizle</button>
                    </div>
                    <div ref={termRef} style={{ flex: 1, overflowY: "auto", padding: "14px 18px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, lineHeight: 1.55 }}>
                      {selected.diagHistory.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: "#475569", marginBottom: 8, borderBottom: "1px solid #1E293B", paddingBottom: 6 }}>— önceki oturum —</div>
                          {selected.diagHistory.map((h, i) => (
                            <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", marginBottom: 12, paddingBottom: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ color: "#22D3EE" }}>$</span>
                                <span style={{ color: "#E2E8F0" }}>{h.cmd}</span>
                                <span style={{ color: "#475569", fontSize: 10, marginLeft: "auto" }}>{h.time}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: h.status === "error" ? "#DC2626" : h.status === "warning" ? "#D97706" : "#059669", color: "#fff" }}>{h.status.toUpperCase()}</span>
                              </div>
                              <pre style={{ color: h.status === "error" ? "#FCA5A5" : h.status === "warning" ? "#FDE68A" : "#86EFAC", fontSize: 11, whiteSpace: "pre-wrap", paddingLeft: 14, opacity: 0.9 }}>{h.output}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                      {diagSession.map((entry) => (
                        <div key={entry.cmd + entry.time} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", marginBottom: 12, paddingBottom: 12, animation: "slideUp .2s ease" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ color: "#22D3EE" }}>$</span>
                            <span style={{ color: "#E2E8F0" }}>{entry.cmd}</span>
                            <span style={{ color: "#475569", fontSize: 10, marginLeft: "auto" }}>{entry.time}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: entry.status === "error" ? "#DC2626" : entry.status === "warning" ? "#D97706" : "#059669", color: "#fff" }}>{entry.status.toUpperCase()}</span>
                          </div>
                          <pre style={{ color: entry.status === "error" ? "#FCA5A5" : entry.status === "warning" ? "#FDE68A" : "#86EFAC", fontSize: 11, whiteSpace: "pre-wrap", paddingLeft: 14 }}>{entry.output}</pre>
                        </div>
                      ))}
                      {diagRunning && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#22D3EE" }}>$</span>
                          <span style={{ color: "#64748B", animation: "pulse 0.8s ease infinite" }}>çalışıyor...</span>
                        </div>
                      )}
                      {!diagRunning && diagSession.length === 0 && selected.diagHistory.length === 0 && (
                        <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.8 }}>
                          <div style={{ color: "#22D3EE" }}>Pixanto Specialist Diagnostic Console v2.0</div>
                          <div>Target: <span style={{ color: "#86EFAC" }}>{selected.configItem.name}</span> ({selected.configItem.ip})</div>
                          <div style={{ marginTop: 8, color: "#475569" }}>Sol panelden bir komut seçin ve çalıştırın.</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── RCA ── */}
              {activeTab === "rca" && selected.rcaData && (() => {
                const rca = getRca()!;
                return (
                  <div style={{ maxWidth: 860 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>🎯 Root Cause Analysis — 5-Why</h3>
                      <Badge bg="#FEF3C7" color="#D97706" mono={false}>{selected.id}</Badge>
                      <div style={{ flex: 1 }} />
                      <button onClick={handleSaveRCA} disabled={saving || !selectedStoreId}
                        style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#3B82F6", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", opacity: (saving || !selectedStoreId) ? 0.5 : 1 }}>
                        {saving ? "Kaydediliyor..." : "RCA Kaydet"}
                      </button>
                    </div>
                    {/* 5-Why */}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 16 }}>5-Why Zinciri</h4>
                      {([1,2,3,4,5] as const).map(n => {
                        const fieldKey = `why${n}` as keyof RCAData;
                        const colors = ["#DC2626","#D97706","#F59E0B","#2563EB","#7C3AED"];
                        const labels = ["Sorun neydi?","Neden oldu?","Bunun nedeni neydi?","Bunun nedeni neydi?","Kök neden neydi?"];
                        return (
                          <div key={n} style={{ display: "flex", gap: 14, marginBottom: n < 5 ? 12 : 0 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: colors[n-1], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{n}</div>
                              {n < 5 && <div style={{ width: 2, flex: 1, background: `${colors[n-1]}40`, minHeight: 12 }} />}
                            </div>
                            <div style={{ flex: 1, paddingBottom: n < 5 ? 8 : 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: colors[n-1], textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Why {n} — {labels[n-1]}</div>
                              <textarea
                                value={(rca[fieldKey] as string) || ""}
                                onChange={e => setRca(fieldKey, e.target.value)}
                                rows={2}
                                placeholder={n === 5 ? "Kök nedeni buraya yazın..." : `Neden ${n}...`}
                                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${colors[n-1]}40`, borderRadius: 6, fontSize: 12, fontFamily: "'IBM Plex Sans',sans-serif", color: "#1E293B", outline: "none", resize: "vertical", background: (rca[fieldKey] as string) ? "#FAFBFC" : "#fff" }}
                                onFocus={e => { e.target.style.borderColor = colors[n-1]; e.target.style.boxShadow = `0 0 0 3px ${colors[n-1]}15`; }}
                                onBlur={e => { e.target.style.borderColor = `${colors[n-1]}40`; e.target.style.boxShadow = "none"; }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {/* Contributing Factors */}
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 14 }}>Katkıda Bulunan Faktörler</h4>
                        {rca.contributingFactors.map((cf, i) => (
                          <div key={cf.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                            <input type="checkbox" checked={cf.checked} style={{ marginTop: 6, accentColor: "#DC2626", flexShrink: 0, cursor: "pointer" }}
                              onChange={e => {
                                const updated = rca.contributingFactors.map((f, fi) => fi === i ? { ...f, checked: e.target.checked } : f);
                                setRca("contributingFactors", updated);
                              }} />
                            <input
                              value={cf.label}
                              onChange={e => {
                                const updated = rca.contributingFactors.map((f, fi) => fi === i ? { ...f, label: e.target.value } : f);
                                setRca("contributingFactors", updated);
                              }}
                              placeholder="Faktör açıklaması..."
                              style={{ flex: 1, fontSize: 12, color: "#334155", border: "1px solid #E2E8F0", borderRadius: 4, padding: "4px 8px", outline: "none" }}
                              onFocus={e => (e.target.style.borderColor = "#3B82F6")}
                              onBlur={e => (e.target.style.borderColor = "#E2E8F0")}
                            />
                            <button onClick={() => setRca("contributingFactors", rca.contributingFactors.filter((_, fi) => fi !== i))}
                              style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 13, padding: "2px 4px", flexShrink: 0, marginTop: 2 }}>×</button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newFactor = { id: `cf-${Date.now()}`, label: "", checked: true };
                            setRca("contributingFactors", [...rca.contributingFactors, newFactor]);
                          }}
                          style={{ marginTop: 6, fontSize: 11, color: "#3B82F6", background: "transparent", border: "1px dashed #BFDBFE", borderRadius: 6, padding: "5px 10px", cursor: "pointer", width: "100%" }}>+ Faktör Ekle</button>
                      </div>
                      {/* Root Cause Summary */}
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #FCA5A5", padding: "18px 20px" }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Kök Neden Özeti</h4>
                        <textarea value={rca.rootCause || ""} onChange={e => setRca("rootCause", e.target.value)} rows={5}
                          placeholder="5-Why analizine dayalı kök neden özetini yazın..."
                          style={{ width: "100%", padding: "10px 12px", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 12, fontFamily: "'IBM Plex Sans',sans-serif", color: "#1E293B", outline: "none", resize: "vertical" }}
                          onFocus={e => { e.target.style.borderColor = "#DC2626"; e.target.style.boxShadow = "0 0 0 3px rgba(220,38,38,.08)"; }}
                          onBlur={e => { e.target.style.borderColor = "#FCA5A5"; e.target.style.boxShadow = "none"; }} />
                      </div>
                    </div>
                    {/* Preventive Actions */}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em" }}>Önleyici Aksiyonlar</h4>
                        <div style={{ flex: 1 }} />
                        <button
                          onClick={() => {
                            const newAction = { id: `pa-${Date.now()}`, action: "", owner: "", due: "", status: "Planned" };
                            setRca("preventiveActions", [...rca.preventiveActions, newAction]);
                          }}
                          style={{ fontSize: 11, color: "#059669", background: "#D1FAE5", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontWeight: 600 }}>+ Aksiyon Ekle</button>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC" }}>
                            {["Aksiyon","Sorumlu","Bitiş Tarihi","Durum",""].map(h => (
                              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rca.preventiveActions.map((pa, pi) => {
                            const updatePA = (field: string, val: string) => {
                              setRca("preventiveActions", rca.preventiveActions.map((p, pj) => pj === pi ? { ...p, [field]: val } : p));
                            };
                            return (
                            <tr key={pa.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input value={pa.action} onChange={e => updatePA("action", e.target.value)} placeholder="Aksiyon..."
                                  style={{ width: "100%", fontSize: 12, color: "#334155", border: "1px solid #E2E8F0", borderRadius: 4, padding: "4px 8px", outline: "none", boxSizing: "border-box" }}
                                  onFocus={e => (e.target.style.borderColor = "#3B82F6")} onBlur={e => (e.target.style.borderColor = "#E2E8F0")} />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input value={pa.owner} onChange={e => updatePA("owner", e.target.value)} placeholder="Sorumlu..."
                                  style={{ width: "100%", fontSize: 12, color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 4, padding: "4px 8px", outline: "none", boxSizing: "border-box" }}
                                  onFocus={e => (e.target.style.borderColor = "#3B82F6")} onBlur={e => (e.target.style.borderColor = "#E2E8F0")} />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input value={pa.due} onChange={e => updatePA("due", e.target.value)} placeholder="YYYY-AA-GG" type="date"
                                  style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#475569", border: "1px solid #E2E8F0", borderRadius: 4, padding: "4px 6px", outline: "none" }}
                                  onFocus={e => (e.target.style.borderColor = "#3B82F6")} onBlur={e => (e.target.style.borderColor = "#E2E8F0")} />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <select value={pa.status} onChange={e => updatePA("status", e.target.value)}
                                  style={{ fontSize: 11, color: "#334155", border: "1px solid #E2E8F0", borderRadius: 4, padding: "4px 6px", outline: "none", background: "#fff" }}>
                                  <option value="Planned">Planned</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Done">Done</option>
                                </select>
                              </td>
                              <td style={{ padding: "6px 4px" }}>
                                <button onClick={() => setRca("preventiveActions", rca.preventiveActions.filter((_, pj) => pj !== pi))}
                                  style={{ background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>×</button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── CAB / Change ── */}
              {activeTab === "cab" && selected.changeDetails && (() => {
                const cd = selected.changeDetails;
                const steps  = getCabSteps();
                const checks = getCabChecks();
                const approvedCount = cd.approvers.filter(a => a.status === "Approved").length;
                const allChecked    = checks.every(c => c.done);
                const RISK_C: Record<string, { c: string; bg: string }> = { Low: { c: "#059669", bg: "#D1FAE5" }, Medium: { c: "#D97706", bg: "#FEF3C7" }, High: { c: "#DC2626", bg: "#FEE2E2" } };
                const IMPACT_C: Record<string, { c: string; bg: string }> = { Low: { c: "#2563EB", bg: "#DBEAFE" }, Medium: { c: "#D97706", bg: "#FEF3C7" }, High: { c: "#DC2626", bg: "#FEE2E2" } };
                const riskC   = RISK_C[cd.risk]   || RISK_C.Medium;
                const impactC = IMPACT_C[cd.impact] || IMPACT_C.Medium;
                return (
                  <div style={{ maxWidth: 900 }}>
                    {/* Change Header */}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "18px 24px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700 }}>📋 Change Advisory Board</h3>
                        <Badge bg="#F3E8FF" color="#7C3AED">{selected.id}</Badge>
                        <div style={{ flex: 1 }} />
                        <div style={{ fontSize: 12, color: "#64748B" }}>CAB Toplantısı: <strong style={{ color: "#1E293B" }}>{cd.cabDate}</strong></div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                        {[
                          { l: "Change Tipi", v: cd.type, bg: "#F8FAFC", c: "#1E293B" },
                          { l: "Risk", v: cd.risk, bg: riskC.bg, c: riskC.c },
                          { l: "Etki", v: cd.impact, bg: impactC.bg, c: impactC.c },
                          { l: "Uygulama Penceresi", v: cd.implementationWindow, bg: "#EFF6FF", c: "#2563EB" },
                        ].map(item => (
                          <div key={item.l} style={{ background: item.bg, borderRadius: 8, padding: "10px 14px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{item.l}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: item.c }}>{item.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>İş Gerekçesi</div>
                        <div style={{ fontSize: 12, color: "#334155" }}>{cd.businessJustification}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {/* Approvers */}
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", alignItems: "center", gap: 8 }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>CAB Onayları</h4>
                          <div style={{ flex: 1 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: approvedCount === cd.approvers.length ? "#059669" : "#D97706" }}>{approvedCount}/{cd.approvers.length}</span>
                          <div style={{ width: 60, height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${(approvedCount / cd.approvers.length) * 100}%`, height: "100%", background: approvedCount === cd.approvers.length ? "#059669" : "#D97706", borderRadius: 2 }} />
                          </div>
                        </div>
                        {cd.approvers.map((ap, i) => {
                          const asc = APPROVER_STATUS[ap.status];
                          return (
                            <div key={i} style={{ padding: "12px 18px", borderBottom: i < cd.approvers.length - 1 ? "1px solid #F1F5F9" : "none", display: "flex", alignItems: "center", gap: 10, animation: `slideUp .2s ease ${i * 0.06}s both` }}>
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: ap.status === "Approved" ? "#D1FAE5" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: ap.status === "Approved" ? "#059669" : "#94A3B8", flexShrink: 0 }}>
                                {ap.name.split(" ").map((n: string) => n[0]).join("").slice(0,2)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{ap.name}</div>
                                <div style={{ fontSize: 10, color: "#94A3B8" }}>{ap.role}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <Badge bg={asc.bg} color={asc.c} mono={false}>{asc.i} {ap.status}</Badge>
                                {ap.at && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{ap.at}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Pre-checks */}
                      <div style={{ background: "#fff", borderRadius: 8, border: allChecked ? "1px solid #6EE7B7" : "1px solid #E2E8F0", overflow: "hidden" }}>
                        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", background: allChecked ? "#F0FDF4" : "#F8FAFC", display: "flex", alignItems: "center" }}>
                          <h4 style={{ fontSize: 12, fontWeight: 700, color: allChecked ? "#059669" : "#475569", textTransform: "uppercase", letterSpacing: ".05em" }}>
                            {allChecked ? "✓ " : ""}Uygulama Öncesi Kontroller
                          </h4>
                          <div style={{ flex: 1 }} />
                          <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: allChecked ? "#059669" : "#D97706", fontWeight: 700 }}>{checks.filter(c => c.done).length}/{checks.length}</span>
                        </div>
                        <div style={{ padding: "10px 18px" }}>
                          {checks.map((chk, i) => (
                            <label key={i} className="step-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", cursor: "pointer", borderRadius: 6, transition: "background .1s" }}>
                              <input type="checkbox" checked={chk.done} onChange={() => toggleCabCheck(i)} style={{ accentColor: "#059669", width: 14, height: 14, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: chk.done ? "#64748B" : "#1E293B", textDecoration: chk.done ? "line-through" : "none" }}>{chk.check}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Implementation Steps */}
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", padding: "18px 22px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".05em" }}>Uygulama Adımları</h4>
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#64748B" }}>{steps.filter(s => s.done).length}/{steps.length} tamamlandı</span>
                        <div style={{ width: 80, height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden", marginLeft: 10 }}>
                          <div style={{ width: `${(steps.filter(s => s.done).length / steps.length) * 100}%`, height: "100%", background: "#3B82F6", borderRadius: 2, transition: "width .3s" }} />
                        </div>
                      </div>
                      {steps.map((s, i) => (
                        <label key={i} className="step-row" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 8px", cursor: "pointer", borderRadius: 6, transition: "background .1s", marginBottom: 2 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 1 }}>
                            <input type="checkbox" checked={s.done} onChange={() => toggleCabStep(i)} style={{ accentColor: "#3B82F6", width: 14, height: 14 }} />
                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: s.done ? "#3B82F6" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: s.done ? "#fff" : "#94A3B8", transition: "all .2s" }}>{i+1}</div>
                          </div>
                          <span style={{ fontSize: 12, color: s.done ? "#94A3B8" : "#334155", textDecoration: s.done ? "line-through" : "none", lineHeight: 1.5, flex: 1 }}>{s.step}</span>
                          {s.done && <span style={{ fontSize: 11, color: "#059669", flexShrink: 0, fontWeight: 700 }}>✓</span>}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #FEE2E2", padding: "16px 20px" }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🔄 Rollback Planı</h4>
                        <pre style={{ fontSize: 12, color: "#334155", whiteSpace: "pre-wrap", fontFamily: "'IBM Plex Sans',sans-serif", lineHeight: 1.6 }}>{cd.rollbackPlan}</pre>
                      </div>
                      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #D1FAE5", padding: "16px 20px" }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>✓ Test Sonuçları</h4>
                        <pre style={{ fontSize: 12, color: "#334155", whiteSpace: "pre-wrap", fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.6, background: "#F0FDF4", padding: "10px 12px", borderRadius: 6 }}>{cd.testResults}</pre>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        )}
      </div>

      {/* Karşılandı Modal */}
      {showFulfillModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>✓ Hizmet Talebi Karşılandı</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>{selected?.id} — {selected?.title}</p>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Karşılama Notu *</label>
            <textarea value={fulfillNotes} onChange={e => setFulfillNotes(e.target.value)} rows={4} placeholder="Talebi nasıl karşıladığınızı açıklayın..."
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowFulfillModal(false); setFulfillNotes(""); }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>İptal</button>
              <button onClick={handleFulfill} disabled={saving || !fulfillNotes.trim()}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !fulfillNotes.trim()) ? 0.5 : 1 }}>
                {saving ? "Kaydediliyor..." : "Karşılandı Olarak İşaretle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Convert Modal (INC → SR / CR / Problem) ── */}
      {showConvertModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 500, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔄 Belge Dönüştür</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 20 }}>{selected.id} — {selected.title}</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["SR", "CR", "Problem"] as const).map(t => (
                <button key={t} onClick={() => setConvertTarget(t)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: convertTarget === t ? "2px solid #3B82F6" : "1px solid #E2E8F0", background: convertTarget === t ? "#EFF6FF" : "#fff", color: convertTarget === t ? "#2563EB" : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {t === "SR" ? "🎫 Service Request" : t === "CR" ? "🔧 Change Request" : "⚠️ Problem Kaydı"}
                </button>
              ))}
            </div>
            {convertTarget === "SR" && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Kategori</label>
                <input value={convertCategory} onChange={e => setConvertCategory(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
            )}
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

      {/* ── Merge Modal ── */}
      {showMergeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 520, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔗 Incident Birleştir</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>Duplicate incident&apos;ı kapatıp bu kayıtla birleştir.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Master (bu kalır)</label>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#059669" }}>{selected.id}</span>
                <span style={{ fontSize: 12, color: "#334155", marginLeft: 8 }}>{selected.title}</span>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Duplicate (kapatılacak)</label>
              <input value={mergeSearchQ}
                onChange={e => {
                  setMergeSearchQ(e.target.value);
                  const q = e.target.value.toLowerCase();
                  const found = q.length >= 3 ? displayTickets.find(t => t.type === "INC" && t.id !== selected.id && (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))) ?? null : null;
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
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Birleştirme Notu <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea value={mergeNote} onChange={e => setMergeNote(e.target.value)}
              placeholder="Neden birleştiriliyor?" rows={3}
              style={{ width: "100%", padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }}
              onFocus={e => { e.target.style.borderColor = "#3B82F6"; }}
              onBlur={e => { e.target.style.borderColor = "#E2E8F0"; }} />
            {mergeTargetTicket && (
              <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 6, background: "#FEF2F2", border: "1px solid #FECACA", fontSize: 11, color: "#991B1B" }}>
                ⚠️ {mergeTargetTicket.id} → &quot;Resolved (Duplicate)&quot; olarak kapatılır. Bu işlem geri alınamaz.
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

      {/* ── Link CR Modal (SR → CR) ── */}
      {showLinkCRModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "scaleIn .2s ease" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🔗 Change Request Bağla</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>{selected.id} — {selected.title}</p>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Change Request Ara</label>
            <input value={linkCRSearchQ}
              onChange={e => {
                setLinkCRSearchQ(e.target.value);
                const q = e.target.value.toLowerCase();
                const found = q.length >= 3 ? displayTickets.find(t => t.type === "CR" && (t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))) ?? null : null;
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

      {/* Çözüldü Modal */}
      {showResolveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>✓ Incident Çözüldü</h3>
            <p style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>{selected?.id} — {selected?.title}</p>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Çözüm Notu *</label>
            <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} rows={4} placeholder="Sorunu nasıl çözdüğünüzü açıklayın..."
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontFamily: "'IBM Plex Sans',sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowResolveModal(false); setResolveNotes(""); }}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>İptal</button>
              <button onClick={handleResolve} disabled={saving || !resolveNotes.trim()}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (saving || !resolveNotes.trim()) ? 0.5 : 1 }}>
                {saving ? "Kaydediliyor..." : "Çözüldü Olarak İşaretle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
