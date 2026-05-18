"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ExtendedViewsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/TimelineView.ts
var import_obsidian = require("obsidian");

// src/helpers.ts
function stripNamespace(s) {
  return s.replace(/^(note|formula|implicit|file)\./, "");
}
function parseDate(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function midnight(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function dayDiff(a, b) {
  return (a.getTime() - b.getTime()) / 864e5;
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function compareValues(a, b) {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const ad = typeof a === "string" ? Date.parse(a) : NaN;
  const bd = typeof b === "string" ? Date.parse(b) : NaN;
  if (!isNaN(ad) && !isNaN(bd)) return ad - bd;
  if (Array.isArray(a)) return compareValues(a[0], Array.isArray(b) ? b[0] : b);
  return String(a).localeCompare(String(b), void 0, {
    numeric: true,
    sensitivity: "base"
  });
}
function getEntryProp(entry, prop) {
  var _a, _b, _c, _d, _e, _f, _g;
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
      return (_b = (_a = entry.file.stat) == null ? void 0 : _a.size) != null ? _b : 0;
    case "file.mtime":
      return (_d = (_c = entry.file.stat) == null ? void 0 : _c.mtime) != null ? _d : 0;
    case "file.ctime":
      return (_f = (_e = entry.file.stat) == null ? void 0 : _e.ctime) != null ? _f : 0;
  }
  const fm = (_g = entry.frontmatter) != null ? _g : {};
  if (prop in fm) return fm[prop];
  const lower = prop.toLowerCase();
  for (const [k, v] of Object.entries(fm)) {
    if (k.toLowerCase() === lower) return v;
  }
  return void 0;
}
function getFormulaValue(entry, name) {
  var _a, _b;
  const e = entry;
  const fr = e.formulaResults;
  if (fr && typeof fr.getFormulaValue === "function") {
    try {
      const tv = fr.getFormulaValue(name);
      if (tv != null) {
        const str = typeof tv.toString === "function" ? tv.toString() : String(tv);
        if (str !== "null" && str !== "undefined") return str;
      }
    } catch (e2) {
    }
  }
  const formulas = fr == null ? void 0 : fr.formulas;
  if (formulas) {
    const fo = (_b = formulas[name]) != null ? _b : (_a = Object.entries(formulas).find(
      ([k]) => k.toLowerCase() === name.toLowerCase()
    )) == null ? void 0 : _a[1];
    if (fo && typeof fo.getValue === "function") {
      try {
        const tv = fo.getValue(entry);
        if (tv != null) {
          const str = typeof tv.toString === "function" ? tv.toString() : String(tv);
          if (str !== "null" && str !== "undefined") return str;
        }
      } catch (e2) {
      }
    }
  }
  return void 0;
}
function hashColor(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 50%)`;
}

// src/TimelineView.ts
var PRESETS = {
  auto: "Auto",
  "3mo": "3m",
  "6mo": "6m",
  "1yr": "1y"
};
var TimelineView = class extends import_obsidian.Component {
  constructor(app, controller, containerEl) {
    super();
    this.currentPreset = "auto";
    this.compactMode = false;
    this.obsApp = app;
    this.controller = controller;
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
    const raw = vc == null ? void 0 : vc.sort;
    if (!Array.isArray(raw)) return [];
    return raw.map((o) => ({
      prop: typeof o.property === "string" ? stripNamespace(o.property) : "",
      dir: typeof o.direction === "string" && o.direction.toUpperCase() === "DESC" ? "desc" : "asc"
    })).filter((s) => s.prop !== "");
  }
  getLimit() {
    const vc = this.getViewConfig();
    const l = vc == null ? void 0 : vc.limit;
    return typeof l === "number" && l > 0 ? l : null;
  }
  getQuery() {
    var _a;
    return (_a = this.controller.query) != null ? _a : null;
  }
  saveQuery() {
    const c = this.controller;
    if (typeof c.saveQuery === "function") {
      c.saveQuery();
    }
  }
  getVisibleProperties() {
    const vc = this.getViewConfig();
    return Array.isArray(vc == null ? void 0 : vc.order) ? vc.order : [];
  }
  togglePropertyVisibility(_prop) {
    this.render();
  }
  onResize() {
  }
  getEphemeralState() {
    return {};
  }
  setEphemeralState(_s) {
  }
  getViewActions() {
    return [];
  }
  // ── Config helpers ─────────────────────────────────────────────────────
  getViewConfig() {
    const c = this.controller;
    if (typeof c.getViewConfig === "function") {
      try {
        return c.getViewConfig();
      } catch (e) {
        return null;
      }
    }
    return null;
  }
  getConfigProp(key) {
    var _a, _b, _c;
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data[key];
    if (typeof raw === "string") return stripNamespace(raw);
    if (raw && typeof raw === "object") {
      const o = raw;
      const id = (_c = (_b = (_a = o.propertyId) != null ? _a : o.id) != null ? _b : o.name) != null ? _c : "";
      return stripNamespace(String(id));
    }
    return "";
  }
  getStartProp() {
    return this.getConfigProp("startProp") || "start_date";
  }
  getEndProp() {
    return this.getConfigProp("endProp") || "end_date";
  }
  getZoom() {
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data.zoom;
    if (typeof raw === "number") return Math.max(10, raw);
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return Math.max(10, n);
    }
    return 60;
  }
  getPadding() {
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data.padding;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
    return 7;
  }
  getColorProp() {
    return this.getConfigProp("colorProp");
  }
  getIconProp() {
    return this.getConfigProp("iconProp");
  }
  isCompact() {
    return this.compactMode;
  }
  getSidebarWidth() {
    return 220;
  }
  getRowHeight() {
    return this.isCompact() ? 24 : 36;
  }
  // ── Date range ─────────────────────────────────────────────────────────
  calculateDateRange(entries) {
    const startProp = this.getStartProp();
    const endProp = this.getEndProp();
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const entry of entries) {
      const sd = parseDate(getEntryProp(entry, startProp));
      const ed = parseDate(getEntryProp(entry, endProp));
      const effectiveStart = sd;
      const effectiveEnd = ed != null ? ed : sd;
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
    let start = midnight(
      new Date(minTime - this.getPadding() * 864e5)
    );
    let end = midnight(
      new Date(maxTime + (this.getPadding() + 1) * 864e5)
    );
    const presetRange = this.presetDateRange(start, end);
    if (presetRange) {
      start = presetRange.start;
      end = presetRange.end;
    }
    return { start, end };
  }
  presetDateRange(autoStart, autoEnd) {
    if (this.currentPreset === "auto") return null;
    const now = /* @__PURE__ */ new Date();
    let s, e;
    switch (this.currentPreset) {
      case "3mo":
        s = new Date(now.getFullYear(), now.getMonth(), 1);
        e = new Date(now.getFullYear(), now.getMonth() + 3, 1);
        break;
      case "6mo":
        s = new Date(
          now.getFullYear(),
          Math.floor(now.getMonth() / 6) * 6,
          1
        );
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
  setPreset(preset) {
    this.currentPreset = preset;
    this.render();
  }
  // ── Group by ───────────────────────────────────────────────────────────
  buildGroups(entries, vc) {
    var _a;
    const gb = vc == null ? void 0 : vc.groupBy;
    if (!(gb == null ? void 0 : gb.property)) return null;
    const groupProp = stripNamespace(String(gb.property));
    const groupDir = String((_a = gb == null ? void 0 : gb.direction) != null ? _a : "").toUpperCase() === "DESC" ? "desc" : "asc";
    const buckets = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const raw = getEntryProp(entry, groupProp);
      let label;
      if (raw == null || raw === "") label = "\u2014";
      else if (Array.isArray(raw))
        label = raw.map((v) => String(v)).join(", ") || "\u2014";
      else label = String(raw);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(entry);
    }
    const sorted = Array.from(buckets.entries()).sort(
      ([a], [b]) => groupDir === "desc" ? b.localeCompare(a, void 0, { numeric: true }) : a.localeCompare(b, void 0, { numeric: true })
    );
    return sorted.map(([key, entries2]) => ({
      key,
      count: entries2.length,
      entries: entries2
    }));
  }
  // ── Render ─────────────────────────────────────────────────────────────
  render() {
    const results = this.controller.results;
    this.containerEl.empty();
    this.containerEl.addClass("btl-root");
    if (this.isCompact()) this.containerEl.addClass("btl-compact");
    else this.containerEl.removeClass("btl-compact");
    if (!results || results.size === 0) {
      this.renderEmpty();
      return;
    }
    let entries = Array.from(results.values());
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
    const limited = limit !== null ? entries.slice(0, limit) : entries;
    const vc = this.getViewConfig();
    const groups = this.buildGroups(limited, vc);
    this.renderToolbar(sidebarWidth);
    const header = this.containerEl.createDiv("btl-header");
    header.createDiv("btl-header-spacer").style.width = `${sidebarWidth}px`;
    const headerScroll = header.createDiv("btl-header-scroll");
    const headerInner = headerScroll.createDiv("btl-header-inner");
    headerInner.style.width = `${timelineWidth}px`;
    this.renderDateCells(headerInner, dateRange, zoom, totalDays);
    const body = this.containerEl.createDiv("btl-body");
    const sidebar = body.createDiv("btl-sidebar");
    sidebar.style.width = `${sidebarWidth}px`;
    const sidebarInner = sidebar.createDiv("btl-sidebar-inner");
    const timelineScroll = body.createDiv("btl-timeline-scroll");
    const colBg = timelineScroll.createDiv("btl-col-bg");
    colBg.style.width = `${timelineWidth}px`;
    this.renderColumnBackgrounds(colBg, dateRange, zoom, totalDays);
    this.renderTodayMarker(colBg, dateRange, zoom, totalDays);
    const timelineInner = timelineScroll.createDiv("btl-timeline-inner");
    timelineInner.style.width = `${timelineWidth}px`;
    let totalRows;
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
    this.syncRowHeights(sidebarInner, timelineInner);
    this.syncScroll(headerScroll, timelineScroll, sidebar);
  }
  renderToolbar(sidebarWidth) {
    const bar = this.containerEl.createDiv("btl-toolbar");
    bar.createDiv("btl-toolbar-spacer").style.width = `${sidebarWidth}px`;
    const controls = bar.createDiv("btl-toolbar-controls");
    for (const [key, label] of Object.entries(PRESETS)) {
      const btn = controls.createEl("button", {
        cls: "btl-preset-btn",
        text: label
      });
      if (this.currentPreset === key)
        btn.addClass("btl-preset-active");
      btn.addEventListener("click", () => this.setPreset(key));
    }
    controls.createDiv("btl-toolbar-sep");
    const compactBtn = controls.createEl("button", {
      cls: "btl-preset-btn",
      text: "Compact"
    });
    if (this.compactMode) compactBtn.addClass("btl-preset-active");
    compactBtn.addEventListener("click", () => {
      this.compactMode = !this.compactMode;
      this.render();
    });
  }
  renderDateCells(parent, range, zoom, totalDays) {
    let currentMonth = -1;
    const d = new Date(range.start);
    for (let i = 0; i < totalDays; i++) {
      const cell = parent.createDiv("btl-date-cell");
      cell.style.width = `${zoom}px`;
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6)
        cell.addClass("btl-weekend");
      if (d.getMonth() !== currentMonth) {
        currentMonth = d.getMonth();
        cell.addClass("btl-month-start");
        const monthLabel = d.toLocaleString("default", {
          month: "short"
        });
        if (zoom >= 50) {
          cell.setText(`${monthLabel} ${d.getDate()}`);
        } else if (zoom >= 35) {
          cell.setText(`${monthLabel[0]} ${d.getDate()}`);
        } else {
          cell.setText(`${d.getMonth() + 1}/${d.getDate()}`);
        }
      } else {
        cell.setText(d.getDate().toString());
      }
      d.setDate(d.getDate() + 1);
    }
  }
  renderColumnBackgrounds(parent, range, zoom, totalDays) {
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
  renderTodayMarker(parent, range, zoom, totalDays) {
    const today = midnight(/* @__PURE__ */ new Date());
    const days = dayDiff(today, range.start);
    if (days < 0 || days > totalDays) return;
    const marker = parent.createDiv("btl-today-marker");
    marker.style.left = `${days * zoom}px`;
  }
  renderFlatBody(sidebar, timeline, entries, range, zoom, rowHeight) {
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
  renderGroupedBody(sidebar, timeline, groups, range, zoom, totalDays, rowHeight) {
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
  renderGroupHeader(sidebar, timeline, key, count, zoom, totalDays, rowHeight) {
    const sRow = sidebar.createDiv("btl-group-header-row");
    sRow.style.height = `${rowHeight}px`;
    sRow.createSpan({ cls: "btl-group-label", text: key });
    sRow.createSpan({ cls: "btl-group-count", text: String(count) });
    const tRow = timeline.createDiv("btl-group-header-row");
    tRow.style.height = `${rowHeight}px`;
    tRow.style.width = `${totalDays * zoom}px`;
  }
  renderOneRow(sidebar, timeline, entry, range, zoom, rowHeight, startProp, endProp, colorProp, iconProp, orderedKeys) {
    var _a, _b, _c;
    const HIDDEN_ALWAYS = /* @__PURE__ */ new Set([
      "title",
      "aliases",
      "cssclasses",
      "cssclass"
    ]);
    const sRow = sidebar.createDiv("btl-sidebar-row");
    sRow.style.minHeight = `${rowHeight}px`;
    const title = sRow.createDiv("btl-sidebar-title");
    title.setText(entry.file.basename);
    title.addEventListener("click", () => {
      this.obsApp.workspace.openLinkText(
        entry.file.path,
        "",
        false
      );
    });
    if (orderedKeys.length > 0) {
      const propsDiv = sRow.createDiv("btl-sidebar-props");
      for (const rawKey of orderedKeys) {
        const stripped = stripNamespace(rawKey);
        let val;
        if (rawKey.startsWith("formula.")) {
          val = getFormulaValue(entry, stripped);
        } else if (rawKey.startsWith("file.")) {
          val = getEntryProp(entry, rawKey);
        } else {
          val = (_c = (_a = entry.frontmatter) == null ? void 0 : _a[stripped]) != null ? _c : (_b = entry.frontmatter) == null ? void 0 : _b[rawKey];
          if (startProp && stripped === startProp) continue;
          if (endProp && stripped === endProp) continue;
          if (HIDDEN_ALWAYS.has(stripped.toLowerCase())) continue;
        }
        if (val == null || val === "") continue;
        const span = propsDiv.createSpan("btl-sidebar-prop");
        span.setText(`${stripped}: ${String(val)}`);
      }
    }
    const tRow = timeline.createDiv("btl-timeline-row");
    tRow.style.height = `${rowHeight}px`;
    let sd = parseDate(getEntryProp(entry, startProp));
    let ed = parseDate(getEntryProp(entry, endProp));
    if (!sd && !ed) return;
    if (sd && ed && sd > ed) [sd, ed] = [ed, sd];
    const effectiveStart = sd;
    const effectiveEnd = ed != null ? ed : sd;
    const leftPx = dayDiff(effectiveStart, range.start) * zoom;
    const bar = tRow.createDiv("btl-bar");
    if (colorProp) {
      const cv = getEntryProp(entry, colorProp);
      if (cv != null && String(cv).trim() !== "") {
        bar.style.background = hashColor(String(cv));
      }
    }
    if (!ed) {
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
    }
    const barW = parseFloat(bar.style.width);
    if (iconProp && barW > 30) {
      const iv = getEntryProp(entry, iconProp);
      if (iv != null && typeof iv === "string" && iv.trim() !== "") {
        const iconName = iv.trim().replace(/^lucide-/, "");
        try {
          (0, import_obsidian.setIcon)(
            bar.createDiv("btl-bar-icon"),
            iconName
          );
        } catch (e) {
        }
      }
    }
    bar.setAttribute(
      "title",
      `${entry.file.basename}
${fmtDate(effectiveStart)}${ed ? ` \u2192 ${fmtDate(ed)}` : ""}`
    );
    if (barW > 50 && !bar.classList.contains("btl-milestone")) {
      bar.createSpan({
        cls: "btl-bar-text",
        text: entry.file.basename
      });
    }
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      this.obsApp.workspace.openLinkText(
        entry.file.path,
        "",
        false
      );
    });
  }
  syncRowHeights(sidebar, timeline) {
    const sChildren = Array.from(sidebar.children);
    const tChildren = Array.from(timeline.children);
    const len = Math.min(sChildren.length, tChildren.length);
    for (let i = 0; i < len; i++) {
      tChildren[i].style.height = `${sChildren[i].offsetHeight}px`;
    }
  }
  syncScroll(headerScroll, timelineScroll, sidebar) {
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
  renderEmpty() {
    const empty = this.containerEl.createDiv("btl-empty");
    (0, import_obsidian.setIcon)(empty.createSpan(), "clock");
    empty.createSpan({ text: " No results" });
  }
};

// src/KanbanView.ts
var import_obsidian2 = require("obsidian");
var IMAGE_EXTS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif"
]);
var KanbanView = class extends import_obsidian2.Component {
  constructor(app, controller, containerEl) {
    super();
    this.obsApp = app;
    this.controller = controller;
    this.containerEl = containerEl;
  }
  // ── Lifecycle ──────────────────────────────────────────────────────────
  onload() {
    this.containerEl.addClass("btk-root");
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
    const raw = vc == null ? void 0 : vc.sort;
    if (!Array.isArray(raw)) return [];
    return raw.map((o) => ({
      prop: typeof o.property === "string" ? stripNamespace(o.property) : "",
      dir: typeof o.direction === "string" && o.direction.toUpperCase() === "DESC" ? "desc" : "asc"
    })).filter((s) => s.prop !== "");
  }
  getLimit() {
    const vc = this.getViewConfig();
    const l = vc == null ? void 0 : vc.limit;
    return typeof l === "number" && l > 0 ? l : null;
  }
  getQuery() {
    var _a;
    return (_a = this.controller.query) != null ? _a : null;
  }
  saveQuery() {
    const c = this.controller;
    if (typeof c.saveQuery === "function") {
      c.saveQuery();
    }
  }
  getVisibleProperties() {
    const vc = this.getViewConfig();
    return Array.isArray(vc == null ? void 0 : vc.order) ? vc.order : [];
  }
  togglePropertyVisibility(_prop) {
    this.render();
  }
  onResize() {
  }
  getEphemeralState() {
    return {};
  }
  setEphemeralState(_s) {
  }
  getViewActions() {
    return [];
  }
  // ── Config helpers ─────────────────────────────────────────────────────
  getViewConfig() {
    const c = this.controller;
    if (typeof c.getViewConfig === "function") {
      try {
        return c.getViewConfig();
      } catch (e) {
        return null;
      }
    }
    return null;
  }
  getConfigProp(key) {
    var _a, _b, _c;
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data[key];
    if (typeof raw === "string") return stripNamespace(raw);
    if (raw && typeof raw === "object") {
      const o = raw;
      const id = (_c = (_b = (_a = o.propertyId) != null ? _a : o.id) != null ? _b : o.name) != null ? _c : "";
      return stripNamespace(String(id));
    }
    return "";
  }
  getColumnProp() {
    return this.getConfigProp("columnProp") || "status";
  }
  getCoverProp() {
    return this.getConfigProp("coverProp");
  }
  getColorProp() {
    return this.getConfigProp("colorProp");
  }
  getCardWidth() {
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data.cardWidth;
    if (typeof raw === "number") return Math.max(160, raw);
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return Math.max(160, n);
    }
    return 280;
  }
  getMaxHeight() {
    const vc = this.getViewConfig();
    const data = vc == null ? void 0 : vc.data;
    const raw = data == null ? void 0 : data.maxHeight;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
    return 0;
  }
  // ── Column building ────────────────────────────────────────────────────
  buildGroups(entries, vc) {
    var _a;
    const gb = vc == null ? void 0 : vc.groupBy;
    if (!(gb == null ? void 0 : gb.property)) return null;
    const groupProp = stripNamespace(String(gb.property));
    const groupDir = String((_a = gb == null ? void 0 : gb.direction) != null ? _a : "").toUpperCase() === "DESC" ? "desc" : "asc";
    const buckets = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const raw = getEntryProp(entry, groupProp);
      let label;
      if (raw == null || raw === "") label = "\u2014";
      else if (Array.isArray(raw))
        label = raw.map((v) => String(v)).join(", ") || "\u2014";
      else label = String(raw);
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(entry);
    }
    const sorted = Array.from(buckets.entries()).sort(
      ([a], [b]) => groupDir === "desc" ? b.localeCompare(a, void 0, { numeric: true }) : a.localeCompare(b, void 0, { numeric: true })
    );
    return sorted.map(([key, entries2]) => ({
      key,
      count: entries2.length,
      entries: entries2
    }));
  }
  getAllVaultColumnValues() {
    var _a;
    const prop = this.getColumnProp();
    const values = /* @__PURE__ */ new Set();
    const cache = this.obsApp.metadataCache;
    for (const file of this.obsApp.vault.getMarkdownFiles()) {
      const fm = (_a = cache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
      if (fm && prop in fm) {
        const val = fm[prop];
        if (val != null && String(val).trim() !== "") {
          values.add(String(val).trim());
        }
      }
    }
    return values;
  }
  buildColumns(entries) {
    const prop = this.getColumnProp();
    const buckets = /* @__PURE__ */ new Map();
    for (const key of this.getAllVaultColumnValues()) {
      buckets.set(key, []);
    }
    for (const entry of entries) {
      const val = getEntryProp(entry, prop);
      const key = val != null && String(val).trim() !== "" ? String(val).trim() : "\u2014";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => {
      if (a === "\u2014") return 1;
      if (b === "\u2014") return -1;
      return a.localeCompare(b, void 0, { numeric: true });
    }).map(([key, entries2]) => ({ key, entries: entries2 }));
  }
  // ── Render ─────────────────────────────────────────────────────────────
  render() {
    const results = this.controller.results;
    this.containerEl.empty();
    this.containerEl.addClass("btk-root");
    const maxH = this.getMaxHeight();
    if (maxH > 0) {
      this.containerEl.style.maxHeight = `${maxH}px`;
      this.containerEl.addClass("btk-clipped");
    } else {
      this.containerEl.style.maxHeight = "";
      this.containerEl.removeClass("btk-clipped");
    }
    if (!results || results.size === 0) {
      this.renderEmpty();
      return;
    }
    let entries = Array.from(results.values());
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
    const limit = this.getLimit();
    const limited = limit !== null ? entries.slice(0, limit) : entries;
    const vc = this.getViewConfig();
    const groups = this.buildGroups(limited, vc);
    const board = this.containerEl.createDiv("btk-board");
    if (groups) {
      board.addClass("btk-grouped");
      for (const group of groups) {
        this.renderGroupHeader(board, group.key, group.count);
        const groupBody = board.createDiv("btk-group-body");
        const columns = this.buildColumns(group.entries);
        for (const col of columns) {
          this.renderColumn(groupBody, col);
        }
      }
    } else {
      const columns = this.buildColumns(limited);
      for (const col of columns) {
        this.renderColumn(board, col);
      }
    }
  }
  renderGroupHeader(parent, key, count) {
    const header = parent.createDiv("btk-group-header");
    const label = header.createSpan("btk-group-label");
    this.renderValueInline(label, key);
    header.createSpan({
      cls: "btk-group-count",
      text: String(count)
    });
  }
  renderColumn(board, col) {
    const cardWidth = this.getCardWidth();
    const colorProp = this.getColorProp();
    const columnProp = this.getColumnProp();
    const orderedKeys = this.getVisibleProperties();
    const column = board.createDiv("btk-column");
    column.style.width = `${cardWidth}px`;
    column.style.minWidth = `${cardWidth}px`;
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.addClass("btk-col-drop");
    });
    column.addEventListener("dragleave", () => {
      column.removeClass("btk-col-drop");
    });
    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.removeClass("btk-col-drop");
      const filePath = e.dataTransfer.getData("text/plain");
      if (filePath) {
        this.moveCard(filePath, col.key);
      }
    });
    const sortSpec = this.getSort();
    if (sortSpec.length > 0) {
      col.entries = [...col.entries].sort((a, b) => {
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
    const header = column.createDiv("btk-column-header");
    header.createSpan({ cls: "btk-col-title", text: col.key });
    header.createSpan({
      cls: "btk-col-count",
      text: String(col.entries.length)
    });
    const cards = column.createDiv("btk-column-cards");
    if (col.entries.length === 0) {
      const empty = cards.createDiv("btk-col-empty");
      empty.setText("Drop here");
    }
    for (const entry of col.entries) {
      this.renderCard(
        cards,
        entry,
        columnProp,
        colorProp,
        orderedKeys
      );
    }
  }
  renderCard(parent, entry, columnProp, colorProp, orderedKeys) {
    var _a, _b, _c;
    const HIDDEN_ALWAYS = /* @__PURE__ */ new Set([
      "title",
      "aliases",
      "cssclasses",
      "cssclass"
    ]);
    const card = parent.createDiv("btk-card");
    card.setAttr("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", entry.file.path);
      card.addClass("btk-dragging");
    });
    card.addEventListener("dragend", () => {
      card.removeClass("btk-dragging");
    });
    if (colorProp) {
      const cv = getEntryProp(entry, colorProp);
      if (cv != null && String(cv).trim() !== "") {
        const bar = card.createDiv("btk-card-color-bar");
        bar.style.background = hashColor(String(cv));
      }
    }
    const coverDiv = card.createDiv("btk-card-cover");
    this.renderCover(coverDiv, entry);
    if (!coverDiv.hasChildNodes()) coverDiv.remove();
    const title = card.createDiv("btk-card-title");
    title.setText(entry.file.basename);
    title.addEventListener("click", () => {
      this.obsApp.workspace.openLinkText(
        entry.file.path,
        "",
        false
      );
    });
    if (orderedKeys.length > 0) {
      const props = card.createDiv("btk-card-props");
      for (const rawKey of orderedKeys) {
        const stripped = stripNamespace(rawKey);
        let val;
        if (rawKey.startsWith("formula.")) {
          val = getFormulaValue(entry, stripped);
        } else if (rawKey.startsWith("file.")) {
          val = getEntryProp(entry, rawKey);
        } else {
          val = (_c = (_a = entry.frontmatter) == null ? void 0 : _a[stripped]) != null ? _c : (_b = entry.frontmatter) == null ? void 0 : _b[rawKey];
          if (columnProp && stripped === columnProp) continue;
          if (HIDDEN_ALWAYS.has(stripped.toLowerCase()))
            continue;
        }
        if (val == null || val === "") continue;
        const row = props.createDiv("btk-card-prop-row");
        row.createSpan({
          cls: "btk-card-prop-key",
          text: stripped
        });
        row.createSpan({ cls: "btk-card-prop-sep", text: ": " });
        const valSpan = row.createSpan("btk-card-prop-val");
        this.renderValueInline(valSpan, String(val));
      }
    }
  }
  async moveCard(filePath, newValue) {
    const columnProp = this.getColumnProp();
    const file = this.obsApp.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian2.TFile)) return;
    await this.obsApp.fileManager.processFrontMatter(
      file,
      (fm) => {
        if (newValue === "\u2014") {
          delete fm[columnProp];
        } else {
          fm[columnProp] = newValue;
        }
      }
    );
  }
  resolveVaultImage(name, app) {
    var _a;
    let f = app.vault.getAbstractFileByPath(name);
    if (!f)
      f = (_a = app.vault.getFiles().find(
        (x) => x.name === name || x.basename === name
      )) != null ? _a : null;
    return f instanceof import_obsidian2.TFile && IMAGE_EXTS.has(f.extension.toLowerCase()) ? f : null;
  }
  renderCover(parent, entry) {
    const coverProp = this.getCoverProp();
    if (!coverProp) return;
    const raw = getEntryProp(entry, coverProp);
    if (raw == null) return;
    const str = String(raw).trim();
    if (str === "") return;
    const wikiMatch = str.match(/^\[\[([^\]|]+)/);
    if (wikiMatch) {
      const imgFile = this.resolveVaultImage(
        wikiMatch[1],
        entry.app
      );
      if (imgFile) {
        const img = parent.createEl("img", {
          cls: "btk-card-cover-img"
        });
        img.setAttr("draggable", "false");
        img.src = entry.app.vault.getResourcePath(imgFile);
        img.addEventListener("error", () => img.remove());
        return;
      }
    }
    if (str.startsWith("http://") || str.startsWith("https://")) {
      const img = parent.createEl("img", {
        cls: "btk-card-cover-img"
      });
      img.setAttr("draggable", "false");
      img.src = str;
      img.addEventListener("error", () => img.remove());
      return;
    }
    try {
      (0, import_obsidian2.setIcon)(
        parent.createDiv("btk-card-cover-icon"),
        str.replace(/^lucide-/, "")
      );
    } catch (e) {
    }
  }
  renderValueInline(parent, raw) {
    var _a;
    const wikiRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let last = 0;
    let hasLinks = false;
    let match;
    const frag = document.createDocumentFragment();
    while ((match = wikiRe.exec(raw)) !== null) {
      hasLinks = true;
      if (match.index > last)
        frag.appendChild(
          document.createTextNode(raw.slice(last, match.index))
        );
      const target = match[1].trim();
      const label = ((_a = match[2]) != null ? _a : match[1]).trim();
      const link = document.createElement("span");
      link.className = "btk-link";
      link.textContent = label;
      link.addEventListener("click", (e) => {
        e.stopPropagation();
        this.obsApp.workspace.openLinkText(target, "", false);
      });
      frag.appendChild(link);
      last = match.index + match[0].length;
    }
    if (!hasLinks) {
      parent.appendText(raw);
      return;
    }
    if (last < raw.length)
      frag.appendChild(
        document.createTextNode(raw.slice(last))
      );
    parent.appendChild(frag);
  }
  renderEmpty() {
    const empty = this.containerEl.createDiv("btk-empty");
    (0, import_obsidian2.setIcon)(empty.createSpan(), "columns-3");
    empty.createSpan({ text: " No results" });
  }
};

// src/main.ts
var ExtendedViewsPlugin = class extends import_obsidian3.Plugin {
  onload() {
    this.registerBasesView("timeline", {
      icon: "clock",
      name: "Timeline",
      factory: (controller, containerEl) => new TimelineView(this.app, controller, containerEl),
      options: () => [
        {
          displayName: "Layout",
          type: "group",
          items: [
            {
              displayName: "Zoom",
              type: "slider",
              key: "zoom",
              description: "Pixels per day column",
              min: 20,
              max: 200,
              step: 10,
              default: 60
            },
            {
              displayName: "Range padding",
              type: "slider",
              key: "padding",
              description: "Extra days before/after the date range",
              min: 0,
              max: 30,
              step: 1,
              default: 7
            }
          ]
        },
        {
          displayName: "Properties",
          type: "group",
          items: [
            {
              displayName: "Start date",
              type: "property",
              key: "startProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            },
            {
              displayName: "End date",
              type: "property",
              key: "endProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            },
            {
              displayName: "Bar color",
              type: "property",
              key: "colorProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            },
            {
              displayName: "Bar icon",
              type: "property",
              key: "iconProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            }
          ]
        }
      ]
    });
    this.registerBasesView("kanban", {
      icon: "columns-3",
      name: "Kanban",
      factory: (controller, containerEl) => new KanbanView(this.app, controller, containerEl),
      options: () => [
        {
          displayName: "Layout",
          type: "group",
          items: [
            {
              displayName: "Card width",
              type: "slider",
              key: "cardWidth",
              description: "Column and card width in pixels",
              min: 200,
              max: 400,
              step: 20,
              default: 280
            },
            {
              displayName: "Max height",
              type: "slider",
              key: "maxHeight",
              description: "Limit board height (0 = auto, else px)",
              min: 0,
              max: 2e3,
              step: 50,
              default: 0
            }
          ]
        },
        {
          displayName: "Properties",
          type: "group",
          items: [
            {
              displayName: "Column property",
              type: "property",
              key: "columnProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            },
            {
              displayName: "Cover image",
              type: "property",
              key: "coverProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            },
            {
              displayName: "Card color",
              type: "property",
              key: "colorProp",
              filter: (prop) => !prop.startsWith("file."),
              placeholder: "Property"
            }
          ]
        }
      ]
    });
  }
  onunload() {
  }
};
