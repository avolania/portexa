// E-posta HTML şablonları — Pixanto marka stili

const BASE = `
  font-family: 'Helvetica Neue', Arial, sans-serif;
  max-width: 520px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
`;

const HEADER = (color: string, label: string) => `
  <div style="background:${color};padding:20px 28px;">
    <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:.05em;">${label}</span>
  </div>
`;

const FOOTER = `
  <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;margin:0;">
      Bu e-posta <strong>Pixanto ITSM</strong> tarafından otomatik gönderilmiştir.
      Yanıtlamayınız.
    </p>
  </div>
`;

function ticket(
  number: string,
  title: string,
  type: string,
): string {
  const typeColor = type === "INC" ? "#dc2626" : type === "SR" ? "#2563eb" : "#7c3aed";
  const typeLabel = type === "INC" ? "Incident" : type === "SR" ? "Servis Talebi" : "Değişiklik";
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin:16px 0;">
      <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;background:${typeColor};color:#fff;font-family:monospace;">${typeLabel}</span>
      <span style="font-size:12px;font-weight:700;color:#475569;font-family:monospace;margin-left:8px;">${number}</span>
      <p style="font-size:14px;font-weight:600;color:#1e293b;margin:6px 0 0;">${title}</p>
    </div>
  `;
}

function button(label: string, url: string, color = "#3b82f6"): string {
  return `
    <a href="${url}" style="display:inline-block;margin:8px 0 20px;padding:10px 22px;
       background:${color};color:#fff;border-radius:7px;text-decoration:none;
       font-size:13px;font-weight:600;">${label}</a>
  `;
}

// ── Şablonlar ────────────────────────────────────────────────

export function ticketAssignedEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  assignedByName: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Size atandı: ${p.ticketNumber} — ${p.ticketTitle}`,
    html: `<div style="${BASE}">
      ${HEADER("#1e293b", "📋 YENİ ATAMA")}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.assignedByName}</strong> aşağıdaki talebi size atadı:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        ${button("Talebi Görüntüle", `${p.appUrl}/itsm`)}
      </div>
      ${FOOTER}
    </div>`,
  };
}

export function approvalNeededEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  requesterName: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Onayınız bekleniyor: ${p.ticketNumber}`,
    html: `<div style="${BASE}">
      ${HEADER("#d97706", "⏳ ONAY BEKLİYOR")}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.requesterName}</strong> tarafından oluşturulan aşağıdaki talep onayınızı bekliyor:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        ${button("Onaylamak için tıklayın", `${p.appUrl}/itsm`, "#d97706")}
      </div>
      ${FOOTER}
    </div>`,
  };
}

export function approvalDecisionEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  decision: "approved" | "rejected";
  approverName: string;
  comments?: string;
  appUrl: string;
}): { subject: string; html: string } {
  const approved = p.decision === "approved";
  const color = approved ? "#059669" : "#dc2626";
  const icon = approved ? "✅" : "❌";
  const label = approved ? "ONAYLANDI" : "REDDEDİLDİ";
  return {
    subject: `${icon} Talebiniz ${label}: ${p.ticketNumber}`,
    html: `<div style="${BASE}">
      ${HEADER(color, `${icon} ${label}`)}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.approverName}</strong> talebiniz hakkında karar verdi:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        ${p.comments ? `<div style="background:#f1f5f9;border-left:3px solid ${color};padding:10px 14px;border-radius:4px;font-size:13px;color:#374151;">"${p.comments}"</div>` : ""}
        ${button("Talebi Görüntüle", `${p.appUrl}/itsm`)}
      </div>
      ${FOOTER}
    </div>`,
  };
}

export function ticketResolvedEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  resolvedByName: string;
  resolution?: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `✓ Talebiniz çözüldü: ${p.ticketNumber}`,
    html: `<div style="${BASE}">
      ${HEADER("#059669", "✓ ÇÖZÜLDÜ")}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.resolvedByName}</strong> aşağıdaki talebinizi çözdü:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        ${p.resolution ? `<div style="background:#f0fdf4;border-left:3px solid #059669;padding:10px 14px;border-radius:4px;font-size:13px;color:#374151;">${p.resolution}</div>` : ""}
        ${button("Geri bildirim verin", `${p.appUrl}/itsm/my-tickets`)}
      </div>
      ${FOOTER}
    </div>`,
  };
}

export function escalationEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  escalatedByName: string;
  targetGroup: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `⬆ Eskalasyon: ${p.ticketNumber} — ${p.ticketTitle}`,
    html: `<div style="${BASE}">
      ${HEADER("#7c3aed", "⬆ ESKALASYoN")}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.escalatedByName}</strong> aşağıdaki talebi <strong>${p.targetGroup}</strong> grubuna eskalasyon yaptı:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        ${button("Workbench'i Aç", `${p.appUrl}/itsm/workbench/l2`, "#7c3aed")}
      </div>
      ${FOOTER}
    </div>`,
  };
}

export function newCommentEmail(p: {
  ticketNumber: string;
  ticketTitle: string;
  ticketType: string;
  agentName: string;
  comment: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Yeni yanıt: ${p.ticketNumber}`,
    html: `<div style="${BASE}">
      ${HEADER("#2563eb", "💬 YENİ YANIT")}
      <div style="padding:24px 28px;">
        <p style="font-size:14px;color:#374151;margin:0 0 4px;">
          <strong>${p.agentName}</strong> talebinize yanıt verdi:
        </p>
        ${ticket(p.ticketNumber, p.ticketTitle, p.ticketType)}
        <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:10px 14px;border-radius:4px;font-size:13px;color:#1e3a5f;">${p.comment}</div>
        ${button("Yanıtla", `${p.appUrl}/itsm/my-tickets`)}
      </div>
      ${FOOTER}
    </div>`,
  };
}
