# rebuild-frontend

리모델링 투자 분석 시스템의 **사용자 인터페이스 (UI 레이어)** 입니다.

이 프로젝트는 **React + TypeScript + Vite 기반 SPA**이며  
rebuild-engine(API 서버)와 연동되는 구조입니다.

---

## 1. 기술 스택

- React 18+
- TypeScript
- Vite (빌드 도구)
- Axios (API 통신)
- Zustand / Redux (상태관리 - 선택)
- React Router (페이지 라우팅)

---

## 2. 프로젝트 목적

- 리모델링 투자 분석 UI 제공
- backend (rebuild-engine) API 연동
- Mock 기반 UI/UX 검증
- 분석 결과 시각화
- 사용자 흐름 설계 및 테스트

---

## 3. 아키텍처 구조

```text id="arch"
rebuild-frontend
├── pages          # 화면 단위 (Login, Dashboard, Result)
├── components     # 재사용 UI
├── features       # 기능 단위 모듈 (auth, analysis 등)
├── api            # backend API 호출
├── mock           # Mock 데이터
├── store          # 상태 관리
└── utils          # 공통 유틸
```

---

## 4. 데이터 흐름
```text id="dataflow"
User
  ↓
Page (UI)
  ↓
API Layer / Mock
  ↓
rebuild-engine (Spring Boot)
  ↓
Response DTO
  ↓
UI Render
```

---


## 5. 실행 방법

### 5.1 패키지 설치
```shell
npm install
```

### 5.2 개발 서버 실행
```shell
npm run dev
```

### 5.3 실행 주소
```shell
http://localhost:5173
```


## 6. Backend 연동

이 프로젝트는 아래 API 서버와 연결됩니다:

rebuild-engine (Spring Boot)
기본 주소: http://localhost:8080

- REST API를 기본으로 사용합니다.
- URL은 복수형(Resource)으로 작성합니다.

예시

```text
GET    /api/properties
GET    /api/properties/{id}
POST   /api/properties
PUT    /api/properties/{id}
DELETE /api/properties/{id}
```

- API URL은 기존 규칙을 유지하며 임의로 변경하지 않습니다.


## 7. 개발 규칙
## 7.1 금지 사항
- API 로직을 UI 컴포넌트에 직접 작성 금지
- backend 로직을 frontend에 재구현 금지
- Mock 구조와 API 구조 불일치 금지
## 7.2 구조 원칙
- Pages = 화면 구성만 담당
- Components = UI 재사용
- Features = 기능 단위 분리
- API Layer = backend 통신 전담


## 8 싱행
PS C:\rebuild-project\rebuild-frontend> npm run dev

> rebuild-frontend@0.0.0 dev
> vite


  VITE v8.0.16  ready in 422 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help