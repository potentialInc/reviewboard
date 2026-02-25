---
name: todo-app
status: example
version: "1.0"
last_updated: 2026-02-23
---

# Todo App — Product Requirements Document

<!-- 이 파일은 예시입니다. 실제 PRD를 작성할 때 prd/ 디렉토리에 prd-<이름>.md로 복사하세요. -->
<!-- status를 "active"로 바꾸면 에이전트가 자동으로 이 PRD를 Source of Truth로 사용합니다. -->

## 1. Overview

| Field | Value |
|-------|-------|
| Feature Name | Todo App |
| Purpose | 할 일 목록 생성/관리/완료 추적 웹 앱 |
| Target Users | 개인 생산성 관리가 필요한 일반 사용자 |
| Target Release | MVP 1주일 |
| Owner | 프로젝트 오너 |

<!-- Overview는 에이전트가 맥락을 빠르게 파악하는 데 사용됩니다. 한 줄로 핵심을 전달하세요. -->

## 2. Terminology

| Term | Definition |
|------|-----------|
| Todo | 사용자가 생성한 할 일 항목 |
| Category | Todo를 그룹화하는 분류 (예: 업무, 개인, 긴급) |

## 3. Goals

- [ ] Goal 1: 사용자가 30초 안에 Todo를 생성할 수 있다
- [ ] Goal 2: 카테고리별로 Todo를 필터링할 수 있다
- [ ] Goal 3: 완료율을 한눈에 확인할 수 있다

## 4. MVP Scope

### In Scope
- Todo CRUD (생성, 조회, 수정, 삭제)
- 카테고리 관리
- 완료/미완료 토글
- 카테고리별 필터링

### Out of Scope
- 사용자 인증 (MVP에서는 단일 사용자)
- 알림/리마인더
- 모바일 앱

### Future Phases
- 사용자 인증 + 멀티유저
- 드래그앤드롭 순서 변경
- 반복 Todo

## 5. System Modules

| Module | Description | Pipeline Phase | Dependencies |
|--------|-------------|----------------|-------------|
| DB Schema | todos, categories 테이블 | Phase 2 (types+db) | 없음 |
| API | REST 엔드포인트 | Phase 4 (backend) | DB Schema |
| UI | Todo 리스트 + 폼 | Phase 3 (frontend) | 없음 |
| Integration | API-UI 연결 | Phase 5 (integrate) | API, UI |

<!-- 각 모듈은 pipeline 모드의 phase에 매핑됩니다. -->
<!-- 의존성이 없는 모듈(API와 UI)은 parallel로 실행 가능합니다. -->

## 6. User Flows

### Flow 1: Todo 생성
1. 사용자가 입력 필드에 할 일 텍스트를 입력한다
2. 카테고리를 선택한다 (선택사항, 기본값: "일반")
3. "추가" 버튼을 클릭한다
4. 시스템이 Todo를 저장하고 리스트에 즉시 표시한다

### Flow 2: Todo 완료
1. 사용자가 Todo 항목의 체크박스를 클릭한다
2. 시스템이 완료 상태로 변경하고 시각적으로 표시한다 (취소선)
3. 완료율 표시가 업데이트된다

## 7. DB Schema

### todos
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | 고유 ID |
| title | TEXT | NOT NULL | 할 일 내용 |
| completed | BOOLEAN | DEFAULT false | 완료 여부 |
| category_id | INTEGER | FK → categories.id | 카테고리 참조 |
| created_at | DATETIME | DEFAULT NOW | 생성 시간 |

### categories
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | 고유 ID |
| name | TEXT | NOT NULL, UNIQUE | 카테고리 이름 |
| color | TEXT | DEFAULT '#6B7280' | 표시 색상 (hex) |

### Relationships
- todos → categories: Many-to-One (하나의 카테고리에 여러 Todo)

## 8. API Endpoints

### Todos
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/todos | — | `[{ id, title, completed, category }]` | 없음 |
| POST | /api/todos | `{ title, category_id? }` | `{ id, title, completed }` | 없음 |
| PATCH | /api/todos/:id | `{ title?, completed? }` | `{ id, title, completed }` | 없음 |
| DELETE | /api/todos/:id | — | `204 No Content` | 없음 |

### Categories
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/categories | — | `[{ id, name, color }]` | 없음 |
| POST | /api/categories | `{ name, color? }` | `{ id, name, color }` | 없음 |

## 9. UI Specifications

### Screen: Main (Todo List)
- **Layout**: 단일 페이지, 상단 입력 폼 + 하단 리스트
- **Components**: TodoInput, TodoItem, CategoryFilter, CompletionStats
- **Interactions**: 체크박스 토글, 인라인 삭제, 카테고리 필터
- **States**: 빈 상태 ("아직 할 일이 없습니다"), 로딩, 에러

## 10. Acceptance Criteria

### Todo CRUD
- [ ] **AC-001**: 빈 필드로 생성 시 에러 메시지 표시
- [ ] **AC-002**: Todo 생성 후 입력 필드가 초기화되고 리스트에 즉시 나타남
- [ ] **AC-003**: Todo 삭제 후 리스트에서 즉시 사라짐
- [ ] **AC-004**: 완료 토글 시 즉시 시각적 변경 (취소선)

### 필터링
- [ ] **AC-005**: 카테고리 필터 선택 시 해당 카테고리만 표시
- [ ] **AC-006**: "전체" 필터 시 모든 Todo 표시

### Edge Cases
- [ ] **EC-001**: 100자 이상 제목 입력 시 잘림 처리
- [ ] **EC-002**: 카테고리 삭제 시 해당 카테고리의 Todo는 "일반"으로 이동

## 11. Non-Functional Requirements

### Performance
- Target response time: 200ms (API)
- Initial load: < 1초

### Security
- Authentication: 없음 (MVP)
- Input sanitization: XSS 방지

## 12. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | Todo에 우선순위 필드 추가할 것인가? | DB Schema, UI | Deferred to v2 |
| Q2 | 오프라인 지원 필요한가? | Frontend 아키텍처 | Deferred to v2 |

## 13. References

- 기술 스택: Next.js + SQLite (via Prisma)
- 디자인: Tailwind CSS 기본 스타일
