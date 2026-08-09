import {
    CONFIDENCE_LABEL_SHORT,
    CONFIDENCE_TONE,
    getLiquidity,
    MATCH_STAGE_LEVEL,
    type ComparableTrade,
    type ConfidenceLevel,
} from "../../search/api/marketApi";
import { formatManwon } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../search/api/analysisApi";
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
        return <p className="right-panel-field-note">정보 없음</p>;
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
                            <p className="report-price-level-value">
                                {recentTradePerSqm != null ? `${recentTradePerSqm.toLocaleString()} 만원/㎡` : "해당 없음"}
                            </p>
                        </div>
                        <div className="report-price-level-item">
                            <p className="report-price-level-label">추정 시세</p>
                            <p className="report-price-level-value">
                                {estimatedPricePerSqm != null ? `${estimatedPricePerSqm.toLocaleString()} 만원/㎡` : "추정 불가"}
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
                    {market.pricePosition == null ? (
                        <p className="right-panel-field-note">정보 없음</p>
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
                            <p className="right-panel-field-note">
                                이 매물(추정시세)은 비교거래 중{" "}
                                <strong>상위 {(100 - market.pricePosition.thisPropertyPercentile).toFixed(0)}%</strong>
                            </p>
                            {/* thisPropertyPercentile===50.0은 이례적인 값이 아니라 recentTrade가 없거나 지분(구분소유
                                일부) 거래로 판정돼 중앙값으로 대체됐다는 신호(§8.16 판정 재사용, 백엔드 확인). */}
                            {market.pricePosition.thisPropertyPercentile === 50 && (
                                <p className="right-panel-field-note">
                                    실거래가 없거나 대표성이 낮아 중앙값 기준으로 계산됐습니다
                                </p>
                            )}
                        </>
                    )}
                </section>

                {/* 2026-08-10 — tradeActivity 배포, FEATURE_10_AI_REPORT.md §2.3 item 5. "시장 유동성"은 백엔드가
                    안 내려주는 프론트 V1 판정(getLiquidity, marketApi.ts) — 최근 1년 건수만 기준, 3/5년은
                    참고용 raw 숫자. 0건도 유효한 값이라 null(모집단 자체 없음)과 명확히 구분해서 처리. */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">거래 활성도</h5>
                    {market.tradeActivity == null ? (
                        <p className="right-panel-field-note">정보 없음</p>
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
                    <p className="right-panel-field-note">정보 없음</p>
                ) : (
                    <PriceTrendChart points={market.priceTrend.points} />
                )}
            </section>

            {/* 5~6. 비교 거래 표 — 구 "유사 사례" 페이지 흡수(2026-08-1x). 2026-08-10: 카드 상단 경고 배너 추가
                (디자인 mockup 참고) — DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE(matchStage 3/4)는 면적을 반영 못 하는
                평균 기반이라 "현재"/"리모델링 후" 두 표가 같은 원본 거래로 나올 수 있다(§2.2, TradeTable의
                기존 행별 보조문구를 카드 단위 배너로 승격 — 표 안 배지는 여전히 report-tone-badge-light-*). */}
            <div className="report-grid-2">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">현재 추정 시세 근거</h5>
                    <p className="right-panel-card-subtitle">추정 시세 계산에 사용된 비교 거래</p>
                    {(market.estimatedPrice.confidenceLevel === "DONG_TYPE_AVERAGE" ||
                        market.estimatedPrice.confidenceLevel === "GU_TYPE_AVERAGE") && (
                        <p className="report-warning-note">이 단계는 면적을 반영하지 않아 두 표가 같은 거래로 나올 수 있습니다</p>
                    )}
                    <TradeTable trades={market.estimatedPrice.comparableTrades} />
                </section>

                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">리모델링 후 예상 시세 근거</h5>
                    <p className="right-panel-card-subtitle">"리모델링 후 예상 시세" 계산에 사용된 비교 거래</p>
                    {market.postRemodelEstimatedPrice == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <>
                            {(market.postRemodelEstimatedPrice.confidenceLevel === "DONG_TYPE_AVERAGE" ||
                                market.postRemodelEstimatedPrice.confidenceLevel === "GU_TYPE_AVERAGE") && (
                                <p className="report-warning-note">이 단계는 면적을 반영하지 않아 두 표가 같은 거래로 나올 수 있습니다</p>
                            )}
                            <TradeTable trades={market.postRemodelEstimatedPrice.comparableTrades} />
                        </>
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
                <p className="right-panel-field-note" style={{ marginTop: 4 }}>
                    단계별 기준: 법정동/구 비교 = 면적±10%·연식±5년 · 범위 확대 = 면적±20%·연식±10년 · 유형 평균 = 면적·연식 무관
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <span className="report-tone-badge report-tone-badge-light-success">높음</span>
                    <span className="report-tone-badge report-tone-badge-light-warning">중간</span>
                    <span className="report-tone-badge report-tone-badge-light-neutral">낮음</span>
                    <span className="report-tone-badge report-tone-badge-light-neutral">매우낮음</span>
                </div>
            </section>
        </>
    );
};

export default MarketAnalysisPage;
