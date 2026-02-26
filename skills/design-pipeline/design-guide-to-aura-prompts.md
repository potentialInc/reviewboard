---
description: Convert Design Guide to AURA.build compatible design prompts
argument-hint: "<design-guide-path>"
---

# Design Guide to AURA Prompts

Precise path: Convert a Design Guide document into AURA.build compatible prompts.

## Workflow

1. **Read Design Guide** at the specified path (default: `design/design-guide.md`)
2. **Extract design system**: Colors, typography, spacing, component standards
3. **Extract page briefs**: Layout and component descriptions per page
4. **Generate AURA prompts** with design system prefix + per-page prompts
5. **Write output** to `design/aura-prompts.md`

## Input: Design Guide Structure

The Design Guide should contain:
- **Design Philosophy**: Inspiration references, design pillars
- **Design System**: Colors, typography, spacing, components
- **Page-by-Page Design Briefs**: Layout and component descriptions
- **Component Patterns**: Reusable component specifications

## Output Format

Same format as `prd-to-design-prompts` output:

```markdown
---
project_name: "[from Design Guide]"
total_pages: [count]
design_system:
  type: "[Web/Mobile/Desktop]"
  style: "[from Design Philosophy]"
  primary_color: "[from Design System]"
  secondary_color: "[from Design System]"
  font: "[from Typography]"
  icons: "[from Design System]"
---

# [PROJECT_NAME] - AURA.build Design Prompts

## Design System

[Comprehensive design spec extracted from Design Guide]

**Design Inspiration:**
[From Design Philosophy section]

**Colors:** [full palette from Design Guide]
**Typography:** [full scale with sizes and weights]
**Spacing:** [base unit, card padding, section gaps]
**Styling:** [radius, shadow, transitions]
**Component Standards:** [key patterns]

---

## Page: 01-[page-slug]
name: [from page brief]
category: [auth|user|admin|public]

[Full page prompt derived from Design Guide's page brief]

---
```

## Conversion Rules

### Design System Mapping

| Design Guide Section | AURA Prompt Section |
|---------------------|---------------------|
| Colors palette | `**Colors:**` block |
| Typography scale | `**Typography:**` block |
| Spacing system | `**Spacing:**` block |
| Component patterns | `**Component Standards:**` block |
| Design philosophy | `**Design Inspiration:**` block |

### Page Brief → Page Prompt

For each page brief in the Design Guide:
1. Extract layout description → `### LAYOUT STRUCTURE`
2. Extract component list → `### KEY ELEMENTS`
3. Extract interactions → `### INTERACTIVE ELEMENTS`
4. Add responsive notes from Design Guide's responsive strategy

## Rules

- Preserve all design tokens exactly as specified in the Design Guide
- Use the same page ordering as the Design Guide
- Include component standards in the design system section (AURA uses them globally)
- Write output to `design/aura-prompts.md`

## Error Handling

- Design Guide not found: **STOP** and suggest running `prd-to-design-guide` first
- Design Guide missing design system: derive from any color/font mentions, ask user
- Design Guide has no page briefs: **STOP** and report incomplete design guide

## Related

- Previous step: `prd-to-design-guide`
- Next step: `prompts-to-aura`
- Alternative: `prd-to-design-prompts` (skip design guide)
