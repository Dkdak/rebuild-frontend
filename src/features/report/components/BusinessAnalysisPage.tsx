import { formatManwon } from "../../search/api/searchApi";
import { CONFIDENCE_LABEL_SHORT } from "../../market/api/marketApi";
import { buildProfitAnalysis, displayGainRange, GAIN_LABEL, gainSign, type PropertyAnalysis } from "../../investment/api/analysisApi";
import CashFlowFormula from "../../cost/components/CashFlowFormula";
import SensitivityMatrix from "../../investment/components/SensitivityMatrix";
import BreakEvenTable from "../../investment/components/BreakEvenTable";
import ComparableTradesCard from "../../investment/components/ComparableTradesCard";

interface BusinessAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    householdCount: number | null;
    propertyType: string | null;
    totalBuildingArea: number | null;
}

// FEATURE_10_AI_REPORT.md §2.5(2026-08-10 전면 재정리, 5카드 구조 확정): analysis.market.postRemodelEstimatedPrice(F-08 §3.7)만
// 사용 — 재무 숫자만 다룬다. 공사비 카드는 "05 리모델링 분석"으로 이동, 여기선 이미 계산된 cost.min/maxCost만 참조.
// 5카드, 3+2행(report-grid-3-even/report-grid-2-even, ReportPage.css) — 윗줄: 사업성 요약/현금흐름/손익분기 및
// 목표 수익률. 아랫줄: 비교 거래(신규)/민감도 분석(ROI 변화). 설명 각주 공통 규칙: 행 라벨 옆엔 아이콘만(숫자
// 매김 없음), 설명 전체는 카드 맨 아래 "·" 목록(report-result-notes, 2026-08-17 재구성 — 구 report-card-
// footnotes 파란 박스 폐기)으로 순서 대응해 모아서 나열.
const BusinessAnalysisPage = ({ analysis, loading, householdCount, propertyType, totalBuildingArea }: BusinessAnalysisPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { cost, market, remodeling } = analysis;
    const postRemodel = market.postRemodelEstimatedPrice;

    // §3.7 "사업성 요약"·현금흐름·민감도분석이 공유하는 계산(analysisApi.ts의 buildProfitAnalysis, 재계산 안 함).
    const profitAnalysis = buildProfitAnalysis(analysis, householdCount, propertyType, totalBuildingArea);
    // 2026-08-17 — 라벨-부호 어긋남 정정(docs/CONTENT_TAXONOMY.md 금지규칙 2). CashFlowFormula.tsx와 같은
    // gainSign() 재사용 — 같은 profitAnalysis.gainMin/Max를 두 컴포넌트가 각자 판정하면 라벨이 어긋날 수 있음.
    const gainDisplaySign = profitAnalysis ? gainSign(profitAnalysis.gainMin, profitAnalysis.gainMax) : "positive";
    const [gainLo, gainHi] = profitAnalysis
        ? displayGainRange(profitAnalysis.gainMin, profitAnalysis.gainMax, gainDisplaySign)
        : [0, 0];

    // "예상 리모델링 비용(적정)" — 기준 공사비는 API에 없어 연면적×기준단가×agingFactorDefault로 직접 계산
    // (F-07 §3.2 산식 그대로). 사업성 요약 표 2행과 민감도분석 "기준" 열이 같은 값을 공유(재계산 안 함).
    const remodelCostBase =
        cost.status === "AVAILABLE" && cost.basis != null
            ? Math.round((cost.basis.grossFloorArea * cost.basis.baseUnitPricePerSqm * cost.basis.agingFactorDefault) / 10_000)
            : null;

    // 2026-08-10 — "미래가치" 각주용 산출근거 역산: 미래가치(postRemodel.value) = 추정시세(㎡당) × 대상면적
    // (연면적+증축가능면적)이라는 관계를 알려주신 예시 그대로, 총액을 대상면적으로 나눠 단가를 역산한다(새로
    // 계산하는 게 아니라 이미 있는 총액을 쪼개 보여주는 것 — 단가×면적을 다시 곱하면 항상 총액과 일치).
    const futureValueTargetArea =
        cost.status === "AVAILABLE" && cost.basis != null && remodeling.basis.additionalBuildableAreaSqm != null
            ? cost.basis.grossFloorArea + remodeling.basis.additionalBuildableAreaSqm
            : null;
    const futureValueUnitPrice =
        profitAnalysis != null && futureValueTargetArea != null && futureValueTargetArea > 0
            ? Math.round(profitAnalysis.value / futureValueTargetArea)
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
                  acquisitionCost: profitAnalysis.acquisitionCost,
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
        <>
            {/* 윗줄(3등분) — 사업성 요약 / 현금흐름 / 손익분기 및 목표 수익률 */}
            <div className="report-grid-3-even">
                {/* 1. 사업성 요약 — 구 "리모델링 후 예상 시세"(Exit Price)/"수익분석" 카드 병합, 7행 표(§2.5).
                    report-profit-summary-card: 옆 카드가 더 길어 이 카드가 grid stretch로 늘어나면, 각주 목록이
                    표 바로 밑에 붙고 카드 하단엔 빈 공간이 남는다 — 카드를 세로 flex로 만들고 dl을 flex:1로
                    늘려서 각주 목록을 margin-top:auto로 카드 맨 밑까지 붙인다. */}
                <section className="right-panel-card report-profit-summary-card">
                    <h5 className="right-panel-card-title">사업성 요약</h5>
                    {profitAnalysis == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <>
                            <dl className="right-panel-fact-list">
                                <div>
                                    <dt>현재가치(매입 예상가)</dt>
                                    <dd>{formatManwon(profitAnalysis.baseValue)}</dd>
                                </div>
                                <div>
                                    <dt>예상 리모델링 비용</dt>
                                    <dd>{remodelCostBase != null ? formatManwon(remodelCostBase) : "산출 불가"}</dd>
                                </div>
                                {/* 2026-08-10 — 총 투자금 = 매입가+공사비+부대비용 공식 반영(analysisApi.ts
                                    buildProfitAnalysis, calcAcquisitionCost). 각주 공통 규칙 — 라벨 옆 아이콘만,
                                    설명은 카드 맨 아래 목록 1번째. */}
                                <div>
                                    <dt>
                                        부대비용 <span className="report-row-label-icon" aria-hidden="true">ⓘ</span>
                                    </dt>
                                    <dd>{formatManwon(profitAnalysis.acquisitionCost)}</dd>
                                </div>
                                <div>
                                    <dt>총 투자금</dt>
                                    <dd>
                                        {formatManwon(profitAnalysis.investMin)} ~ {formatManwon(profitAnalysis.investMax)}
                                    </dd>
                                </div>
                                {/* 각주 목록 2번째 — 산출근거(추정시세×대상면적, 비교거래건수, 신뢰도). */}
                                <div>
                                    <dt>
                                        미래가치 <span className="report-row-label-icon" aria-hidden="true">ⓘ</span>
                                    </dt>
                                    <dd>{formatManwon(profitAnalysis.value)}</dd>
                                </div>
                                <div>
                                    <dt>{GAIN_LABEL[gainDisplaySign]}</dt>
                                    <dd>
                                        {formatManwon(gainLo)} ~ {formatManwon(gainHi)}
                                    </dd>
                                </div>
                                {/* 각주 목록 3번째 — 반영/미반영 비용 구분. */}
                                <div>
                                    <dt>
                                        예상 수익률(ROI) <span className="report-row-label-icon" aria-hidden="true">ⓘ</span>
                                    </dt>
                                    <dd>
                                        {profitAnalysis.roiMin.toFixed(1)}% ~ {profitAnalysis.roiMax.toFixed(1)}%
                                        {/* 2026-08-17 추가 — ROI 범위가 전부 음수(투자원금도 못 건짐)일 때만 3단계
                                            인라인 보조 문구. "약 -1%"만 있으면 거의 0에 가까운 것처럼 읽히지만
                                            실제로는 큰 손실일 수 있다(docs/CONTENT_TAXONOMY.md §2 "A. 값 보조"). */}
                                        {profitAnalysis.roiMax < 0 && (
                                            <span className="report-row-aux"> 투자금 대비 손실</span>
                                        )}
                                    </dd>
                                </div>
                            </dl>
                            {/* 2026-08-17 재구성(§확정분) — 파란 배경 박스(right-panel-info-note) 제거, 01/05가
                                쓰는 "·" 플레인 텍스트 목록(report-result-notes)으로 통일. 항목명을 주어로 앞에
                                명시해 "항목명 — 내용" 형식으로 압축 — 삭제된 내용(법인·다주택자 예외, 산출식
                                구성 요소, 취득·공사·부대비용 반영 문구)은 각각 주어에 이미 함의되거나 바로
                                위/다른 섹션에 이미 보이는 값이라 중복이었다. */}
                            <ul className="report-result-notes">
                                <li>부대비용 — 개인 1주택자·표준세율 기준</li>
                                <li>
                                    미래가치 —{" "}
                                    {futureValueUnitPrice != null ? (
                                        <>
                                            추정시세 {futureValueUnitPrice.toLocaleString()}만원/㎡
                                            {postRemodel?.confidenceLevel != null &&
                                                postRemodel.confidenceLevel !== "UNAVAILABLE" &&
                                                `, 신뢰도 ${CONFIDENCE_LABEL_SHORT[postRemodel.confidenceLevel]}`}
                                        </>
                                    ) : (
                                        "산출근거 정보 없음"
                                    )}
                                </li>
                                <li>ROI — 양도소득세·대출이자는 반영되지 않음</li>
                            </ul>
                        </>
                    )}
                </section>

                {/* 2. 현금흐름 — 매입가+공사비=총투자금, 매도가-총투자금=예상차익 산식 그대로(같은 profitAnalysis 재사용). */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">현금흐름</h5>
                    {profitAnalysis == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <CashFlowFormula
                            buyPrice={profitAnalysis.baseValue}
                            acquisitionCost={profitAnalysis.acquisitionCost}
                            costMin={Math.round((cost.minCost ?? 0) / 10_000)}
                            costMax={Math.round((cost.maxCost ?? 0) / 10_000)}
                            investMin={profitAnalysis.investMin}
                            investMax={profitAnalysis.investMax}
                            sellPrice={profitAnalysis.value}
                            gainMin={profitAnalysis.gainMin}
                            gainMax={profitAnalysis.gainMax}
                        />
                    )}
                </section>

                {/* 3. 손익분기 및 목표 수익률 — 손익분기 매도가=총 투자금(같은 profitAnalysis 재사용, 새 계산
                    아님), 목표 ROI별 필요 매도가만 BreakEvenTable.tsx에서 계산. */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">손익분기 및 목표 수익률</h5>
                    {profitAnalysis == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <BreakEvenTable investMin={profitAnalysis.investMin} investMax={profitAnalysis.investMax} />
                    )}
                </section>
            </div>

            {/* 아랫줄(2등분) — 비교 거래(신규) / 민감도 분석(ROI 변화) */}
            <div className="report-grid-2-even">
                {/* 4. 비교 거래 — 신규 카드. postRemodelEstimatedPrice.comparableTrades 재사용(새 API 불필요). */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">비교 거래</h5>
                    {postRemodel == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <ComparableTradesCard
                            comparableTrades={postRemodel.comparableTrades}
                            comparableCount={postRemodel.comparableCount}
                        />
                    )}
                </section>

                {/* 5. 민감도 분석(ROI 변화) — 공사비×매도가 3×3, 새 API 없이 프론트에서 재계산(§2.5) */}
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">민감도 분석(ROI 변화)</h5>
                    {sensitivity == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <SensitivityMatrix
                            buyPrice={sensitivity.buyPrice}
                            acquisitionCost={sensitivity.acquisitionCost}
                            costs={sensitivity.costs}
                            sellPrices={sensitivity.sellPrices}
                        />
                    )}
                </section>
            </div>
        </>
    );
};

export default BusinessAnalysisPage;
