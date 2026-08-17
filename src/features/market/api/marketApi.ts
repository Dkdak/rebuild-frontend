import type { RecentTrade } from "../../search/api/searchApi";

// FEATURE_08_MARKET.md §3.6: 백엔드 구현 완료(2026-08-08). 값 단위 전부 만원 — 단 landPrice(개별공시지가)만
// 예외로 원/㎡ 단가 그대로(총액이 아니라 단가라는 의미 자체가 달라서 환산하지 않음, §3.6 "단위 주의").
// 2026-08-1x(3번째 요청): matchStage 3/4(법정동×유형 평균 / 구×유형 평균) 추가 — 백엔드가 실제로 이 값을
// 내려주기 시작해서, 타입 확장 없이는 MATCH_STAGE_LEVEL[3/4]가 undefined가 되고 그 값으로 CONFIDENCE_LABEL을
// 조회하면 깨진다(§2.2).
export type ConfidenceLevel =
    | "SAME_DONG"
    | "SAME_GU"
    | "WIDENED_RANGE"
    | "DONG_TYPE_AVERAGE"
    | "GU_TYPE_AVERAGE"
    | "UNAVAILABLE";

// FEATURE_10_AI_REPORT.md §2.9: "유사 사례" 페이지용 — 추정 시세 계산에 실제로 쓰인 비교 거래 원본(집계 통계가
// 아니라 개별 행). matchStage(0=법정동/1=구/2=범위확대/3=법정동×유형 평균/4=구×유형 평균)는 같은 배열 안에서
// 항상 confidenceLevel과 같은 단계 — MATCH_STAGE_LEVEL로 변환해 CONFIDENCE_LABEL/CONFIDENCE_TONE을 그대로
// 재사용한다. 지번은 내려오지 않고 법정동(dong)까지만(개인정보 성격은 아니지만 실거래가 공개 시스템 관례를
// 따름, §2.9). matchStage>=3(평균 기반)은 면적·연식을 반영 못 하는 근본적으로 다른 신뢰도 등급이라
// MarketAnalysisPage.tsx의 TradeTable에서 "면적·연식 무관, 참고용" 보조 문구를 행마다 붙인다.
export interface ComparableTrade {
    dong: string;
    area: number;
    price: number;
    contractDate: string;
    matchStage: number;
}

export const MATCH_STAGE_LEVEL: Record<number, Exclude<ConfidenceLevel, "UNAVAILABLE">> = {
    0: "SAME_DONG",
    1: "SAME_GU",
    2: "WIDENED_RANGE",
    3: "DONG_TYPE_AVERAGE",
    4: "GU_TYPE_AVERAGE",
};

export interface EstimatedPrice {
    value: number | null;
    confidenceLevel: ConfidenceLevel;
    comparableCount: number;
    comparableTrades: ComparableTrade[];
    // FEATURE_10_AI_REPORT.md §2.6 "미래 가치 예측" 3-way 시나리오 — 보수적/낙관적 값(2026-08-1x 추가, 실측 확인).
    // "기준" 값은 이 필드가 아니라 market.postRemodelEstimatedPrice.value를 쓴다(사용자 확인).
    conservativeValue: number | null;
    optimisticValue: number | null;
}

// FEATURE_10_AI_REPORT.md §2.4 "시세 추이" 꺾은선 그래프용 — 실측 확인된 응답 그대로(2026-08-1x).
export interface PriceTrendPoint {
    month: string; // "YYYY-MM"
    medianPricePerSqm: number;
    tradeCount: number;
}

export interface PriceTrend {
    matchStage: number;
    points: PriceTrendPoint[];
}

// FEATURE_08_MARKET.md §3.7: 백엔드 구현 완료(2026-08-1x) — "리모델링 후 예상 시세"(세대수 증가 반영 또는 증축 후 면적 기준 재조회).
// F-05 시세 카드가 아니라 F-10 "시장 분석"으로 이동 예정(FEATURE_05_PROPERTY_INFO.md §2.1-c) — 타입만 먼저 맞춰둔다.
// confidenceLevel이 null이면(값 자체가 아니라 등급 산정이 안 된 경우) "산출 불가"로 표시.
export interface PostRemodelEstimatedPrice {
    value: number | null;
    confidenceLevel: ConfidenceLevel | null;
    comparableCount: number | null;
    comparableTrades: ComparableTrade[];
    // FEATURE_10_AI_REPORT.md §2.6 "미래 가치 예측" 3-way 시나리오 — estimatedPrice와 마찬가지로 postRemodelEstimatedPrice
    // 자체에도 실린다(DB 실측 확인, 2026-08-1x — toEstimatedPrice()가 양쪽을 같은 지점에서 채움). "미래 가치"는 이
    // 값을 써야 한다 — estimatedPrice의 conservativeValue/optimisticValue는 "현재가" 시나리오라 다른 개념.
    conservativeValue: number | null;
    optimisticValue: number | null;
}

// FEATURE_10_AI_REPORT.md §2.3 item 5(2026-08-10 배포) — "거래 활성도" 카드. 모집단은 estimatedPrice의 실제
// 신뢰도 단계와 무관하게 항상 고정(법정동×유형×면적±20%·연식±5년, F-08 SAME_DONG 단계와 동일 필터) — "이 매물과
// 거의 동일한 조건의 거래가 최근 얼마나 있었나"를 보여주는 지표라 estimatedPrice처럼 범위를 넓히지 않는다.
// 0건도 유효한 값(데이터 없음이 아니라 "낮음" 신호)이라 null과 {0,0,0}을 구분해야 한다 — 유형 분류 자체가
// 안 되거나 대상 면적을 못 구할 때만(estimatedPrice가 UNAVAILABLE이 되는 것과 같은 조건) null.
export interface TradeActivity {
    recent1yCount: number;
    recent3yCount: number;
    recent5yCount: number;
}

// FEATURE_10_AI_REPORT.md §2.3 item 4(2026-08-10 배포) — "시장 내 가격 위치" 카드. p25/median/p75는 ㎡당가
// (만원 단위, 총액 아님). thisPropertyPercentile은 0~100(클수록 비싼 쪽) — "상위 N%"로 보여줄 땐
// 100-thisPropertyPercentile로 환산. 모집단은 estimatedPrice가 실제로 resolve된 단계와 완전히 동일해
// tradeActivity와 달리 완화 단계를 그대로 따라간다. thisPropertyPercentile이 정확히 50.0이면 recentTrade가
// 없거나 지분(구분소유 일부) 거래로 판정돼 중앙값으로 대체됐다는 뜻(§8.16 판정 재사용) — 이례적인 값 아님.
export interface PricePosition {
    p25: number;
    median: number;
    p75: number;
    thisPropertyPercentile: number;
}

export interface MarketAnalysis {
    recentTrade: RecentTrade | null;
    estimatedPrice: EstimatedPrice;
    officialPrice: number | null;
    landPrice: number | null;
    // §3.7: F-06 "불가" 판정이거나 참조 필드가 없으면 이 객체 자체가 null(절반만 계산된 값 노출 안 함).
    postRemodelEstimatedPrice: PostRemodelEstimatedPrice | null;
    priceTrend: PriceTrend | null;
    // estimatedPrice가 UNAVAILABLE이면(비교할 분포 자체가 없어) 둘 다 null(2026-08-10 배포, 실측 확인).
    tradeActivity: TradeActivity | null;
    pricePosition: PricePosition | null;
}

// FEATURE_08_MARKET.md §5.1 확정본 — 신뢰도 배지 한글 라벨. UNAVAILABLE은 배지 자체를 안 띄우고 "추정 불가" 텍스트만
// 쓰는 게 원칙(§2.2)이라 CONFIDENCE_TONE에서 제외한 소비처(F-05)도 있었지만, F-10은 근거를 자세히 보여주는 화면이라
// UNAVAILABLE도 라벨을 그대로 노출한다(§2.9 "완화 단계 배지"와 같은 맥락).
// 2026-08-17 표기 정정(docs/CONTENT_TAXONOMY.md §3) — "추정 불가"는 결측 4종에 없는 표현("추정 불가"는 "산출
// 불가"에 합친다, 사용자가 둘의 차이를 알 필요가 없음) — "산출 불가"로 통일.
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
    SAME_DONG: "높음(같은 법정동 비교)",
    SAME_GU: "중간(같은 구 비교)",
    WIDENED_RANGE: "낮음(면적·연식 범위 확대)",
    DONG_TYPE_AVERAGE: "매우 낮음(법정동·유형 평균, 면적·연식 미반영)",
    GU_TYPE_AVERAGE: "매우 낮음(구·유형 평균, 면적·연식 미반영)",
    UNAVAILABLE: "산출 불가(비교 가능한 유사 거래 없음)",
};

// 좁은 fact-list 행(사업성 요약의 "미래가치" 등)에서는 괄호 설명이 값 텍스트를 밀어내 줄바꿈을 깨뜨린다(2026-08-1x).
// 숫자 점수화는 하지 않는다(근거 없는 값이라 DOMAIN.md §4 위반) — 괄호 설명만 생략, 등급 자체는 CONFIDENCE_LABEL과 동일.
// 2026-08-10: "카드 헤더처럼 자리가 있는 곳은 CONFIDENCE_LABEL 그대로" 예외를 폐지 — MarketAnalysisPage.tsx
// "시세 심화" 카드도 이제 이 짧은 라벨만 쓰고, 괄호 설명은 "04 시장 분석" 섹션에 범례 한 번으로 대체한다
// (반복되는 배지마다 긴 문구를 안 붙여도 되게). 긴 라벨(CONFIDENCE_LABEL) 자체는 다른 소비처가 생길 수 있어
// 남겨두되, 지금은 이 페이지들에서 안 쓴다.
// 2026-08-17 — 이 Record의 실제 값 5종(높음/중간/낮음/매우 낮음/산출 불가)을 타입으로 못박은 것이
// ConfidenceLabel(아래쪽 A/B/C/D 폐지 섹션에서 정의) — 타입 선언 순서상 이 상수보다 먼저 있어야 해서 여기서
// 타입만 미리 참조. DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE가 같은 문자열로 겹쳐 6개 키가 5개 값으로 압축된다.
export const CONFIDENCE_LABEL_SHORT: Record<ConfidenceLevel, ConfidenceLabel> = {
    SAME_DONG: "높음",
    SAME_GU: "중간",
    WIDENED_RANGE: "낮음",
    DONG_TYPE_AVERAGE: "매우 낮음",
    GU_TYPE_AVERAGE: "매우 낮음",
    UNAVAILABLE: "산출 불가",
};

// 2026-08-12 추가 — "01 요약 정보" "현재 확인된 값" 그룹 각주("현재 시세 신뢰도 {등급} — {매칭단계}")용. 등급
// 단어(높음/중간/...)는 이미 currentPriceConfidence(A~D 문자 등급)로 따로 표시하니, 여기선 CONFIDENCE_LABEL의
// 괄호 안 매칭 근거만 짧게 뽑아 별도 상수로 둔다(등급 단어와 중복 없이).
export const CONFIDENCE_MATCH_STAGE_LABEL: Record<ConfidenceLevel, string> = {
    SAME_DONG: "같은 법정동 비교",
    SAME_GU: "같은 구 비교",
    WIDENED_RANGE: "면적·연식 범위 확대",
    DONG_TYPE_AVERAGE: "법정동·유형 평균",
    GU_TYPE_AVERAGE: "구·유형 평균",
    UNAVAILABLE: "비교 가능한 유사 거래 없음",
};

// §2.2 "신뢰도 배지 색상": SAME_DONG=success·SAME_GU=warning·WIDENED_RANGE/DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE
// =neutral(회색)·UNAVAILABLE은 배지 없음(호출부에서 분기).
export const CONFIDENCE_TONE: Record<Exclude<ConfidenceLevel, "UNAVAILABLE">, "success" | "warning" | "neutral"> = {
    SAME_DONG: "success",
    SAME_GU: "warning",
    WIDENED_RANGE: "neutral",
    DONG_TYPE_AVERAGE: "neutral",
    GU_TYPE_AVERAGE: "neutral",
};

// 2026-08-17 추가, 같은 날 재정정 — "06 사업성 분석" 신뢰도 칩(pill) 전용 톤 매핑. 최초엔 확정본 mockup의
// 리터럴 색(중간=중립 회색, 매우낮음=warning 주황)을 그대로 옮겼으나, 사용자가 "매우낮음도 낮음과 완전히
// 같은 회색"으로 정정 — 최종 규칙은 높음=success·중간=warning·낮음=neutral·매우낮음=neutral(낮음과 동일)·
// 산출불가=배지 자체 없음(호출부에서 UNAVAILABLE을 걸러내는 걸로 처리, 이 Record엔 없음). 결과적으로 아래
// 값이 바로 위 CONFIDENCE_TONE(04 "시세 심화" 배지 등)과 완전히 같아졌다 — 그래도 상수는 분리 유지한다.
// CONFIDENCE_TONE을 직접 재사용하면 나중에 06만 다시 바뀔 때(이번처럼) 04까지 같이 바뀌어버리는 결합이
// 생긴다 — 지금은 값이 같아도 "06 전용" 개념 자체는 유효해서 중복을 감수하고 분리해 둔다.
export const CONFIDENCE_PILL_TONE: Record<Exclude<ConfidenceLevel, "UNAVAILABLE">, "success" | "warning" | "neutral"> = {
    SAME_DONG: "success",
    SAME_GU: "warning",
    WIDENED_RANGE: "neutral",
    DONG_TYPE_AVERAGE: "neutral",
    GU_TYPE_AVERAGE: "neutral",
};

// 2026-08-17 — A/B/C/D 등급 체계 전면 폐지(analysisApi.ts의 구 PriceConfidenceGrade/priceConfidenceFromLevel/
// priceConfidenceTone 삭제), CONFIDENCE_LABEL_SHORT 라벨(높음/중간/낮음/매우 낮음/산출 불가) 5단계로 리포트
// 전체 통일 — 04 "시세 산정 근거" 카드가 이미 쓰던 이 어휘가 유일한 신뢰도 범례가 된다. CONFIDENCE_LABEL_SHORT의
// 실제 값은 6개 ConfidenceLevel 키가 5개 문자열로 압축된 결과(DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE가 같은
// "매우 낮음")라, 그 문자열 자체를 타입으로 못박아 F-09 매트릭스(analysisApi.ts)처럼 라벨을 키로 쓰는 곳에서
// 재사용한다.
export type ConfidenceLabel = "높음" | "중간" | "낮음" | "매우 낮음" | "산출 불가";

// "01 요약정보 현재가"/"F-04·F-05 시세" 배지 전용 — recentTrade(실제 성사된 거래)가 있으면 confidenceLevel과
// 무관하게 최우선으로 "실거래"(가장 강한 신뢰도 신호). "리모델링 후 추정"/F-09처럼 미래 추정값에는 애초에
// recentTrade 개념이 없어(아직 일어나지 않은 거래) 이 값이 나올 일이 없다 — hasRecentTrade 인자를 그런
// 소비처에서는 항상 false로 넘기면 된다(별도 타입 분기 불필요).
export type PriceDisplayLabel = ConfidenceLabel | "실거래";

export const resolvePriceDisplayLabel = (confidenceLevel: ConfidenceLevel, hasRecentTrade: boolean): PriceDisplayLabel =>
    hasRecentTrade ? "실거래" : CONFIDENCE_LABEL_SHORT[confidenceLevel];

// 색 — 실거래·높음=success · 중간=warning · 낮음·매우 낮음·산출 불가=neutral(같은 회색). 04/06이 이미 쓰던
// CONFIDENCE_TONE/CONFIDENCE_PILL_TONE과 같은 규칙 재사용(새 색 없음) — 다만 그 두 Record는 UNAVAILABLE 키가
// 없어(호출부에서 배지 자체를 숨기는 방식) 여기서는 별도로 neutral을 채워 둔다. "산출 불가"도 값 자체는
// 갖고 있지만, 아래 hasPriceConfidenceBadge가 UNAVAILABLE(& !hasRecentTrade)이면 배지 렌더링 자체를 막으므로
// 이 톤 값이 실제로 쓰이는 일은 없다(타입 완전성만 목적).
export const PRICE_DISPLAY_TONE: Record<PriceDisplayLabel, "success" | "warning" | "neutral"> = {
    실거래: "success",
    높음: "success",
    중간: "warning",
    낮음: "neutral",
    "매우 낮음": "neutral",
    "산출 불가": "neutral",
};

// 2026-08-17 재정정(planning/rebuild/widgets/2026-08-17_confidence_unified_legend.html 확정본) — "산출 불가"도
// 실제 표시 상태로 취급해 neutral 배지를 노출했던 이전 판단을 되돌린다. 확정본이 "추정불가: 배지 없이 텍스트만"
// 이라고 명시 — recentTrade가 있으면(그래서 "실거래"로 뜨면) 여전히 배지를 보여주고, 그 경우가 아니면서
// confidenceLevel이 UNAVAILABLE일 때만 배지 자체를 숨긴다(호출부는 이 값이 false면 <span className="report-chip
// ...">가 아니라 배지 없는 plain text로 "신뢰도 산출 불가"를 보여줘야 한다 — 완전히 숨기는 게 아니라 "텍스트만").
export const hasPriceConfidenceBadge = (confidenceLevel: ConfidenceLevel, hasRecentTrade: boolean): boolean =>
    hasRecentTrade || confidenceLevel !== "UNAVAILABLE";

// "거래 활성도" 카드(FEATURE_10_AI_REPORT.md §2.3 item 5) — "시장 유동성" 판정은 백엔드가 안 내려주는 프론트
// V1 잠정치. 최근 1년 거래건수(TradeActivity.recent1yCount)만 기준으로 삼고, 3/5년은 참고용 raw 숫자로만
// 노출(판정에 안 씀). 2026-08-10 tradeActivity 필드 배포 완료 — MarketAnalysisPage.tsx에서 사용 중.
export const getLiquidity = (recent1yCount: number): "활발" | "보통" | "낮음" =>
    recent1yCount >= 20 ? "활발" : recent1yCount >= 5 ? "보통" : "낮음";
