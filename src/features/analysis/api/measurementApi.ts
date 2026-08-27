import { apiClient as api } from "../../../shared/api/apiClient";

// FEATURE_19_PERSONALIZED_ANALYSIS.md §3.2 — F-19 실측 입력 API. 전부 로그인 필수.
// 저장 단위는 "단계"다 — 요청 레코드에 전 필드가 있지만 서비스가 stepNo에 해당하는 필드만 읽으므로,
// 화면은 그 단계 항목만 실어 보낸다(§2.2-b).
// 금액 단위: 매입가·미래가치는 만원, 공사비·설계비·인허가비는 원(backend MeasurementServiceImpl 주석 기준).
const BASE = "/api/v1/analysis/measurements";

export type MeasurementItemStatus = "ESTIMATED" | "MEASURED" | "RECHECK";

export interface MeasurementProgress {
    measured: number;
    total: number;
}

export interface MeasurementItemStatusRow {
    itemKey: string;
    stepNo: number;
    status: MeasurementItemStatus;
    inputAt: string | null;
    // 유효기간 판정에 실제로 쓰인 기준일 — "INPUT_AT" 또는 "DOCUMENT_DATE"(§3.1-a).
    // 서류 날짜를 안 넣어 INPUT_AT으로 폴백된 것도 서버가 확정해 내려준다 — 프론트가 추측하지 않는다.
    anchorUsed: string | null;
    // 그 판정에 쓴 날짜와 경과일 — 문구를 프론트가 계산 없이 조립할 수 있게 서버가 함께 준다.
    anchorDate: string | null;
    elapsedDays: number | null;
}

// 실측이 없어도 value는 채워진다(공공데이터 추정치) — "화면을 열면 전 항목이 리포트 추정치로 이미 채워져
// 있다"(§2.2-b 규칙 2). measured를 그대로 배지로 옮기고, 값이 비었다고 화면을 비우지 않는다.
export interface ValuedField {
    value: number | null;
    measured: boolean;
}

export interface MeasurementRecalculation {
    totalInvestment: number | null;
    totalInvestmentMeasured: boolean;
    projectedValue: number | null;
    projectedValueMeasured: boolean;
    expectedProfit: number | null;
    roi: number | null;
    additionalBuildableAreaSqm: ValuedField;
    // STEP 1 상한 기준 이론상 증축 상한 — STEP 2 실측이 들어와도 바뀌지 않는다(위 필드는 실측값으로 바뀐다).
    // STEP 1 결과 카드와 STEP 2 "N㎡ 남김" 비교가 이 값을 쓴다.
    theoreticalAdditionalBuildableAreaSqm: number | null;
    constructionEstimate: ValuedField;
    purchasePrice: ValuedField;
    // 취득세 계산이 쓰는 것과 같은 판정 — 화면 분기도 이 값으로 한다(propertyType으로 다시 판정하면
    // 기준이 두 곳으로 갈린다). 주택 외는 개인·법인 4% 동일이라 취득 주체를 물을 이유가 없다(LAW-003 §1-a).
    isHousing: boolean;
    // F-06 추진 요건 판정 — 요건을 못 넘겨도 계산은 진행되고(2026-08-27 backend), 그 사실을 밴드 위에
    // 경고로 얹는다. 사유 문구는 서버가 만든 것을 그대로 쓴다("2023년 준공 3년차 / 필요 30년").
    verdict: "POSSIBLE" | "LIMITED" | "NOT_POSSIBLE" | null;
    verdictReason: string | null;
    // 세대수가 대장에 없어 매입가·미래가치를 추정하지 못하는 건물(전체의 2.32%) — 판정은 서버가 한다.
    // 프론트가 householdCount == null을 직접 보고 판단하지 않는다(재확인·표본 부족과 같은 원칙).
    // backend 필드 추가 전에는 undefined로 와서 안내가 뜨지 않는다.
    householdCountMissing?: boolean | null;
}

export interface MeasurementValues {
    zoneName: string | null;
    farLimitPct: number | null;
    heightLimit: string | null;
    districtPlan: string | null;
    safetyInspection: { grade: string | null; inspectionDate: string | null; allowedExpansionType: string | null } | null;
    actualExpandableAreaSqm: number | null;
    expandableAreaDocumentDate: string | null;
    reductionReason: string | null;
    actualConstructionEstimate: number | null;
    estimateDocumentDate: string | null;
    estimateSiteCondition: string | null;
    estimateSiteNote: string | null;
    estimateSource: string | null;
    designFee: number | null;
    permitFee: number | null;
    actualPurchasePrice: number | null;
    acquisitionEntityType: string | null;
    registryRightsStatus: string | null;
    leaseVacancyCondition: string | null;
    postRemodelEstimatedPrice: number | null;
    valuationBasisMemo: string | null;
}

export interface MeasurementDetail {
    buildingId: string;
    values: MeasurementValues;
    itemStatuses: MeasurementItemStatusRow[];
    recalculation: MeasurementRecalculation;
    progress: MeasurementProgress;
}

export interface MeasurementListItem {
    buildingId: string;
    address: string;
    progress: MeasurementProgress;
    status: "COMPLETED" | "IN_PROGRESS";
    // 14개 항목 전체 기준 재확인 건수 — status와 독립된 축이다("완료"인데 부속 항목이 낡은 경우가 있다).
    recheckCount: number;
    measuredRoi: number | null;
    nextInputField: string | null;
}

export interface MeasurementHistoryEntry {
    changedAt: string;
    stepNo: number;
    itemKey: string;
    previousValue: string | null;
    newValue: string | null;
    measuredRoiAtChange: number | null;
}

export interface MeasurementStepSaveResponse {
    recalculation: MeasurementRecalculation;
    itemStatuses: MeasurementItemStatusRow[];
    // 이 저장으로 재확인이 새로 붙은 항목 — 어느 단계를 다시 그릴지는 이 목록으로 정한다(프론트가 판단하지 않는다).
    recheckTriggeredItemKeys: string[];
    progress: MeasurementProgress;
}

export type StepSavePayload = Partial<{
    zoneName: string;
    farLimitPct: number;
    heightLimit: string;
    districtPlan: string;
    safetyGrade: string;
    safetyInspectionDate: string | null;
    safetyAllowedExpansionType: string;
    actualExpandableAreaSqm: number;
    expandableAreaDocumentDate: string | null;
    reductionReason: string;
    actualConstructionEstimate: number;
    estimateDocumentDate: string | null;
    estimateSource: string;
    actualPurchasePrice: number;
    acquisitionEntityType: string;
    postRemodelEstimatedPrice: number;
    valuationBasisMemo: string;
}>;

const authHeader = (token: string | null) =>
    token ? { headers: { Authorization: `Bearer ${token}` } } : {};

export const fetchMeasurements = async (token: string | null): Promise<MeasurementListItem[]> => {
    const response = await api.get<MeasurementListItem[]>(BASE, authHeader(token));
    return response.data;
};

export const fetchMeasurementDetail = async (token: string | null, buildingId: string): Promise<MeasurementDetail> => {
    const response = await api.get<MeasurementDetail>(`${BASE}/${buildingId}`, authHeader(token));
    return response.data;
};

export const fetchMeasurementHistory = async (
    token: string | null,
    buildingId: string,
): Promise<MeasurementHistoryEntry[]> => {
    const response = await api.get<MeasurementHistoryEntry[]>(`${BASE}/${buildingId}/history`, authHeader(token));
    return response.data;
};

export const saveMeasurementStep = async (
    token: string | null,
    buildingId: string,
    stepNo: number,
    payload: StepSavePayload,
): Promise<MeasurementStepSaveResponse> => {
    const response = await api.put<MeasurementStepSaveResponse>(
        `${BASE}/${buildingId}/steps/${stepNo}`,
        payload,
        authHeader(token),
    );
    return response.data;
};

// FEATURE_08_MARKET.md §3.7 확장 — STEP 5 유효연식 참고표. "입력 연식만 다른 같은 쿼리"라서 4행의
// 완화 단계(confidenceLevel)는 가장 넓은 단계 하나로 통일돼 내려온다(행마다 다르면 비교가 성립하지 않는다).
// insufficientSample이면 값은 그대로 오되 화면에서 고를 수 없게 한다 — 값을 숨기지는 않는다.
// 이 API는 시세만 책임진다 — ROI는 없다(총투자금이 필요해 F-19 실측 API 레이어가 계산한다).
export interface AgeAdjustedPrice {
    ageAdjustmentYears: number;
    targetAreaSqm: number;
    estimatedPrice: { value: number; confidenceLevel: string; comparableCount: number };
    insufficientSample: boolean;
}

export const fetchAgeAdjustedPrices = async (buildingId: string): Promise<AgeAdjustedPrice[]> => {
    const response = await api.get<AgeAdjustedPrice[]>(`/api/v1/properties/${buildingId}/market/age-adjusted`);
    return response.data;
};

// F-07 공사비 참고표(STEP 3) — 국세청 고시 단가 × 면적이라 표본·완화 단계 개념이 없다(§2.2-c).
// 행별 ㎡당 단가는 baseUnitPricePerSqm × 보정계수로 만든다 — 받은 값을 표시 단위로 바꾸는 산술이라
// "서버가 돌려줄 파생값을 흉내 내는 것"에 해당하지 않는다.
export interface CostEstimate {
    minCost: number;
    defaultCost: number;
    maxCost: number;
    status: string;
    basis: {
        grossFloorArea: number;
        baseUnitPricePerSqm: number;
        agingFactorMin: number;
        agingFactorDefault: number;
        agingFactorMax: number;
        source: string;
    } | null;
}

export const fetchCostEstimate = async (buildingId: string): Promise<CostEstimate> => {
    const response = await api.get<CostEstimate>(`/api/v1/properties/${buildingId}/cost`);
    return response.data;
};

// F-06 판정 근거 단독 조회 — 대지면적·연면적은 이 엔드포인트에서만 채워져 온다(/analysis의 같은 필드는
// null이다, 2026-08-27 실측 확인). STEP 2 용적률 막대·참고표가 이 값을 쓴다.
// 판정(verdict)까지 함께 읽는다 — 증축 가능 면적이 비어 있을 때 "왜 없는지"가 이 값에 있다.
export const fetchRemodelingBasis = async (buildingId: string) => {
    const response = await api.get<{
        basis: import("../../remodeling/api/remodelingApi").RemodelingBasis;
        verdict: import("../../remodeling/api/remodelingApi").RemodelingVerdict;
    }>(`/api/v1/properties/${buildingId}/remodeling`);
    return response.data;
};

// 용도지역별 조례 상한 — 매핑을 프론트에 두면 조례 개정 때 두 곳을 고쳐야 한다(서버 zoning_limit이 단일출처).
export interface ZoningLimit {
    zoneName: string;
    floorAreaRatioLimit: number;
    coverageRatioLimit: number;
}

export const fetchZoningLimits = async (token: string | null): Promise<ZoningLimit[]> => {
    const response = await api.get<ZoningLimit[]>(`${BASE}/zoning-limits`, authHeader(token));
    return response.data;
};
