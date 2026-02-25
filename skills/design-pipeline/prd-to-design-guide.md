---
description: Convert PRD to a Design Guide for designers
argument-hint: "<prd-path>"
---

# PRD to Design Guide

Convert any PRD into a comprehensive Design Guide ready for a designer (human or AI tool).

## Workflow

1. **Read PRD**: Read the specified PRD file thoroughly
2. **Extract basic info**: Project name, version, platform, user types, total pages
3. **Define design philosophy**: Find reference apps, derive inspiration, create 3-4 design pillars
4. **Create design system**: Colors, typography, spacing, components
5. **Convert pages to design briefs**: Layout + component descriptions per page
6. **Create component patterns**: Reusable component specifications
7. **Output Design Guide**: Write to `design/design-guide.md`

## Extraction Phases

### Phase 1: Basic Information

| Information | Where to Find | Variable |
|-------------|---------------|----------|
| Project Name | PRD title/header | `[PROJECT_NAME]` |
| Project Type | App type section | `[TYPE]` |
| Target Platform | Platform section | `[PLATFORM]` |
| User Types | User roles section | `[USER_TYPES]` |
| Total Pages | Page breakdown | `[TOTAL_PAGES]` |
| Timeline | Timeline section | `[TIMELINE]` |

### Phase 2: Design Philosophy

Pattern-match PRD features to design references:

| PRD Feature | Design Reference |
|-------------|-----------------|
| Upvoting system | Product Hunt |
| Threaded comments | Reddit |
| Card-based feed | LinkedIn |
| Dashboard/analytics | Stripe, Linear |
| Social feed/posts | Instagram, Twitter |
| Kanban board | Trello, Asana |
| Chat/messaging | Slack, Discord |
| Calendar/scheduling | Google Calendar |
| E-commerce/cart | Shopify |

Create 3-4 design pillars based on key features.

### Phase 3: Design System

Extract from PRD or derive sensible defaults:

| Token | Example |
|-------|---------|
| Primary Color | `#0077B6` |
| Secondary Color | `#00B4D8` |
| Success / Warning / Error | `#10B981` / `#F59E0B` / `#EF4444` |
| Background / Surface | `#FFFFFF` / `#F9FAFB` |
| Font Family | Inter, SF Pro Display |
| Base Spacing | 4px |
| Border Radius | 8px (card), 6px (button) |
| Shadow | `0 1px 3px rgba(0,0,0,0.1)` |
| Icons | Lucide Icons |

### Phase 4: Page Design Briefs

For each page in the PRD:
1. Page name and category (auth, user, admin, public)
2. Layout description (sidebar + content, header + main, etc.)
3. Key components and their behavior
4. Responsive considerations
5. State variations (empty, loading, error)

### Phase 5: Component Patterns

Extract reusable patterns:
- Navigation (sidebar, header, breadcrumbs)
- Forms (input groups, validation states)
- Cards (content cards, stat cards)
- Tables (sortable, filterable)
- Modals and dialogs
- Notifications and toasts

## Output

Write the complete Design Guide to `design/design-guide.md` with sections:
1. Project Overview
2. Design Philosophy & References
3. Design System (tokens, colors, typography, spacing)
4. Page-by-Page Design Briefs
5. Component Patterns
6. Responsive Strategy
7. Deliverables Checklist

## Rules

- Design tokens go in `design/design-guide.md`, not in code config (that's ui-builder's job)
- Reference PRD Section 9 (UI Specifications) if it exists
- Follow kebab-case file naming for all design assets
- Output one file — the design guide should be self-contained

## Error Handling

- PRD not found at specified path: **STOP** and ask user
- PRD has no page breakdown: derive pages from feature descriptions
- PRD is in non-English language: follow the PRD's language for the guide

## Related

- Next step: `prd-to-design-prompts` or `design-guide-to-aura-prompts`
- UI implementation: `ui-builder` agent
