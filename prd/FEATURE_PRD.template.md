---
name: feature-name
status: draft
version: "1.0"
last_updated: YYYY-MM-DD
---

# {Feature Name} — Product Requirements Document

## 1. Overview

| Field | Value |
|-------|-------|
| Feature Name | {name} |
| Purpose | {one-line purpose} |
| Target Users | {primary user persona} |
| Target Release | {date or sprint} |
| Owner | {person or team} |

## 2. Terminology

Define domain-specific terms so all agents use consistent language.

| Term | Definition |
|------|-----------|
| {term} | {definition} |

## 3. Goals

What success looks like. Agents use these as decision criteria when implementation choices arise.

- [ ] Goal 1: {measurable outcome}
- [ ] Goal 2: {measurable outcome}
- [ ] Goal 3: {measurable outcome}

## 4. MVP Scope

### In Scope
- {feature/capability}

### Out of Scope
- {explicitly excluded}

### Future Phases
- {deferred to later}

## 5. System Modules

Map to pipeline phases. Each module becomes a pipeline phase or parallel sub-phase.

| Module | Description | Pipeline Phase | Dependencies |
|--------|-------------|----------------|-------------|
| {module} | {what it does} | {phase number} | {depends on} |

## 6. User Flows

Describe the key user journeys step by step.

### Flow 1: {flow name}
1. User {action}
2. System {response}
3. User {action}
4. System {response}

## 7. DB Schema

Input for `db:` agent. Define tables, relationships, and constraints.

### {Table Name}
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | UUID | PK | Primary key |
| {column} | {type} | {constraints} | {description} |

### Relationships
- {Table A} → {Table B}: {relationship type}

## 8. API Endpoints

Input for `build:` agent. Define REST/GraphQL endpoints.

### {Endpoint Group}
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /api/{resource} | `{ field: type }` | `{ field: type }` | Required |

## 9. UI Specifications

Input for `design:` ui-builder agent. Describe screens, provide design inputs, and define tokens.

### Design Inputs

| Source | Path / Link | Notes |
|--------|-------------|-------|
| Screenshots | `design/screens/` | Figma exports, wireframes (PNG/JPEG) |
| HTML Mockups | `design/mockups/` | Static HTML/CSS prototypes |
| Figma | {Figma link} | View-only link for reference |
| Design System | {link or path} | Existing component library docs |

### Design Tokens

| Token | Value | Notes |
|-------|-------|-------|
| App Type | Web App / Mobile App / Dashboard / Landing Page | Platform type |
| Design Style | Modern SaaS / Minimal / Corporate / Playful / Dark | Visual direction |
| Icon Library | Lucide Icons / Heroicons / Phosphor Icons | Pick one |
| Primary Color | {#hex} | Brand primary |
| Secondary Color | {#hex} | Brand secondary |
| Font Family | {font name} | Body text |
| Heading Font | {font name} | If different from body |
| Base Spacing | {N}px | Spacing unit (e.g., 4px, 8px) |
| Border Radius | {N}px | Default corner radius |

### Screen: {screen name}
- **Layout**: {description or Figma link}
- **Components**: {list of UI components}
- **Interactions**: {user interactions and their effects}
- **States**: {loading, empty, error, success}
- **Responsive**: {mobile / tablet / desktop breakpoints}
- **Accessibility**: {keyboard nav, screen reader, contrast requirements}

## 10. Acceptance Criteria

Input for `test:` QA agent. Each criterion becomes a test case.

### {Feature/Module}
- [ ] **AC-001**: Given {precondition}, when {action}, then {expected result}
- [ ] **AC-002**: Given {precondition}, when {action}, then {expected result}

### Edge Cases
- [ ] **EC-001**: {edge case description and expected behavior}

### Performance Criteria
- [ ] Response time < {N}ms for {operation}
- [ ] Supports {N} concurrent users

## 11. Non-Functional Requirements

### Performance
- Target response time: {N}ms
- Target throughput: {N} requests/second
- Bundle size limit: {N}KB

### Security
- Authentication: {method}
- Authorization: {method}
- Data encryption: {at rest / in transit}
- OWASP compliance: {specific items}

### Scalability
- Expected users: {N}
- Data growth: {rate}
- Scaling strategy: {horizontal/vertical}

## 12. Open Questions

Track unresolved decisions. Agents will flag these rather than guessing.

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | {question} | {which module affected} | Open |

## 13. References

- Figma: {link}
- External API docs: {link}
- Related PRDs: {link}
- Design system: {link}
