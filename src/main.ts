import { Plugin } from "obsidian";
import { TimelineView } from "./TimelineView";

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
    // TODO: register kanban view in Phase 1
  }

  onunload() {}
}
