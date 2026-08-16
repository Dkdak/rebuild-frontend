import {
    CONFIDENCE_LABEL_SHORT,
    CONFIDENCE_TONE,
    getLiquidity,
    MATCH_STAGE_LEVEL,
    type ComparableTrade,
    type ConfidenceLevel,
} from "../api/marketApi";
import { formatManwon } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../investment/api/analysisApi";
import PriceTrendChart from "./PriceTrendChart";

interface MarketAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    area: number | null; // 건물 자체 면적(F-04 §2.1-e 기준) — 추정 시세 ㎡당가격 분모
}

const formatContractMonth = (dateStr: string): string => {
    const [year, month] = dateStr.split("-");
    return year && month ? `${year}년 ${Number(month)}월` : dateStr;
};

// confidenceLevel별 매칭 기준 텍스트 — 하드코딩 아니라 매핑 테이블로(2026-08-10, "시세 산정 근거" 카드).
const MATCH_STAGE_TEXT: Record<ConfidenceLevel, string> = {
    SAME_DONG: "같은 법정동 비교(면적 ±10% · 연식 ±5년)",
    SAME_GU: "같은 구 비교(면적 ±10% · 연식 ±5년)",
    WIDENED_RANGE: "비교 범위 확대(면적 ±20% · 연식 ±10년)",
    DONG_TYPE_AVERAGE: "법정동·유형 평균(면적·연식 무관)",
    GU_TYPE_AVERAGE: "구·유형 평균(면적·연식 무관)",
    UNAVAILABLE: "산정 불가",
};

// 최대 5건, 계약일 최신순(FEATURE_10_AI_REPORT.md §2.4 — 구 "유사 사례" 흡수).
const topFive = (trades: ComparableTrade[]): ComparableTrade[] =>
    [...trades].sort((a, b) => b.contractDate.localeCompare(a.contractDate)).slice(0, 5);

const TradeTable = ({ trades }: { trades: ComparableTrade[] }) => {
    if (trades.length === 0) {
        return <p className="right-panel-field-note">비교 가능한 유사 거래 없음</p>;
    }
    return (
        <div className="report-trade-table-wrap">
            <table className="report-trade-table">
                <thead>
                    <tr>
                        <th>법정동</th>
                        <th>면적</th>
                        <th>거래가</th>
                        <th>계약월</th>
                        <th>신뢰도</th>
                    </tr>
                </thead>
                <tbody>
                    {topFive(trades).map((trade, index) => {
                        const level = MATCH_STAGE_LEVEL[trade.matchStage];
                        return (
                            // eslint-disable-next-line react/no-array-index-key -- 동일 동/면적/가격 거래가 같은 날 여러 건일 수 있어 index를 섞는다.
                            <tr key={`${trade.dong}-${trade.contractDate}-${index}`}>
                                <td>{trade.dong}</td>
                                <td>{trade.area}㎡</td>
                                <td>{formatManwon(trade.price)}</td>
                                <td>{formatContractMonth(trade.contractDate)}</td>
                                <td>
                                    {/* 2026-08-10 — "면적·연식 무관, 참고용" 보조 행 삭제. 신뢰도 배지는 이 페이지
                                        전체(이 표/"시세 심화" 단독 배지/범례)에서 가벼운 톤(report-tone-badge-light-*)만
                                        쓴다 — 진한 알약형(report-tone-badge, 톤 없이)은 F-05 verdict-badge 같은
                                        다른 용도 전용으로 남김. */}
                                    <span className={`report-tone-badge report-tone-badge-light-${CONFIDENCE_TONE[level] ?? "neutral"}`}>
                                        {CONFIDENCE_LABEL_SHORT[level]}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// FEATURE_10_AI_REPORT.md §2.4: analysis.market(F-08) 파생값 + 시세 추이 그래프(priceTrend) + 비교 거래 표 2개
// (구 "유사 사례" 페이지 흡수, 2026-08-1x 카테고리 재편). 2026-08-10: "단지 정보" 섹션 삭제 — F-17
// building-summary 호출은 BasicInfoPage.tsx(02 기본정보)로 이동, 이 페이지는 더 이상 그 데이터를 안 씀.
const MarketAnalysisPage = ({ analysis, loading, area }: MarketAnalysisPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        // 2026-08-17 표기 정정(docs/CONTENT_TAXONOMY.md §3 결측 4종) — "정보 없음"은 4종에 없는 표현. 여기는
        // 계산 자체가 안 되는(analysis 자체가 없는) 상태라 "산출 불가".
        return <p className="right-panel-field-note">산출 불가</p>;
    }

    const { market } = analysis;

    // §2.2 파생 보조지표: 최근실거래가는 recentTrade.area로, 추정시세는 건물 자체 면적으로 나눔.
    const recentTradePerSqm =
        market.recentTrade?.price != null && market.recentTrade.area != null && market.recentTrade.area > 0
            ? Math.round(market.recentTrade.price / market.recentTrade.area)
            : null;
    const estimatedPricePerSqm =
        market.estimatedPrice.value != null && area != null && area > 0 ? Math.round(market.estimatedPrice.value / area) : null;

    // 공시가격 대비 배율 — 최근실거래가 있으면 그 값, 없으면 추정시세. 분자·분모 둘 다 없으면 표시 안 함.
    const baseForRatio = market.recentTrade?.price ?? market.estimatedPrice.value;
    const officialPriceRatio =
        baseForRatio != null && market.officialPrice != null && market.officialPrice > 0
            ? (baseForRatio / market.officialPrice).toFixed(2)
            : null;

    // 2026-08-10 — "시장 가격 수준" 카드(디자인 mockup 참고, 기존 "시세 심화"를 큰 숫자 비교 위주로 리디자인) —
    // 위 두 ㎡당가격을 그대로 재사용해 차이를 문장으로 표현. 둘 다 있고 분모(추정시세)가 0보다 클 때만 계산.
    const priceLevelDelta =
        recentTradePerSqm != null && estimatedPricePerSqm != null && estimatedPricePerSqm > 0
            ? ((recentTradePerSqm - estimatedPricePerSqm) / estimatedPricePerSqm) * 100
            : null;

    return (
        <>
            {/* 1~3. 시장 가격 수준 / 시장 내 가격 위치 / 거래 활성도 — 한 줄 3열(report-grid-3, BasicInfoPage.tsx
                "02 기본정보"와 같은 클래스 재사용). 2026-08-10 tradeActivity/pricePosition 필드 배포로 세 카드가
                한 행에 나란히 — 시세 추이(4)는 그 아래 별도 전체 폭 줄. */}
            <div className="report-grid-3">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">시장 가격 수준</h5>
                    <div className="report-price-level-grid">
                        <div className="report-price-level-item">
                            {/* 2026-08-10 — 단위를 라벨로 옮겼다가("최근 실거래(만원/㎡)") 어색하다는 지적으로
                                되돌림. 단위 표기 방식(공백/생략 등) 자체는 나중에 한꺼번에 정리 — 지금은 이전
                                형태만 복원. */}
                            <p className="report-price-level-label">최근 실거래</p>
                            {/* 2026-08-17 표기 정정(docs/CONTENT_TAXONOMY.md §3) — "최근 실거래"는 이 매물에도
                                적용되는 개념인데 매칭된 거래가 없는 경우라 "해당 없음"(개념 자체가 안 맞을 때)이
                                아니라 "확인되지 않음"(개념은 있는데 값만 없음)이 맞다. */}
                            <p className="report-price-level-value">
                                {recentTradePerSqm != null ? `${recentTradePerSqm.toLocaleString()} 만원/㎡` : "확인되지 않음"}
                            </p>
                        </div>
                        <div className="report-price-level-item">
                            <p className="report-price-level-label">추정 시세</p>
                            {/* 2026-08-17 표기 정정 — "추정 불가"는 §3 4종에 없는 표현("추정 불가"는 "산출 불가"에
                                합친다). */}
                            <p className="report-price-level-value">
                                {estimatedPricePerSqm != null ? `${estimatedPricePerSqm.toLocaleString()} 만원/㎡` : "산출 불가"}
                            </p>
                        </div>
                    </div>
                    {priceLevelDelta != null && (
                        <p className="report-price-level-delta">
                            실거래가 추정시세보다 {Math.abs(priceLevelDelta).toFixed(1)}% {priceLevelDelta >= 0 ? "높음" : "낮음"}
                        </p>
                    )}
                    {/* 2026-08-10 — "구분선 → 결론 줄" 구조로 세 카드(시장 가격 수준/시장 내 가격 위치/거래 활성도)
                        통일. right-panel-market-cell-aux는 F-05 좁은 사이드바 dd 정렬 기준으로 text-align:right가
                        붙어 있어(layout.css) 이 카드처럼 넓은 report-grid-2 칼럼에서 결론 줄이 오른쪽으로 붕 떠
                        보였다 — right-panel-field-note(왼쪽 정렬)로 교체. */}
                    <hr className="right-panel-card-divider" />
                    <p className="right-panel-field-note">
                        비교거래 {market.estimatedPrice.comparableCount}건 · 신뢰도{" "}
                        {/* 신뢰도 배지는 이 페이지 전체(이 단독 배지/표 안/범례)에서 가벼운 톤만 쓴다. 진한 알약형
                            (report-tone-badge, 톤 클래스 없이)은 F-05 verdict-badge류 다른 용도로만 남김. */}
                        <span
                            className={`report-tone-badge ${
                                market.estimatedPrice.confidenceLevel === "UNAVAILABLE"
                                    ? ""
                                    : `report-tone-badge-light-${CONFIDENCE_TONE[market.estimatedPrice.confidenceLevel]}`
                            }`}
                        >
                            {CONFIDENCE_LABEL_SHORT[market.estimatedPrice.confidenceLevel]}
                        </span>
                    </p>
                    {officialPriceRatio != null && (
                        <p className="right-panel-field-note">공시가격 대비 시세 {officialPriceRatio}배(참고용)</p>
                    )}
                </section>

                {/* 2026-08-10 — pricePosition 배포(FEATURE_10_AI_REPORT.md §2.3 item 4). 모집단은 estimatedPrice가
                    실제로 resolve된 단계와 동일(tradeActivity와 달리 완화 단계를 그대로 따라감). 마커 위치는
                    thisPropertyPercentile(0~100)을 트랙 left%로 직접 사용 — p25/p75도 정의상 각각 25/75
                    percentile이라 눈금 자리(25%/50%/75%)와 값이 서로 어긋나지 않는다. */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">시장 내 가격 위치</h5>
                    {/* 2026-08-17 정정(docs/CONTENT_TAXONOMY.md 금지규칙 5 "계산되지 않은 값에 결론을 붙이지
                        않는다") — thisPropertyPercentile===50을 "이례적 값"으로 취급해 게이지+결론을 그대로
                        그리고 그 아래에 뒤늦게 "사실 중앙값 대체였다"고 해명하던 것이 바로 이 금지 규칙이 지목한
                        패턴이었다. DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE(대표 가격이 실제 비교거래가 아니라 평균·
                        중앙값 대체로 resolve된 단계)면 percentile 자체가 "계산되지 않은 값"이라 게이지를 아예
                        그리지 않고 "산출 불가"만 표시 — 50 여부로 판단하지 않는다(진짜 SAME_DONG 단계에서
                        중앙값에 위치한 매물은 50이 정상값이라 걸러지면 안 됨). */}
                    {market.pricePosition == null ||
                    market.estimatedPrice.confidenceLevel === "DONG_TYPE_AVERAGE" ||
                    market.estimatedPrice.confidenceLevel === "GU_TYPE_AVERAGE" ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <>
                            <div className="report-price-position-gauge">
                                <div className="report-price-position-track" />
                                <div
                                    className="report-price-position-marker"
                                    style={{ left: `${market.pricePosition.thisPropertyPercentile}%` }}
                                >
                                    {estimatedPricePerSqm != null ? estimatedPricePerSqm.toLocaleString() : "-"}
                                </div>
                            </div>
                            <div className="report-price-position-ticks">
                                <span>하위25% {Math.round(market.pricePosition.p25).toLocaleString()}</span>
                                <span>중앙값 {Math.round(market.pricePosition.median).toLocaleString()}</span>
                                <span>상위25% {Math.round(market.pricePosition.p75).toLocaleString()}</span>
                            </div>
                            <hr className="right-panel-card-divider" />
                            {/* 2026-08-17 정정(금지규칙 3 "방향을 결론에 명시한다") — "상위 20%"만 있으면 "좋다"는
                                뜻으로 오독될 수 있어(비싼 쪽이라는 뜻) 방향을 문장으로 먼저 말한다. */}
                            <p className="right-panel-field-note">
                                {market.pricePosition.thisPropertyPercentile >= 50
                                    ? `가격이 높은 편입니다(상위 ${(100 - market.pricePosition.thisPropertyPercentile).toFixed(0)}% 수준)`
                                    : `가격이 낮은 편입니다(하위 ${market.pricePosition.thisPropertyPercentile.toFixed(0)}% 수준)`}
                            </p>
                        </>
                    )}
                </section>

                {/* 2026-08-10 — tradeActivity 배포, FEATURE_10_AI_REPORT.md §2.3 item 5. "시장 유동성"은 백엔드가
                    안 내려주는 프론트 V1 판정(getLiquidity, marketApi.ts) — 최근 1년 건수만 기준, 3/5년은
                    참고용 raw 숫자. 0건도 유효한 값이라 null(모집단 자체 없음)과 명확히 구분해서 처리. */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">거래 활성도</h5>
                    {market.tradeActivity == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <>
                            <dl className="right-panel-fact-list">
                                <div>
                                    <dt>최근 1년</dt>
                                    <dd>{market.tradeActivity.recent1yCount}건</dd>
                                </div>
                                <div>
                                    <dt>최근 3년</dt>
                                    <dd>{market.tradeActivity.recent3yCount}건</dd>
                                </div>
                                <div>
                                    <dt>최근 5년</dt>
                                    <dd>{market.tradeActivity.recent5yCount}건</dd>
                                </div>
                            </dl>
                            <hr className="right-panel-card-divider" />
                            <p className="right-panel-field-note">
                                시장 유동성 <strong>{getLiquidity(market.tradeActivity.recent1yCount)}</strong>
                            </p>
                        </>
                    )}
                </section>
            </div>

            {/* 4. 시세 추이 — priceTrend(2026-08-1x 신규 필드) */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">시세 추이</h5>
                {market.priceTrend == null || market.priceTrend.points.length === 0 ? (
                    <p className="right-panel-field-note">산출 불가</p>
                ) : (
                    <PriceTrendChart points={market.priceTrend.points} />
                )}
            </section>

            {/* 5~6. 비교 거래 표 — 구 "유사 사례" 페이지 흡수(2026-08-1x). 2026-08-10: 카드 상단 경고 배너 추가
                (디자인 mockup 참고) — DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE(matchStage 3/4)는 면적을 반영 못 하는
                평균 기반이라 "현재"/"리모델링 후" 두 표가 같은 원본 거래로 나올 수 있다(§2.2, TradeTable의
                기존 행별 보조문구를 카드 단위 배너로 승격 — 표 안 배지는 여전히 report-tone-badge-light-*).
                2026-08-17 재정정(FEATURE_08_MARKET.md §2.2, docs/CONTENT_TAXONOMY.md 적용) — (a) 문구를
                "두 표가 같은 거래로 나올 수 있습니다"(현상 설명뿐)에서 "이 값이 이어지는 예상차익·ROI 결과에
                어떤 영향을 주는지"까지 명시하는 문장으로 교체. (b) 카드마다 반복하지 않고 두 표를 감싸는
                report-grid-2 위에 한 번만(문서 "행마다 반복하지 않고 두 표를 감싸는 자리에 한 번만") —
                estimatedPrice/postRemodelEstimatedPrice 둘 중 하나라도 해당 단계면 노출. */}
            {(market.estimatedPrice.confidenceLevel === "DONG_TYPE_AVERAGE" ||
                market.estimatedPrice.confidenceLevel === "GU_TYPE_AVERAGE" ||
                market.postRemodelEstimatedPrice?.confidenceLevel === "DONG_TYPE_AVERAGE" ||
                market.postRemodelEstimatedPrice?.confidenceLevel === "GU_TYPE_AVERAGE") && (
                <p className="report-warning-note">
                    이 단계는 면적을 반영하지 않아 현재 시세와 리모델링 후 시세의 차이가 실제와 다를 수 있습니다.
                </p>
            )}
            <div className="report-grid-2">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">현재 추정 시세 근거</h5>
                    <p className="right-panel-card-subtitle">추정 시세 계산에 사용된 비교 거래</p>
                    <TradeTable trades={market.estimatedPrice.comparableTrades} />
                </section>

                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">리모델링 후 예상 시세 근거</h5>
                    <p className="right-panel-card-subtitle">"리모델링 후 예상 시세" 계산에 사용된 비교 거래</p>
                    {market.postRemodelEstimatedPrice == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <TradeTable trades={market.postRemodelEstimatedPrice.comparableTrades} />
                    )}
                </section>
            </div>
            {/* "04 시장 분석" 섹션 전체(위 배지 3곳: 시세 심화 카드/비교 거래 표 2개) 공용 각주(2026-08-10, plain
                텍스트 각주 → 카드로 구체화) — 이 매물의 실제 신뢰도(market.estimatedPrice.confidenceLevel)를
                MATCH_STAGE_TEXT로 문장화하고, 아래 배지 4개는 데이터에 안 묶인 순수 범례(단계 표). 개별 배지 옆
                report-tone-badge-light-*는 그대로, 괄호 설명만 여기 한 곳으로 흡수. */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">시세 산정 근거</h5>
                <p className="right-panel-field-note">
                    이 매물은 <strong>{MATCH_STAGE_TEXT[market.estimatedPrice.confidenceLevel]}</strong> 기준으로 산정됐습니다
                </p>
                {/* 2026-08-17 재구성 — 배지 행 + 압축 문장 2줄이 같은 정보(단계별 기준)를 중복 설명하고 있어서
                    하나로 합친다: 배지 바로 옆에 그 배지의 정의를 붙여 한 줄씩(docs/CONTENT_TAXONOMY.md §2
                    "E. 범례" — "배지와 글자가 완전히 같아야 함" 원칙 그대로, 배지 텍스트는 CONFIDENCE_LABEL_SHORT와
                    동일 문자열 "매우 낮음"(공백 포함) 유지). line-height를 넉넉히 줘서 배지가 줄바꿈될 때 다음
                    줄과 안 겹치게 한다. */}
                <p className="market-basis-legend">
                    <span className="report-tone-badge report-tone-badge-light-success">높음</span> 같은 법정동 비교(면적±10%·연식±5년),{" "}
                    <span className="report-tone-badge report-tone-badge-light-warning">중간</span> 같은 구 비교(면적±10%·연식±5년),{" "}
                    <span className="report-tone-badge report-tone-badge-light-neutral">낮음</span> 범위 확대(면적±20%·연식±10년),{" "}
                    <span className="report-tone-badge report-tone-badge-light-neutral">매우 낮음</span> 법정동·구 유형 평균(면적·연식 무관)
                </p>
            </section>
        </>
    );
};

export default MarketAnalysisPage;
