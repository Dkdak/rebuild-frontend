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
}

// status가 AVAILABLE이 아니면 minCost/maxCost/basis 전부 null(§3.3 — 200 OK, 에러 아님).
export interface CostEstimation {
    minCost: number | null;
    maxCost: number | null;
    status: CostEstimationStatus;
    basis: CostEstimationBasis | null;
}
