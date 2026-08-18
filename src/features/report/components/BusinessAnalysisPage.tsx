import { CONFIDENCE_LABEL_SHORT, CONFIDENCE_PILL_TONE, PRICE_DISPLAY_TONE, resolvePriceDisplayLabel } from "../../market/api/marketApi";
import { formatManwon } from "../../search/api/searchApi";
import { buildProfitAnalysis, displayGainRange, GAIN_LABEL, gainSign, type PropertyAnalysis } from "../../investment/api/analysisApi";
import CashFlowFormula from "../../cost/components/CashFlowFormula";
import SensitivityMatrix from "../../investment/components/SensitivityMatrix";
import BreakEvenTable from "../../investment/components/BreakEvenTable";
import ComparableTradesCard from "../../investment/components/ComparableTradesCard";
import CardSubHeading from "../../../shared/components/CardSubHeading";

interface BusinessAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    householdCount: number | null;
    propertyType: string | null;
    totalBuildingArea: number | null;
}

// FEATURE_10_AI_REPORT.md §2.5, 2026-08-17 구조 전면 개편 — planning/rebuild/widgets/
// 2026-08-17_business_analysis_confirmed_final.html 확정본을 그대로 구현(좌표·색상·문구 전부 그 파일이
// 단일 출처, 임의 판단 아님). 구 5카드(사업성요약/현금흐름/손익분기 + 비교거래/민감도, 3+2행)를 폐기하고
// 아래 순서로 교체:
//   1. 경고 배너(풀폭) — warning 톤(주황), accent(파랑) 아님.
//   2. 투자 결과 한눈에 보기(신규, 풀폭 밴드) — 구 "사업성 요약" 표를 대체. 5칸 각각 테두리 박스, 예상차익/
//      예상ROI 2칸만 success 톤 배경(밴드 자체가 아니라 값 색까지 success). 매입가·미래가치 칸엔 라벨→값→
//      신뢰도 칩(4px 라운드 배지, 01의 999px 완전 pill과는 다른 형태) 3단만 — "시세 추정"/"미래 시세 추정"
//      서브캡션은 2026-08-17 삭제(§확정분, 라벨·서브캡션·배지 셋이 "추정값"이라는 같은 말을 세 번 반복).
//   3~6. 2×2 그리드(report-grid-2-even 두 줄) — 투자금 흐름(SVG 워터폴)/손익분기 및 목표 수익률(강조 박스+
//      표+현재 미래가치 강조줄)/미래가치 산정 근거(3열 표+강조 배지)/민감도 분석(3×3, 열 3색+중앙 강조).
//   7. 계산 조건 및 제외 항목(신규, 풀폭 3열) — 확정본 문구 그대로.
// 06 전체 공통 신뢰도 표기 규칙: confidenceLevel 원본 라벨(CONFIDENCE_LABEL_SHORT — 높음/중간/낮음/매우낮음)
// 만 사용, A/B/C/D 등급 금지 — 2026-08-17(신뢰도 체계 정리 §확정분)에 01/F-04/F-05까지 전부 이 라벨 체계로
// 통일되며 A/B/C/D(구 analysisApi.ts PriceConfidenceGrade) 자체가 전면 폐지됐다(더 이상 "01만 예외"가 아님).
// 신뢰도 칩 톤은 CONFIDENCE_PILL_TONE(marketApi.ts, 04가 쓰는 CONFIDENCE_TONE과는 별도 매핑이지만 2026-08-17
// 재정정 이후 값 자체는 같음 — 높음=success/중간=warning/낮음·매우낮음=neutral).
const BusinessAnalysisPage = ({ analysis, loading, householdCount, propertyType, totalBuildingArea }: BusinessAnalysisPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { cost, market, remodeling } = analysis;
    const postRemodel = market.postRemodelEstimatedPrice;

    // §3.7 "투자 결과 한눈에 보기"·투자금 흐름·민감도분석이 공유하는 계산(analysisApi.ts의 buildProfitAnalysis, 재계산 안 함).
    const profitAnalysis = buildProfitAnalysis(analysis, householdCount, propertyType, totalBuildingArea);

    // 2026-08-17 — "예상 차익" 칸 라벨-부호 어긋남 정정(§확정분: 값>0 "예상 차익"/<0 "예상 손실"(절댓값만)/
    // 0을 걸치면 "예상 손익"). ReportPage.tsx(01)가 이미 쓰는 gainSign/GAIN_LABEL/displayGainRange 그대로
    // 재사용(analysisApi.ts, 새 판정 로직 아님) — 지금까지 이 밴드만 "예상 차익" 고정 라벨이었다.
    const gainDisplaySign = profitAnalysis ? gainSign(profitAnalysis.gainMin, profitAnalysis.gainMax) : "positive";
    const [gainLo, gainHi] = profitAnalysis ? displayGainRange(profitAnalysis.gainMin, profitAnalysis.gainMax, gainDisplaySign) : [0, 0];

    // "예상 리모델링 비용(적정)" — 기준 공사비는 API에 없어 연면적×기준단가×agingFactorDefault로 직접 계산
    // (F-07 §3.2 산식 그대로). "투자금 흐름" 막대(대표 공사비)와 민감도분석 "기준" 열이 같은 값을 공유(재계산 안 함).
    const remodelCostBase =
        cost.status === "AVAILABLE" && cost.basis != null
            ? Math.round((cost.basis.grossFloorArea * cost.basis.baseUnitPricePerSqm * cost.basis.agingFactorDefault) / 10_000)
            : null;

    // 2026-08-10 — "미래가치" 캡션용 산출근거 역산: 미래가치(postRemodel.value) = 추정시세(㎡당) × 대상면적
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

    // 현재가(estimatedPrice) 신뢰도 — "투자 결과 한눈에 보기" 밴드의 "예상 매입가" 칸 캡션용. postRemodel
    // 신뢰도(미래가치 칸)와는 다른 값이라 따로 조회(ReportPage.tsx currentPriceLabel과 같은 근거, 재계산 아님).
    // 2026-08-17(신뢰도 스티커 통일) — recentTrade 있으면 "실거래"가 최우선(01/F-04/F-05와 같은 규칙, "예상
    // 매입가"도 결국 같은 estimatedPrice.confidenceLevel 개념). futureValueLevel(미래가치, postRemodel 기준)은
    // recentTrade 개념이 없어 그대로 CONFIDENCE_PILL_TONE/CONFIDENCE_LABEL_SHORT 유지 — 영향 없는 곳까지 바꾸지
    // 않는다.
    const currentPriceHasRecentTrade = market.recentTrade?.price != null;
    const currentPriceLabel =
        market.estimatedPrice.confidenceLevel !== "UNAVAILABLE" || currentPriceHasRecentTrade
            ? resolvePriceDisplayLabel(market.estimatedPrice.confidenceLevel, currentPriceHasRecentTrade)
            : null;
    const futureValueLevel =
        postRemodel?.confidenceLevel != null && postRemodel.confidenceLevel !== "UNAVAILABLE" ? postRemodel.confidenceLevel : null;

    return (
        <>
            {/* 1. 경고 배너(풀폭) — warning 톤(확정본: bg-warning/text-warning, accent 아님). */}
            <p className="report-business-warning">
                <span aria-hidden="true">⚠</span> 추정값 포함 · 실제 사업비 및 시장가격, 인허가, 세금, 금융비용에 따라 변동될 수
                있습니다.
            </p>

            {/* 2. 투자 결과 한눈에 보기(신규, 풀폭 밴드) — 구 "사업성 요약" 표 폐기, 이 밴드가 대체. */}
            {profitAnalysis == null ? (
                <p className="right-panel-field-note">산출 불가</p>
            ) : (
                <section className="right-panel-card">
                    <CardSubHeading number={1} title="투자 결과 한눈에 보기" />
                    <div className="report-investment-band">
                        <div className="report-investment-band-cell">
                            <p className="report-stat-label">예상 매입가</p>
                            <p className="report-stat-value">{formatManwon(profitAnalysis.baseValue)}</p>
                            {/* 2026-08-17 삭제(§확정분) — "시세 추정" 서브캡션 제거. 라벨("예상 매입가")+서브캡션
                                ("시세 추정")+배지("신뢰도 ...") 3개가 전부 "이건 추정값"이라는 같은 말을 세 번
                                반복하고 있었다는 지적 — 라벨→값→배지 3단으로 정리(배지 자체가 이미 신뢰도까지
                                말해줘서 "추정"이라는 사실은 그걸로 충분히 전달됨). */}
                            {currentPriceLabel != null && (
                                <span className={`report-chip report-chip-${PRICE_DISPLAY_TONE[currentPriceLabel]}`}>신뢰도 {currentPriceLabel}</span>
                            )}
                        </div>
                        <span className="report-investment-band-arrow" aria-hidden="true">
                            →
                        </span>
                        <div className="report-investment-band-cell">
                            <p className="report-stat-label">총 투자금</p>
                            <p className="report-stat-value">
                                {formatManwon(profitAnalysis.investMin)} ~ {formatManwon(profitAnalysis.investMax)}
                            </p>
                            <p className="report-investment-band-note">부대비용 + 공사비 포함</p>
                        </div>
                        <span className="report-investment-band-arrow" aria-hidden="true">
                            →
                        </span>
                        <div className="report-investment-band-cell">
                            <p className="report-stat-label">예상 미래가치</p>
                            <p className="report-stat-value">{formatManwon(profitAnalysis.value)}</p>
                            {/* 2026-08-17 삭제(§확정분) — "미래 시세 추정" 서브캡션 제거, 위 "예상 매입가" 칸과 같은 이유. */}
                            {futureValueLevel != null && (
                                <span className={`report-chip report-chip-${CONFIDENCE_PILL_TONE[futureValueLevel]}`}>
                                    신뢰도 {CONFIDENCE_LABEL_SHORT[futureValueLevel]}
                                </span>
                            )}
                        </div>
                        <span className="report-investment-band-arrow" aria-hidden="true">
                            →
                        </span>
                        <div className="report-investment-band-cell report-investment-band-cell-emphasis">
                            <p className="report-stat-label">{GAIN_LABEL[gainDisplaySign]}</p>
                            <p className="report-investment-band-value-success">
                                {formatManwon(gainLo)} ~ {formatManwon(gainHi)}
                            </p>
                        </div>
                        <span className="report-investment-band-arrow" aria-hidden="true">
                            →
                        </span>
                        <div className="report-investment-band-cell report-investment-band-cell-emphasis">
                            <p className="report-stat-label">예상 ROI</p>
                            <p className="report-investment-band-value-success">
                                {profitAnalysis.roiMin.toFixed(1)}% ~ {profitAnalysis.roiMax.toFixed(1)}%
                                {/* 2026-08-17 신규 — ROI 범위 전체가 음수(gainDisplaySign==="negative", 위 예상
                                    손실과 같은 판정 재사용)면 01 "요약 정보" ROI 칸과 같은 부기 문구. */}
                                {gainDisplaySign === "negative" && <span className="report-row-aux"> 투자금 대비 손실</span>}
                            </p>
                        </div>
                    </div>
                    <p className="right-panel-field-note report-basis-caption">
                        ROI는 총 투자금 대비 예상 차익 기준입니다. 양도소득세·금융비용·대출이자는 반영되지 않았습니다.
                    </p>
                </section>
            )}

            {/* 3~4. 2단(위) — 투자금 흐름 / 손익분기 및 목표 수익률 */}
            <div className="report-grid-2-even">
                {/* 3. 투자금 흐름(← 현금흐름) — SVG 워터폴(CashFlowFormula.tsx). */}
                <section className="right-panel-card">
                    <CardSubHeading number={2} title="투자금 흐름" />
                    {profitAnalysis == null || remodelCostBase == null || cost.minCost == null || cost.maxCost == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <CashFlowFormula
                            buyPrice={profitAnalysis.baseValue}
                            acquisitionCost={profitAnalysis.acquisitionCost}
                            cost={remodelCostBase}
                            costMin={Math.round(cost.minCost / 10_000)}
                            costMax={Math.round(cost.maxCost / 10_000)}
                            investMin={profitAnalysis.investMin}
                            investMax={profitAnalysis.investMax}
                            futureValue={profitAnalysis.value}
                            gainMin={profitAnalysis.gainMin}
                            gainMax={profitAnalysis.gainMax}
                        />
                    )}
                </section>

                {/* 4. 손익분기 및 목표 수익률 — 기존 표 유지 + "현재 추정 미래가치" 강조줄(BreakEvenTable.tsx). */}
                <section className="right-panel-card">
                    <CardSubHeading number={3} title="손익분기 및 목표 수익률" />
                    {profitAnalysis == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <BreakEvenTable
                            investMin={profitAnalysis.investMin}
                            investMax={profitAnalysis.investMax}
                            futureValue={profitAnalysis.value}
                        />
                    )}
                </section>
            </div>

            {/* 5~6. 2단(아래) — 미래가치 산정 근거(구 비교 거래) / 민감도 분석(ROI 변화) */}
            <div className="report-grid-2-even">
                {/* 5. 미래가치 산정 근거(← 비교 거래) — 5건 표(법정동/거래가/면적) + 하단 강조 배지(ComparableTradesCard.tsx). */}
                <section className="right-panel-card">
                    <CardSubHeading number={4} title="미래가치 산정 근거" />
                    {postRemodel == null || profitAnalysis == null ? (
                        <p className="right-panel-field-note">산출 불가</p>
                    ) : (
                        <ComparableTradesCard
                            comparableTrades={postRemodel.comparableTrades}
                            comparableCount={postRemodel.comparableCount}
                            futureValue={profitAnalysis.value}
                            confidenceLevel={postRemodel.confidenceLevel}
                            perSqmPrice={futureValueUnitPrice}
                            area={futureValueTargetArea}
                        />
                    )}
                </section>

                {/* 6. 민감도 분석(ROI 변화) — 공사비×매도가 3×3, 가운데 셀만 강조(SensitivityMatrix.tsx). */}
                <section className="right-panel-card">
                    <CardSubHeading number={5} title="민감도 분석(ROI 변화)" />
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

            {/* 7. 계산 조건 및 제외 항목(신규, 풀폭 3열) — 확정본 문구 그대로. */}
            <section className="right-panel-card">
                <CardSubHeading number={6} title="계산 조건 및 제외 항목" />
                <div className="report-calc-conditions">
                    <div>
                        <p className="report-calc-conditions-title">계산 조건</p>
                        <ul className="report-calc-conditions-list">
                            <li>
                                취득 부대비용:{" "}
                                {/* 기존 값 재사용 — 실제 계산은 analysisApi.ts calcAcquisitionCost(개인 1주택자 표준세율 기준). */}
                                개인 1주택자 표준세율 기준
                            </li>
                            <li>공사비: 시장 단가 기반 추정 범위</li>
                            <li>
                                미래가치: 비교거래 기반 시세 추정
                                {futureValueUnitPrice != null && ` (추정시세 ${futureValueUnitPrice.toLocaleString()}만원/㎡)`}
                            </li>
                            <li>면적 기준: 건축물대장(연면적)</li>
                        </ul>
                    </div>
                    <div>
                        <p className="report-calc-conditions-title">제외 항목(미반영)</p>
                        <ul className="report-calc-conditions-list">
                            <li>양도소득세</li>
                            <li>금융비용 / 대출이자</li>
                            <li>인허가 비용 / 설계비</li>
                            <li>추가 공사비 및 예비비</li>
                            <li>보유기간 중 유지비, 관리비</li>
                        </ul>
                    </div>
                    <div>
                        <p className="report-calc-conditions-title">주의</p>
                        <p className="right-panel-field-note">본 분석은 정보 제공을 목적으로 하며, 투자 판단과 책임은 이용자에게 있습니다.</p>
                    </div>
                </div>
            </section>
        </>
    );
};

export default BusinessAnalysisPage;
