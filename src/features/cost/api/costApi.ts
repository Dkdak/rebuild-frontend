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
}

// status가 AVAILABLE이 아니면 minCost/maxCost/basis 전부 null(§3.3 — 200 OK, 에러 아님).
export interface CostEstimation {
    minCost: number | null;
    maxCost: number | null;
    status: CostEstimationStatus;
    basis: CostEstimationBasis | null;
}
