---
name: blog-api
status: example
version: "1.0"
last_updated: 2026-02-23
---

# Blog API — Product Requirements Document

<!-- API 중심 PRD 예시. backend 에이전트와 database 에이전트가 주로 사용합니다. -->

## 1. Overview

| Field | Value |
|-------|-------|
| Feature Name | Blog REST API |
| Purpose | 블로그 게시글 작성/조회/관리 API 서버 |
| Target Users | 프론트엔드 개발자 (API 소비자) |
| Target Release | MVP 3일 |
| Owner | 프로젝트 오너 |

## 2. Terminology

| Term | Definition |
|------|-----------|
| Post | 블로그 게시글 (제목, 본문, 작성자, 태그) |
| Author | 게시글 작성자 (인증된 사용자) |
| Tag | 게시글 분류 태그 (N:M 관계) |

## 3. Goals

- [ ] Goal 1: RESTful API 설계 원칙 준수 (적절한 HTTP 상태 코드, 리소스 명명)
- [ ] Goal 2: JWT 기반 인증으로 작성자만 자기 글 수정/삭제 가능
- [ ] Goal 3: 페이지네이션, 태그 필터, 검색 지원

## 4. MVP Scope

### In Scope
- 사용자 등록/로그인 (JWT)
- 게시글 CRUD + 페이지네이션
- 태그 관리 (N:M)
- 게시글 검색 (제목/본문)

### Out of Scope
- 댓글 시스템
- 이미지 업로드
- RSS 피드

### Future Phases
- 댓글 + 대댓글
- Markdown 렌더링
- 이미지 업로드 (S3)

## 5. System Modules

| Module | Description | Pipeline Phase | Dependencies |
|--------|-------------|----------------|-------------|
| Auth | JWT 인증/인가 | Phase 2 | DB Schema |
| DB Schema | users, posts, tags, post_tags | Phase 2 | 없음 |
| Posts API | 게시글 CRUD + 검색 | Phase 4 | Auth, DB Schema |
| Tags API | 태그 관리 | Phase 4 | DB Schema |
| Tests | API 통합 테스트 | Phase 6 | Posts API, Tags API |

## 6. User Flows

### Flow 1: 게시글 작성
1. Author가 POST /auth/login으로 JWT 토큰 획득
2. POST /api/posts에 Authorization: Bearer 헤더와 함께 게시글 데이터 전송
3. 서버가 게시글 생성 후 201 응답 + 생성된 게시글 반환
4. 태그가 포함된 경우 post_tags 관계 자동 생성

### Flow 2: 게시글 검색
1. 클라이언트가 GET /api/posts?search=keyword&tag=python&page=1 요청
2. 서버가 검색 조건에 맞는 게시글 페이지네이션 결과 반환
3. 응답에 total, page, per_page, items 포함

## 7. DB Schema

### users
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PK | 고유 ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 이메일 (로그인 ID) |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 해시 |
| name | VARCHAR(100) | NOT NULL | 표시 이름 |
| created_at | TIMESTAMP | DEFAULT NOW | 가입 시간 |

### posts
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PK | 고유 ID |
| title | VARCHAR(200) | NOT NULL | 제목 |
| body | TEXT | NOT NULL | 본문 (마크다운) |
| author_id | INTEGER | FK → users.id, NOT NULL | 작성자 |
| published | BOOLEAN | DEFAULT false | 공개 여부 |
| created_at | TIMESTAMP | DEFAULT NOW | 작성 시간 |
| updated_at | TIMESTAMP | DEFAULT NOW | 수정 시간 |

### tags
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PK | 고유 ID |
| name | VARCHAR(50) | UNIQUE, NOT NULL | 태그명 (소문자) |

### post_tags
| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| post_id | INTEGER | FK → posts.id | 게시글 |
| tag_id | INTEGER | FK → tags.id | 태그 |
| | | PK(post_id, tag_id) | 복합 기본키 |

### Relationships
- users → posts: One-to-Many
- posts ↔ tags: Many-to-Many (via post_tags)

## 8. API Endpoints

### Auth
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| POST | /auth/register | `{ email, password, name }` | `{ id, email, name, token }` | 없음 |
| POST | /auth/login | `{ email, password }` | `{ token, expires_in }` | 없음 |

### Posts
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/posts | — | `{ items, total, page, per_page }` | Optional |
| GET | /api/posts/:id | — | `{ id, title, body, author, tags }` | Optional |
| POST | /api/posts | `{ title, body, tags[], published? }` | `201 { post }` | Required |
| PUT | /api/posts/:id | `{ title?, body?, tags[]?, published? }` | `{ post }` | Owner only |
| DELETE | /api/posts/:id | — | `204` | Owner only |

**Query Parameters** (GET /api/posts):
- `search` — 제목/본문 검색
- `tag` — 태그 필터
- `author` — 작성자 필터
- `page` / `per_page` — 페이지네이션 (기본 20개)

### Tags
| Method | Path | Request Body | Response | Auth |
|--------|------|-------------|----------|------|
| GET | /api/tags | — | `[{ id, name, post_count }]` | 없음 |

## 9. UI Specifications

> API 전용 프로젝트 — UI 없음. Swagger/OpenAPI 문서 자동 생성.

## 10. Acceptance Criteria

### Auth
- [ ] **AC-001**: 이메일 중복 가입 시 409 Conflict
- [ ] **AC-002**: 잘못된 비밀번호 로그인 시 401 Unauthorized
- [ ] **AC-003**: 만료된 토큰으로 요청 시 401 + "token expired" 메시지

### Posts CRUD
- [ ] **AC-004**: 인증 없이 POST /api/posts 시 401
- [ ] **AC-005**: 다른 사용자의 글 DELETE 시 403 Forbidden
- [ ] **AC-006**: 존재하지 않는 게시글 GET 시 404
- [ ] **AC-007**: 빈 제목으로 POST 시 422 Validation Error

### 검색/페이지네이션
- [ ] **AC-008**: `?search=python` → 제목 또는 본문에 "python" 포함된 글만 반환
- [ ] **AC-009**: `?page=2&per_page=5` → 올바른 오프셋으로 5개 반환
- [ ] **AC-010**: 결과 없을 때 빈 배열 + total: 0 반환 (에러 아님)

## 11. Non-Functional Requirements

### Performance
- API 응답: < 100ms (단건), < 300ms (검색)
- 동시 사용자: 100명

### Security
- Authentication: JWT (access 15분, refresh 7일)
- Password: bcrypt (cost 12)
- Rate limiting: 로그인 5회/분
- CORS: 지정된 origin만

## 12. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | 게시글 soft delete vs hard delete? | DB Schema, API | Open |

## 13. References

- 기술 스택: FastAPI + PostgreSQL + SQLAlchemy
- API 문서: FastAPI 자동 생성 (/docs)
