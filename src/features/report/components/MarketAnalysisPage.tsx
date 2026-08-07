import { useEffect, useState } from "react";
import { CONFIDENCE_LABEL, CONFIDENCE_TONE, MATCH_STAGE_LEVEL, type ComparableTrade } from "../../search/api/marketApi";
import { ESTIMATED_AREA_TYPES, formatEok } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../search/api/analysisApi";
import { getBuildingSummary, type BuildingSummary } from "../../search/api/buildingSummaryApi";
import PriceTrendChart from "./PriceTrendChart";

interface MarketAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    buildingId: string;
    propertyType: string | null;
    area: number | null; // 건물 자체 면적(F-04 §2.1-e 기준) — 추정 시세 ㎡당가격 분모
}

const formatContractMonth = (dateStr: string): string => {
    const [year, month] = dateStr.split("-");
    return year && month ? `${year}년 ${Number(month)}월` : dateStr;
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
                                <td>{formatEok(trade.price)}</td>
                                <td>{formatContractMonth(trade.contractDate)}</td>
                                <td>
                                    <span className={`report-tone-badge report-tone-badge-${CONFIDENCE_TONE[level] ?? "neutral"}`}>
                                        {CONFIDENCE_LABEL[level]}
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

// FEATURE_10_AI_REPORT.md §2.4: analysis.market(F-08) 파생값 + F-17 단지정보(예외적으로 별도 호출) + 시세 추이
// 그래프(priceTrend) + 비교 거래 표 2개(구 "유사 사례" 페이지 흡수, 2026-08-1x 카테고리 재편).
const MarketAnalysisPage = ({ analysis, loading, buildingId, propertyType, area }: MarketAnalysisPageProps) => {
    const [summary, setSummary] = useState<BuildingSummary | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setSummaryLoading(true);
        getBuildingSummary(buildingId)
            .then((result) => {
                if (!cancelled) setSummary(result);
            })
            .finally(() => {
                if (!cancelled) setSummaryLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [buildingId]);

    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { market } = analysis;
    const isCondoType = propertyType != null && ESTIMATED_AREA_TYPES.includes(propertyType);

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

    return (
        <>
            <div className="report-grid-2">
                {/* 1. 시세 심화 */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">시세 심화</h5>
                    <dl className="right-panel-fact-list report-fact-grid">
                        <div>
                            <dt>㎡당가격(최근실거래가 기준)</dt>
                            <dd>{recentTradePerSqm != null ? `${recentTradePerSqm.toLocaleString()}만원/㎡` : "해당 없음"}</dd>
                        </div>
                        <div>
                            <dt>㎡당가격(추정시세 기준)</dt>
                            <dd>{estimatedPricePerSqm != null ? `${estimatedPricePerSqm.toLocaleString()}만원/㎡` : "추정 불가"}</dd>
                        </div>
                        <div>
                            <dt>공시가격 대비 배율</dt>
                            <dd>{officialPriceRatio != null ? `시세 대비 ${officialPriceRatio}배(참고용)` : "정보 없음"}</dd>
                        </div>
                    </dl>
                    <hr className="right-panel-card-divider" />
                    <span
                        className={`report-tone-badge ${
                            market.estimatedPrice.confidenceLevel === "UNAVAILABLE"
                                ? ""
                                : `report-tone-badge-${CONFIDENCE_TONE[market.estimatedPrice.confidenceLevel]}`
                        }`}
                    >
                        {CONFIDENCE_LABEL[market.estimatedPrice.confidenceLevel]}
                    </span>
                    <p className="right-panel-market-cell-aux">비교 거래 {market.estimatedPrice.comparableCount}건</p>
                </section>

                {/* 2. 단지 정보 — F-17 별도 호출, 공동주택(아파트·연립다세대) 외 유형은 "해당 없음" */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">단지 정보</h5>
                    {!isCondoType ? (
                        <p className="right-panel-field-note">해당 없음(공동주택 매물만 제공)</p>
                    ) : summaryLoading ? (
                        <p className="right-panel-field-note">조회 중...</p>
                    ) : (
                        <dl className="right-panel-fact-list report-fact-grid">
                            <div>
                                <dt>전체 세대수</dt>
                                <dd>{summary?.householdCount != null ? `${summary.householdCount.toLocaleString()}세대` : "정보 없음"}</dd>
                            </div>
                            <div>
                                <dt>동수</dt>
                                <dd>{summary?.mainBuildingCount != null ? `${summary.mainBuildingCount}동` : "정보 없음"}</dd>
                            </div>
                            <div>
                                <dt>승강기수</dt>
                                <dd>
                                    {summary?.elevatorPassengerCount != null || summary?.elevatorEmergencyCount != null
                                        ? `승용 ${summary?.elevatorPassengerCount ?? 0}대 · 비상용 ${summary?.elevatorEmergencyCount ?? 0}대`
                                        : "정보 없음"}
                                </dd>
                            </div>
                        </dl>
                    )}
                </section>
            </div>

            {/* 3. 시세 추이 — priceTrend(2026-08-1x 신규 필드) */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">시세 추이</h5>
                {market.priceTrend == null || market.priceTrend.points.length === 0 ? (
                    <p className="right-panel-field-note">정보 없음</p>
                ) : (
                    <PriceTrendChart points={market.priceTrend.points} />
                )}
            </section>

            {/* 4~5. 비교 거래 표 — 구 "유사 사례" 페이지 흡수(2026-08-1x) */}
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
        </>
    );
};

export default MarketAnalysisPage;
