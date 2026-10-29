export const USE_CASES = [
  {
    id: 'fleet',
    title: 'Fleet Intelligence',
    category: 'Spatial & semantic search',
    subtitle: '배송 데이터의 공간·의미 복합 검색',
    question: '위치와 배송 조건을 만족하면서, 찾는 화물과 의미가 가까운 배송은?',
    description: '정형 조건, 공간 조건, 의미 검색을 조합합니다. AI는 질문을 검색 조건으로 해석하고 도구의 조회 결과를 바탕으로 답합니다.',
    capabilities: ['PostGIS', 'pgvector · DiskANN', 'AI Functions · Pipelines', 'Agent with Tools'],
    documentation: 'blog-post.html',
    presentation: 'fleet-intelligence-slides.html',
  },
  {
    id: 'commerce',
    title: 'Home Shopping Intelligence',
    category: 'SQL analytics & AI classification',
    subtitle: '주문 집계와 고객 반응 분석',
    question: '방송 중 주문 흐름은 어떻고, 고객은 무엇 때문에 구매를 망설일까?',
    description: '주문 지표는 SQL로 계산하고, 고객 댓글은 AI pipeline으로 분류합니다. 집계와 댓글 근거를 묶어 상황 브리핑을 생성합니다.',
    capabilities: ['SQL Aggregation', 'azure_ai', 'AI Pipelines', 'Grounded Briefing'],
    documentation: 'home-shopping.html',
    presentation: 'home-shopping-slides.html',
  },
] as const

export type UseCaseId = (typeof USE_CASES)[number]['id']
