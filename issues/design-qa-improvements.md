# Design QA Improvement Plan

> Date: 2026-02-25
> Current Avg Fidelity: 73.4% (0 PASS / 7 NEEDS_REVIEW / 4 FAIL)
> Target: >= 90% PASS on all 11 screens

## Global Fixes (affect all 11 screens)

### G1. Import Plus Jakarta Sans
- **File**: `app/src/app/layout.tsx`
- **Impact**: Typography +10~15pts across all 11 screens
- **Action**: Add `Plus_Jakarta_Sans` to Google Fonts import, define `font-jakarta` CSS utility

### G2. Add Branded Logo Icon
- **Files**: `app/src/components/admin/sidebar.tsx`, `app/src/components/client/navbar.tsx`
- **Impact**: Layout +5~10pts across 8 screens
- **Action**: Import `Layers` from lucide-react, add `w-8 h-8 bg-primary rounded-lg` icon block

### G3. Admin Layout Padding p-8 -> p-10
- **File**: `app/src/app/admin/layout.tsx`
- **Impact**: Spacing +5pts across 6 admin screens
- **Action**: Change `p-8` to `p-10`

### G4. Table Cell Padding px-4 py-3 -> px-6 py-4
- **Files**: admin-projects, admin-feedback pages
- **Impact**: Spacing +5pts on table screens
- **Action**: Update `<th>` and `<td>` padding

### G5. Table Header Font Weight font-medium -> font-semibold
- **Files**: admin-projects, admin-feedback pages
- **Impact**: Typography +3pts on table screens

## Per-Screen Fixes

### S1. login / index (76.0% / 78.5% -> target 90%+)
- Move heading+subtitle inside card
- Add indigo logo icon (Layers, w-12 h-12)
- Add input icons (User, Lock from lucide-react)
- Add footer admin link with border-t separator
- Change heading text-3xl -> text-2xl
- Change heading text to "Welcome to ReviewBoard"
- Add active:scale-[0.98] to submit button
- Add shadow-lg shadow-primary/20 to button

### S2. admin-dashboard (71.3% -> target 90%+)
- Add "New Project" button in header (bg-primary, shadow-lg)
- Add subtitle "Overview of all active projects and feedback status."
- Restructure stat cards: label/number left, icon top-right, trend bottom
- Add per-card colors (purple for feedback, red for open, green for resolved)
- Change heading mb-6 -> mb-8, stats mb-8 -> mb-10
- Change heading text-2xl -> text-3xl
- Add "View All" link in Recent Activity header

### S3. admin-projects (74.5% -> target 90%+)
- Match column order: Checkbox, Name, Slack, Client ID, Created, Screens, Open Feedback, Actions
- Add header subtitle "Manage client projects and access credentials."
- Replace text action links with hover-revealed icon buttons (Eye, Trash2)
- Add row cursor-pointer and group-hover:text-primary on project name
- Style Slack channel as badge (bg-slate-100 rounded)
- Style open feedback as pill badge (bg-red-100 text-red-800 rounded-full)
- Add shadow-lg shadow-indigo-500/20 to "New Project" button
- Change rounded-2xl -> rounded-xl on table container

### S4. admin-project-details (65.8% -> target 90%+) [FAIL]
- Change grid lg:grid-cols-3 -> lg:grid-cols-4
- Change aspect-video -> aspect-[9/16]
- Remove editable project info form (not in mockup)
- Add dashed "Add Screen" placeholder card
- Add search/filter toolbar
- Add hover overlay (bg-black/50 with refresh + delete icons)
- Remove max-w-5xl constraint
- Display actual project name as h1
- Show Client ID and Slack inline metadata

### S5. admin-feedback-manager (69.7% -> target 90%+) [FAIL]
- Restore 6-column table: Pin, Comment, Context, Status, Date, Action
- Pin column: colored circles with numbers (not plain text)
- Replace filter toggle buttons with two select dropdowns
- Wrap filters in white card container
- Change "View" button to "View & Reply" text link with hover:underline
- Adjust status text colors to -700 variants
- Add status colored borders to select elements
- Change heading to "Feedback Manager"

### S6. admin-sidebar (76.5% -> target 90%+)
- Add logo icon (Layers in indigo square) [covered by G2]
- Restore header to h-16 with border-b border-white/5
- Remove "Admin Dashboard" subtitle
- Add "Team" nav item (Users icon)
- Add User Profile section at bottom (avatar, name, email, logout icon)
- Change nav item rounded-xl -> rounded-lg
- Add group-hover:text-primary on nav icons

### S7. client-dashboard (76.8% -> target 90%+)
- Change max-w-7xl -> max-w-6xl in client layout
- Change heading "My Projects" -> "Assigned Projects"
- Add subtitle "Select a project to view designs and leave feedback."
- Add project description field with line-clamp-2 to cards
- Add border-t border-slate-100 pt-4 separator in card stats
- Move "Updated" timestamp below stats with mt-4
- Change hover:shadow-lg -> hover:shadow-xl + duration-300
- Add left-edge indigo indicator bar on card hover
- Change card title font-semibold -> font-bold

### S8. client-screen-list (69.8% -> target 90%+) [FAIL]
- Change grid lg:grid-cols-3 -> lg:grid-cols-4, add sm:grid-cols-2
- Change aspect-video -> aspect-[9/16]
- Add dark hover overlay with "View Design" slide-up button
- Add metadata row (last-updated, screen count, feedback pill)
- Update CountBadge to solid style (bg-red-500 text-white)
- Add border-t border-slate-100 to card meta section
- Remove group-hover:scale-105 zoom effect

### S9. client-feedback-viewer (79.3% -> target 90%+)
- Increase sidebar w-80 -> w-96
- Add "Click anywhere to comment" CTA badge
- Wrap image in fixed-width centered container with shadow
- Add status-specific bg/border colors to comment cards
- Add count badge pill next to "Feedback" heading
- Convert comment list from divide-y to card-based with space-y-4
- Update pin animation to bouncy cubic-bezier

### S10. client-navbar (69.4% -> target 90%+) [FAIL]
- Add logo icon [covered by G2]
- Add "Client Mode" label (text-sm text-muted hidden sm:block)
- Change <header> to <nav> with aria-label
- Change brand text-primary -> text-foreground, text-xl -> text-lg, add tracking-tight
- Change logout hover:text-foreground -> hover:text-red-600
- Add font-medium to logout button

## Estimated Post-Fix Targets

| Screen | Current | Target |
|--------|---------|--------|
| index | 78.5% | 92%+ |
| login | 76.0% | 92%+ |
| admin-dashboard | 71.3% | 90%+ |
| admin-projects | 74.5% | 90%+ |
| admin-project-details | 65.8% | 90%+ |
| admin-feedback-manager | 69.7% | 90%+ |
| admin-sidebar | 76.5% | 92%+ |
| client-dashboard | 76.8% | 92%+ |
| client-screen-list | 69.8% | 90%+ |
| client-feedback-viewer | 79.3% | 92%+ |
| client-navbar | 69.4% | 92%+ |
