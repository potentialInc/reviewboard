---
name: landing-page
status: example
version: "1.0"
last_updated: 2026-02-23
---

# Landing Page — Product Requirements Document

<!-- UI 중심 PRD 예시. 백엔드 없이 프론트엔드만으로 완성되는 프로젝트입니다. -->

## 1. Overview

| Field | Value |
|-------|-------|
| Feature Name | Product Landing Page |
| Purpose | SaaS 제품 소개 + 얼리 액세스 이메일 수집 |
| Target Users | 잠재 고객 (기술/비기술 모두) |
| Target Release | MVP 1일 |
| Owner | 마케팅팀 |

## 2. Terminology

| Term | Definition |
|------|-----------|
| Hero | 페이지 최상단의 대형 배너 영역 |
| CTA | Call-to-Action, 사용자 행동 유도 버튼 |
| Social proof | 고객 후기, 사용 통계 등 신뢰 요소 |

## 3. Goals

- [ ] Goal 1: 방문자가 10초 안에 제품이 뭔지 이해할 수 있다
- [ ] Goal 2: 이메일 수집 전환율 5% 이상
- [ ] Goal 3: Lighthouse Performance 점수 90+ / Accessibility 90+

## 4. MVP Scope

### In Scope
- Hero 섹션 (헤드라인 + 서브텍스트 + CTA)
- 핵심 기능 3개 소개 (아이콘 + 텍스트)
- Social proof (고객 후기 3개)
- 이메일 수집 폼 (프론트 검증만, 백엔드 없음)
- 반응형 (모바일/태블릿/데스크톱)
- Footer (링크, 저작권)

### Out of Scope
- 실제 이메일 발송/저장 (MVP는 콘솔 로그)
- 블로그/뉴스 섹션
- 다국어 지원

### Future Phases
- 이메일 저장 백엔드 (Supabase or API)
- A/B 테스트
- 애니메이션/인터랙션 강화

## 5. System Modules

| Module | Description | Pipeline Phase | Dependencies |
|--------|-------------|----------------|-------------|
| Layout | 전체 레이아웃, 네비게이션, Footer | Phase 3 (frontend) | 없음 |
| Hero | 메인 배너 + CTA | Phase 3 (frontend) | Layout |
| Features | 기능 소개 카드 3개 | Phase 3 (frontend) | Layout |
| Testimonials | 고객 후기 | Phase 3 (frontend) | Layout |
| Email Form | 이메일 수집 + 검증 | Phase 3 (frontend) | Layout |

<!-- 모든 모듈이 frontend — pipeline 대신 parallel 모드가 적합합니다 -->

## 6. User Flows

### Flow 1: 랜딩 → 이메일 등록
1. 방문자가 페이지에 접속한다
2. Hero 섹션에서 헤드라인과 설명을 읽는다
3. 아래로 스크롤하며 기능과 후기를 확인한다
4. CTA 버튼 또는 이메일 폼에서 이메일을 입력한다
5. "등록" 클릭 → 성공 메시지 표시

## 7. DB Schema

> 해당 없음 — 프론트엔드 전용 프로젝트

## 8. API Endpoints

> 해당 없음 — MVP에서는 프론트엔드 폼 검증만. 이메일은 콘솔 로그.

## 9. UI Specifications

### Screen: Landing Page (single page)

**Hero Section**
- 헤드라인: 큰 볼드 텍스트 (최대 10단어)
- 서브텍스트: 1-2줄 설명
- CTA 버튼: "Get Early Access" (파란색, 큰 사이즈)
- 배경: 그라데이션 또는 단색

**Features Section**
- 3컬럼 그리드 (모바일: 1컬럼)
- 각 카드: 아이콘 (emoji or svg) + 제목 + 설명 (2줄)

**Testimonials Section**
- 3개 후기 카드
- 각 카드: 인용문 + 이름 + 직함
- 배경색 구분

**Email Form Section**
- 이메일 입력 + 제출 버튼 (인라인)
- 검증: 이메일 형식 체크
- 상태: 기본 → 로딩 → 성공("등록 완료!") / 에러("유효한 이메일을 입력하세요")

**Footer**
- 로고, 링크 (Privacy, Terms), 저작권

### Responsive Breakpoints
- Mobile: < 640px (1컬럼)
- Tablet: 640-1024px (2컬럼)
- Desktop: > 1024px (3컬럼)

## 10. Acceptance Criteria

### Hero
- [ ] **AC-001**: 헤드라인이 모바일에서도 잘리지 않고 표시된다
- [ ] **AC-002**: CTA 버튼 클릭 시 이메일 폼 섹션으로 스무스 스크롤

### Features
- [ ] **AC-003**: 모바일에서 3개 카드가 세로로 쌓인다
- [ ] **AC-004**: 각 카드에 아이콘, 제목, 설명이 모두 표시된다

### Email Form
- [ ] **AC-005**: 빈 이메일 제출 시 에러 메시지 표시
- [ ] **AC-006**: 잘못된 이메일 형식 시 에러 메시지 표시
- [ ] **AC-007**: 성공 시 "등록 완료" 메시지 + 폼 초기화

### Performance
- [ ] **AC-008**: Lighthouse Performance 90+
- [ ] **AC-009**: Lighthouse Accessibility 90+

## 11. Non-Functional Requirements

### Performance
- First Contentful Paint: < 1.5초
- Total bundle size: < 100KB (gzipped)
- 이미지: WebP 포맷, lazy loading

### Accessibility
- 모든 이미지에 alt 텍스트
- 키보드 네비게이션 가능
- 색상 대비 WCAG AA 이상

## 12. Open Questions

| # | Question | Impact | Status |
|---|----------|--------|--------|
| Q1 | 실제 제품 이름/브랜딩? | Hero 텍스트 | Open — 플레이스홀더 사용 |
| Q2 | 이메일 저장 백엔드를 어디에? | Future phase | Deferred |

## 13. References

- 기술 스택: React + Vite + Tailwind CSS
- 디자인 참고: 심플한 SaaS 랜딩 (Stripe, Linear 스타일)
