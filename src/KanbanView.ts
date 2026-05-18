import { Component, App, TFile, setIcon } from "obsidian";
import type { BasesEntry } from "./types";
import {
  stripNamespace,
  compareValues,
  getEntryProp,
  getFormulaValue,
  hashColor,
} from "./helpers";

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif",
]);

// ── KanbanView ──────────────────────────────────────────────────────────────

export class KanbanView extends Component {
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
    const raw = vc?.sort;
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[])
      .map((o) => ({
        prop:
          typeof o.property === "string"
            ? stripNamespace(o.property)
            : "",
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

  getColumnProp(): string {
    return this.getConfigProp("columnProp") || "status";
  }

  getCoverProp(): string {
    return this.getConfigProp("coverProp");
  }

  getColorProp(): string {
    return this.getConfigProp("colorProp");
  }

  getCardWidth(): number {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.cardWidth;
    if (typeof raw === "number") return Math.max(160, raw);
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return Math.max(160, n);
    }
    return 280;
  }

  getMaxHeight(): number {
    const vc = this.getViewConfig();
    const data = vc?.data as Record<string, unknown> | undefined;
    const raw = data?.maxHeight;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
      const n = parseFloat(raw);
      if (!isNaN(n)) return n;
    }
    return 0;
  }

  // ── Column building ────────────────────────────────────────────────────

  private getAllVaultColumnValues(): Set<string> {
    const prop = this.getColumnProp();
    const values = new Set<string>();
    const cache = this.obsApp.metadataCache;

    for (const file of this.obsApp.vault.getMarkdownFiles()) {
      const fm = cache.getFileCache(file)?.frontmatter;
      if (fm && prop in fm) {
        const val = fm[prop];
        if (val != null && String(val).trim() !== "") {
          values.add(String(val).trim());
        }
      }
    }

    return values;
  }

  private buildColumns(
    entries: BasesEntry[]
  ): { key: string; entries: BasesEntry[] }[] {
    const prop = this.getColumnProp();
    const buckets = new Map<string, BasesEntry[]>();

    // Seed every vault-wide value as an empty column
    for (const key of this.getAllVaultColumnValues()) {
      buckets.set(key, []);
    }

    // Fill with current results
    for (const entry of entries) {
      const val = getEntryProp(entry, prop);
      const key =
        val != null && String(val).trim() !== ""
          ? String(val).trim()
          : "—";
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(entry);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => {
        if (a === "—") return 1;
        if (b === "—") return -1;
        return a.localeCompare(b, undefined, { numeric: true });
      })
      .map(([key, entries]) => ({ key, entries }));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render() {
    const results = this.controller.results as
      | Map<TFile, BasesEntry>
      | undefined;
    this.containerEl.empty();
    this.containerEl.addClass("btk-root");

    // Max height — clip and scroll board vertically
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

    const limit = this.getLimit();
    const limited = limit !== null ? entries.slice(0, limit) : entries;

    const columns = this.buildColumns(limited);

    // ── Board ──
    const board = this.containerEl.createDiv("btk-board");
    for (const col of columns) {
      this.renderColumn(board, col);
    }
  }

  private renderColumn(
    board: HTMLElement,
    col: { key: string; entries: BasesEntry[] }
  ) {
    const cardWidth = this.getCardWidth();
    const colorProp = this.getColorProp();
    const columnProp = this.getColumnProp();
    const orderedKeys = this.getVisibleProperties();

    const column = board.createDiv("btk-column");
    column.style.width = `${cardWidth}px`;
    column.style.minWidth = `${cardWidth}px`;

    // Drop zone events
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
      const filePath = e.dataTransfer!.getData("text/plain");
      if (filePath) {
        this.moveCard(filePath, col.key);
      }
    });

    // Sort entries within this column
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

    // Column header
    const header = column.createDiv("btk-column-header");
    header.createSpan({ cls: "btk-col-title", text: col.key });
    header.createSpan({
      cls: "btk-col-count",
      text: String(col.entries.length),
    });

    // Cards
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

  private renderCard(
    parent: HTMLElement,
    entry: BasesEntry,
    columnProp: string,
    colorProp: string,
    orderedKeys: string[]
  ) {
    const HIDDEN_ALWAYS = new Set([
      "title",
      "aliases",
      "cssclasses",
      "cssclass",
    ]);

    const card = parent.createDiv("btk-card");
    card.setAttr("draggable", "true");

    // Drag start → store file path and mark as dragging
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer!.setData("text/plain", entry.file.path);
      card.addClass("btk-dragging");
    });
    card.addEventListener("dragend", () => {
      card.removeClass("btk-dragging");
    });

    // Color bar
    if (colorProp) {
      const cv = getEntryProp(entry, colorProp);
      if (cv != null && String(cv).trim() !== "") {
        const bar = card.createDiv("btk-card-color-bar");
        bar.style.background = hashColor(String(cv));
      }
    }

    // Cover image
    const coverDiv = card.createDiv("btk-card-cover");
    this.renderCover(coverDiv, entry);
    if (!coverDiv.hasChildNodes()) coverDiv.remove();

    // Title
    const title = card.createDiv("btk-card-title");
    title.setText(entry.file.basename);
    title.addEventListener("click", () => {
      this.obsApp.workspace.openLinkText(
        entry.file.path,
        "",
        false
      );
    });

    // Properties
    if (orderedKeys.length > 0) {
      const props = card.createDiv("btk-card-props");
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
          if (columnProp && stripped === columnProp) continue;
          if (
            HIDDEN_ALWAYS.has(stripped.toLowerCase())
          )
            continue;
        }
        if (val == null || val === "") continue;
        const row = props.createDiv("btk-card-prop-row");
        row.createSpan({
          cls: "btk-card-prop-key",
          text: stripped,
        });
        row.createSpan({ cls: "btk-card-prop-sep", text: ": " });
        const valSpan = row.createSpan("btk-card-prop-val");
        this.renderValueInline(valSpan, String(val));
      }
    }
  }

  private async moveCard(filePath: string, newValue: string) {
    const columnProp = this.getColumnProp();
    const file = this.obsApp.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    await this.obsApp.fileManager.processFrontMatter(
      file,
      (fm: Record<string, unknown>) => {
        if (newValue === "—") {
          delete fm[columnProp];
        } else {
          fm[columnProp] = newValue;
        }
      }
    );
    // Bases detects the file change → re-runs query → calls onDataUpdated() → render()
  }

  private resolveVaultImage(
    name: string,
    app: BasesEntry["app"]
  ): TFile | null {
    let f = app.vault.getAbstractFileByPath(name);
    if (!f)
      f =
        app.vault
          .getFiles()
          .find(
            (x) => x.name === name || x.basename === name
          ) ?? null;
    return f instanceof TFile &&
      IMAGE_EXTS.has(f.extension.toLowerCase())
      ? f
      : null;
  }

  private renderCover(parent: HTMLElement, entry: BasesEntry) {
    const coverProp = this.getCoverProp();
    if (!coverProp) return;

    const raw = getEntryProp(entry, coverProp);
    if (raw == null) return;

    const str = String(raw).trim();
    if (str === "") return;

    // Wikilink to vault image
    const wikiMatch = str.match(/^\[\[([^\]|]+)/);
    if (wikiMatch) {
      const imgFile = this.resolveVaultImage(
        wikiMatch[1],
        entry.app
      );
      if (imgFile) {
        const img = parent.createEl("img", {
          cls: "btk-card-cover-img",
        });
        img.setAttr("draggable", "false");
        img.src = entry.app.vault.getResourcePath(imgFile);
        img.addEventListener("error", () => img.remove());
        return;
      }
    }

    // HTTP URL to image
    if (str.startsWith("http://") || str.startsWith("https://")) {
      const img = parent.createEl("img", {
        cls: "btk-card-cover-img",
      });
      img.setAttr("draggable", "false");
      img.src = str;
      img.addEventListener("error", () => img.remove());
      return;
    }

    // Plain text — try as Lucide icon name
    try {
      setIcon(
        parent.createDiv("btk-card-cover-icon"),
        str.replace(/^lucide-/, "")
      );
    } catch {
      // not a valid icon, skip
    }
  }

  private renderValueInline(parent: HTMLElement, raw: string) {
    const wikiRe = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let last = 0;
    let hasLinks = false;
    let match: RegExpExecArray | null;
    const frag = document.createDocumentFragment();

    while ((match = wikiRe.exec(raw)) !== null) {
      hasLinks = true;
      if (match.index > last)
        frag.appendChild(
          document.createTextNode(raw.slice(last, match.index))
        );
      const target = match[1].trim();
      const label = (match[2] ?? match[1]).trim();
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

  private renderEmpty() {
    const empty = this.containerEl.createDiv("btk-empty");
    setIcon(empty.createSpan(), "columns-3");
    empty.createSpan({ text: " No results" });
  }
}
