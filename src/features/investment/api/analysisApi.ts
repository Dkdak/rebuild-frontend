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

// 2026-08-17 — A/B/C/D 등급 체계(PriceConfidenceGrade/priceConfidenceFromLevel/priceConfidenceTone) 전면
// 폐지, marketApi.ts의 CONFIDENCE_LABEL_SHORT 라벨(높음/중간/낮음/매우 낮음/산출 불가, 04 "시세 산정 근거"가
// 이미 쓰던 체계) 5단계로 리포트 전체 통일 — resolvePriceDisplayLabel/PRICE_DISPLAY_TONE(marketApi.ts)이 새
// 단일 출처. 이 파일의 소비처(F-09 "검토 우선순위" 매트릭스)는 recentTrade 개념이 없는 postRemodel 기준이라
// "실거래" 라벨은 나올 일이 없다 — ConfidenceLevel(6종, UNAVAILABLE 포함) 자체를 그대로 매트릭스 키로 쓴다.

// FEATURE_10_AI_REPORT.md §2.2(2026-08-09 재편) — 추천여부를 grade 단독 매핑에서 grade×시세 신뢰도 매트릭스로
// 확장. 구 PriceConfidenceGrade는 SAME_GU/WIDENED_RANGE를 C 하나로, DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE를 D
// 하나로 묶었었다 — 매트릭스 "구조·판정 경계는 바꾸지 않는다"는 이번 요청 원칙대로, 새 ConfidenceLevel 키도
// 같은 두 쌍을 여전히 동일한 행 값으로 채워 그 경계를 그대로 보존한다(SAME_GU/WIDENED_RANGE 값 동일,
// DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE 값 동일). 구 A열(어떤 confidenceLevel도 매핑되지 않아 실제로 한 번도
// 안 쓰였던 죽은 열)은 폐기 — SAME_DONG("높음")이 이제 실제로 도달 가능한 최고 등급이라 그 자리(구 B열
// 값)를 물려받는다. 구 NONE(postRemodel 자체가 없음)과 UNAVAILABLE(있지만 산출 실패)은 구 시스템에서도
// 항상 같은 "판단 불가" 결과였으므로 이번에도 하나로 합쳐 처리(getRecommendation에서 ?? "UNAVAILABLE"로 통일).
const RECOMMENDATION_MATRIX: Record<InvestmentGrade, Record<ConfidenceLevel, string>> = {
    A: {
        SAME_DONG: "적극 추천",
        SAME_GU: "추천",
        WIDENED_RANGE: "추천",
        DONG_TYPE_AVERAGE: "검토",
        GU_TYPE_AVERAGE: "검토",
        UNAVAILABLE: "판단 불가",
    },
    B: {
        SAME_DONG: "추천",
        SAME_GU: "검토",
        WIDENED_RANGE: "검토",
        DONG_TYPE_AVERAGE: "검토",
        GU_TYPE_AVERAGE: "검토",
        UNAVAILABLE: "판단 불가",
    },
    C: {
        SAME_DONG: "검토",
        SAME_GU: "비추천",
        WIDENED_RANGE: "비추천",
        DONG_TYPE_AVERAGE: "비추천",
        GU_TYPE_AVERAGE: "비추천",
        UNAVAILABLE: "판단 불가",
    },
    D: {
        SAME_DONG: "비추천",
        SAME_GU: "비추천",
        WIDENED_RANGE: "비추천",
        DONG_TYPE_AVERAGE: "비추천",
        GU_TYPE_AVERAGE: "비추천",
        UNAVAILABLE: "판단 불가",
    },
    NA: {
        SAME_DONG: "판단 불가",
        SAME_GU: "판단 불가",
        WIDENED_RANGE: "판단 불가",
        DONG_TYPE_AVERAGE: "판단 불가",
        GU_TYPE_AVERAGE: "판단 불가",
        UNAVAILABLE: "판단 불가",
    },
};

// 2026-08-12 확정 — "추천여부"→"검토 우선순위"로 칸 자체가 개명되면서 값도 "추천/비추천" 계열(투자 확정 뉘앙스)
// 대신 "검토 우선순위" 뉘앙스(적극 검토/검토/추가 확인/보류)로 전면 교체. 매트릭스 구조(등급×신뢰도)와 각 셀이
// 가리키는 판정 자체는 그대로 — 라벨 문구만 LABEL_MAP으로 치환.
const LABEL_MAP: Record<string, string> = {
    "적극 추천": "적극 검토",
    추천: "검토",
    검토: "추가 확인",
    비추천: "보류",
    "판단 불가": "판단 불가",
};

// confidenceLevel이 null이면(postRemodel 자체가 없음) UNAVAILABLE과 동일하게 취급(위 주석 참고, 구 시스템도
// 항상 같은 결과였음).
export const getRecommendation = (grade: InvestmentGrade, confidenceLevel: ConfidenceLevel | null): string =>
    LABEL_MAP[RECOMMENDATION_MATRIX[grade][confidenceLevel ?? "UNAVAILABLE"]];
// 기존 RECOMMENDATION_LABEL(grade 단독 매핑)은 삭제 — 위 매트릭스로 완전히 대체.

// 2026-08-17 삭제(§확정분) — F-04/F-05 "시세" 신뢰도 배지 설명 캡션(구 PRICE_CONFIDENCE_CAPTION_FULL/COMPACT,
// "비교 범위를 넓힌 유사거래 기반 추정 시세입니다(...)" 등) 전면 제거 — 불필요하다는 지적으로 두 소비처
// (ResultList.tsx/PropertyDetailContent.tsx) 모두 캡션 렌더링을 없애며 이 Record 자체도 삭제. 신뢰도 배지
// (right-panel-estimate-tag, 라벨만 표시)와 04 "시세 산정 근거" 카드의 공용 범례는 그대로 유지 — 이번 삭제
// 대상은 F-04/F-05 개별 값 옆 설명 문구뿐.

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
// 2026-08-17 재정정("부대비용 계산 버그" Open Item 해결, "프론트에 전달할 내용") — 주택 외(isHousing=false)
// 분기만 수정: 취득세 4%에 지방교육세 0.4%+농특세 0.2%가 누락돼 있었다(4.9%→5.5%). 주택(isHousing=true)
// 분기는 건드리지 않음 — 지방교육세·농특세 공식이 아직 미확정(LAW-003 §5, 별도 확인 후 진행). 이 값이 바뀌면
// investMin/investMax·gainMin/gainMax·roiMin/roiMax 등 06 "사업성 분석" 전반이 재계산되고(부수 효과로 총
// 투자금이 0.6%p 소폭 상승 → 주택 외 매물 ROI 표시값이 소폭 낮아짐, 정상적인 수정 결과), CashFlowFormula.tsx
// 캡션의 "4.9%"도 "5.5%"로 함께 갱신했다.
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
    return baseValue * 0.04 + baseValue * 0.004 + baseValue * 0.002 + baseValue * 0.009; // 주택 외 — 취득세4%+지방교육세0.4%+농특세0.2%+중개보수0.9%=5.5%
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

// 2026-08-17 신규(docs/CONTENT_TAXONOMY.md 금지규칙 2 "라벨과 값의 부호를 어긋내지 않는다" — "예상차익 -68.17억"처럼
// 라벨은 "차익"인데 값에 마이너스가 붙으면 부호와 라벨이 어긋난다. 부호는 값이 아니라 라벨이 말한다). "01 요약
// 정보"/"06 사업성 분석"(사업성 요약·현금흐름) 셋이 전부 같은 gainMin/gainMax(profitAnalysis)를 공유하므로 라벨
// 판정도 한 곳에서 계산한다 — CashFlowFormula.tsx가 이미 쓰던 positive/negative/neutral 3분기(부호 스타일링용)와
// 같은 경계값을 그대로 재사용, 라벨 매핑만 추가.
export type GainSign = "positive" | "negative" | "neutral";

export const gainSign = (gainMin: number, gainMax: number): GainSign =>
    gainMin >= 0 && gainMax >= 0 ? "positive" : gainMin < 0 && gainMax < 0 ? "negative" : "neutral";

// positive="예상 차익"(값>0) · negative="예상 손실"(값<0, 절댓값만 표시 — 마이너스 기호 없이) · neutral="예상 손익"
// (범위가 0을 가로지름).
export const GAIN_LABEL: Record<GainSign, string> = {
    positive: "예상 차익",
    negative: "예상 손실",
    neutral: "예상 손익",
};

// "예상 손실"일 때만 절댓값(마이너스 기호 제거) — 차익/손익은 부호를 그대로 보여준다(손익은 0을 가로지르는
// 범위라 부호 자체가 "어느 쪽으로도 갈 수 있다"는 정보라 지우면 안 됨).
export const displayGain = (value: number, sign: GainSign): number => (sign === "negative" ? Math.abs(value) : value);

// gainMin~gainMax 범위를 화면에 표시할 [저, 고] 순서쌍으로. "예상 손실"이면 절댓값으로 바꾸면서 대소가
// 뒤집힌다(원래 gainMin<=gainMax인데 abs(gainMin)>=abs(gainMax)) — 그대로 이어붙이면 "68.17억 ~ 54억"처럼
// 내림차순으로 보여 어색하다. 절댓값 기준으로 다시 오름차순 정렬해서 반환.
export const displayGainRange = (gainMin: number, gainMax: number, sign: GainSign): [number, number] =>
    sign === "negative" ? [displayGain(gainMax, sign), displayGain(gainMin, sign)] : [gainMin, gainMax];

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
export interface RiskChecklist {
    permitRisk: RemodelingChecklistItem;
    districtRisk: RemodelingChecklistItem;
    confidenceRisk: RemodelingChecklistItem;
    costRangeRisk: RemodelingChecklistItem;
    agingMarginRisk: RemodelingChecklistItem;
}

// 2026-08-17 — 배열 반환에서 이름 있는 객체 반환으로 변경(§확정분). ReportPage.tsx가 "확인이 필요한 사항"
// 목록에서 confidenceRisk만 골라 빼고("평가"/"리모델링 후 추정" 카드 캡션으로 이동) 나머지만 나열해야 하는데,
// 배열+filter(ok)만으로는 특정 항목만 선택적으로 제외할 방법이 없었다(순서/개수가 데이터에 따라 달라짐).
export const buildRiskChecklist = (analysis: PropertyAnalysis): RiskChecklist => {
    const { basis } = analysis.remodeling;
    const checklist = buildRemodelingChecklist(basis);
    const { cost, market } = analysis;

    const permitRisk: RemodelingChecklistItem = !basis.permitInProgress
        ? { ok: true, text: "진행 중인 인허가 없음" }
        : { ok: false, text: `최근 인허가 진행 중(${basis.recentPermitType ?? "종류 미상"}) — 사업 지연 가능` };

    // 2026-08-12 정정 — "01 요약 정보" 확인이 필요한 사항 목록에서 구역명이 전부 나열돼 문장이 너무 길어졌다는
    // 지적 — 처음 2개만 보여주고 나머지는 "외 N곳"으로 축약(전체 목록은 "05 리모델링 분석" 세부 근거 표에서
    // 그대로 확인 가능, 여긴 요약이라 축약해도 정보 손실 아님).
    // 2026-08-17 — ✓ 텍스트를 remodelingApi.ts의 district 항목과 같은 문구로 통일("확인된 지구/구역 지정
    // 없음") — landuse_district 매칭률이 49.1%라 빈 배열이 "규제가 실제로 없다"가 아니라 "매칭 실패"일 수도
    // 있어 "없음"이라고 단정하면 안 된다(F-06 §2.1과 동일 근거). F-06 체크리스트를 이 목록 소스에서 제외한
    // 뒤로(위 buildRiskChecklist 호출부 참고) 이 ✓ 문구가 화면에 뜨는 유일한 지구/구역 항목이 됐다.
    const districtRisk: RemodelingChecklistItem =
        basis.districtNames.length === 0
            ? { ok: true, text: "확인된 지구/구역 지정 없음" }
            : {
                  ok: false,
                  text: `${
                      basis.districtNames.length > 2
                          ? `${basis.districtNames.slice(0, 2).join(", ")} 외 ${basis.districtNames.length - 2}곳`
                          : basis.districtNames.join(", ")
                  } 지정 — 추가 규제 확인 필요`,
              };

    // 2026-08-12 정정 — (a) 이 항목은 market.estimatedPrice(현재 시세) 기준이라 "현재 시세"로 대상 명시(리모델링
    // 후 시세와 구분). (b) CONFIDENCE_LABEL 값 자체가 이미 "중간(같은 구 비교)"처럼 등급 단어를 포함하는데 앞에
    // 고정 "낮음"을 또 붙여 "낮음(중간(같은 구 비교))"처럼 이중으로 겹치고 실제 등급과도 안 맞았다 — 고정
    // "낮음" 접두 제거.
    const confidenceRisk: RemodelingChecklistItem =
        market.estimatedPrice.confidenceLevel === "SAME_DONG"
            ? { ok: true, text: "현재 시세 추정 신뢰도 높음" }
            : { ok: false, text: `현재 시세 추정 신뢰도 ${CONFIDENCE_LABEL[market.estimatedPrice.confidenceLevel]}` };

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

    return { permitRisk, districtRisk, confidenceRisk, costRangeRisk, agingMarginRisk };
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
