# Project Tables Design

**Date:** 2026-03-01
**Status:** Implemented

## Overview

Notion-style inline tables attached to project spaces. Multiple tables per project, each with typed columns (text/url), ordered rows, and per-cell values. Fills the gap between the Kanban board (task tracking) and freeform structured data.

## Data Model

Four tables in Supabase:

| Table | Key columns |
|-------|------------|
| `project_tables` | `id, project_id, name, position` |
| `project_table_columns` | `id, table_id, project_id, name, type, position` |
| `project_table_rows` | `id, table_id, project_id, position` |
| `project_table_cells` | `id, row_id, column_id, project_id, value, updated_at` — UNIQUE(row_id, column_id) |

All tables cascade-delete from parent. `project_id` is denormalised into columns/rows/cells to simplify RLS ownership checks.

## RLS Policy Pattern

- Public SELECT via `USING (true)`
- Owner ALL via `EXISTS (SELECT 1 FROM projects WHERE projects.id = project_id AND projects.user_id = auth.uid())`

## API Routes

| Method | Path | Action |
|--------|------|--------|
| POST | `/api/projects/[id]/tables` | Create table |
| PATCH | `/api/projects/[id]/tables/[tableId]` | Rename table |
| DELETE | `/api/projects/[id]/tables/[tableId]` | Delete table (cascades) |
| POST | `/api/projects/[id]/tables/[tableId]/columns` | Add column |
| POST | `/api/projects/[id]/tables/[tableId]/rows` | Add row |
| PATCH | `/api/table-columns/[columnId]` | Rename column |
| DELETE | `/api/table-columns/[columnId]` | Delete column (cascades cells) |
| DELETE | `/api/table-rows/[rowId]` | Delete row (cascades cells) |
| PUT | `/api/table-cells/[rowId]/[columnId]` | Upsert cell value |

All routes use `createSupabaseAdmin() as any` + `auth()` ownership checks, consistent with existing board routes.

## Component Architecture

`ProjectTables` (client component) → `ProjectTableItem` → `ColumnHeader` + `Cell`

### State management
- Single `tables` array in `ProjectTables`
- Optimistic updates for all mutations; rollback on failure
- Cell saves debounced 400ms via `PUT /api/table-cells/...`

### Cell editing
- Click to edit (owner only)
- `onBlur` → commit; `Escape` → revert; `Tab` → next cell
- URL columns: display as `<a>` when not editing; auto-prepend `https://` on commit

### Column types (V1)
- `text` — plain text input
- `url` — text input when editing; clickable anchor when not editing

## Rendering

Inserted between Kanban and ProjectTabs in the project page. Hidden for non-owners when no tables exist.

Data fetched server-side via Supabase nested select with ordered joins; normalised into `ProjectTable[]` before passing to component.

## Styling

Follows Kanban palette: `#f5f0e8` headers, `#e8ddd0` borders, `#b5522a` accent/links, `rounded-xl` containers.
