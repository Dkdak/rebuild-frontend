import type { RecentTrade } from "./searchApi";

// FEATURE_08_MARKET.md §3.6: 백엔드 구현 완료(2026-08-08). 값 단위 전부 만원 — 단 landPrice(개별공시지가)만
// 예외로 원/㎡ 단가 그대로(총액이 아니라 단가라는 의미 자체가 달라서 환산하지 않음, §3.6 "단위 주의").
export type ConfidenceLevel = "SAME_DONG" | "SAME_GU" | "WIDENED_RANGE" | "UNAVAILABLE";

// FEATURE_10_AI_REPORT.md §2.9: "유사 사례" 페이지용 — 추정 시세 계산에 실제로 쓰인 비교 거래 원본(집계 통계가
// 아니라 개별 행). matchStage(0=법정동/1=구/2=범위확대)는 같은 배열 안에서 항상 confidenceLevel과 같은 단계 —
// MATCH_STAGE_LEVEL로 변환해 CONFIDENCE_LABEL/CONFIDENCE_TONE을 그대로 재사용한다. 지번은 내려오지 않고
// 법정동(dong)까지만(개인정보 성격은 아니지만 실거래가 공개 시스템 관례를 따름, §2.9).
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

export interface MarketAnalysis {
    recentTrade: RecentTrade | null;
    estimatedPrice: EstimatedPrice;
    officialPrice: number | null;
    landPrice: number | null;
    // §3.7: F-06 "불가" 판정이거나 참조 필드가 없으면 이 객체 자체가 null(절반만 계산된 값 노출 안 함).
    postRemodelEstimatedPrice: PostRemodelEstimatedPrice | null;
    priceTrend: PriceTrend | null;
}

// FEATURE_08_MARKET.md §5.1 확정본 — 신뢰도 배지 한글 라벨. UNAVAILABLE은 배지 자체를 안 띄우고 "추정 불가" 텍스트만
// 쓰는 게 원칙(§2.2)이라 CONFIDENCE_TONE에서 제외한 소비처(F-05)도 있었지만, F-10은 근거를 자세히 보여주는 화면이라
// UNAVAILABLE도 라벨을 그대로 노출한다(§2.9 "완화 단계 배지"와 같은 맥락).
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
    SAME_DONG: "높음(같은 법정동 비교)",
    SAME_GU: "중간(같은 구 비교)",
    WIDENED_RANGE: "낮음(면적·연식 범위 확대)",
    UNAVAILABLE: "추정 불가(비교 가능한 유사 거래 없음)",
};

// 좁은 fact-list 행(사업성 요약의 "미래가치" 등)에서는 괄호 설명이 값 텍스트를 밀어내 줄바꿈을 깨뜨린다(2026-08-1x).
// 숫자 점수화는 하지 않는다(근거 없는 값이라 DOMAIN.md §4 위반) — 괄호 설명만 생략, 등급 자체는 CONFIDENCE_LABEL과 동일.
// 카드 헤더처럼 자리가 있는 곳(예: "시세 심화")은 CONFIDENCE_LABEL을 그대로 쓴다.
export const CONFIDENCE_LABEL_SHORT: Record<ConfidenceLevel, string> = {
    SAME_DONG: "높음",
    SAME_GU: "중간",
    WIDENED_RANGE: "낮음",
    UNAVAILABLE: "추정 불가",
};

// §2.2 "신뢰도 배지 색상": SAME_DONG=success·SAME_GU=warning·WIDENED_RANGE=neutral(회색)·UNAVAILABLE은 배지 없음(호출부에서 분기).
export const CONFIDENCE_TONE: Record<Exclude<ConfidenceLevel, "UNAVAILABLE">, "success" | "warning" | "neutral"> = {
    SAME_DONG: "success",
    SAME_GU: "warning",
    WIDENED_RANGE: "neutral",
};
