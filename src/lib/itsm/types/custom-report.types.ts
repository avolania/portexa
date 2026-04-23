export type ReportSource    = "INC" | "SR" | "CR" | "ALL";
export type ReportGroupBy   = "state" | "priority" | "assignee" | "category" | "week" | "month";
export type ReportMetric    = "count" | "avg_resolution_hours" | "sla_compliance_pct";
export type ReportChartType = "bar" | "pie" | "table";
export type ReportDateRange = "7d" | "30d" | "90d" | "all";

export interface ReportFilters {
  dateRange:   ReportDateRange;
  priorities?: string[];
  states?:     string[];
}

export interface CustomReport {
  id:          string;
  name:        string;
  createdBy:   string;
  createdAt:   string;
  source:      ReportSource;
  groupBy:     ReportGroupBy;
  metric:      ReportMetric;
  chartType:   ReportChartType;
  filters:     ReportFilters;
}

// ─── Builder step ─────────────────────────────────────────────────────────────

export interface BuilderState {
  source:    ReportSource;
  groupBy:   ReportGroupBy;
  metric:    ReportMetric;
  chartType: ReportChartType;
  filters:   ReportFilters;
  name:      string;
}

export const DEFAULT_BUILDER: BuilderState = {
  source:    "INC",
  groupBy:   "state",
  metric:    "count",
  chartType: "bar",
  filters:   { dateRange: "30d" },
  name:      "",
};

// ─── Label maps ───────────────────────────────────────────────────────────────

export const SOURCE_LABELS: Record<ReportSource, string> = {
  INC: "Incident",
  SR:  "Servis Talebi",
  CR:  "Değişiklik",
  ALL: "Tüm Ticket'lar",
};

export const GROUP_LABELS: Record<ReportGroupBy, string> = {
  state:    "Duruma göre",
  priority: "Önceliğe göre",
  assignee: "Atanan kişiye göre",
  category: "Kategoriye göre",
  week:     "Haftaya göre",
  month:    "Aya göre",
};

export const METRIC_LABELS: Record<ReportMetric, string> = {
  count:                "Ticket adedi",
  avg_resolution_hours: "Ort. çözüm süresi (saat)",
  sla_compliance_pct:   "SLA uyum oranı (%)",
};

export const CHART_LABELS: Record<ReportChartType, string> = {
  bar:   "Sütun grafik",
  pie:   "Pasta grafik",
  table: "Tablo",
};

export const DATE_RANGE_LABELS: Record<ReportDateRange, string> = {
  "7d":  "Son 7 gün",
  "30d": "Son 30 gün",
  "90d": "Son 90 gün",
  "all": "Tüm zamanlar",
};
