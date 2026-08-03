import type { RecentTrade } from "./searchApi";

// FEATURE_08_MARKET.md §3.6: 백엔드 구현 완료(2026-08-08). 값 단위 전부 만원 — 단 landPrice(개별공시지가)만
// 예외로 원/㎡ 단가 그대로(총액이 아니라 단가라는 의미 자체가 달라서 환산하지 않음, §3.6 "단위 주의").
export type ConfidenceLevel = "SAME_DONG" | "SAME_GU" | "WIDENED_RANGE" | "UNAVAILABLE";

export interface EstimatedPrice {
    value: number | null;
    confidenceLevel: ConfidenceLevel;
    comparableCount: number;
}

// FEATURE_08_MARKET.md §3.7: 백엔드 구현 완료(2026-08-1x) — "리모델링 후 예상 시세"(세대수 증가 반영 또는 증축 후 면적 기준 재조회).
// F-05 시세 카드가 아니라 F-10 "시장 분석"으로 이동 예정(FEATURE_05_PROPERTY_INFO.md §2.1-c) — 타입만 먼저 맞춰둔다.
// confidenceLevel이 null이면(값 자체가 아니라 등급 산정이 안 된 경우) "산출 불가"로 표시.
export interface PostRemodelEstimatedPrice {
    value: number | null;
    confidenceLevel: ConfidenceLevel | null;
    comparableCount: number | null;
}

export interface MarketAnalysis {
    recentTrade: RecentTrade | null;
    estimatedPrice: EstimatedPrice;
    officialPrice: number | null;
    landPrice: number | null;
    postRemodelEstimatedPrice: PostRemodelEstimatedPrice;
}
