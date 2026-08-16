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
export const CONFIDENCE_LABEL_SHORT: Record<ConfidenceLevel, string> = {
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

// "거래 활성도" 카드(FEATURE_10_AI_REPORT.md §2.3 item 5) — "시장 유동성" 판정은 백엔드가 안 내려주는 프론트
// V1 잠정치. 최근 1년 거래건수(TradeActivity.recent1yCount)만 기준으로 삼고, 3/5년은 참고용 raw 숫자로만
// 노출(판정에 안 씀). 2026-08-10 tradeActivity 필드 배포 완료 — MarketAnalysisPage.tsx에서 사용 중.
export const getLiquidity = (recent1yCount: number): "활발" | "보통" | "낮음" =>
    recent1yCount >= 20 ? "활발" : recent1yCount >= 5 ? "보통" : "낮음";
