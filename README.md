# Bases Extended Views

Extended views for [Obsidian](https://obsidian.md/) Bases. Currently ships with the **Timeline** view — more views planned.

## Timeline View

A horizontal Gantt-style timeline that renders entries with `start_date` and `end_date` properties, with full Bases integration.

### Features

- Horizontal bars spanning from start to end date
- Milestone diamonds for entries without an end date
- Fixed left sidebar showing entry title and selected properties
- Full Sort, Filter, Group by, and Properties panel integration
- Configurable zoom (px/day) and date range padding
- Date range presets: Auto, 3 months, 6 months, 1 year
- Weekend column shading and today marker
- Bar coloring from any property value (HSL hash)
- Lucide icons on bars from any property value
- Compact layout toggle for dense views
- Synchronized horizontal and vertical scrolling
- Click bars to open the note

### Requirements

Obsidian 1.10.0+ (Bases API)

### Installation

1. Extract to `<vault>/.obsidian/plugins/bases-extended-views/`
2. Enable in Settings → Community Plugins
3. Add `type: timeline` to any `.base` file's views list
4. Configure the start/end date properties in the Configure view panel
