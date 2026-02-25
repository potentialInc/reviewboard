# Design QA Report

**Date**: 2026-02-25
**Design Source**: HTML prototypes (mockups/)
**Mode**: full

## Results

| Screen | Status | Fidelity | Layout | Colors | Typo | Spacing | Interact | A11y |
|--------|--------|----------|--------|--------|------|---------|----------|------|
| index | NEEDS_REVIEW | 78.5% | 72 | 88 | 75 | 80 | 82 | 78 |
| login | NEEDS_REVIEW | 76.0% | 68 | 88 | 72 | 80 | 70 | 82 |
| admin-dashboard | NEEDS_REVIEW | 71.3% | 62 | 82 | 68 | 75 | 70 | 78 |
| admin-projects | NEEDS_REVIEW | 74.5% | 68 | 88 | 72 | 75 | 62 | 82 |
| admin-project-details | FAIL | 65.8% | 55 | 82 | 72 | 65 | 45 | 78 |
| admin-feedback-manager | FAIL | 69.7% | 62 | 78 | 75 | 70 | 65 | 72 |
| admin-sidebar | NEEDS_REVIEW | 76.5% | 68 | 90 | 72 | 75 | 82 | 78 |
| client-dashboard | NEEDS_REVIEW | 76.8% | 72 | 88 | 75 | 70 | 80 | 78 |
| client-screen-list | FAIL | 69.8% | 62 | 78 | 72 | 75 | 55 | 80 |
| client-feedback-viewer | NEEDS_REVIEW | 79.3% | 72 | 88 | 82 | 75 | 85 | 80 |
| client-navbar | FAIL | 69.4% | 65 | 78 | 60 | 85 | 70 | 55 |

## Summary

| Metric | Value |
|--------|-------|
| Screens Tested | 11 |
| Passed (>=90%) | 0 |
| Needs Review | 7 |
| Failed (<70%) | 4 |
| Average Fidelity | 73.4% |

## Cross-Cutting Issues (all screens)

### 1. Plus Jakarta Sans Not Loaded (Typography -15~25pts across all screens)
Plus Jakarta Sans is referenced in every mockup for headings and brand text but is never imported in the Next.js app. Only Inter is loaded. This single fix would lift typography scores by 10-15 points across all 11 screens.

**Fix**: Add `Plus Jakarta Sans` to the Google Fonts import in `app/src/app/layout.tsx` and define a `font-jakarta` utility class in `globals.css`.

### 2. Missing Branded Logo Icon (Layout -5~10pts across 8 screens)
The indigo square with Layers Lucide icon (`w-8 h-8 bg-primary rounded-lg`) appears in every mockup's sidebar and navbar, but is absent from both `sidebar.tsx` and `navbar.tsx`.

**Fix**: Import `Layers` from `lucide-react` and add the icon block to the sidebar header and client navbar brand area.

### 3. Main Content Padding p-8 vs p-10 (Spacing -5pts across 6 admin screens)
The admin layout uses `p-8` (32px) while mockups consistently use `p-10` (40px).

**Fix**: Change `p-8` to `p-10` in `app/src/app/admin/layout.tsx`.

### 4. Table Cell Padding px-4 py-3 vs px-6 py-4 (Spacing, admin tables)
Admin table cells are tighter than mockups specify.

**Fix**: Update `<th>` and `<td>` padding in admin-projects and admin-feedback pages.

### 5. Breadcrumb Added to All Pages (Layout, not in any mockup)
A Breadcrumb component was added to every page that does not exist in any mockup. This is an enhancement that should be explicitly documented as intentional or removed.

## Failures (actionable fixes)

### admin-project-details -- 65.8%

- **Layout (55)**: Grid is 3-col (`lg:grid-cols-3`) vs mockup's 4-col. An editable project info form was added that does not exist in the mockup. The dashed "Add Screen" placeholder card is missing. Screen thumbnails use `aspect-video` (16:9) instead of portrait `aspect-[9/16]`.
- **Interactions (45)**: The mockup's hover overlay (`bg-black/50` with "Update Version" and "Delete" icon buttons) is entirely absent. Implementation shows persistent footer buttons instead of progressive-disclosure hover actions.
- **Spacing (65)**: `max-w-5xl` constraint not in mockup. Header margin `mb-6` vs `mb-8`. Missing search/filter toolbar adds vertical spacing gap.

### admin-feedback-manager -- 69.7%

- **Layout (62)**: Table restructured from 6 to 8 columns. Detail panel changed from centered split-view modal to side drawer. Filter controls changed from dropdowns to toggle buttons, removing the project filter.
- **Interactions (65)**: "View & Reply" link changed to "View" button with different hover style. Status dropdown hover transitions missing. Modal open/close animations absent.
- **Accessibility (72)**: Search input, status selects, and pagination buttons lack aria-labels. Filter toggles lack `aria-pressed`.

### client-screen-list -- 69.8%

- **Layout (62)**: Grid 3-col vs 4-col. `aspect-video` vs `aspect-[9/16]` portrait ratio -- the most visually impactful deviation. Missing metadata row (last-updated, screen count, feedback pill).
- **Interactions (55)**: Mockup's dark hover overlay with "View Design" slide-up button is missing. Implementation uses zoom-scale instead.
- **Colors (78)**: `CountBadge` uses pastel `bg-red-100 text-red-700` instead of solid `bg-red-500 text-white` badges.

### client-navbar -- 69.4%

- **Layout (65)**: Missing logo icon block and "Client Mode" label. Uses `<header>` instead of `<nav>`.
- **Typography (60)**: Brand text uses Inter instead of Plus Jakarta Sans, `text-xl` instead of `text-lg`, missing `tracking-tight`.
- **Colors (78)**: Brand text is `text-primary` (indigo) instead of `text-foreground` (dark). Logout hover is dark instead of red.
- **Accessibility (55)**: No `aria-label` on the nav landmark. No `aria-label` on the logout button.

## Recommended Fix Priority

1. **Global: Import Plus Jakarta Sans** -- lifts all 11 screens
2. **Global: Add branded logo icon** -- fixes sidebar + navbar across 8 screens
3. **Global: Adjust admin layout padding** -- fixes spacing on 6 screens
4. **admin-project-details: Restructure grid/cards** -- highest FAIL severity
5. **client-screen-list: Fix grid + aspect ratio** -- second highest visual impact
6. **admin-feedback-manager: Restore modal + table structure** -- third FAIL
7. **client-navbar: Fix semantic element + colors + typography** -- fourth FAIL
8. **Per-screen: Individual layout/interaction fixes** -- incremental improvements
