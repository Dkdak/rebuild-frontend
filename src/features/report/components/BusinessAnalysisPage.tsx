import { formatManwon } from "../../search/api/searchApi";
import { CONFIDENCE_LABEL_SHORT, CONFIDENCE_TONE } from "../../market/api/marketApi";
import { buildProfitAnalysis, type PropertyAnalysis } from "../../investment/api/analysisApi";
import CashFlowFormula from "../../cost/components/CashFlowFormula";
import SensitivityMatrix from "../../investment/components/SensitivityMatrix";

interface BusinessAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    householdCount: number | null;
    propertyType: string | null;
    totalBuildingArea: number | null;
}

// FEATURE_10_AI_REPORT.md §2.5(2026-08-1x 재편, 구 "수익 분석"): analysis.market.postRemodelEstimatedPrice(F-08 §3.7)만
// 사용 — 재무 숫자만 다룬다. 공사비 카드는 "05 리모델링 분석"으로 이동, 여기선 이미 계산된 cost.min/maxCost만 참조.
// 2026-08-1x: 세로 스택 4카드 → report-grid-3 가로 3열(좌 사업성 요약/중 현금흐름/우 민감도분석)로 재구성.
const BusinessAnalysisPage = ({ analysis, loading, householdCount, propertyType, totalBuildingArea }: BusinessAnalysisPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { cost, market } = analysis;
    const postRemodel = market.postRemodelEstimatedPrice;

    // §3.7 "사업성 요약"·현금흐름·민감도분석이 공유하는 계산(analysisApi.ts의 buildProfitAnalysis, 재계산 안 함).
    const profitAnalysis = buildProfitAnalysis(analysis, householdCount, propertyType, totalBuildingArea);

    // "예상 리모델링 비용(적정)" — 기준 공사비는 API에 없어 연면적×기준단가×agingFactorDefault로 직접 계산
    // (F-07 §3.2 산식 그대로). 사업성 요약 표 2행과 민감도분석 "기준" 열이 같은 값을 공유(재계산 안 함).
    const remodelCostBase =
        cost.status === "AVAILABLE" && cost.basis != null
            ? Math.round((cost.basis.grossFloorArea * cost.basis.baseUnitPricePerSqm * cost.basis.agingFactorDefault) / 10_000)
            : null;

    // 민감도분석 — 공사비축(최소/기준/최대) × 매도가축(보수적/기준/낙관적). "매도가" 시나리오는 postRemodel(미래/exit
    // price) 기준이라야 한다 — market.estimatedPrice의 conservativeValue/optimisticValue는 "현재가" 시나리오라
    // 다른 개념(비세대기반 유형은 실제로 값이 다름, §2.6 정정).
    const sensitivity =
        profitAnalysis != null &&
        cost.status === "AVAILABLE" &&
        cost.minCost != null &&
        cost.maxCost != null &&
        remodelCostBase != null &&
        postRemodel?.conservativeValue != null &&
        postRemodel.optimisticValue != null
            ? {
                  buyPrice: profitAnalysis.baseValue,
                  costs: [Math.round(cost.minCost / 10_000), remodelCostBase, Math.round(cost.maxCost / 10_000)] as [
                      number,
                      number,
                      number,
                  ],
                  sellPrices: [postRemodel.conservativeValue, profitAnalysis.value, postRemodel.optimisticValue] as [
                      number,
                      number,
                      number,
                  ],
              }
            : null;

    return (
        <div className="report-grid-3">
            {/* 1. 사업성 요약 — 구 "리모델링 후 예상 시세"(Exit Price)/"수익분석" 카드 병합, 6행 표(§2.5) */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">사업성 요약</h5>
                {profitAnalysis == null ? (
                    <p className="right-panel-field-note">산출 불가</p>
                ) : (
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>현재가치(매입 예상가)</dt>
                            <dd>{formatManwon(profitAnalysis.baseValue)}</dd>
                        </div>
                        <div>
                            <dt>예상 리모델링 비용</dt>
                            <dd>{remodelCostBase != null ? formatManwon(remodelCostBase) : "산출 불가"}</dd>
                        </div>
                        <div>
                            <dt>총 투자금</dt>
                            <dd>
                                {formatManwon(profitAnalysis.investMin)} ~ {formatManwon(profitAnalysis.investMax)}
                            </dd>
                        </div>
                        <div>
                            <dt>미래가치</dt>
                            <dd>
                                {formatManwon(profitAnalysis.value)}
                                {postRemodel?.confidenceLevel != null && postRemodel.confidenceLevel !== "UNAVAILABLE" && (
                                    <span
                                        className={`report-tone-badge report-tone-badge-${CONFIDENCE_TONE[postRemodel.confidenceLevel]}`}
                                        style={{ marginLeft: 6 }}
                                    >
                                        {/* 전 구간 공통(2026-08-10) — 자리 여부와 무관하게 짧은 라벨만 사용, 범례는 "시장 분석" 섹션에 한 번만 */}
                                        {CONFIDENCE_LABEL_SHORT[postRemodel.confidenceLevel]}
                                    </span>
                                )}
                                <span className="right-panel-market-cell-aux"> 비교 거래 {postRemodel?.comparableCount ?? 0}건</span>
                            </dd>
                        </div>
                        <div>
                            <dt>예상 차익</dt>
                            <dd>
                                {formatManwon(profitAnalysis.gainMin)} ~ {formatManwon(profitAnalysis.gainMax)}
                            </dd>
                        </div>
                        <div>
                            <dt>예상 수익률(ROI)</dt>
                            <dd>
                                {profitAnalysis.roiMin.toFixed(1)}% ~ {profitAnalysis.roiMax.toFixed(1)}%
                            </dd>
                        </div>
                    </dl>
                )}
            </section>

            {/* 2. 현금흐름 — 매입가+공사비=총투자금, 매도가-총투자금=예상차익 산식 그대로(같은 profitAnalysis 재사용).
                막대 비교(구 CashFlowWaterfall)는 매도가가 다른 항목을 압도해 해석이 안 됐다(사용자 피드백
                2026-08-1x) — 산식 흐름으로 교체. */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">현금흐름</h5>
                {profitAnalysis == null ? (
                    <p className="right-panel-field-note">산출 불가</p>
                ) : (
                    <CashFlowFormula
                        buyPrice={profitAnalysis.baseValue}
                        costMin={Math.round((cost.minCost ?? 0) / 10_000)}
                        costMax={Math.round((cost.maxCost ?? 0) / 10_000)}
                        sellPrice={profitAnalysis.value}
                        gainMin={profitAnalysis.gainMin}
                        gainMax={profitAnalysis.gainMax}
                    />
                )}
            </section>

            {/* 3. 민감도 분석 — 공사비×매도가 3×3, 새 API 없이 프론트에서 재계산(§2.5) */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">민감도 분석</h5>
                {sensitivity == null ? (
                    <p className="right-panel-field-note">산출 불가</p>
                ) : (
                    <SensitivityMatrix buyPrice={sensitivity.buyPrice} costs={sensitivity.costs} sellPrices={sensitivity.sellPrices} />
                )}
            </section>
        </div>
    );
};

export default BusinessAnalysisPage;
