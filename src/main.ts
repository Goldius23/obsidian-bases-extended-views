import { Plugin } from "obsidian";
import { TimelineView } from "./TimelineView";
import { KanbanView } from "./KanbanView";

// ── Extended Views Plugin ───────────────────────────────────────────────────

export default class ExtendedViewsPlugin extends Plugin {
  onload() {
    // ── Timeline view ──
    // @ts-ignore — registerBasesView not in public typings yet
    this.registerBasesView("timeline", {
      icon: "clock",
      name: "Timeline",
      factory: (controller: unknown, containerEl: HTMLElement) =>
        new TimelineView(this.app, controller, containerEl),
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
              default: 60,
            },
            {
              displayName: "Range padding",
              type: "slider",
              key: "padding",
              description: "Extra days before/after the date range",
              min: 0,
              max: 30,
              step: 1,
              default: 7,
            },
          ],
        },
        {
          displayName: "Properties",
          type: "group",
          items: [
            {
              displayName: "Start date",
              type: "property",
              key: "startProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
            {
              displayName: "End date",
              type: "property",
              key: "endProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
            {
              displayName: "Bar color",
              type: "property",
              key: "colorProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
            {
              displayName: "Bar icon",
              type: "property",
              key: "iconProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
          ],
        },
      ],
    });

    // ── Kanban view ──
    // @ts-ignore
    this.registerBasesView("kanban", {
      icon: "columns-3",
      name: "Kanban",
      factory: (controller: unknown, containerEl: HTMLElement) =>
        new KanbanView(this.app, controller, containerEl),
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
              default: 280,
            },
            {
              displayName: "Compact mode",
              type: "slider",
              key: "compact",
              description: "Tighter card spacing (0=normal, 1=compact)",
              min: 0,
              max: 1,
              step: 1,
              default: 0,
            },
            {
              displayName: "Max height",
              type: "slider",
              key: "maxHeight",
              description: "Limit board height (0 = auto, else px)",
              min: 0,
              max: 2000,
              step: 50,
              default: 0,
            },
          ],
        },
        {
          displayName: "Properties",
          type: "group",
          items: [
            {
              displayName: "Column property",
              type: "property",
              key: "columnProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
            {
              displayName: "Cover image",
              type: "property",
              key: "coverProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
            {
              displayName: "Card color",
              type: "property",
              key: "colorProp",
              filter: (prop: string) => !prop.startsWith("file."),
              placeholder: "Property",
            },
          ],
        },
      ],
    });
  }

  onunload() {}
}
