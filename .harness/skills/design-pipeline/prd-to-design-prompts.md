---
description: Convert PRD directly to AURA.build compatible design prompts
argument-hint: "<prd-path>"
---

# PRD to Design Prompts

Fast path: Convert a PRD directly into AURA.build compatible prompts (skips design guide).

## Workflow

1. **Read PRD** at the specified path
2. **Extract design system** variables (colors, fonts, spacing)
3. **Extract pages** from PRD's page breakdown or feature specs
4. **Generate prompts file** with design system prefix + per-page prompts
5. **Write output** to `design/aura-prompts.md`

## Template Variables

Extract these from the PRD (or derive sensible defaults):

| Variable | Description | Example |
|----------|-------------|---------|
| `[PROJECT_NAME]` | Application name | MediCare+, ShopEase |
| `[TYPE]` | Application type | Web Application, Mobile App |
| `[STYLE]` | Design style | Modern SaaS, Minimal, Corporate |
| `[PRIMARY_COLOR]` | Main brand color | #0077B6 |
| `[SECONDARY_COLOR]` | Supporting color | #00B4D8 |
| `[FONT_FAMILY]` | Primary font | Inter, Poppins |
| `[ICONS]` | Icon library | Lucide Icons, Heroicons |

## Output Format

```markdown
---
project_name: "[PROJECT_NAME]"
total_pages: [COUNT]
design_system:
  type: "[TYPE]"
  style: "[STYLE]"
  primary_color: "[PRIMARY_COLOR]"
  secondary_color: "[SECONDARY_COLOR]"
  font: "[FONT_FAMILY]"
  icons: "[ICONS]"
---

# [PROJECT_NAME] - AURA.build Design Prompts

## Design System

[Common design spec — automatically prefixed to all page prompts]

**Colors:**
- Primary: [PRIMARY_COLOR]
- Secondary: [SECONDARY_COLOR]
- Success/Warning/Error: [colors]
- Background/Surface/Text: [colors]

**Typography / Spacing / Styling:**
[tokens]

---

## Page: 01-[page-slug]
name: [Page Display Name]
category: [auth|user|admin|public]

### SCREEN OVERVIEW
[2-4 sentences: purpose, role in flow, key objectives]

### LAYOUT STRUCTURE
[Grid/layout description]

### KEY ELEMENTS
[Component list with specifications]

### INTERACTIVE ELEMENTS
[Buttons, forms, hover states]

---
```

## Per-Page Prompt Pattern

For each page extracted from the PRD:

1. **Screen overview**: Purpose and context (2-4 sentences)
2. **Layout structure**: Grid, sidebar, header arrangement
3. **Key elements**: Components with specifications
4. **Interactive elements**: Buttons, forms, states
5. **Responsive notes**: Mobile/tablet adaptations

## Rules

- One page section per `## Page:` block, separated by `---`
- Page slugs use kebab-case with numeric prefix: `01-landing`, `02-login`
- Categories: `auth`, `user`, `admin`, `public`
- Design system section is prefixed to every page prompt by AURA
- Write output to `design/aura-prompts.md`

## Error Handling

- PRD has no page list: derive pages from features, ask user to confirm
- PRD has no color scheme: use sensible defaults (blue primary, gray neutral)
- PRD is missing sections: note gaps in output, proceed with available info

## Related

- Previous step: PRD creation (use `prd/FEATURE_PRD.template.md`)
- Alternative path: `prd-to-design-guide` → `design-guide-to-aura-prompts`
- Next step: `prompts-to-aura`
