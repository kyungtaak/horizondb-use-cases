# Fleet Intelligence: HorizonDB에서 조건·공간·의미 검색 함께 사용하기

배송 담당자는 때로 조건을 정확히 알고 있습니다. 지연 상태이고, 일정 기간에 도착 예정이며, 특정 지역 주변에 있는 배송을 찾는 식입니다. 반대로 “의료기관에 필요한 화물”처럼 설명의 의미에서 검색을 시작하기도 합니다. Fleet Intelligence는 이 두 방식을 같은 HorizonDB 데이터에 적용하고, 반환한 배송과 검색 조건을 함께 보여주는 샘플입니다.

이 문서는 [참고 프로젝트](https://github.com/FranckPachot/horizondb-fleet-intelligence)의 시나리오를 바탕으로 HorizonShip의 현재 구현을 설명합니다. 원본을 그대로 번역한 문서는 아닙니다. 제품명과 기술 용어는 영어로 유지하고 API·데이터 구조·검증 범위는 2026-09-15의 로컬 구현에 맞췄습니다. 원문 링크와 라이선스는 [문서 출처와 라이선스](THIRD-PARTY-NOTICES.md)에서 확인할 수 있습니다.

HorizonDB Use Cases의 Fleet 사례 문서입니다. 공통 개발 환경과 앱 실행은 [프로젝트 README](../README.md)를,
배송 검색·모델 설정·DB 준비·API·시연 절차는 이 문서를 따릅니다.
2026-10-29에는 루트 README의 사례별 상세를 이 문서로 통합했습니다. 아래의 과거 검증 기록을 새로 측정한 결과로 바꾸지는 않았습니다.

![Pretendard를 적용한 Fleet Intelligence의 조건 검색·지도·한국어 어시스턴트](media/fleet-overview.png)

24건의 고정 샘플은 각 조건과 결과를 직접 확인하기 위한 데이터입니다. 실제 운항 관제나 대규모 성능 비교 자료는 아닙니다. 배송·벡터·권역 경계를 같은 DB에 저장하지만, 모델 추론은 외부 Foundry가 수행합니다.

## 두 검색 경로의 역할

Search Workbench는 상태, ETA, 지도 반경을 직접 지정하는 form입니다. `Search intent`는 화물의 의미 검색어이며 상태나 날짜를 자연어로 해석하는 입력이 아닙니다. 검색어가 비어 있으면 임베딩 없이 조건만으로 조회합니다. 입력 변경은 검색 버튼이나 Enter로 적용하고 `Clear`로 초기화합니다.

Agent with Tools는 한국어 질문을 구조화된 조건으로 해석합니다. 모델이 임의 SQL을 작성하는 대신 `ShipmentFilters`에 맞는 인자를 선택하고, Python의 `search_shipments` 도구가 검사한 뒤 Repository를 호출합니다. UI의 배송 카드는 답변 문장에서 다시 추출하지 않고 도구 결과를 그대로 사용합니다.

| 항목 | Search Workbench | Agent with Tools |
| --- | --- | --- |
| API | `POST /api/search/criteria` | `POST /api/chat/stream` |
| 조건 해석 | 컨트롤 값으로 결정 | 모델이 현재 질문을 해석 |
| 모델 호출 | 화물 검색어가 있을 때 임베딩 | 조건 해석·답변 생성, 필요할 때 임베딩 |
| 표시 상한 | 최대 24건 | 현재 화면 최대 8건 |
| 상태 필터 | 선택한 값을 적용 | 화면의 상태 선택이 질문의 상태보다 우선 |
| 이전 입력 | form의 현재 값 | 왼쪽 ETA·반경·검색어와 이전 대화는 자동 전달하지 않음 |

기존 `POST /api/search`는 벡터 검색 직접 호출 API로 남아 있습니다. `/api/chat`은 스트림이 아닌 응답 경로입니다. 원본 문서의 “질문만 보내며 상태를 넣으면 HTTP 422”라는 설명은 이 앱에 적용하지 않습니다.

### 도구 호출과 결과 연결

1. 브라우저는 현재 질문, 화면의 상태 필터, 표시 상한을 전달합니다. 대화 기록 전체는 전송하지 않습니다.
2. Agent가 질문을 [ShipmentFilters](../backend/app/models.py)로 해석합니다. 상태·지명·권역은 정확한 조건에,
   화물의 의미는 `cargo_query`에 넣습니다. 한국어 지명은 등록된 영문 이름으로 대응합니다.
3. [검색 도구](../backend/app/agent.py)가 입력을 검사하고 화면의 상태 필터를 우선 적용합니다.
   [Repository](../backend/app/repository.py)는 등록된 장소·권역과 조건 조합을 검사합니다.
   열 이름과 정렬식은 코드에서 선택하고 조건값은 Psycopg의 `%s`에 바인딩합니다.
4. `cargo_query`가 있을 때만 1,536차원 검색어 벡터를 생성합니다. 직접 API 또는 DB 함수로 호출하며,
   Agent가 검색어를 번역하거나 요약할 수 있습니다. 검색 때 배송 전체의 벡터를 다시 만들지는 않습니다.
5. HorizonDB가 조건을 검사하고 정렬한 뒤 표시 상한보다 한 행을 더 조회해 `has_more`를 판단합니다.
6. Agent는 도구가 반환한 배송 번호·경로·상태·ETA·거리·유사도로 답합니다.
   화면의 배송 레코드는 답변 문장에서 다시 추출하지 않고 도구 결과를 그대로 사용합니다.

## 배송과 임베딩을 별도 테이블로 관리

`shipments`에는 업무 필드와 출발지·도착지·현재 위치의 `geometry(Point, 4326)`을 저장합니다. 벡터는 `shipment_embeddings`에서 배송 ID로 연결합니다. `shipment_embedding_jobs`가 의미 필드 변경을 기록하고 기존 `azure_ai on_change` pipeline이 갱신을 처리합니다. 모델 호출 경로를 바꿔도 이 저장 구조와 pipeline을 유지합니다.

초기 setup은 누락된 벡터를 backfill합니다. 이후 검색은 content version을 비교해 작업 중인 새 내용과 오래된 벡터를 혼동하지 않도록 합니다. 초기 설정과 갱신은 아래의 데이터베이스 준비 절차와 [DB 스키마](../database/schema.sql)를 기준으로 합니다. 시연을 준비한다는 이유로 기존 DB의 전체 setup을 다시 실행하지 않습니다.

권역은 별도의 `region_boundaries`에 MultiPolygon으로 저장합니다. 같은 DB에서 관계형·공간·벡터 조건을 함께 검사하지만 모든 데이터가 하나의 테이블에 있다는 뜻은 아닙니다.

## 질문별로 다른 조건과 정렬

필터는 필요한 필드만 표시했습니다. `cargo_query`가 없으면 검색어 임베딩을 호출하지 않습니다.

| 질문 예시 | 구조화된 필터 예시 | DB 처리 | search_mode |
| --- | --- | --- | --- |
| 지연된 배송 | `status: "delayed"` | 상태 일치 | `sql` |
| SHIP-0004를 찾아주세요 | `shipment_number: "SHIP-0004"` | 배송 번호 일치 | `sql` |
| 로테르담으로 가는 배송 | `destination_name: "Rotterdam, Netherlands"` | 도착지 이름 일치 | `sql` |
| 아시아권이 출발지인 배송 | `origin_region: "Asia"` | 출발 좌표에 `ST_Covers` | `gis` |
| 유럽으로 가는 지연된 배송 | `destination_region: "Europe", status: "delayed"` | 도착지 권역 + 상태 일치 | `gis` |
| 부산 반경 100km 이내에서 출발한 배송 | `nearby_location: "Busan, South Korea", position_field: "origin", radius_km: 100` | 출발 좌표에 `ST_DWithin` | `gis` |
| 현재 부산 반경 100km 이내인 배송 | `nearby_location: "Busan, South Korea", position_field: "current", radius_km: 100` | 현재 좌표에 `ST_DWithin` | `gis` |
| 목적지에 가장 가까운 2개 | `sort_by: "destination_distance", result_limit: 2` | 각 배송의 자기 도착지 거리순 | `gis` |
| 로테르담으로 가는 운송 중 배송 중 목적지에 가장 가까운 2개 | `destination_name: "Rotterdam, Netherlands", status: "in_transit", sort_by: "destination_distance", result_limit: 2` | 도착지·상태 일치 + 목적지 거리순 | `gis` |
| 의료기관에 필요한 화물 | `cargo_query: "medical supplies"` | 검색어 임베딩 + 코사인 거리순 | `diskann_cosine` |
| 지연된 의료용품 배송 | `status: "delayed", cargo_query: "medical supplies"` | 상태 일치 + 코사인 거리순 | `hybrid` |
| 아시아에서 출발한 의료용품 | `origin_region: "Asia", cargo_query: "medical supplies"` | 출발지 권역 + 코사인 거리순 | `hybrid` |
| 2026년 9월 15~17일 도착 예정 배송 | `eta_start: "2026-09-15", eta_end: "2026-09-17"` | ETA 범위, 양 끝 포함 | `sql` |
| 현재 부산 반경 500km의 의료용품을 관련성과 거리 가중 순으로 | `cargo_query: "medical supplies", nearby_location: "Busan, South Korea", radius_km: 500, sort_by: "semantic_spatial"` | 반경 + 의미 72%·근접도 28% 점수순 | `hybrid` |

위 표는 의도한 매핑입니다. 모델 표현은 달라질 수 있으므로 실제 적용 조건과 임베딩 입력은 실행 내역에서 확인합니다. 지원하지 않는 국가 전체 조건, 제외 조건, 등록되지 않은 장소나 모호한 요청은 검색 없이 확인 질문을 하도록 지시합니다. 이어서 요청할 때는 전체 조건을 포함해 다시 질문합니다.

권역·반경·목적지 거리만으로 조회해도 API의 `search_mode`는 `gis`입니다. 의미와 정확한 조건을 함께 사용하면 `hybrid`이며, 이 이름이 가중 정렬이나 실제 DiskANN 사용을 뜻하지는 않습니다. 가중 정렬은 `semantic_spatial`을 명시했을 때만 적용합니다.

`search_mode`의 결정 규칙은 다음과 같습니다. SQL·GIS 모드도 내부적으로는 SQL을 실행합니다.

| 모드 | 결정 조건 | 기본 결과 순서 |
| --- | --- | --- |
| `sql` | 화물 의미 검색과 공간 조건 없이 상태·배송 번호·장소명 등으로 조회 | 배송 번호순 |
| `gis` | 화물 의미 검색 없이 권역·반경·목적지 거리 정렬 중 하나 사용 | 배송 번호순 또는 요청한 목적지 거리순 |
| `diskann_cosine` | `cargo_query`만 있고 정확한 상태·번호·장소·권역·반경 조건은 없음 | 코사인 거리 오름차순 |
| `hybrid` | `cargo_query`와 정확한 조건(ETA 포함)을 함께 사용 | 기본 코사인 거리순, 명시적 `semantic_spatial`은 가중 점수순 |
| `not_searched` | Agent가 도구를 호출하지 않고 확인 질문으로 응답 | 새 배송 결과 없음 |

`result_limit`만 추가해도 모드는 바뀌지 않습니다. 화면의 상태 선택과 화물 의미 검색을 함께 사용하면 `hybrid`입니다.
반경 검색 자체가 거리순 정렬은 아닙니다. 출발·도착 좌표로 검색해도 지도는 `current_position`을 표시합니다.

### 필터별 의미와 제한

| 필드 | 의미와 검사 방식 |
| --- | --- |
| `status` | `in_transit`, `delivered`, `delayed`, `exception`, `unknown` 중 하나 |
| `shipment_number` | `SHIP-0004` 같은 배송 번호 일치 검사 |
| `origin_name`, `destination_name` | 등록된 장소명과 일치 검사. 국가 전체나 좌표 반경 조건이 아님 |
| `origin_region`, `destination_region` | `Asia`, `Middle East`, `Europe`, `North America`, `South America`, `Africa`, `Oceania` 경계와 좌표 비교 |
| `nearby_location`, `radius_km` | 등록 도시와 반경을 함께 지정. km를 미터로 바꿔 `ST_DWithin`에 전달 |
| `position_field` | 반경 검사 좌표: `origin`, `destination`, `current`. 기본값은 `current` |
| `cargo_query` | 화물 의미 검색어. 상태·지리·배송 번호·표시 지시는 넣지 않음 |
| `eta_start`, `eta_end` | ISO 날짜 범위, 양 끝 포함. 한쪽만 지정 가능. 역전된 범위는 거부하며 ETA가 없는 레코드는 제외 |
| `sort_by` | `destination_distance`는 자기 도착지 거리순, `semantic_spatial`은 의미·기준점 근접도 가중 점수순 |
| `result_limit` | 요청 건수 1~24. 실제 표시 건수에는 API의 `limit` 상한도 적용 |

Workbench는 ETA 중심일 ±일수(0~365)를 서버에서 범위로 계산합니다. `Map radius`를 켜고 지도를 클릭하면
현재 위치를 선택 좌표와 비교합니다. 반경 원은 현재 입력값을 나타내며, 적용 후 값을 바꾸면 `Unapplied changes`를 표시합니다.
일반 마커 선택은 반경 조건을 추가하지 않습니다. `Clear`는 조건·반경·결과를 초기화합니다.
직접 입력한 화물 검색어는 그대로 임베딩하며, 검색어와 기준점이 모두 있을 때만 가중 정렬을 선택할 수 있습니다.

지도 좌표용 `nearby_point`는 직접 검색에서만 받습니다. Agent 도구의 JSON Schema에서는 제외하고
모델이 보내더라도 실행 전에 거부합니다. 채팅에는 왼쪽의 상태 선택만 추가 적용하며 ETA·반경·검색어는 자동 전달하지 않습니다.
채팅 검색이 성공하면 왼쪽 목록은 `Agent matches`로 바뀝니다.

ETA 순 정렬은 지원하지 않으며 화물 의미 검색과 자기 목적지 거리 정렬도 함께 사용할 수 없습니다.
거리순 검색의 기본 배송 완료 제외는 코드에 정한 동작이며 일반적인 제외 조건 지원을 뜻하지 않습니다.
입력 검사나 외부 API·DB 호출 실패는 오류로 처리하고, 결과 0건이나 확인 질문으로 바꾸지 않습니다.

## ETA·권역·거리의 의미

ETA는 저장된 도착 예정일입니다. 채팅은 시작일·종료일의 양 끝을 포함하고, Workbench는 중심일 ±일수를 서버에서 계산합니다. 상대 날짜는 `SEARCH_TIMEZONE`의 요청 날짜를 기준으로 해석합니다. 기본 시간대는 `Asia/Seoul`입니다. “이번 주”는 실행 날짜마다 범위가 달라지므로 고정 샘플 발표에서는 절대 날짜가 적합합니다. ETA가 없는 레코드는 날짜 조건에서 제외하며 ETA 순 정렬은 지원하지 않습니다.

![2026년 9월 ETA와 delayed를 함께 지정한 실제 검색](media/fleet-eta-result.png)

2026-09-15 확인한 위 질문은 SHIP-0005, SHIP-0011, SHIP-0020을 반환했습니다. 화물 조건이 없어 임베딩은 생략하지만 조건 해석과 한국어 답변을 위한 채팅 모델 호출은 남습니다. 고정된 처리 시간이나 모든 환경의 결과를 보장하는 수치는 아닙니다.

권역은 Natural Earth v5.1.2의 1:50m 국가 경계를 합쳐 `ST_Covers`로 판정합니다. 경계 위의 점도 포함하지만 해안 밖 부두나 해상 좌표는 제외될 수 있습니다. 현재 샘플의 코펜하겐·이스탄불·뉴욕 좌표는 단순화된 경계 밖으로 판정됩니다. 국가 내부를 물리적 대륙 경계로 나누지 않으며, 중동은 별도의 데모용 국가 집합입니다. 도시 이름으로 결과를 보정하지 않습니다.

반경은 등록된 도시 또는 수동 선택 좌표를 기준으로 `geography`의 미터 거리로 검사합니다. Workbench는 현재 위치에 50~3,000km 반경을 적용합니다. 채팅은 출발·도착·현재 위치를 구분하며, 5,000km 예시는 등록 도시를 사용하는 채팅의 범위입니다. 지도에는 어느 경우든 현재 위치를 표시합니다.

상대 날짜는 요청 시작 시 모델 지침에 넣은 시간대별 날짜로 해석합니다. 주 단위는 월요일부터 일요일이며,
중심일 ±N일은 시작일·종료일로 변환합니다. 날짜 계산에는 모델 판단이 들어가므로 확정 범위는 실행 내역에서 확인합니다.
모호한 기간이나 `도착이 임박한 배송`처럼 거리·ETA 중 기준이 불분명한 질문은 먼저 기준을 확인합니다.
저장된 도착 예정일을 검사하는 기능이며 실제 도착 이력을 조회하지 않습니다.

### 권역 판정 기준

[경계 적재 코드](../backend/app/region_boundaries.py)는 Natural Earth의 `CONTINENT` 속성별 경계를 합칩니다.
출발지는 `ST_Covers(region.boundary, s.origin_position)`, 도착지는 같은 함수와 `destination_position`으로 검사합니다.
도시명이나 기존 `metadata.regions`로 판정하지 않습니다. 튀르키예 전체는 아시아, 러시아 전체는 유럽으로 분류합니다.

중동은 바레인·키프로스·이집트·이란·이라크·이스라엘·요르단·쿠웨이트·레바논·오만·팔레스타인·카타르·
사우디아라비아·시리아·튀르키예·아랍에미리트·예멘의 국가 경계를 합친 데모용 집합입니다.
이집트는 아프리카에도 포함되므로 중동 전체가 아시아의 부분집합은 아닙니다.

[번들 경계](../database/region_boundaries.json)는 약 2.15MB이며 원본 URL·SHA-256·국가별 분류를 포함합니다.
Natural Earth는 [public domain](https://www.naturalearthdata.com/about/terms-of-use/)입니다.
이 경계 표현을 지리·정치적 입장이나 항만 운영 구역의 정의로 해석하지 않습니다.
실행 중 원본을 다운로드하거나 경계 전체를 모델·브라우저로 전송하지 않습니다.

경계 밖 해안 좌표를 도시명으로 보정하지 않습니다. 따라서 튀르키예를 아시아로 분류해도
이스탄불 샘플 좌표는 아시아 검색에 포함되지 않습니다.
장소명과 반경 중심점은 [등록 도시 목록](../backend/app/search_locations.py)을 사용하며, 새 도시는 목록에 추가해야 합니다.
지원하지 않는 국가·제외 조건을 벡터 검색으로 대신 처리하지 않도록 Agent에 지시합니다.

경계만 추가하는 작업은 기존 배송·임베딩을 유지합니다. 데이터가 커지면 출발·도착 geometry GiST와
geography 표현식 GiST 인덱스를 실행 계획에 맞춰 검토합니다. geometry 인덱스가 geography 형변환에도 사용된다고 가정하지 않습니다.

목적지 거리 정렬은 `ST_Distance(current_position::geography, destination_position::geography)`를 사용합니다. 상태를 지정하지 않으면 배송 완료를 제외하고 같은 거리에서는 배송 번호로 정렬합니다. 이 거리는 실제 항로 길이나 도착까지 걸리는 시간이 아닙니다. 화물 의미 검색과 자기 목적지 거리순의 동시 사용은 지원하지 않습니다.

## 의미·근접도 가중 정렬

```text
hybrid_score = 0.72 * cosine_similarity
             + 0.28 * max(0, 1 - distance_to_center_km / radius_km)
```

72:28은 이 샘플의 정렬 정책입니다. 근접도 항은 반경 안에서 기준점에 가까울수록 커지지만 코사인 유사도는 음수도 가능하므로 전체 점수를 0~1 확률로 설명하지 않습니다. 화면의 `cos`는 코사인 유사도, `score`는 이 가중 점수입니다. 화물 의미 검색은 관련성 정렬이지 품목의 정확한 일치 조건이 아니므로 다른 종류의 화물도 결과에 포함될 수 있습니다.

가중 정렬은 조건에 맞는 전체 레코드를 평가한 뒤 LIMIT을 적용합니다. 먼저 코사인 상위 일부만 뽑으면 가까운 배송이 가중 상위 결과에서 누락될 수 있기 때문입니다. 이 선택은 큰 데이터에서 비용을 늘릴 수 있으며 DiskANN의 근사 최근접 탐색 성능을 그대로 기대할 수 없습니다. 일반 의미 검색과 가중 정렬은 같은 접근 경로라고 가정하지 않습니다.

`semantic_spatial`에는 `cargo_query`, 반경 기준점, `radius_km`이 모두 필요합니다.
채팅은 등록 도시, 직접 검색은 선택 좌표를 기준점으로 사용합니다. `position_field`의 좌표에서
기준점까지 거리를 계산하며 동점은 배송 번호순입니다. 반경만 지정한 일반 의미 검색의 순서는 바뀌지 않습니다.
`distance_to_center_km`는 기준점 거리이고 `remaining_distance_km`는 자기 도착지 거리입니다.

## SQL과 인덱스

모델은 조건만 선택하고 열·정렬식은 서버 코드에서 고릅니다. 조건값은 Psycopg의 `%s`에 바인딩합니다. 다음은 아시아 출발 의료용품 검색을 설명하기 위해 조회 열을 줄인 예시입니다. 실제 SQL은 요청의 실행 내역을 확인합니다.

```sql
WITH query_vector AS (SELECT %s::public.vector(1536) AS embedding)
SELECT s.shipment_number,
       1 - (se.embedding <=> query_vector.embedding) AS similarity
FROM horizon_ship.shipments AS s
JOIN horizon_ship.shipment_embeddings AS se ON se.shipment_id = s.id
LEFT JOIN horizon_ship.shipment_embedding_jobs AS sej ON sej.shipment_id = s.id
CROSS JOIN query_vector
WHERE (%s::text IS NULL OR s.status = %s)
  AND (sej.shipment_id IS NULL OR sej.content_version = se.content_version)
  AND EXISTS (
      SELECT 1 FROM horizon_ship.region_boundaries AS region
      WHERE region.name = %s
        AND public.ST_Covers(region.boundary, s.origin_position)
  )
ORDER BY se.embedding <=> query_vector.embedding
LIMIT %s;
```

화면 상태가 없고 표시 상한이 8건이면 바인딩은 `[검색어 벡터, null, null, "Asia", 9]`입니다.
`medical supplies`만 임베딩하고 출발 권역은 공간 조건으로 유지합니다. AI가 벡터 결과에서 권역을 다시 추측하지 않습니다.
이는 논리적 조건이며 DB의 물리적 실행 순서나 인덱스 선택을 고정하지 않습니다.

권역 조건 없이 화물 의미 검색과 `status=delayed`를 함께 지정하고 상위 5건을 요청하면
`[검색어 벡터, "delayed", "delayed", 6]`을 바인딩합니다. 이때는 위 SQL의 권역 `EXISTS` 조건이 없습니다.
추가 결과 확인용 한 행을 더 조회하고 상위 5건만 반환합니다.
`%s`는 Psycopg 매개변수 자리이므로 이 예시를 SQL 콘솔에 그대로 실행하지 않습니다.

`목적지에 가장 가까운 2개`는 임베딩 없이 조회합니다.

```sql
SELECT s.shipment_number,
       public.ST_Distance(
           s.current_position::public.geography,
           s.destination_position::public.geography
       ) / 1000.0 AS remaining_distance_km
FROM horizon_ship.shipments AS s
WHERE (%s::text IS NULL OR s.status = %s)
  AND s.status <> %s
ORDER BY remaining_distance_km ASC, s.shipment_number ASC
LIMIT %s;
```

명시적 상태가 없을 때 바인딩은 `[null, null, "delivered", 3]`입니다.
3행 중 상위 2건을 반환하고 나머지 행으로 `has_more`를 판단합니다.
상태를 명시하면 기본 배송 완료 제외 조건 대신 해당 상태를 적용합니다.
코사인 검색은 `ORDER BY ... LIMIT`에 거리 연산식을 유지하고 가중 정렬은 별도 경로를 사용합니다.

기본 벡터 인덱스는 cosine 연산자에 맞춘 DiskANN이며 `spherical_quantized=true`, `sq_bits=4`, `sq_training_samples=25000`을 설정합니다. 25,000은 설정값이지 적재한 배송 수가 아닙니다. 공통 DiskANN 설정 6개는 새 풀 연결의 초기화 단계에서 `SET SESSION`으로 한 번 적용합니다. 매 요청마다 `SET LOCAL`을 실행하지 않습니다.

```sql
CREATE INDEX shipment_embeddings_diskann_idx
  ON horizon_ship.shipment_embeddings
    USING diskann (embedding vector_cosine_ops)
    WITH (
        spherical_quantized = true,
        sq_bits = 4,
        sq_training_samples = 25000
    );
```

Spherical quantization은 낮은 비트 수로 벡터를 압축하는 Preview 기능입니다.
DiskANN은 근사 최근접 검색이므로 전체 벡터를 정확히 비교한 결과와 일부 차이가 날 수 있습니다.
풀의 `configure` 콜백은 설정 SQL을 묶어 전송하고 초기화 트랜잭션을 커밋합니다.
풀 확장·재연결에도 같은 설정을 적용하며 서버·DB 전체 기본값은 바꾸지 않습니다.
초기화 실패 연결은 풀에서 사용할 수 없고 앱 시작도 실패할 수 있습니다.

상태·ETA B-tree와 공간 GiST는 planner의 선택지를 제공합니다. 현재 위치 반경용 `shipments_current_geography_idx`는 `(current_position::geography)` 표현식 인덱스입니다. geometry 인덱스가 이 형변환 검색에도 사용된다고 가정하지 않습니다. 2026-09-15 ETA·geography 인덱스를 추가한 뒤 유효 상태와 배송 24건·벡터 24건·작업 큐 0건의 보존을 확인했습니다. 이 문서 작업에서는 DB를 변경하지 않았습니다.

원본 자료의 특정 BitmapAnd, DiskANNFilteredScan, TID 개수나 실행 시간은 원본 환경의 결과입니다. 현재 조건에서 같은 계획이 반드시 나온다고 설명하지 않습니다. 특히 24건의 작은 데이터에서는 Seq Scan도 합리적인 선택일 수 있습니다.

## 요청별 SQL viewer와 예상 계획

![6:4 분할과 CodeMirror SQL 범위 강조를 적용한 현재 예상 실행 계획 팝업](media/fleet-query-plan.png)

채팅의 실행 내역은 요청 ID·순번·경과시간으로 진행 상태를 기록합니다. 임베딩 직전에 실제 입력 검색어를 표시하고, SQL과 바인딩 값은 실행 직전에 전송합니다. SQL 이벤트가 있다는 사실만으로 조회 성공을 판단하지 않고 뒤의 DB 결과 수신 이벤트를 확인합니다. 답변은 완성 후 한 번에 전달하며 내부 추론이나 토큰별 생성 과정은 노출하지 않습니다.

`CAPTURE_QUERY_PLAN=true`일 때 같은 바인딩 값으로 `EXPLAIN (FORMAT JSON)`을 조회합니다. 검색어 벡터는 먼저 생성한 것을 재사용합니다. `ANALYZE`가 아니므로 검색을 다시 실행해 실제 시간·buffer·WAL을 수집하지 않으며, 계획 조회를 위해 모델을 다시 호출하지 않습니다. 화면의 DB 시간은 execute와 fetch를 포함한 클라이언트 측정값입니다.

CodeMirror SQL viewer는 구문 강조·줄 번호·정돈/원본 보기·줄바꿈을 지원합니다. 복사 버튼은 원본 SQL을 복사하고 바인딩 값은 별도 접이식 영역에 표시합니다. SQL:EXPLAIN의 초기 6:4 비율을 드래그·방향키로 바꾸고 두 번 클릭해 복원합니다. 모바일은 위아래로 배치합니다.

계획 노드를 누르면 PostgreSQL 구문 트리에서 LIMIT·ORDER BY·GROUP BY·테이블 참조 중 유일하게 대응하는 범위를 강조합니다. EXPLAIN에 SQL 원문 위치가 없으므로 추정 연결입니다. 중복된 절, 같은 테이블을 여러 번 참조하는 SQL, 직접 대응하지 않는 optimizer 노드는 임의로 강조하지 않습니다.

벡터 숫자와 노출 위험이 있는 Filter·Output 등은 계획에서 제거합니다. 요청별 이벤트는 브라우저 메모리에 보관하며 전역 last plan을 사용하지 않습니다. 다른 검색 뒤에도 해당 답변의 계획을 확인할 수 있지만, 새로고침이나 대화 초기화로 사라집니다. 팝업을 다시 열거나 크기를 바꾸는 동작은 API를 호출하지 않습니다.

요청별 이벤트에는 요청 ID·순번·서버 경과시간이 포함됩니다. 바인딩은 `%s` 순서대로 표시하되
벡터 숫자는 `[vector: 1536 dimensions; omitted]`로 대체합니다. 풀 초기화 설정은 요청마다 반복하지 않고 실행 내역에도 표시하지 않습니다.
DB 수신 행 수에는 추가 결과 확인용 한 행이 포함될 수 있습니다. 트랜잭션·풀 내부 SQL까지 추적하는 DB 감사 로그는 아닙니다.

10초간 새 이벤트가 없으면 heartbeat를 보내며 서버는 120초, 브라우저는 150초에 timeout을 처리합니다.
중단 버튼과 연결 종료는 해당 비동기 작업을 취소합니다. 스트림 오류는 최종 `error` 이벤트로 전달하고,
클라이언트는 최종 `result` 없이 종료된 연결도 실패로 처리합니다.
계획 조회의 DB 오류는 별도 이벤트로 표시하고 검색은 계속하지만 실제 검색 오류는 실패로 처리합니다.
계획에는 노드·인덱스·예상 행 수·비용만 허용하며 Filter·Order By·Output 등은 제거합니다.

키·접속 문자열·전체 벡터·예외 원문은 이벤트에 넣지 않지만 검색어·조건에는 업무 데이터가 포함될 수 있습니다.
운영 적용 시 인증·접근 권한·마스킹을 추가하거나 추적 endpoint 대신 `/api/chat`을 사용합니다.
프록시는 응답 버퍼링을 끄고 스트림 timeout을 맞춰야 합니다.

## 모델 호출과 기존 pipeline

`CHAT_PROVIDER`와 `EMBEDDING_PROVIDER`는 각각 `azure_openai`와 `horizondb` 중에서 선택합니다. 기본값은 직접 API 호출입니다. DB provider의 모델 별칭은 `horizonship-chat`, `horizonship-embedding`이며, 채팅은 `azure_ai.generate`, 임베딩은 `azure_openai.create_embeddings`를 호출합니다. 실제 inference는 두 경로 모두 외부 모델 endpoint에서 실행됩니다.

DB 채팅 adapter는 모델의 구조화 응답을 검사하고, 검색 도구를 최대 한 번 호출한 뒤 도구 결과로 한국어 답변을 작성합니다. 확인 질문이면 도구를 실행하지 않습니다. DB 함수가 Python 도구를 실행하는 것은 아니며, JSON 오류나 모델 오류를 다른 provider로 자동 전환하지 않습니다.

배송 변경 후 벡터 갱신은 두 provider 설정과 관계없이 기존 DB pipeline이 처리합니다. 모델 별칭만 준비할 때는 전체 setup 대신 `--models-only` 절차를 사용합니다. DB 경유 모델 요청은 풀 연결을 점유하므로 긴 모델 대기와 DB 연결 수를 함께 검토해야 합니다. 중단 요청이 이미 발생한 외부 모델 비용까지 취소하지는 못합니다.

## 지도·폰트·데모 상태

본문과 제목은 Pretendard를 사용하고 SQL은 고정폭 폰트를 유지했습니다. 초기 예시 발화에는 상태·권역·반경에 더해 ETA, 목적지 거리, 의미·근접도 정렬을 포함했습니다. 데스크톱과 모바일에서 같은 조건을 조회할 수 있습니다.

지도는 상태별 선박 아이콘을 사용합니다. 목록 선택, 팝업, 상세의 배송을 일치시키고 `현재 위치 보기`로 이동합니다. 이전 대화의 배송이 현재 결과에 없으면 선택한 한 건을 지도에 임시로 추가하고 결과 밖 배송임을 알립니다. 출발·현재·도착 연결선은 날짜 변경선에서 나눈 개략 경로이며 실제 항적이 아닙니다.

SHIP-0024의 `unknown`은 위치 갱신 미보고를 가정한 명시적 샘플 상태입니다. API 변환 실패나 지도 렌더링 실패의 대체값이 아닙니다. 데이터와 의미는 [샘플 정의](../backend/app/sample_data.py)를 따릅니다.

채팅은 요청당 최대 8건, 직접 조건 검색은 최대 24건을 표시하고 `has_more`로 추가 결과를 알립니다.
페이지 이동은 아직 없습니다. SQL·GIS 결과에는 유사도 대신 `조건 일치`를 표시합니다.
결과가 없어도 조건을 풀거나 자동 재검색하지 않습니다.
이전 대화의 조건도 이어받지 않으므로 필요한 조건을 포함한 완전한 질문으로 다시 요청합니다.

결과 카드 본문은 선택·상세 표시, `현재 위치 보기`는 지도 이동·확대·팝업 열기 동작입니다.
같은 버튼을 다시 누르면 해당 위치로 다시 이동합니다. 결과 밖 선택 한 건은 필터를 바꾸지 않고 임시 표시합니다.
상세를 닫으면 임시 마커를 제거하고, 위치 보기로 이동했다면 기존 결과 범위로 돌아옵니다.
새 AI 검색이 완료되면 이전 선택을 해제합니다. 모바일의 카드 선택·위치 보기는 지도 탭을 엽니다.

## 실행·검증·운영 전 확인

로컬에서는 backend를 uv, frontend를 npm으로 별도 실행합니다. HorizonDB와 선택적 Foundry는 PowerShell·Bicep의 조회 전용 Check, WhatIf, 승인 후 Deploy 순서로 준비할 수 있습니다.

앱 호스팅은 [azure.yaml](../azure.yaml)의 `azd up` 흐름으로도 지원합니다. ACR과 Container Apps를 배포하고 HorizonDB는 기존 cluster 연결 또는 신규 생성을 선택합니다. 이 흐름은 Foundry나 모델 deployment를 만들지 않으므로 key 인증이 가능한 기존 모델 endpoint가 필요합니다. 기존 DB는 기본적으로 setup을 실행하지 않으며, 신규 DB는 최초 backend 시작 때 스키마·샘플·임베딩·인덱스·pipeline을 준비합니다. 설정과 방화벽, 종료 시 삭제 범위는 [인프라 README](../infra/README.md#azure-container-apps-배포)를 확인합니다.

2026-09-15의 기존 구현 검증에서는 backend 147개 테스트와 실제 DB 모델·ETA·반경·가중 검색을 확인했습니다. SQL 범위 연결은 별도 6개 테스트가 있으며 frontend 빌드·lint와 실제 브라우저 검사를 수행했습니다. 문서의 캡처는 현재 앱에서 저장한 화면이며 원본의 측정값을 재사용하지 않았습니다. 모델의 모든 표현, 모든 환경의 계획, 운영 성능을 보장하는 검증은 아닙니다.

현재 API는 인증 없는 데모용입니다. Container Apps에서는 backend ingress를 내부로 제한하지만, public frontend의 Nginx가 `/api`를 전달하므로 API가 인증으로 보호되는 것은 아닙니다. 운영에서는 사용자 인증, 데이터 접근 권한, 검색어·조건의 마스킹, 네트워크와 timeout 정책을 추가해야 합니다. HorizonDB Preview의 지원 리전·구독·모델 가용성도 배포 시 다시 확인합니다. 이 샘플의 목적은 어떤 조건으로 어떤 배송을 조회했는지 확인할 수 있는 구현을 제공하는 데 있습니다.

## 모델 호출 위치 선택

[환경 변수 예제](../backend/.env.example)의 기본값은 직접 API 호출입니다.
`CHAT_PROVIDER`는 채팅, `EMBEDDING_PROVIDER`는 검색어와 초기 backfill에 적용합니다.
배송 변경의 `on_change` pipeline은 어느 설정에서도 DB에서 실행합니다.

| 설정 | `azure_openai` | `horizondb` |
| --- | --- | --- |
| `CHAT_PROVIDER` | OpenAIChatClient, native tool calling | `azure_ai.generate(prompt, alias, system_prompt)`로 JSON 계획·최종 답변 생성 |
| `EMBEDDING_PROVIDER` | OpenAI SDK로 검색어·초기 backfill 생성 | `azure_openai.create_embeddings(alias, input)`로 같은 입력·1536차원 생성 |

준비된 DB의 호출 경로를 전환할 때는 다음을 지정합니다.

```dotenv
CHAT_PROVIDER=horizondb
CHAT_MODEL_ALIAS=horizonship-chat
EMBEDDING_PROVIDER=horizondb
EMBEDDING_MODEL_ALIAS=horizonship-embedding
CAPTURE_QUERY_PLAN=true
MODEL_TIMEOUT_SECONDS=45
SEARCH_TIMEZONE=Asia/Seoul
```

`backend`에서 alias만 준비하고 백엔드를 재시작합니다.

```bash
uv run python -m app.setup_database --models-only
```

이 명령은 스키마·샘플·벡터·인덱스·pipeline을 변경하지 않습니다.
새 alias를 등록하거나 metadata가 같은 alias의 key를 갱신하며, 다른 endpoint·deployment·모델의 alias는 오류로 중단합니다.
기본 alias가 서버에 미리 있다고 가정하지 않습니다. 외부 모델 등록에는 현재 `AZURE_OPENAI_KEY`가 필요합니다.
두 provider가 모두 `horizondb`이고 alias가 준비됐다면 앱 실행에는 모델 key가 없어도 되지만,
DB 접속 정보와 저장된 벡터의 endpoint·deployment 설정은 여전히 필요합니다.

전체 setup은 샘플을 갱신하고 인덱스를 다시 만들므로 모델 전환만을 위해 실행하지 않습니다.
기존 DB에 조회 인덱스만 추가할 때는 트랜잭션 밖에서 아래 DDL을 각각 실행합니다.
`CONCURRENTLY`도 부하·장기 트랜잭션에 영향을 받으므로 운영에서는 먼저 확인합니다.
같은 이름의 인덱스가 있으면 정의와 유효 상태를 검사해야 합니다.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS shipments_eta_idx
  ON horizon_ship.shipments (eta);
CREATE INDEX CONCURRENTLY IF NOT EXISTS shipments_current_geography_idx
  ON horizon_ship.shipments USING gist ((current_position::public.geography));
```

2026-09-15에는 두 인덱스의 `indisvalid`, `indisready`가 true임을 확인했습니다.
적용 전후 배송 24건·벡터 24건·작업 큐 0건의 건수와 해시가 같았으며 기존 geometry 인덱스·DiskANN·pipeline을 유지했습니다.

runtime DB 모델 호출은 풀 연결을 점유하고 트랜잭션에 `MODEL_TIMEOUT_SECONDS`의 statement timeout을 적용합니다.
초기 setup은 별도 동기 작업으로 이 제한을 적용하지 않습니다.
직접 호출로 되돌릴 때는 provider를 `azure_openai`로 바꾸고 재시작합니다. 저장된 벡터는 유지됩니다.
취소하더라도 이미 발생한 외부 모델 비용이 되돌아오는 것은 아닙니다.

2026-09-15 재검증에서는 DB 연결 복구와 `azure_ai 2.2.2`의 text 생성·1536차원 embedding을 확인했습니다.
`horizonship-chat` 등록 후 두 provider를 `horizondb`로 지정한 검사에서 ETA 검색은 12.6초에 3건,
ETA·반경 가중 검색은 16.4초에 상위 3건, 확인 질문은 3.5초에 검색 없이 완료됐습니다.
예상 계획과 가중 점수 계산도 확인했습니다. 한 환경의 한 차례 측정값이며 응답 시간 보장이 아닙니다.
새 환경에서는 설치 함수 signature·alias·DB에서 Foundry로의 접근을 다시 확인합니다.
시작 시 함수 존재 검사만으로 모델 호환성의 종단 간 검증을 대신하지 않습니다.

## 인증과 endpoint 설정

공통 환경을 준비한 뒤 `backend`의 `.env`에 실제 DB·모델 값을 지정합니다.
아래는 Fleet의 설정 예시이며 홈쇼핑의 모델 alias는 [홈쇼핑 문서](home-shopping.md)에서 별도로 지정합니다.

```dotenv
AZURE_PG_HOST=your-horizondb-host
AZURE_PG_NAME=your-database-name
AZURE_PG_USER=your-database-user
AZURE_PG_PASSWORD=your-database-password
AZURE_PG_PORT=5432
AZURE_PG_SSLMODE=require

AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-5.4
AZURE_EMBED_DEPLOYMENT=text-embedding-3-small
```

`MODEL_REGISTRY_AUTH_TYPE=subscription-key`가 기본값입니다. setup은 `AZURE_OPENAI_KEY`를
DB model registry에 등록하므로 비워 둘 수 없습니다. 직접 호출 provider는 backend에서도 key를 사용하고
DB provider는 등록된 alias로 호출합니다. key가 있으면 Entra ID로 자동 재시도하지 않습니다.

`MODEL_REGISTRY_AUTH_TYPE=managed-identity`는 key 없이 등록을 시도하는 실험용 모드입니다.
DB에 User Assigned Managed Identity를 연결하고 모델 호출 권한을 부여해야 합니다.
backend 직접 호출에도 같은 identity를 쓰려면 `AZURE_CLIENT_ID`에 client ID를 지정합니다.
다만 2026-09-10의 `azure_ai 2.2.2`와 2026-10-28 KRC의 `azure_ai 2.5.3` 검증 모두
`Managed identity authentication is not yet supported for BYOM models` 오류를 반환했습니다.
[공식 AI 함수 문서](https://learn.microsoft.com/azure/horizondb/ai/ai-functions#register-a-model)의 인증 설명과
실제 대상 DB의 지원 상태를 구분해야 합니다. 미지원이면 오류로 중단하고 pipeline을 생략하거나 다른 인증으로 자동 전환하지 않습니다.

| 구성 | 인증 방식 | 사전 준비 |
| --- | --- | --- |
| key 인증을 허용하는 외부 Foundry | backend와 DB model registry의 subscription key | endpoint, 유효한 key, 두 모델의 실제 deployment 이름 |
| 저장소 스크립트로 만든 Entra ID 전용 Foundry | backend 직접 호출에 Managed Identity 사용 가능, 검증한 DB의 BYOM 등록은 미지원 | 앱 identity·모델 호출 RBAC, 현재 DB pipeline에는 별도 key 인증 리소스 필요 |

저장소의 Foundry 배포 스크립트는 `disableLocalAuth: true`로 key 인증을 차단합니다.
현재 검증된 앱 배포는 key 인증을 허용하는 별도 KRC 리소스를 사용합니다.
같은 그룹의 Foundry Project나 모델 호출 RBAC를 추가하는 것만으로 DB의 BYOM 제한을 해결할 수는 없습니다.
배포 스크립트는 외부 Foundry를 수정하거나 key를 조회하지 않습니다. 노출된 key는 폐기·재발급하고 채팅·소스·로그에 넣지 않습니다.

Entra ID 직접 호출은 앱 실행 계정으로 `az login`을 수행합니다.
`DefaultAzureCredential`은 환경 변수·Managed Identity·Azure CLI 등을 순서대로 검사하므로
다른 서비스 주체 환경 변수가 CLI 계정보다 먼저 선택될 수 있습니다. 토큰 발급·갱신은 SDK가 처리합니다.
계정에는 부모 Foundry 리소스 범위의 `Cognitive Services OpenAI User` 등 모델 호출 권한이 필요합니다.
Project 범위 권한이나 Contributor만으로 대신할 수 없으며 권한 반영에는 시간이 걸릴 수 있습니다.

DB pipeline은 모델 endpoint를 직접 호출합니다. subscription key를 DB model registry에 저장하므로
DB 관리자·백업 접근 권한과 로그 정책을 비밀정보 관리 기준에 맞춰 제한합니다. setup 출력이나 앱 로그에 key를 기록하지 않습니다.

`AZURE_OPENAI_ENDPOINT`에는 `https://<resource>.openai.azure.com/` 또는
`https://<resource>.services.ai.azure.com/`를 사용합니다.
`/openai/v1/responses`, `/openai/v1/embeddings` 주소도 받아 SDK용 주소로 정규화하지만 `/api/projects/...` endpoint는 사용하지 않습니다.
임베딩은 OpenAI v1 API를 사용합니다. 채팅·임베딩 deployment는 같은 리소스 안에 있어야 하며 실제 배포 이름과 환경 변수를 맞춥니다.
직접 호출은 backend에서, DB 호출은 HorizonDB에서 endpoint에 접근할 수 있어야 합니다.
DB 접속은 별도의 PostgreSQL 사용자·비밀번호를 사용합니다. 개별 `AZURE_PG_*` 대신 `DATABASE_URL`도 사용할 수 있습니다.
환경 변수 예제의 연결 풀 설정은 그대로 두고 비밀 값이 담긴 `.env`는 Git에 추가하지 않습니다.

## 데이터베이스 준비

### 확장 허용 목록

대상 DB에 접속해 다음을 확인합니다.

```sql
SHOW azure.extensions;
```

`vector`, `pg_diskann`, `postgis`, `uuid-ossp`, `azure_ai`가 모두 필요합니다.
빠진 항목이 있으면 연결할 parameter group의 `azure.extensions`에 아래 항목을 포함하고 기존 허용 확장은 유지합니다.

```text
vector,pg_diskann,postgis,uuid-ossp,azure_ai
```

생성·연결·적용은 [확장 허용 안내](https://learn.microsoft.com/en-us/azure/horizondb/extensions/how-to-allow-extensions)를 따릅니다.
적용 후 다시 접속해 결과를 확인합니다. 이 설정만을 위해 전체 인프라를 재배포하지 말고 다른 설정에 미치는 영향을 먼저 확인합니다.
서버의 확장 허용과 DB의 확장 설치는 별도 단계입니다.
[준비 코드](../backend/app/setup_database.py)는 [스키마 SQL](../database/schema.sql)의 `CREATE EXTENSION`을
실행하지만 서버 허용 목록이나 parameter group 연결은 변경하지 않습니다. 템플릿 배포만으로 적용됐다고 판단하지 않습니다.

### 스키마·샘플·임베딩·pipeline

확장 허용과 모델 인증을 준비한 뒤 `backend`에서 실행합니다.

```bash
uv run python -m app.setup_database
```

첫 실행은 몇 분 걸릴 수 있습니다. 허용 확장과 스키마를 설치하고 경계 일곱 개·배송 24건·임베딩·DiskANN 인덱스,
model registry·`on_change` pipeline·배송 변경 trigger를 구성합니다.

```text
HorizonShip ready: 24 shipments, 24 Azure embeddings, primary DiskANN index: ready
```

재실행은 샘플을 중복 생성하지 않지만 기존 샘플 값·인덱스·pipeline을 갱신합니다.
임베딩 endpoint·deployment·차원은 `embedding_configuration`에 저장합니다.
기존 `shipments.embedding`은 별도 `shipment_embeddings`로 옮긴 뒤 이전 열을 제거합니다.
초기 backfill은 backend가 처리합니다. 이후 의미 필드 변경은 trigger → job → DB pipeline → sink upsert로 연결합니다.
위치·ETA만 바뀌면 새 임베딩을 요청하지 않고, job과 sink의 `content_version`이 같은 배송만 의미 검색에 사용합니다.
text-embedding-3-small은 화물명·설명·지명·상태·metadata를 합친 텍스트를 임베딩합니다.

인증 방식·key 변경만으로 전체 벡터를 다시 만들지 않습니다.
같은 deployment 이름의 실제 모델을 교체했다면 아래 명령으로 명시적으로 재생성합니다.

```bash
uv run python -m app.setup_database --force-embeddings
```

배치 응답의 개수·순서·차원을 검사하고 실패하면 DB 트랜잭션을 롤백합니다. 이미 호출한 모델 비용은 되돌릴 수 없습니다.
model alias만 준비하려면 앞의 `--models-only` 절차를 사용합니다.

### 경계만 갱신

배송·임베딩·DiskANN은 유지하고 경계 테이블만 트랜잭션으로 갱신할 때 `backend`에서 실행한 뒤 백엔드를 재시작합니다.
JSON-C가 없는 PostGIS 빌드도 지원하도록 Shapely로 WKB를 만들어 전달합니다.

```bash
uv run python -m app.region_boundaries
```

원본을 다시 받을 때만 `uv run python -m app.region_boundaries --download`를 사용합니다.
고정 버전 URL에서 번들 JSON을 재생성하는 명령이며 DB 적재는 별도로 실행해야 합니다.

## 시작 시 검사

DB 연결이나 `AZURE_OPENAI_ENDPOINT`가 없으면 FastAPI를 시작하지 않습니다.
직접 호출은 key가 있으면 key 인증, 없으면 Entra ID를 사용하고 DB provider는 등록된 alias로 호출합니다.
두 provider가 모두 DB 경유이고 alias가 준비됐다면 앱의 모델 key는 생략할 수 있지만 전체 setup·외부 모델 등록에는 현재 subscription key가 필요합니다.

배송이 없거나 저장된 임베딩 설정과 backend 설정이 다르거나, 임베딩 누락 배송이 있거나,
SQ4 DiskANN 인덱스가 유효하지 않으면 시작하지 않습니다. 권역 일곱 개의 존재도 검사합니다.
DB provider는 함수·alias와 embedding alias의 endpoint·deployment를 추가 검사합니다.
SQL 검색만 사용하더라도 초기 DB·임베딩 준비는 필요합니다.
시작 성공이 실제 모델 인증 성공을 보장하지는 않습니다. 자격 증명·권한 오류는 모델 호출 시 확인할 수 있습니다.

## API와 데이터 입력

아래는 공통 상태 확인과 Fleet의 API입니다. 홈쇼핑은 [별도 문서](home-shopping.md)의 `/api/commerce/*`를 사용합니다.
사례 선택 화면을 추가해도 기존 endpoint와 요청·응답 규격은 유지합니다.

| 메서드 | 경로 | 역할 |
| --- | --- | --- |
| `GET` | `/api/health` | DB 연결·확장·임베딩·인덱스·모델·provider 상태 |
| `GET` | `/api/shipments` | 목록과 선택적 상태·텍스트 필터 |
| `GET` | `/api/shipments/stats` | 상태별 건수 |
| `GET` | `/api/shipments/embedding-status` | job version과 검색 가능한 embedding version 비교 |
| `GET` | `/api/shipments/{shipment_number}` | 상세와 PostGIS 좌표 |
| `POST` | `/api/shipments` | 배송 1건 추가 |
| `POST` | `/api/shipments/bulk` | 최대 20건을 한 transaction으로 추가 |
| `DELETE` | `/api/shipments/demo` | 데모 표식이 있는 요청 ID만 삭제. embedding 처리 중이면 409 |
| `PATCH` | `/api/shipments/{shipment_number}` | 화물명·설명·장소명·상태·좌표·ETA·metadata 수정 |
| `POST` | `/api/search/criteria` | Workbench의 직접 조건 검색. Agent 호출 없음 |
| `POST` | `/api/search` | 벡터 검색 직접 실행 |
| `POST` | `/api/chat` | Agent 답변과 도구의 배송 레코드 |
| `POST` | `/api/chat/stream` | NDJSON 검색 내역과 Agent 응답 |

`/api/health`는 모델 추론을 실행하지 않습니다. 실제 모델 인증·응답은 검색·대화 요청으로 별도 확인합니다.
목록 제목 옆 데이터 입력 버튼은 단건 update·insert와 20건 bulk insert를 지원합니다.
의미 필드 변경은 DB 반영 → embedding 대기 → 검색 가능으로 표시하며, 좌표만 바꾸면 embedding을 다시 만들지 않습니다.

### 벌크 데모 순서

1. 시작 배송 건수를 확인하고 **벌크 20건**에서 **추가할 배송 20건**을 펼쳐 화물·번호·출발/도착·상태를 확인합니다.
   **20건 추가**는 미리보기 목록을 전송하며 실패해도 같은 목록을 유지합니다. 성공 후 다시 추가하려면 **다음 20건 준비**를 누릅니다.
2. 건수가 20 증가하고 `SHIP-7xxx` 번호가 생기는지 확인합니다. 비어 있는 SHIP-7000부터 할당하고
   7000번대를 모두 쓰면 더 큰 번호를 사용합니다. 같은 좌표가 있을 수 있으므로 marker 수를 배송 건수로 보지 않습니다.
3. 실제 조회로 표시되는 **20 / 20건 embedding 반영 완료**를 기다립니다. 빠르게 처리되면 중간 숫자 없이 완료될 수 있습니다.
4. `새 콜드체인 화물 검색`, `인도적 지원 물품 찾기`, `재생에너지 배송 보기`로 검색하고 실행 내역·새 번호를 확인합니다.
   전체 배송을 검색하므로 기본 상위 8건에 기존 배송도 섞일 수 있습니다. 검색 결과 수와 pipeline 완료 건수는 다릅니다.
5. **벌크 20건** 하단 **데모 데이터 N건** 옆 휴지통에서 건수를 확인하고 **N건 삭제**를 누릅니다.
   해당 배송과 job·embedding을 함께 삭제하며 목록·지도·통계·이전 채팅 결과를 갱신합니다.

삭제 API는 UUID와 `metadata.demo_run: true`, `pipeline-demo` 태그를 모두 검사합니다.
확인창을 연 뒤 다른 화면에서 생성한 배송은 요청에 포함하지 않습니다.
기존 배송은 유지하지만 단건 update로 바꾼 기존 배송 값을 복원하지는 않습니다.
다른 데모 데이터가 없었다면 전체 건수는 시작 값으로 돌아갑니다.
embedding 처리 중에는 삭제를 막으며, 대기 시간이 초과돼도 서버 version 비교가 pending이면 삭제하지 않습니다.

발표용 요약은 [슬라이드](fleet-intelligence-slides.html), 공통 실행은 [프로젝트 README](../README.md), 자료 전체는 [문서 안내](README.md)를 참고합니다.