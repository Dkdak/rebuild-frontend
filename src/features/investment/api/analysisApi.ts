import { apiClient } from "../../../shared/api/apiClient";
import { buildRemodelingChecklist, type RemodelingAnalysis, type RemodelingChecklistItem } from "../../remodeling/api/remodelingApi";
import { CONFIDENCE_LABEL, type ConfidenceLevel, type MarketAnalysis } from "../../market/api/marketApi";
import type { CostEstimation } from "../../cost/api/costApi";
import { ESTIMATED_AREA_TYPES, PARTIAL_TRADE_AREA_RATIO } from "../../search/api/searchApi";

// FEATURE_05_PROPERTY_INFO.md §2.1: remodeling/market/grade/roi 통합 조회 — 기존에 따로 부르던
// getRemodelingAnalysis/getMarketAnalysis를 이 API 하나로 대체(2026-08-1x, 백엔드 구현 완료).
// grade/roi는 investment_result 스파이크 더미데이터가 아니라 이 응답의 실제 계산값 — RightPanel 개요 카드가 이번에 처음 연동.
// 배치(주기적 재실행) 결과라 updatedAt 기준 "최근 갱신" 라벨 필수 표시.
// 2026-08-1x — 6단계(A+/A/B+/B/C/D) → 4단계(A/B/C/D)+NA로 재편(FEATURE_09_INVESTMENT.md 반영, 백엔드 확정).
// A+/B+ 세부 구간은 폐지 — A/B 등급 자체가 그 자리를 흡수. NA는 등급 산정에 필요한 데이터 자체가 모자란
// 케이스(구 INSUFFICIENT_DATA와 같은 개념, enum 값만 NA로 정정)로 A~D(성능 등급)와는 성격이 다르다.
export type InvestmentGrade = "A" | "B" | "C" | "D" | "NA";

export const GRADE_LABEL: Record<InvestmentGrade, string> = {
    A: "A",
    B: "B",
    C: "C",
    D: "D",
    NA: "정보부족",
};

export interface PropertyAnalysis {
    grade: InvestmentGrade;
    // roi==null이면 backend stage != FULL이라는 뜻(실측 확인) — "산정 중"이 아니라 "산출 불가"로 취급해야 한다
    // (§2.2 확정, 2026-08-1x). 타입이 number였던 건 실제 런타임과 다른 선언 오류 — 이미 곳곳에서 null 체크는
    // 하고 있었어서 동작엔 문제 없었음.
    roi: number | null;
    remodeling: RemodelingAnalysis;
    // 공사비 카드는 F-10 "수익 분석"으로 이동 예정이라 이 화면(F-05)에서는 아직 쓰지 않는다(costApi.ts 참고).
    cost: CostEstimation;
    market: MarketAnalysis;
    updatedAt: string;
}

// "2026-08-03T17:36:26" → "2026-08-03" — "최근 갱신" 라벨용(배치 결과, 실시간 값 아님을 알리는 목적).
export const formatUpdatedAt = (updatedAt: string): string => updatedAt.split("T")[0];

// FEATURE_10_AI_REPORT.md §2.2(2026-08-09 재편) — 추천여부를 grade 단독 매핑에서 grade×시세 신뢰도 매트릭스로
// 확장. postRemodelEstimatedPrice(F-08 §2.3 "미래 가치")의 confidenceLevel을 4단계로 압축한 게 PriceConfidenceGrade —
// SAME_DONG만 최고 B인 이유는 recentTrade는 F-05 "시세" 카드 개념일 뿐, 이 매트릭스가 참조하는
// postRemodelEstimatedPrice엔 실거래 개념 자체가 없다(FEATURE_08_MARKET.md §2.3).
export type PriceConfidenceGrade = "A" | "B" | "C" | "D";

export const priceConfidenceFromLevel = (confidenceLevel: ConfidenceLevel): PriceConfidenceGrade | null => {
    switch (confidenceLevel) {
        case "SAME_DONG":
            return "B";
        case "SAME_GU":
        case "WIDENED_RANGE":
            return "C";
        case "DONG_TYPE_AVERAGE":
        case "GU_TYPE_AVERAGE":
            return "D";
        case "UNAVAILABLE":
            return null;
    }
};

// 신뢰도 배지 색 톤(2026-08-09) — report-tone-badge/MarketAnalysisPage.tsx TradeTable과 같은 규칙(A/B=success,
// C/D=warning). right-panel-estimate-tag가 이제 등급 의미를 담으니 고정 파란색 대신 이 톤을 따른다.
export const priceConfidenceTone = (grade: PriceConfidenceGrade): "success" | "warning" =>
    grade === "A" || grade === "B" ? "success" : "warning";

// 핵심 요약 "주의사항" item 3(§2.1) — priceConfidence가 이 맵에서 null이 아닌 문구를 반환할 때만 목록에 추가.
// A는 항목 자체 생략(주의할 게 없음), UNAVAILABLE(priceConfidence===null)은 애초에 예상차익/미래가치/ROI가
// 전부 "산출 불가"라 별도 문구가 불필요.
export const PRICE_CONFIDENCE_CAUTION: Record<PriceConfidenceGrade, string | null> = {
    A: null,
    B: "동일 법정동 유사거래 기반 추정 시세입니다",
    C: "비교 범위를 넓힌 유사거래 기반 추정 시세입니다(구 단위 확장 또는 면적·연식 조건 완화)",
    D: "지역·유형 평균 기반 추정 시세입니다(면적·연식 미반영, 참고용)",
};

const RECOMMENDATION_MATRIX: Record<InvestmentGrade, Record<PriceConfidenceGrade | "NONE", string>> = {
    A: { A: "적극 추천", B: "적극 추천", C: "추천", D: "검토", NONE: "판단 불가" },
    B: { A: "추천", B: "추천", C: "검토", D: "검토", NONE: "판단 불가" },
    C: { A: "검토", B: "검토", C: "비추천", D: "비추천", NONE: "판단 불가" },
    D: { A: "비추천", B: "비추천", C: "비추천", D: "비추천", NONE: "판단 불가" },
    NA: { A: "판단 불가", B: "판단 불가", C: "판단 불가", D: "판단 불가", NONE: "판단 불가" },
};

export const getRecommendation = (grade: InvestmentGrade, priceConfidence: PriceConfidenceGrade | null): string =>
    RECOMMENDATION_MATRIX[grade][priceConfidence ?? "NONE"];
// 기존 RECOMMENDATION_LABEL(grade 단독 매핑)은 삭제 — 위 매트릭스로 완전히 대체.

// 2026-08-10 — "총 투자금 = 매입가+공사비+부대비용"으로 공식 변경(LAW-003_취득세_중개보수_요율.md). isHousing
// 분류는 취득세법상 "주택" 특례세율 대상(아파트/연립다세대/단독다가구) 기준 — ESTIMATED_AREA_TYPES(세대 기반
// 시세추정 대상, 아파트/연립다세대 2종)나 RESIDENTIAL_PRESET_TYPES(검색 필터 프리셋, 오피스텔 포함 4종)와는
// 목적이 달라 둘 다 그대로 못 쓴다 — 오피스텔은 원칙적으로 업무시설 취득세율(4.6%) 적용 대상이라 여기선 제외.
// 법적 분류라 확신이 필요한 부분 — 세율 자체(taxRate/brokerageRate 구간)와 함께 확인 요청함.
const HOUSING_TYPES_FOR_ACQUISITION_TAX = ["아파트", "연립다세대", "단독다가구"];

// 2026-08-10 확정("프론트에 전달할 내용") — 부대비용(취득세+중개보수) 계산. baseValue와 같은 단위(만원).
// 주택 취득세율은 6억 이하 1%/9억 초과 3%/6~9억 구간 선형 근사, 중개보수는 구간별 고정요율(한도액은 5천만원/
// 2억 구간만 별도 적용되지만 이번 V1엔 반영 안 함 — 근사치임을 캡션으로 안내). 주택 외 유형은 취득세 4%+
// 중개보수 0.9% 고정.
export const calcAcquisitionCost = (baseValue: number, isHousing: boolean): number => {
    if (isHousing) {
        const taxRate =
            baseValue <= 60000
                ? 0.01
                : baseValue > 90000
                  ? 0.03
                  : 0.01 + ((baseValue - 60000) / 30000) * 0.02; // 6~9억 구간 선형 근사
        const brokerageRate =
            baseValue < 5000
                ? 0.006
                : baseValue < 20000
                  ? 0.005
                  : baseValue < 90000
                    ? 0.004
                    : baseValue < 120000
                      ? 0.005
                      : baseValue < 150000
                        ? 0.006
                        : 0.007;
        return baseValue * taxRate + baseValue * brokerageRate; // 한도액은 5천만원/2억 구간만 별도 적용(V1 미반영)
    }
    return baseValue * 0.04 + baseValue * 0.009; // 주택 외
};

// FEATURE_08_MARKET.md §3.7 "수익분석" — BusinessAnalysisPage.tsx(구 ProfitAnalysisPage.tsx)와 요약 섹션(예상차익/미래가치 통계)이 공유하는
// 계산 로직. 같은 데이터를 두 곳에서 각자 다시 계산하지 않기 위해 여기 한 곳에만 둔다.
export interface ProfitAnalysisResult {
    baseValue: number; // 매입가(공사비 제외) — CashFlowFormula/민감도분석(§2.6)이 공유
    acquisitionCost: number; // 2026-08-10 추가 — 취득세+중개보수 추정치, investMin/Max에 이미 포함됨
    investMin: number;
    investMax: number;
    value: number;
    gainMin: number;
    gainMax: number;
    roiMin: number;
    roiMax: number;
}

export const buildProfitAnalysis = (
    analysis: PropertyAnalysis,
    householdCount: number | null,
    propertyType: string | null,
    totalBuildingArea: number | null
): ProfitAnalysisResult | null => {
    const { cost, market } = analysis;
    const postRemodel = market.postRemodelEstimatedPrice;
    const isHouseholdBased = propertyType != null && ESTIMATED_AREA_TYPES.includes(propertyType);

    // §3.7 "신뢰도": postRemodel이 없거나 UNAVAILABLE이면 전체를 "산출 불가"로 — 절반만 계산된 값을 노출하지 않는다.
    if (
        cost.status !== "AVAILABLE" ||
        cost.minCost == null ||
        cost.maxCost == null ||
        postRemodel == null ||
        postRemodel.value == null ||
        postRemodel.confidenceLevel === "UNAVAILABLE"
    ) {
        return null;
    }

    const costMinManwon = Math.round(cost.minCost / 10_000);
    const costMaxManwon = Math.round(cost.maxCost / 10_000);

    // 2026-08-10 — "건물 일부 거래" 착시(DOMAIN.md §5.1, 을지로6가 실측 사례: 연면적 23,658㎡ 건물에 3.77㎡
    // 호실 거래가 매칭)로 recentTrade.price가 매입가로 그대로 쓰이면, 건물 전체 스케일인 postRemodel.value/
    // cost와 자릿수가 6~7자리 차이 나 예상차익·미래가치·ROI가 터무니없이 커진다(실측 확인, 약 1,311억). 같은
    // 판정 기준(formatRecentTrade의 isPartial, searchApi.ts)을 재사용해 일부 거래면 recentTrade.price를
    // 건너뛰고 estimatedPrice.value로 폴백 — estimatedPrice는 ㎡당가×건물전체면적이라 전 유형 공통으로
    // 스케일이 맞는다(PropertyItem.estimatedPrice 주석과 동일 근거).
    const isPartialTrade =
        !isHouseholdBased &&
        market.recentTrade?.area != null &&
        totalBuildingArea != null &&
        totalBuildingArea > 0 &&
        market.recentTrade.area / totalBuildingArea < PARTIAL_TRADE_AREA_RATIO;

    const baseValue = isHouseholdBased
        ? market.estimatedPrice.value != null && householdCount != null
            ? market.estimatedPrice.value * householdCount
            : null
        : isPartialTrade
          ? market.estimatedPrice.value
          : (market.recentTrade?.price ?? market.estimatedPrice.value);
    if (baseValue == null) {
        return null;
    }

    // 2026-08-10 — 총 투자금 = 매입가+공사비+부대비용(취득세+중개보수). isHousing은 propertyType 원본 기준
    // (isHouseholdBased와는 다른 분류, 위 HOUSING_TYPES_FOR_ACQUISITION_TAX 주석 참고).
    const isHousing = propertyType != null && HOUSING_TYPES_FOR_ACQUISITION_TAX.includes(propertyType);
    const acquisitionCost = Math.round(calcAcquisitionCost(baseValue, isHousing));

    const investMin = baseValue + costMinManwon + acquisitionCost;
    const investMax = baseValue + costMaxManwon + acquisitionCost;
    const value = postRemodel.value;
    const gainMin = value - investMax; // 최대 공사비 적용 → 차익 최소
    const gainMax = value - investMin; // 최소 공사비 적용 → 차익 최대
    return {
        baseValue,
        acquisitionCost,
        investMin,
        investMax,
        value,
        gainMin,
        gainMax,
        roiMin: investMax > 0 ? (gainMin / investMax) * 100 : 0,
        roiMax: investMin > 0 ? (gainMax / investMin) * 100 : 0,
    };
};

// FEATURE_10_AI_REPORT.md §2.1 "요약 정보" 주의사항 — 구 "리스크 분석"(RiskAnalysisPage.tsx, 폐지) 5항목을
// 그대로 옮겨왔다(2026-08-1x, 카테고리 재편 — 판정 로직은 변경 없음, 위치만 이동). 새 계산 로직·API 없이 analysis
// 응답 필드를 "리스크 관점"으로 재구성만 한다(DOMAIN.md §4 "AI는 해석 단계에서만" — 이건 해석도 아니고 조건 재배치).
// 4/5번 임계값(30%/5년)은 backend V1 정책값(FEATURE_07_COST.md §5.1의 aging_factor.k와 같은 성격).
export const buildRiskChecklist = (analysis: PropertyAnalysis): RemodelingChecklistItem[] => {
    const { basis } = analysis.remodeling;
    const checklist = buildRemodelingChecklist(basis);
    const { cost, market } = analysis;

    const permitRisk: RemodelingChecklistItem = !basis.permitInProgress
        ? { ok: true, text: "진행 중인 인허가 없음" }
        : { ok: false, text: `최근 인허가 진행 중(${basis.recentPermitType ?? "종류 미상"}) — 사업 지연 가능` };

    const districtRisk: RemodelingChecklistItem =
        basis.districtNames.length === 0
            ? { ok: true, text: "지구/구역 규제 없음" }
            : { ok: false, text: `${basis.districtNames.join(", ")} 지정 — 추가 규제 확인 필요` };

    const confidenceRisk: RemodelingChecklistItem =
        market.estimatedPrice.confidenceLevel === "SAME_DONG"
            ? { ok: true, text: "시세 추정 신뢰도 높음" }
            : { ok: false, text: `시세 추정 신뢰도 낮음(${CONFIDENCE_LABEL[market.estimatedPrice.confidenceLevel]})` };

    const costRangeRisk: RemodelingChecklistItem =
        cost.status !== "AVAILABLE" || cost.minCost == null || cost.maxCost == null
            ? { ok: false, text: "공사비 추정 정보 없음" }
            : cost.minCost > 0 && (cost.maxCost - cost.minCost) / cost.minCost < 0.3
              ? { ok: true, text: "공사비 추정 폭 좁음" }
              : {
                    ok: false,
                    text: `공사비 추정 폭 큼(최소~최대 차이 ${cost.minCost > 0 ? Math.round(((cost.maxCost - cost.minCost) / cost.minCost) * 100) : "?"}%) — 예산 여유 필요`,
                };

    const agingMarginRisk: RemodelingChecklistItem =
        basis.buildingAgeYears == null || basis.requiredYears == null
            ? { ok: false, text: "노후도 정보 없음" }
            : basis.buildingAgeYears - basis.requiredYears >= 5
              ? { ok: true, text: "노후도 기준 충분히 충족" }
              : basis.buildingAgeYears - basis.requiredYears >= 0
                ? {
                      ok: false,
                      text: `노후도 기준 근소 충족(${basis.buildingAgeYears - basis.requiredYears}년 차이) — 조례 개정 시 재검토 필요`,
                  }
                : { ok: false, text: checklist.aging.text };

    return [permitRisk, districtRisk, confidenceRisk, costRangeRisk, agingMarginRisk];
};

// buildingId(=bdrg_sn)가 building 테이블에 없으면 백엔드가 404 — apiClient 호출부에서 catch해 null 처리(market/remodelingApi.ts와 동일 패턴).
export const getPropertyAnalysis = async (buildingId: string): Promise<PropertyAnalysis | null> => {
    try {
        const response = await apiClient.get<PropertyAnalysis>(`/api/v1/properties/${buildingId}/analysis`);
        return response.data;
    } catch (error) {
        if (typeof error === "object" && error != null && "response" in error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 404) return null;
        }
        throw error;
    }
};
