import { Plugin, Component, App, TFile, setIcon } from "obsidian";

// ── Types ──────────────────────────────────────────────────────────────────

interface BasesEntry {
  file: TFile;
  frontmatter: Record<string, unknown>;
  note: { icon: string; data: Record<string, unknown> };
  app: {
    vault: {
      getAbstractFileByPath: (p: string) => unknown;
      getFiles: () => TFile[];
      getResourcePath: (f: TFile) => string;
    };
  };
  formulaResults: {
    formulas: Record<string, unknown>;
    cachedFormulaOutputs: Record<string, unknown>;
    getFormulaValue: (name: string) => unknown;
  };
}

// ── Module-level helpers ───────────────────────────────────────────────────

function stripNamespace(s: string): string {
  return s.replace(/^(note|formula|implicit|file)\./, "");
}

function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const ad = typeof a === "string" ? Date.parse(a) : NaN;
  const bd = typeof b === "string" ? Date.parse(b) : NaN;
  if (!isNaN(ad) && !isNaN(bd)) return ad - bd;
  if (Array.isArray(a)) return compareValues(a[0], Array.isArray(b) ? b[0] : b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function getEntryProp(entry: BasesEntry, prop: string): unknown {
  switch (prop) {
    case "file.name":
    case "name":
      return entry.file.name;
    case "file.basename":
    case "basename":
      return entry.file.basename;
    case "file.path":
      return entry.file.path;
    case "file.ext":
      return entry.file.extension;
    case "file.size":
      return (entry.file.stat as Record<string, unknown>)?.size ?? 0;
    case "file.mtime":
      return (entry.file.stat as Record<string, unknown>)?.mtime ?? 0;
    case "file.ctime":
      return (entry.file.stat as Record<string, unknown>)?.ctime ?? 0;
  }
  const fm = entry.frontmatter ?? {};
  if (prop in fm) return fm[prop];
  const lower = prop.toLowerCase();
  for (const [k, v] of Object.entries(fm)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function getFormulaValue(entry: BasesEntry, name: string): string | undefined {
  const e = entry as unknown as Record<string, unknown>;
  const fr = e.formulaResults as Record<string, unknown> | undefined;

  if (fr && typeof fr.getFormulaValue === "function") {
    try {
      const tv = (fr.getFormulaValue as Function)(name);
      if (tv != null) {
        const str = typeof tv.toString === "function" ? tv.toString() : String(tv);
        if (str !== "null" && str !== "undefined") return str;
      }
    } catch { /* ignore */ }
  }

  const formulas = fr?.formulas as Record<string, unknown> | undefined;
  if (formulas) {
    const fo = (formulas[name] ??
      Object.entries(formulas).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1]
    ) as Record<string, unknown> | undefined;
    if (fo && typeof fo.getValue === "function") {
      try {
        const tv = (fo.getValue as Function)(entry);
        if (tv != null) {
          const str = typeof tv.toString === "function" ? tv.toString() : String(tv);
          if (str !== "null" && str !== "undefined") return str;
        }
      } catch { /* ignore */ }
    }
  }
  return undefined;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── TimelineView ───────────────────────────────────────────────────────────

class TimelineView extends Component {
  private obsApp: App;
  private controller: Record<string, unknown>;
  private containerEl: HTMLElement;

  constructor(app: App, controller: unknown, containerEl: HTMLElement) {
    super();
    this.obsApp = app;
    this.controller = controller as Record<string, unknown>;
    this.containerEl = containerEl;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  onload() {
    this.containerEl.addClass("btl-root");
    this.render();
  }

  onDataUpdated() {
    this.render();
  }

  onunload() {
    this.containerEl.empty();
  }

  // ── Bases toolbar API ──────────────────────────────────────────────────

  getSort() {
    const vc = this.getViewConfig();
    const raw = vc?.sort;
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[]).map((o) => ({
      prop: typeof o.property === "string" ? stripNamespace(o.property) : "",
      dir:
        typeof o.direction === "string" &&
        o.direction.toUpperCase() === "DESC"
          ? "desc"
          : "asc",
    })).filter((s) => s.prop !== "");
  }

  getLimit() {
    const vc = this.getViewConfig();
    const l = vc?.limit;
    return typeof l === "number" && l > 0 ? l : null;
  }

  getQuery() {
    return this.controller.query ?? null;
  }

  saveQuery() {
    const c = this.controller as Record<string, unknown>;
    if (typeof c.saveQuery === "function") {
      (c.saveQuery as Function)();
    }
  }

  getVisibleProperties() {
    const vc = this.getViewConfig();
    return Array.isArray(vc?.order) ? (vc.order as string[]) : [];
  }

  togglePropertyVisibility(_prop: string) {
    this.render();
  }

  onResize() {}

  getEphemeralState() {
    return {};
  }

  setEphemeralState(_s: unknown) {}

  getViewActions() {
    return [];
  }

  // ── Config helpers ─────────────────────────────────────────────────────

  getViewConfig(): Record<string, unknown> | null {
    const c = this.controller as Record<string, unknown>;
    if (typeof c.getViewConfig === "function") {
      try {
        return (c.getViewConfig as Function)();
      } catch {
        return null;
      }
    }
    return null;
  }

  getConfigProp(key: string): string {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.[key];
    if (typeof raw === "string") return stripNamespace(raw);
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const id = o.propertyId ?? o.id ?? o.name ?? "";
      return stripNamespace(String(id));
    }
    return "";
  }

  getStartProp(): string {
    return this.getConfigProp("startProp") || "start_date";
  }

  getEndProp(): string {
    return this.getConfigProp("endProp") || "end_date";
  }

  getZoom(): number {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.zoom;
    if (typeof raw === "number") return Math.max(10, raw);
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return Math.max(10, n);
    }
    return 60;
  }

  getPadding(): number {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.padding;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
    return 7;
  }

  getSidebarWidth(): number {
    return 220;
  }

  getRowHeight(): number {
    return 36;
  }

  // ── Date range calculation ─────────────────────────────────────────────

  private calculateDateRange(
    entries: BasesEntry[]
  ): { start: Date; end: Date } | null {
    const startProp = this.getStartProp();
    const endProp = this.getEndProp();
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const entry of entries) {
      const sd = parseDate(getEntryProp(entry, startProp));
      const ed = parseDate(getEntryProp(entry, endProp));

      const effectiveStart = sd;
      const effectiveEnd = ed ?? sd;
      if (effectiveStart && effectiveEnd) {
        if (effectiveStart < effectiveEnd) {
          minTime = Math.min(minTime, effectiveStart.getTime());
          maxTime = Math.max(maxTime, effectiveEnd.getTime());
        } else {
          minTime = Math.min(minTime, effectiveEnd.getTime());
          maxTime = Math.max(maxTime, effectiveStart.getTime());
        }
      } else if (effectiveStart) {
        minTime = Math.min(minTime, effectiveStart.getTime());
        maxTime = Math.max(maxTime, effectiveStart.getTime());
      }
    }

    if (minTime === Infinity) return null;

    const pad = this.getPadding() * 86400000;

    // Round start to midnight of that day
    const start = new Date(minTime - pad);
    start.setHours(0, 0, 0, 0);

    // Round end to end of that day + 1
    const end = new Date(maxTime + pad + 86400000);
    end.setHours(0, 0, 0, 0);

    return { start, end };
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render() {
    const results = this.controller.results as
      | Map<TFile, BasesEntry>
      | undefined;
    this.containerEl.empty();
    this.containerEl.addClass("btl-root");

    if (!results || results.size === 0) {
      this.renderEmpty();
      return;
    }

    let entries = Array.from(results.values());

    // Client-side sort
    const sortSpec = this.getSort();
    if (sortSpec.length > 0) {
      entries.sort((a, b) => {
        for (const { prop, dir } of sortSpec) {
          const cmp = compareValues(
            getEntryProp(a, prop),
            getEntryProp(b, prop)
          );
          if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
        }
        return 0;
      });
    }

    const dateRange = this.calculateDateRange(entries);
    if (!dateRange) {
      this.renderEmpty();
      return;
    }

    const zoom = this.getZoom();
    const totalDays = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / 86400000
    );
    const timelineWidth = totalDays * zoom;
    const sidebarWidth = this.getSidebarWidth();
    const rowHeight = this.getRowHeight();
    const limit = this.getLimit();
    const orderedKeys = this.getVisibleProperties();

    // Apply limit
    const limited = limit !== null ? entries.slice(0, limit) : entries;

    // ── Header area ──
    const header = this.containerEl.createDiv("btl-header");
    header.createDiv("btl-header-spacer").style.width = `${sidebarWidth}px`;
    const headerScroll = header.createDiv("btl-header-scroll");
    const headerInner = headerScroll.createDiv("btl-header-inner");
    headerInner.style.width = `${timelineWidth}px`;

    this.renderDateCells(headerInner, dateRange, zoom, totalDays);

    // ── Body area ──
    const body = this.containerEl.createDiv("btl-body");

    // Sidebar
    const sidebar = body.createDiv("btl-sidebar");
    sidebar.style.width = `${sidebarWidth}px`;
    const sidebarInner = sidebar.createDiv("btl-sidebar-inner");

    // Timeline scroll area
    const timelineScroll = body.createDiv("btl-timeline-scroll");

    // Column backgrounds (weekend shading, etc.)
    const colBg = timelineScroll.createDiv("btl-col-bg");
    colBg.style.width = `${timelineWidth}px`;
    this.renderColumnBackgrounds(colBg, dateRange, zoom, totalDays);

    // Timeline body
    const timelineInner = timelineScroll.createDiv("btl-timeline-inner");
    timelineInner.style.width = `${timelineWidth}px`;
    timelineInner.style.minHeight = `${limited.length * rowHeight}px`;

    this.renderEntryRows(
      sidebarInner,
      timelineInner,
      limited,
      dateRange,
      zoom,
      rowHeight
    );

    // ── Scroll sync ──
    this.syncScroll(headerScroll, timelineScroll, sidebar);
  }

  private renderDateCells(
    parent: HTMLElement,
    range: { start: Date; end: Date },
    zoom: number,
    totalDays: number
  ) {
    let currentMonth = -1;
    const d = new Date(range.start);

    for (let i = 0; i < totalDays; i++) {
      const cell = parent.createDiv("btl-date-cell");
      cell.style.width = `${zoom}px`;

      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        cell.addClass("btl-weekend");
      }

      if (d.getMonth() !== currentMonth) {
        currentMonth = d.getMonth();
        cell.addClass("btl-month-start");
        const monthLabel = d.toLocaleString("default", { month: "short" });
        cell.setText(`${monthLabel} ${d.getDate()}`);
      } else {
        cell.setText(d.getDate().toString());
      }

      d.setDate(d.getDate() + 1);
    }
  }

  private renderColumnBackgrounds(
    parent: HTMLElement,
    range: { start: Date; end: Date },
    zoom: number,
    totalDays: number
  ) {
    const d = new Date(range.start);
    let weekStart = -1;

    for (let i = 0; i < totalDays; i++) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) {
        if (weekStart < 0) weekStart = i;
      } else if (weekStart >= 0) {
        const bg = parent.createDiv("btl-col-weekend");
        bg.style.left = `${weekStart * zoom}px`;
        bg.style.width = `${(i - weekStart) * zoom}px`;
        weekStart = -1;
      }

      d.setDate(d.getDate() + 1);
    }

    if (weekStart >= 0) {
      const bg = parent.createDiv("btl-col-weekend");
      bg.style.left = `${weekStart * zoom}px`;
      bg.style.width = `${(totalDays - weekStart) * zoom}px`;
    }
  }

  private renderEntryRows(
    sidebar: HTMLElement,
    timeline: HTMLElement,
    entries: BasesEntry[],
    range: { start: Date; end: Date },
    zoom: number,
    rowHeight: number
  ) {
    const startProp = this.getStartProp();
    const endProp = this.getEndProp();
    const orderedKeys = this.getVisibleProperties();

    for (const entry of entries) {
      this.renderOneRow(
        sidebar,
        timeline,
        entry,
        range,
        zoom,
        rowHeight,
        startProp,
        endProp,
        orderedKeys
      );
    }
  }

  private renderOneRow(
    sidebar: HTMLElement,
    timeline: HTMLElement,
    entry: BasesEntry,
    range: { start: Date; end: Date },
    zoom: number,
    rowHeight: number,
    startProp: string,
    endProp: string,
    orderedKeys: string[]
  ) {
    const HIDDEN_ALWAYS = new Set([
      "title",
      "aliases",
      "cssclasses",
      "cssclass",
    ]);

    // ── Sidebar row ──
    const sRow = sidebar.createDiv("btl-sidebar-row");
    sRow.style.height = `${rowHeight}px`;

    const title = sRow.createDiv("btl-sidebar-title");
    title.setText(entry.file.basename);
    title.addEventListener("click", () => {
      this.obsApp.workspace.openLinkText(entry.file.path, "", false);
    });

    if (orderedKeys.length > 0) {
      const propsDiv = sRow.createDiv("btl-sidebar-props");
      for (const rawKey of orderedKeys) {
        const stripped = stripNamespace(rawKey);
        let val: unknown;
        if (rawKey.startsWith("formula.")) {
          val = getFormulaValue(entry, stripped);
        } else if (rawKey.startsWith("file.")) {
          val = getEntryProp(entry, rawKey);
        } else {
          val =
            entry.frontmatter?.[stripped] ??
            entry.frontmatter?.[rawKey];
          if (startProp && stripped === startProp) continue;
          if (endProp && stripped === endProp) continue;
          if (HIDDEN_ALWAYS.has(stripped.toLowerCase())) continue;
        }
        if (val == null || val === "") continue;
        const span = propsDiv.createSpan("btl-sidebar-prop");
        span.setText(`${stripped}: ${String(val)}`);
      }
    }

    // ── Timeline row ──
    const tRow = timeline.createDiv("btl-timeline-row");
    tRow.style.height = `${rowHeight}px`;

    let sd = parseDate(getEntryProp(entry, startProp));
    let ed = parseDate(getEntryProp(entry, endProp));

    if (!sd && !ed) return;

    if (sd && ed && sd > ed) {
      [sd, ed] = [ed, sd];
    }

    const effectiveStart = sd!;
    const effectiveEnd = ed ?? sd!;
    const durationDays = Math.max(
      0,
      (effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000
    );

    const leftPx =
      ((effectiveStart.getTime() - range.start.getTime()) / 86400000) * zoom;

    const bar = tRow.createDiv("btl-bar");

    if (!ed) {
      // Milestone: diamond shape centered on the day
      bar.addClass("btl-milestone");
      const diamondW = Math.max(10, zoom * 0.5);
      bar.style.left = `${leftPx + zoom / 2 - diamondW / 2}px`;
      bar.style.width = `${diamondW}px`;
    } else {
      bar.style.left = `${leftPx}px`;
      bar.style.width = `${Math.max(durationDays * zoom, 2)}px`;
    }

    bar.setAttribute(
      "title",
      `${entry.file.basename}\n${fmtDate(effectiveStart)}${
        ed ? ` -> ${fmtDate(ed)}` : ""
      }`
    );
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      this.obsApp.workspace.openLinkText(entry.file.path, "", false);
    });
  }

  private syncScroll(
    headerScroll: HTMLElement,
    timelineScroll: HTMLElement,
    sidebar: HTMLElement
  ) {
    let syncing = false;

    timelineScroll.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      headerScroll.scrollLeft = timelineScroll.scrollLeft;
      sidebar.scrollTop = timelineScroll.scrollTop;
      syncing = false;
    });

    headerScroll.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      timelineScroll.scrollLeft = headerScroll.scrollLeft;
      syncing = false;
    });

    sidebar.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      timelineScroll.scrollTop = sidebar.scrollTop;
      syncing = false;
    });
  }

  private renderEmpty() {
    const empty = this.containerEl.createDiv("btl-empty");
    setIcon(empty.createSpan(), "clock");
    empty.createSpan({ text: " No results" });
  }
}

// ── Plugin entry ───────────────────────────────────────────────────────────

export default class ExtendedViewsPlugin extends Plugin {
  onload() {
    // @ts-ignore — registerBasesView not in public typings yet
    this.registerBasesView("timeline", {
      icon: "clock",
      label: "Timeline",
      factory: (controller: unknown, containerEl: HTMLElement) =>
        new TimelineView(this.app, controller, containerEl),
      options: () => [
        {
          type: "property",
          key: "startProp",
          label: "Start date property",
        },
        {
          type: "property",
          key: "endProp",
          label: "End date property",
        },
        {
          type: "slider",
          key: "zoom",
          label: "Zoom (px/day)",
          min: 20,
          max: 200,
          step: 10,
        },
        {
          type: "slider",
          key: "padding",
          label: "Range padding (days)",
          min: 0,
          max: 30,
          step: 1,
        },
      ],
    });
  }

  onunload() {}
}
