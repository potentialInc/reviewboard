---
skill_name: prd-normalize
magicKeyword: "prd:"
applies_to_local_project_only: false
auto_trigger_regex: [prd normalize, normalize prd, convert prd, fill prd, prd template, standardize prd]
tags: [prd, requirements, normalization, ai-native]
description: Convert ANY PRD (any format, any language, incomplete) to the standard harness template. Never hallucinate — asks only for genuinely missing information.
---

# PRD Normalize

Convert any PRD into the standard harness template format so all agents can work with it reliably.

**Input**: Any PRD — existing doc, rough notes, Notion export, bullet points, or another format
**Output**: `prd/prd-{name}.md` in the standard 13-section template, `status: active`

---

## Core Principle: No Hallucination

- **Extract only** what is explicitly stated in the source PRD
- **Never invent** colors, endpoints, schemas, user flows, or acceptance criteria
- **Never guess** what the user "probably" wants
- **Flag gaps** explicitly — missing sections become `{MISSING — needs input}` placeholders
- **Ask once** at the end with a consolidated list of questions, not inline guesses

---

## Workflow

### Step 1: Read Source PRD

Read the provided PRD file completely before doing anything else.

### Step 2: Extract → Map to Template Sections

For each of the 13 sections, scan the source PRD for matching content:

| Template Section | What to Look For |
|-----------------|-----------------|
| 1. Overview | Project name, purpose, target users, release date, owner |
| 2. Terminology | Domain-specific terms, glossary, definitions |
| 3. Goals | Success metrics, KPIs, measurable outcomes |
| 4. MVP Scope | In/out scope, phase breakdown, explicitly excluded items |
| 5. System Modules | Modules, components, services, pipeline phases |
| 6. User Flows | Step-by-step user journeys, use cases, scenarios |
| 7. DB Schema | Tables, columns, types, relationships, constraints |
| 8. API Endpoints | Routes, methods, request/response shapes, auth requirements |
| 9. UI Specifications | Screens, layouts, design tokens, colors, fonts, app type, style |
| 10. Acceptance Criteria | Test cases, given/when/then, edge cases, performance criteria |
| 11. Non-Functional Requirements | Performance targets, security requirements, scalability |
| 12. Open Questions | Unresolved decisions, blockers, dependencies |
| 13. References | Figma links, external docs, related PRDs |

### Step 3: Identify Gaps

After mapping, identify which sections are:
- **COMPLETE**: Sufficient information extracted
- **PARTIAL**: Some info but missing key details (note what's missing)
- **MISSING**: No information found at all

### Step 4: Write Normalized PRD

Write to `prd/prd-{project-name}.md` using the standard template.

Rules for writing:
- Copy extracted content faithfully — preserve the original's intent and wording
- For PARTIAL sections: fill what you have, mark unclear parts as `{unclear — see Q{N}}`
- For MISSING sections: use `{MISSING — needs input}` as the value
- **Critical sections** (DB Schema, API Endpoints, UI Specs) that are MISSING: do NOT invent — leave as MISSING
- Set `status: draft` in YAML frontmatter (not `active` — user must review and activate)

### Step 5: Report Gaps and Ask Questions

After writing the file, output a consolidated gap report:

```
## Normalization Complete

Output: prd/prd-{name}.md
Status: draft (review and set status: active when ready)

### Extracted (complete)
- Section 1 Overview ✅
- Section 3 Goals ✅
- ...

### Partial
- Section 9 UI Specs — design tokens extracted, missing: App Type, Design Style, Icon Library
- ...

### Missing (needs your input)
- Section 7 DB Schema — no table definitions found
- Section 8 API Endpoints — no endpoint specs found
- ...

### Questions (answer to complete the PRD)

Q1 [Section 9 — App Type]: Is this a Web App, Mobile App, Dashboard, or Landing Page?
Q2 [Section 9 — Design Style]: What visual direction? (Modern SaaS / Minimal / Corporate / Playful / Dark)
Q3 [Section 9 — Icon Library]: Lucide Icons, Heroicons, or Phosphor Icons?
Q4 [Section 7 — DB Schema]: What are the main data entities? (e.g., User, Post, Order...)
...

Answer these questions and I'll update the PRD. Then set `status: active` to start building.
```

---

## Section-Specific Extraction Rules

### Section 7 — DB Schema
- Extract table names from nouns in feature descriptions
- Only create column definitions if explicitly mentioned
- Do NOT infer column types — mark as `{type — TBD}` if unclear
- Relationships: only if explicitly described ("User has many Posts")

### Section 8 — API Endpoints
- Extract from any REST/GraphQL/RPC spec in the source
- If only feature descriptions exist (no explicit endpoints), leave MISSING
- Do NOT invent CRUD endpoints — the feature-builder agent will derive them from the PRD

### Section 9 — UI Specifications
- **Always ask** for App Type, Design Style, Icon Library if not explicitly stated
- Colors: extract exact hex values if provided; otherwise leave as `{TBD}`
- Screens: extract every named screen/page from the source PRD
- Map screen names to the template's `### Screen: {name}` format

### Section 10 — Acceptance Criteria
- Convert any "should", "must", "will" statements into AC format
- Pattern: `Given {precondition}, when {action}, then {expected result}`
- If none exist: leave MISSING (do not invent test cases)

### Section 12 — Open Questions
- Extract explicit unknowns, blockers, or "TBD" markers from source
- Add your own gap questions here too (from Step 5)

---

## Language Handling

- Source PRD can be in any language
- Output PRD: match the source language
- Section headers: keep in English (agents depend on English section names)
- Content: use the source PRD's language

---

## Error Handling

- Source file not found: **STOP**, ask user to provide the path
- Source is too vague (e.g., one paragraph): extract what you can, mark everything else MISSING, ask Q1..QN
- Source is in a format that can't be read (binary, image): **STOP**, ask user to paste as text

---

## Related

- Template: `prd/FEATURE_PRD.template.md`
- Next step after completing PRD: `fullstack:` or `pipeline:`
- Design generation: `design:` (reads Section 9)
