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
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
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

function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 50%)`;
}

function midnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayDiff(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86400000;
}

// ── TimelineView ───────────────────────────────────────────────────────────

const PRESETS: Record<string, string> = {
  auto: "Auto",
  "3mo": "3m",
  "6mo": "6m",
  "1yr": "1y",
};

class TimelineView extends Component {
  private obsApp: App;
  private controller: Record<string, unknown>;
  private containerEl: HTMLElement;
  private currentPreset = "auto";

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
    return (raw as Record<string, unknown>[])
      .map((o) => ({
        prop: typeof o.property === "string" ? stripNamespace(o.property) : "",
        dir:
          typeof o.direction === "string" &&
          o.direction.toUpperCase() === "DESC"
            ? "desc"
            : "asc",
      }))
      .filter((s) => s.prop !== "");
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

  getColorProp(): string {
    return this.getConfigProp("colorProp");
  }

  getIconProp(): string {
    return this.getConfigProp("iconProp");
  }

  isCompact(): boolean {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.compact;
    if (typeof raw === "number") return raw === 1;
    if (typeof raw === "string") return parseFloat(raw) === 1;
    return false;
  }

  getSidebarWidth(): number {
    return 220;
  }

  getRowHeight(): number {
    return this.isCompact() ? 24 : 36;
  }

  // ── Date range ─────────────────────────────────────────────────────────

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
        if (effectiveStart <= effectiveEnd) {
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

    let start = midnight(new Date(minTime - this.getPadding() * 86400000));
    let end = midnight(new Date(maxTime + (this.getPadding() + 1) * 86400000));

    // Apply date preset override
    const presetRange = this.presetDateRange(start, end);
    if (presetRange) {
      start = presetRange.start;
      end = presetRange.end;
    }

    return { start, end };
  }

  private presetDateRange(
    autoStart: Date,
    autoEnd: Date
  ): { start: Date; end: Date } | null {
    if (this.currentPreset === "auto") return null;

    const now = new Date();
    let s: Date, e: Date;

    switch (this.currentPreset) {
      case "3mo":
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 3, 1);
        break;
      case "6mo":
        s = new Date(now.getFullYear(), Math.floor(now.getMonth() / 6) * 6, 1);
        e = new Date(s.getFullYear(), s.getMonth() + 6, 1);
        break;
      case "1yr":
        s = new Date(now.getFullYear(), 0, 1);
        e = new Date(now.getFullYear() + 1, 0, 1);
        break;
      default:
        return null;
    }

    return { start: s, end: e };
  }

  private setPreset(preset: string) {
    this.currentPreset = preset;
    this.render();
  }

  // ── Group by ───────────────────────────────────────────────────────────

  private buildGroups(
    entries: BasesEntry[],
    vc: Record<string, unknown> | null
  ): { key: string; count: number; entries: BasesEntry[] }[] | null {
    const gb = vc?.groupBy as Record<string, unknown> | undefined;
    if (!gb?.property) return null;
    const groupProp = stripNamespace(String(gb.property));
    const groupDir =
      String(gb?.direction ?? "").toUpperCase() === "DESC" ? "desc" : "asc";

    const buckets = new Map<string, BasesEntry[]>();
    for (const entry of entries) {
      const raw = getEntryProp(entry, groupProp);
      let label: string;
      if (raw == null || raw === "") label = "—";
      else if (Array.isArray(raw))
        label = raw.map((v) => String(v)).join(", ") || "—";
      else label = String(raw);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label)!.push(entry);
    }

    const sorted = Array.from(buckets.entries()).sort(([a], [b]) =>
      groupDir === "desc"
        ? b.localeCompare(a, undefined, { numeric: true })
        : a.localeCompare(b, undefined, { numeric: true })
    );

    return sorted.map(([key, entries]) => ({
      key,
      count: entries.length,
      entries,
    }));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render() {
    const results = this.controller.results as
      | Map<TFile, BasesEntry>
      | undefined;
    this.containerEl.empty();
    this.containerEl.addClass("btl-root");

    if (this.isCompact()) this.containerEl.addClass("btl-compact");
    else this.containerEl.removeClass("btl-compact");

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
    const totalDays = Math.ceil(dayDiff(dateRange.end, dateRange.start));
    const timelineWidth = totalDays * zoom;
    const sidebarWidth = this.getSidebarWidth();
    const rowHeight = this.getRowHeight();
    const limit = this.getLimit();

    // Apply limit
    const limited = limit !== null ? entries.slice(0, limit) : entries;

    // Build groups
    const vc = this.getViewConfig();
    const groups = this.buildGroups(limited, vc);

    // ── Toolbar ──
    this.renderToolbar(sidebarWidth);

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

    // Column backgrounds
    const colBg = timelineScroll.createDiv("btl-col-bg");
    colBg.style.width = `${timelineWidth}px`;
    this.renderColumnBackgrounds(colBg, dateRange, zoom, totalDays);

    // Today marker
    this.renderTodayMarker(colBg, dateRange, zoom, totalDays);

    // Timeline body
    const timelineInner = timelineScroll.createDiv("btl-timeline-inner");
    timelineInner.style.width = `${timelineWidth}px`;

    let totalRows: number;
    if (groups) {
      totalRows = groups.reduce(
        (sum, g) => sum + 1 + g.entries.length,
        0
      );
      this.renderGroupedBody(
        sidebarInner,
        timelineInner,
        groups,
        dateRange,
        zoom,
        totalDays,
        rowHeight
      );
    } else {
      totalRows = limited.length;
      this.renderFlatBody(
        sidebarInner,
        timelineInner,
        limited,
        dateRange,
        zoom,
        rowHeight
      );
    }
    timelineInner.style.minHeight = `${totalRows * rowHeight}px`;

    // ── Scroll sync ──
    this.syncScroll(headerScroll, timelineScroll, sidebar);
  }

  private renderToolbar(sidebarWidth: number) {
    const bar = this.containerEl.createDiv("btl-toolbar");
    bar.createDiv("btl-toolbar-spacer").style.width = `${sidebarWidth}px`;
    const controls = bar.createDiv("btl-toolbar-controls");

    // Date range presets
    for (const [key, label] of Object.entries(PRESETS)) {
      const btn = controls.createEl("button", {
        cls: "btl-preset-btn",
        text: label,
      });
      if (this.currentPreset === key) btn.addClass("btl-preset-active");
      btn.addEventListener("click", () => this.setPreset(key));
    }
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

  private renderTodayMarker(
    parent: HTMLElement,
    range: { start: Date; end: Date },
    zoom: number,
    totalDays: number
  ) {
    const today = midnight(new Date());
    const days = dayDiff(today, range.start);
    if (days < 0 || days > totalDays) return;
    const marker = parent.createDiv("btl-today-marker");
    marker.style.left = `${days * zoom}px`;
  }

  private renderFlatBody(
    sidebar: HTMLElement,
    timeline: HTMLElement,
    entries: BasesEntry[],
    range: { start: Date; end: Date },
    zoom: number,
    rowHeight: number
  ) {
    const startProp = this.getStartProp();
    const endProp = this.getEndProp();
    const colorProp = this.getColorProp();
    const iconProp = this.getIconProp();
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
        colorProp,
        iconProp,
        orderedKeys
      );
    }
  }

  private renderGroupedBody(
    sidebar: HTMLElement,
    timeline: HTMLElement,
    groups: { key: string; count: number; entries: BasesEntry[] }[],
    range: { start: Date; end: Date },
    zoom: number,
    totalDays: number,
    rowHeight: number
  ) {
    const startProp = this.getStartProp();
    const endProp = this.getEndProp();
    const colorProp = this.getColorProp();
    const iconProp = this.getIconProp();
    const orderedKeys = this.getVisibleProperties();

    for (const group of groups) {
      this.renderGroupHeader(
        sidebar,
        timeline,
        group.key,
        group.count,
        zoom,
        totalDays,
        rowHeight
      );
      for (const entry of group.entries) {
        this.renderOneRow(
          sidebar,
          timeline,
          entry,
          range,
          zoom,
          rowHeight,
          startProp,
          endProp,
          colorProp,
          iconProp,
          orderedKeys
        );
      }
    }
  }

  private renderGroupHeader(
    sidebar: HTMLElement,
    timeline: HTMLElement,
    key: string,
    count: number,
    zoom: number,
    totalDays: number,
    rowHeight: number
  ) {
    const sRow = sidebar.createDiv("btl-group-header-row");
    sRow.style.height = `${rowHeight}px`;
    sRow.createSpan({ cls: "btl-group-label", text: key });
    sRow.createSpan({ cls: "btl-group-count", text: String(count) });

    const tRow = timeline.createDiv("btl-group-header-row");
    tRow.style.height = `${rowHeight}px`;
    tRow.style.width = `${totalDays * zoom}px`;
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
    colorProp: string,
    iconProp: string,
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

    const leftPx = dayDiff(effectiveStart, range.start) * zoom;

    const bar = tRow.createDiv("btl-bar");

    // ── Color property ──
    if (colorProp) {
      const cv = getEntryProp(entry, colorProp);
      if (cv != null && String(cv).trim() !== "") {
        bar.style.background = hashColor(String(cv));
      }
    }

    if (!ed) {
      // Milestone: diamond centered on the day column
      bar.addClass("btl-milestone");
      const diamondW = Math.max(10, zoom * 0.5);
      bar.style.left = `${leftPx + zoom / 2 - diamondW / 2}px`;
      bar.style.width = `${diamondW}px`;
    } else {
      const durationDays = Math.max(
        0,
        dayDiff(effectiveEnd, effectiveStart)
      );
      bar.style.left = `${leftPx}px`;
      bar.style.width = `${Math.max(durationDays * zoom, 2)}px`;

      // ── Icon property ──
      if (iconProp) {
        const iv = getEntryProp(entry, iconProp);
        if (iv != null && typeof iv === "string" && iv.trim() !== "") {
          const iconName = iv.trim().replace(/^lucide-/, "");
          try {
            setIcon(
              bar.createDiv("btl-bar-icon"),
              iconName
            );
          } catch {
            // invalid icon, skip
          }
        }
      }
    }

    bar.setAttribute(
      "title",
      `${entry.file.basename}\n${fmtDate(effectiveStart)}${
        ed ? ` → ${fmtDate(ed)}` : ""
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
        {
          type: "property",
          key: "colorProp",
          label: "Bar color property",
        },
        {
          type: "property",
          key: "iconProp",
          label: "Bar icon property",
        },
        {
          type: "slider",
          key: "compact",
          label: "Compact layout",
          min: 0,
          max: 1,
          step: 1,
        },
      ],
    });
  }

  onunload() {}
}
