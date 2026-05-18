import type { BasesEntry } from "./types";

// ── Namespace ───────────────────────────────────────────────────────────────

export function stripNamespace(s: string): string {
  return s.replace(/^(note|formula|implicit|file)\./, "");
}

// ── Date ────────────────────────────────────────────────────────────────────

export function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (s === "") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function midnight(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function dayDiff(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86400000;
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Comparison ──────────────────────────────────────────────────────────────

export function compareValues(a: unknown, b: unknown): number {
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

// ── Entry property access ───────────────────────────────────────────────────

export function getEntryProp(entry: BasesEntry, prop: string): unknown {
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

// ── Formula access ──────────────────────────────────────────────────────────

export function getFormulaValue(
  entry: BasesEntry,
  name: string
): string | undefined {
  const e = entry as unknown as Record<string, unknown>;
  const fr = e.formulaResults as Record<string, unknown> | undefined;

  if (fr && typeof fr.getFormulaValue === "function") {
    try {
      const tv = (fr.getFormulaValue as Function)(name);
      if (tv != null) {
        const str =
          typeof tv.toString === "function" ? tv.toString() : String(tv);
        if (str !== "null" && str !== "undefined") return str;
      }
    } catch {
      /* ignore */
    }
  }

  const formulas = fr?.formulas as Record<string, unknown> | undefined;
  if (formulas) {
    const fo = (formulas[name] ??
      Object.entries(formulas).find(
        ([k]) => k.toLowerCase() === name.toLowerCase()
      )?.[1]) as Record<string, unknown> | undefined;
    if (fo && typeof fo.getValue === "function") {
      try {
        const tv = (fo.getValue as Function)(entry);
        if (tv != null) {
          const str =
            typeof tv.toString === "function" ? tv.toString() : String(tv);
          if (str !== "null" && str !== "undefined") return str;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return undefined;
}

// ── Color ───────────────────────────────────────────────────────────────────

export function hashColor(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 50%, 50%)`;
}
