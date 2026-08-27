import { apiClient as api } from "../../../shared/api/apiClient";

// FEATURE_19_PERSONALIZED_ANALYSIS.md §1.1 — F-10 리포트 CASE1(공공데이터)/CASE2(실측 반영) 통합 응답.
// caseTwo는 이 계정에 그 매물의 활성 실측이 있는지다. 실측이 없으면 전부 measured=false라 CASE1과 같은
// 내용이 되므로 화면은 분기하지 않고 measured만 배지로 옮긴다.
// 등급은 어느 CASE든 바뀌지 않는다(공공데이터 기준 유지) — 배지를 붙이지 않는다.
// 04 "시장 내 가격 위치"는 이번 범위 밖이라 CASE2에서도 공공데이터 기준 그대로다.
export interface ValuedField {
    value: number | null;
    measured: boolean;
}

// 08 "분석의 한계" 5문장의 해소 현황. UNRESOLVED(입력하면 풀린다)와 OUT_OF_SCOPE(서비스가 다루지 않는다)는
// 사용자가 할 일이 있느냐로 갈리므로 화면에서 다르게 보여야 한다.
export type LimitationStatus = "RESOLVED" | "PARTIAL" | "RECORDED" | "UNRESOLVED" | "OUT_OF_SCOPE";

export interface LimitationResolution {
    number: number;
    statement: string;
    status: LimitationStatus;
}

// 04 "시장 내 가격 위치" — 분포(p25/median/p75)는 공공데이터 기준과 같고, 실측 매입가가 있으면 "이 매물의
// 위치"(thisPropertyPercentile)만 그 값 기준으로 다시 매겨진다. 값 자체는 항상 채워지고, 비교거래가 아예
// 없을 때만 null이다(기존 pricePosition null 동작과 동일).
export interface PricePositionField {
    // p25/median/p75는 ㎡당 단가, ~Total은 같은 분포의 총액(만원). 세대기반 유형은 서버가 세대당가×세대수로
    // 환산해 내려주므로 프론트에서 면적을 곱하지 않는다. 세대수가 없으면 총액 셋이 null이라 ㎡당가로 돌아간다.
    value: {
        p25: number;
        median: number;
        p75: number;
        thisPropertyPercentile: number;
        p25Total: number | null;
        medianTotal: number | null;
        p75Total: number | null;
        // 추정이 불가능해 중앙값으로 폴백된 경우 — 그 자리에 마커를 두면 "모르니까 중간에 뒀다"가
        // "이 건물이 딱 중간"으로 읽힌다(DOMAIN.md §7.5). 판정은 서버가 한다.
        estimateFallback: boolean;
    } | null;
    measured: boolean;
}

export interface BuildingReport {
    caseTwo: boolean;
    grade: string | null;
    totalInvestment: ValuedField;
    projectedValue: ValuedField;
    expectedProfit: ValuedField;
    roi: ValuedField;
    additionalBuildableAreaSqm: ValuedField;
    estimatedAdditionalHouseholds: number | null;
    pricePosition: PricePositionField;
    limitations: LimitationResolution[];
}

export const fetchBuildingReport = async (token: string | null, buildingId: string): Promise<BuildingReport> => {
    const response = await api.get<BuildingReport>(
        `/api/v1/properties/${buildingId}/report`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    );
    return response.data;
};

export const LIMITATION_STATUS_LABEL: Record<LimitationStatus, string> = {
    RESOLVED: "해소",
    PARTIAL: "일부",
    RECORDED: "기록됨",
    UNRESOLVED: "미해소",
    OUT_OF_SCOPE: "분석 범위 아님",
};
