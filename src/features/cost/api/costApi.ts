// FEATURE_07_COST.md §3.4: 백엔드 구현 완료(GET /api/v1/properties/{buildingId}/cost), 프론트 미연동 —
// 공사비 카드는 F-10 리포트 화면 "수익 분석"으로 이동 예정(FEATURE_05_PROPERTY_INFO.md §2.1-c). 타입만 먼저 맞춰둔다 —
// PropertyAnalysis.cost(analysisApi.ts)가 이 모양을 그대로 재사용.
export type CostEstimationStatus =
    | "AVAILABLE"
    | "NOT_APPLICABLE_REMODELING_NOT_POSSIBLE"
    | "NO_REFERENCE_RATE"
    | "AREA_UNAVAILABLE";

export interface CostEstimationBasis {
    grossFloorArea: number;
    structureNm: string;
    propertyType: string;
    baseUnitPricePerSqm: number;
    buildingAgeYears: number;
    agingFactorMin: number;
    agingFactorMax: number;
    // FEATURE_10_AI_REPORT.md §2.6 "민감도 분석" 공사비축 기준값 — minCost/maxCost는 agingFactorMin/Max로 이미
    // 계산돼 있지만 "기준(default)" 시나리오 공사비는 API에 없어 이 계수로 프론트가 직접 계산한다(2026-08-1x 추가).
    agingFactorDefault: number;
    // 2026-08-10 요청 — FEATURE_07_COST.md §3.2에 이미 문서화된 cost_base_price.source(근거 고시, 예:
    // "국세청고시 제2024-38호") 노출 요청. baseUnitPricePerSqm과 같은 참조 테이블 행에서 나오는 값이라 함께
    // 항상 채워질 것으로 보고 필수 필드로 선언 — 백엔드 배치 반영 전까지는 null일 수 있어 렌더링 쪽에서
    // "정보 없음"으로 방어(RemodelingAnalysisPage.tsx 참고).
    source: string | null;
}

// status가 AVAILABLE이 아니면 minCost/maxCost/basis 전부 null(§3.3 — 200 OK, 에러 아님).
export interface CostEstimation {
    minCost: number | null;
    maxCost: number | null;
    status: CostEstimationStatus;
    basis: CostEstimationBasis | null;
}

// 2026-08-10 — 백엔드가 내려주는 source는 조항까지 포함한 전체 인용("국세청고시 제2024-38호 제6조(2025년
// 건물신축가격기준액)")이지만, 화면의 "기준 산정 방식" 행은 기준단가(baseUnitPricePerSqm)만의 근거라 조항
// 번호까지 보여주면 노후도 보정계수(같은 고시 제10조 — 다른 조항)의 근거로 오인될 수 있다는 지적으로 고시
// 번호("OO호")까지만 잘라서 표시한다. "호"로 끝나는 고시 번호 표기 관례에 기대는 정규식이라, 혹시 다른
// 포맷이 오면(매치 실패) 원본을 그대로 반환 — 조용히 잘못 자르는 것보다 안전.
export const formatCostSourceShort = (source: string): string => {
    const match = source.match(/^(.*?호)/);
    return match ? match[1] : source;
};
