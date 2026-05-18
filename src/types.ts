import { TFile } from "obsidian";

// ── BasesEntry ──────────────────────────────────────────────────────────────

export interface BasesEntry {
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
