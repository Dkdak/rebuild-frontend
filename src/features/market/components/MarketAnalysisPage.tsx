import {
    CONFIDENCE_LABEL_SHORT,
    getLiquidity,
    hasPriceConfidenceBadge,
    PRICE_DISPLAY_TONE,
    resolvePriceDisplayLabel,
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

// 2026-08-17 재구성 — 행마다 반복되던 "신뢰도" 열 삭제(FEATURE_08_MARKET.md §2.2, matchStage/confidenceLevel은
// "이 매물"의 매칭 단계 하나에 대한 값이라 5개 행 전부 같은 배지가 그대로 반복되고 있었다 — 정보가 아니라
// 중복). 표 아래 "비교거래 기반 추정 {현재/리모델링 후} 시세" 결과 요약박스로 대체(06 "미래가치 산정 근거"
// 카드의 표+결과배지 패턴과 같은 구조 — 근거 바로 아래서 값+신뢰도를 한 번에 확인).
// 2026-08-17 재정정(신뢰도 스티커 통일, planning/rebuild/widgets/2026-08-17_report_full_confidence_context.html
// 확정본) — 결과 요약박스 배지를 이 페이지 기존 999px pill(report-tone-badge-light-*)에서 06과 같은 4px
// report-chip으로 교체(리포트 전체 배지 모양 통일). hasRecentTrade("현재" 표에서만 의미 있음, "리모델링 후"는
// 항상 false로 호출부에서 넘김)로 "실거래" 우선 규칙 반영, confidenceLevel이 UNAVAILABLE이면
// hasPriceConfidenceBadge가 false라 배지를 안 띄운다(확정본 "추정불가: 배지 없이 텍스트만").
// 2026-08-17 재구성(FEATURE_10_AI_REPORT.md §2.3, planning/rebuild/widgets/
// 2026-08-17_market_analysis_full_updated.html 확정본) — (a) 표 아래 "전체 N건 중 최근 5건" 캡션 추가(06
// ComparableTradesCard.tsx가 이미 쓰는 문구 그대로 재사용, 그동안 04에는 빠져 있었음). (b) 결과박스에 계산식
// 2줄 추가 — "이 5건의 중앙값"이 아니라 "전체 comparableCount건의 중앙값"이라고 정확히 표현(실제 계산 모집단은
// TradeStatsIndex의 전체 비교거래, 화면 표는 최신순 5건 샘플이라 서로 다름 — 백엔드 확인 완료).
const TradeTable = ({
    trades,
    priceLabel,
    comparableCount,
    perSqmPrice,
    totalValue,
    area,
    confidenceLevel,
    hasRecentTrade,
}: {
    trades: ComparableTrade[];
    priceLabel: string; // "현재" | "리모델링 후" — 결과 요약박스 문구용
    comparableCount: number | null; // 비교거래 전체 건수(표는 이 중 최신순 5건만) — "전체 N건 중 최근 5건" 캡션 + 계산식 1줄용
    perSqmPrice: number | null;
    totalValue: number | null; // 추정 {현재/리모델링 후} 시세 총액(estimatedPrice.value/postRemodelEstimatedPrice.value) — 계산식 2줄용
    area: number | null; // 건물 자체 면적 — 계산식 2줄("연면적 {N}㎡")용, perSqmPrice와 같은 분모
    confidenceLevel: ConfidenceLevel | null;
    hasRecentTrade: boolean;
}) => {
    if (trades.length === 0) {
        return <p className="right-panel-field-note">비교 가능한 유사 거래 없음</p>;
    }
    const showBadge = confidenceLevel != null && hasPriceConfidenceBadge(confidenceLevel, hasRecentTrade);
    const label = confidenceLevel != null ? resolvePriceDisplayLabel(confidenceLevel, hasRecentTrade) : null;
    const shown = topFive(trades);
    return (
        <>
            <div className="report-trade-table-wrap">
                <table className="report-trade-table">
                    <thead>
                        <tr>
                            <th>법정동</th>
                            <th>면적</th>
                            <th>거래가</th>
                            <th>계약월</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((trade, index) => (
                            // eslint-disable-next-line react/no-array-index-key -- 동일 동/면적/가격 거래가 같은 날 여러 건일 수 있어 index를 섞는다.
                            <tr key={`${trade.dong}-${trade.contractDate}-${index}`}>
                                <td>{trade.dong}</td>
                                <td>{trade.area}㎡</td>
                                <td>{formatManwon(trade.price)}</td>
                                <td>{formatContractMonth(trade.contractDate)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="right-panel-field-note report-basis-caption">
                전체 {comparableCount ?? shown.length}건 중 최근 {shown.length}건
            </p>
            <div className="report-comparable-value-badge">
                <div className="report-comparable-value-badge-row">
                    <span>비교거래 기반 추정 {priceLabel} 시세</span>
                    <span className="report-comparable-value-badge-right">
                        <strong>{perSqmPrice != null ? `${perSqmPrice.toLocaleString()}만원/㎡` : "산출 불가"}</strong>
                        {showBadge && label != null && (
                            <span className={`report-chip report-chip-${PRICE_DISPLAY_TONE[label]}`}>신뢰도 {label}</span>
                        )}
                    </span>
                </div>
                {comparableCount != null && (
                    <p className="report-comparable-value-badge-calc">
                        추정 {priceLabel} 시세 = 비교거래 전체 {comparableCount}건의 ㎡당가 중앙값
                    </p>
                )}
                {perSqmPrice != null && area != null && totalValue != null && (
                    <p className="report-comparable-value-badge-calc">
                        {perSqmPrice.toLocaleString()}만원/㎡ × 연면적 {Math.round(area).toLocaleString()}㎡ ≈{" "}
                        <strong>
                            {priceLabel} 시세 {formatManwon(totalValue)}
                        </strong>
                    </p>
                )}
            </div>
        </>
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

    // 2026-08-17(신뢰도 스티커 통일) — recentTrade 있으면 confidenceLevel과 무관하게 "실거래"가 최우선(01/06/
    // F-04/F-05와 같은 규칙). postRemodel(리모델링 후)은 미래 추정값이라 recentTrade 개념이 없어 항상 false.
    const estimatedPriceHasRecentTrade = market.recentTrade?.price != null;

    // §2.2 파생 보조지표: 최근실거래가는 recentTrade.area로, 추정시세는 건물 자체 면적으로 나눔.
    const recentTradePerSqm =
        market.recentTrade?.price != null && market.recentTrade.area != null && market.recentTrade.area > 0
            ? Math.round(market.recentTrade.price / market.recentTrade.area)
            : null;
    const estimatedPricePerSqm =
        market.estimatedPrice.value != null && area != null && area > 0 ? Math.round(market.estimatedPrice.value / area) : null;
    // 2026-08-17 삭제(§확정분) — postRemodelPricePerSqm(옛 "리모델링 후 예상 시세 근거" 결과박스 전용 값)은
    // 그 카드 삭제로 유일한 소비처가 사라져 함께 삭제. 06 "미래가치 산정 근거"는 이 값이 아니라 별도 분모
    // (연면적+증축가능면적, BusinessAnalysisPage.tsx futureValueUnitPrice)를 쓰므로 재사용 대상도 아니었음.

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
                    {/* 2026-08-17 신규(FEATURE_10_AI_REPORT.md §2.3, planning/rebuild/widgets/
                        2026-08-17_market_analysis_full_updated.html 확정본) — "추정 시세"(㎡당가) 바로 아래
                        총액 행. 새 계산 아님 — estimatedPrice.value(이미 API에 있는 총액)를 그대로 재사용
                        (estimatedPricePerSqm이 이 값을 area로 나눈 것과 같은 출처).
                        2026-08-17 같은 날 재정정(planning/rebuild/widgets/2026-08-17_market_level_card_final.html
                        확정본) — (a) 라벨 "현재가"→"추정가": 이 행은 01/06의 "현재가"(옆에 신뢰도 배지가 붙어
                        추정치라는 신호가 있음)와 달리 배지 없이 숫자만 단독이라 라벨 자체에 "추정"을 명시해야
                        함, "추정 현재가"는 어색해 반려되고 바로 위 "추정 시세" 행과 어휘를 맞춘 "추정가"로 확정.
                        (b) 계산식 캡션("= 추정 시세 × 연면적...") 삭제 — 아래 "현재 추정 시세 근거" 카드에
                        이미 같은 계산식이 있어 중복(그 카드는 값+계산식이 근거 카드의 핵심이라 남기고, 여긴
                        요약 카드라 라벨만으로 충분). */}
                    {market.estimatedPrice.value != null && (
                        <p className="right-panel-field-note">추정가 {formatManwon(market.estimatedPrice.value)}</p>
                    )}
                    {/* 2026-08-10 — "구분선 → 결론 줄" 구조로 세 카드(시장 가격 수준/시장 내 가격 위치/거래 활성도)
                        통일. right-panel-market-cell-aux는 F-05 좁은 사이드바 dd 정렬 기준으로 text-align:right가
                        붙어 있어(layout.css) 이 카드처럼 넓은 report-grid-2 칼럼에서 결론 줄이 오른쪽으로 붕 떠
                        보였다 — right-panel-field-note(왼쪽 정렬)로 교체. */}
                    <hr className="right-panel-card-divider" />
                    <p className="right-panel-field-note">
                        비교거래 {market.estimatedPrice.comparableCount}건 ·{" "}
                        {/* 2026-08-17 재정정 — 04 결과박스/범례·01·06·F-04·F-05가 전부 report-chip(4px)으로
                            통일된 뒤 이 단독 배지만 999px pill(report-tone-badge)로 남아 눈에 띄게 튀어보인다는
                            지적(사용자 스크린샷) — 애초에 "목업 대상 밖이라 손 안 댐"이었던 판단을 뒤집고 나머지와
                            동일하게 맞춘다. UNAVAILABLE이면(hasPriceConfidenceBadge) 배지 없이 텍스트만 그대로.
                            같은 날 재정정 — "신뢰도"가 배지 밖 plain text로 빠져 있어("...신뢰도 [중간]") 다른
                            모든 소비처(04 결과박스/01/06/F-04/F-05, 전부 배지 안에 "신뢰도 {`{label}`}" 통째로)와
                            달랐다 — 배지 안으로 넣어 통일(사용자 스크린샷 지적). */}
                        {hasPriceConfidenceBadge(market.estimatedPrice.confidenceLevel, estimatedPriceHasRecentTrade) ? (
                            <span
                                className={`report-chip report-chip-${
                                    PRICE_DISPLAY_TONE[resolvePriceDisplayLabel(market.estimatedPrice.confidenceLevel, estimatedPriceHasRecentTrade)]
                                }`}
                            >
                                신뢰도 {resolvePriceDisplayLabel(market.estimatedPrice.confidenceLevel, estimatedPriceHasRecentTrade)}
                            </span>
                        ) : (
                            `신뢰도 ${CONFIDENCE_LABEL_SHORT[market.estimatedPrice.confidenceLevel]}`
                        )}
                    </p>
                    {officialPriceRatio != null && (
                        <div>
                            <p className="right-panel-field-note">공시가격 대비 시세 {officialPriceRatio}배(참고용)</p>
                            {/* 2026-08-17 신규 — 배율의 분모(공시가격) 원본값 병기. 새 필드 아님(officialPriceRatio
                                계산에 이미 쓰던 market.officialPrice 그대로). */}
                            {market.officialPrice != null && (
                                <p className="right-panel-field-note report-price-level-caption">공시가격 {formatManwon(market.officialPrice)}</p>
                            )}
                        </div>
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
                기존 행별 보조문구를 카드 단위 배너로 승격 — 2026-08-17 표 안 신뢰도 열 자체가 삭제되며 이
                문구도 표 아래 결과 요약박스 하나로 대체됐다, 아래 TradeTable 참고).
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
            {/* 2026-08-17 삭제(§확정분, planning/rebuild/widgets/2026-08-17_market_04_fix_before_after.html
                Before/After 확인본) — "리모델링 후 예상 시세 근거" 카드(postRemodelEstimatedPrice.comparableTrades)
                전체 삭제. 06 "미래가치 산정 근거"(ComparableTradesCard.tsx)가 같은 데이터를 이미 보여주고 있어
                완전히 중복이었다 — 문서 스펙에는 이미 확정돼 있었는데 코드 반영이 누락됐던 것. 비워진 자리는
                바로 아래 "시세 산정 근거" 카드로 채운다(그리드 밖 풀폭 단독 카드였던 걸 이 자리로 이동). */}
            <div className="report-grid-2">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">현재 추정 시세 근거</h5>
                    <p className="right-panel-card-subtitle">추정 시세 계산에 사용된 비교 거래</p>
                    <TradeTable
                        trades={market.estimatedPrice.comparableTrades}
                        priceLabel="현재"
                        comparableCount={market.estimatedPrice.comparableCount}
                        perSqmPrice={estimatedPricePerSqm}
                        totalValue={market.estimatedPrice.value}
                        area={area}
                        confidenceLevel={market.estimatedPrice.confidenceLevel}
                        hasRecentTrade={estimatedPriceHasRecentTrade}
                    />
                </section>

                {/* "시세 산정 근거" — 04 전체(위 배지 3곳: 시세 심화 카드/비교 거래 표) 공용 각주(2026-08-10, plain
                    텍스트 각주 → 카드로 구체화) — 이 매물의 실제 신뢰도(market.estimatedPrice.confidenceLevel)를
                    MATCH_STAGE_TEXT로 문장화하고, 아래 배지 4개는 데이터에 안 묶인 순수 범례(단계 표). 개별 배지 옆
                    report-tone-badge-light-*는 그대로, 괄호 설명만 여기 한 곳으로 흡수. */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">시세 산정 근거</h5>
                    {/* 2026-08-17 — 첫 줄(이 매물의 실제 기준)을 아래 순수 범례(데이터 무관, 참고용 5단계 설명)와
                        시각적으로 구분되게 진하고 조금 크게(report-basis-headline) — 카드 안에서 "이 매물"에
                        해당하는 문장이 먼저 눈에 들어와야 한다는 지적. */}
                    <p className="report-basis-headline">
                        이 매물은 <strong>{MATCH_STAGE_TEXT[market.estimatedPrice.confidenceLevel]}</strong> 기준으로 산정됐습니다
                    </p>
                    {/* 2026-08-17 재구성 — 배지 행 + 압축 문장 2줄이 같은 정보(단계별 기준)를 중복 설명하고 있어서
                        하나로 합친다: 배지 바로 옆에 그 배지의 정의를 붙여 한 줄씩(docs/CONTENT_TAXONOMY.md §2
                        "E. 범례" — "배지와 글자가 완전히 같아야 함" 원칙 그대로, 배지 텍스트는 CONFIDENCE_LABEL_SHORT와
                        동일 문자열 "매우 낮음"(공백 포함) 유지).
                        2026-08-17 재정정(신뢰도 스티커 통일, planning/rebuild/widgets/2026-08-17_report_full_confidence_context.html·
                        2026-08-17_confidence_unified_legend.html 확정본) — 이 범례가 "리포트 전체의 유일한 5단계
                        범례가 실제로 노출되는 곳"이라 맨 앞에 "실거래"(success 톤) 항목을 추가하고, 배지 모양을
                        999px pill(report-tone-badge-light-*)에서 06과 같은 4px report-chip으로 통일한다.
                        2026-08-17 같은 날 재정정(그리드 배치) — 그리드 밖 풀폭 단독 카드였던 걸 위 "리모델링 후
                        예상 시세 근거" 삭제로 비워진 자리로 이동, report-grid-2 안에서 "현재 추정 시세 근거"와
                        짝을 이룬다.
                        2026-08-17 또 같은 날 재정정 — 배지 5개를 한 문단에 쉼표로 흘려 쓰던 걸(줄바꿈은 브라우저가
                        폭에 맞춰 알아서, 몇 개가 한 줄에 들어갈지 매번 달라짐) 항목마다 줄바꿈하는 구조로 변경 —
                        <p> 하나였던 걸 항목별 <p> 5개로 나누고 market-basis-legend는 그 목록을 감싸는 컨테이너로. */}
                    <div className="market-basis-legend">
                        <p>
                            <span className="report-chip report-chip-success">실거래</span> 해당 건물의 실제 최근 거래
                        </p>
                        <p>
                            <span className="report-chip report-chip-success">높음</span> 같은 법정동 비교(면적±10%·연식±5년)
                        </p>
                        <p>
                            <span className="report-chip report-chip-warning">중간</span> 같은 구 비교(면적±10%·연식±5년)
                        </p>
                        <p>
                            <span className="report-chip report-chip-neutral">낮음</span> 범위 확대(면적±20%·연식±10년)
                        </p>
                        <p>
                            <span className="report-chip report-chip-neutral">매우 낮음</span> 법정동·구 유형 평균(면적·연식 무관)
                        </p>
                    </div>
                </section>
            </div>
        </>
    );
};

export default MarketAnalysisPage;
