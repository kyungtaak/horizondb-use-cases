# HorizonDB Use Cases 프론트엔드

React·TypeScript·Vite 기반의 공통 진입 화면과 업무별 데모입니다.
첫 화면에서 Fleet Intelligence 또는 Home Shopping Intelligence를 선택합니다.
기술 구성과 백엔드·DB·모델 준비는 [프로젝트 가이드](../README.md),
발표·검증 자료는 [문서 안내](../docs/README.md)를 따릅니다.

## 실행

이 폴더에서 실행합니다. 의존성은 최초 준비 또는 패키지 변경 시 `npm install`로 설치합니다.

```powershell
npm run dev
```

기본 주소는 `http://127.0.0.1:5173`입니다. 개발 서버는 `/api`를 `http://127.0.0.1:8000`으로 전달합니다.
별도 API 주소를 사용할 때만 `VITE_API_URL`을 지정합니다.
소개 화면은 업무 API를 호출하지 않지만, 각 데모는 실제 백엔드·HorizonDB·모델 설정이 필요합니다.
홈쇼핑은 [별도 활성화와 설정](../docs/home-shopping.md#설정과-실행)을 먼저 적용합니다.

## 화면 구성

| 파일 | 역할 |
| --- | --- |
| [src/useCases.ts](src/useCases.ts) | 사례 ID·이름·업무 질문·기능 목록 |
| [src/components/UseCaseOverview.tsx](src/components/UseCaseOverview.tsx) | 사례 소개·진입 카드와 DB·모델 역할 설명 |
| [src/App.tsx](src/App.tsx) | 공통 이름·메뉴·브라우저 제목, 사례 이동과 Fleet 화면 |
| [src/commerce/CommerceDashboard.tsx](src/commerce/CommerceDashboard.tsx) | 홈쇼핑 제어·집계·분석·브리핑 |

사례 화면은 처음 방문할 때 마운트합니다. 방문 후에는 숨김 상태로 유지해 검색·대화·필터를 보존합니다.
홈쇼핑은 화면을 벗어나면 polling을 중단하지만 서버 측 실행을 자동으로 일시정지하거나 초기화하지 않습니다.
새로고침하면 소개 화면으로 돌아오고 브라우저 메모리의 상태는 초기화됩니다.
사례 소개의 기능 목록과 실제 연결 상태 배지는 구분합니다.

## 검사

```powershell
npm run build
npm run lint
npm run test:commerce
```

`build`는 TypeScript 검사와 Vite 빌드를 실행합니다. `test:commerce`는 기존 시간 차트의 계산·결측값 처리를 검사합니다.
화면 변경 시에는 소개 → Fleet → 홈쇼핑 → 소개 이동, 두 사례의 상태 유지,
모바일 메뉴·스크롤·오류 표시를 브라우저에서도 확인합니다. UI fixture 검증과 실제 DB·모델 통합 검증은 구분합니다.
