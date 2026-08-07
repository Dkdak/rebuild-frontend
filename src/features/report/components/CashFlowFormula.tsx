import { formatEok } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 — 매입가+공사비=총투자금, 매도가-총투자금=예상차익을 산식 그대로 나열한다.
// 2026-08-1x: 세로 막대 비교(구 CashFlowWaterfall)는 매도가(수십억)가 공사비·예상차익(한 자릿수 억)을
// 압도해 공유 축에서 작은 막대가 트랙에 묻히고, 범위 막대(공사비)는 시작점 라벨이 없어 뭘 보는지 알 수
// 없었다(사용자 피드백 "해석을 못하겠는데, 눈에 띄지도 않고..."). 그래프 비교가 안 맞는 데이터라 판단해
// 산식을 그대로 읽는 흐름으로 교체 — 새 계산 없음(ProfitAnalysisResult 그대로, 총투자금=매입가+공사비만
// 컴포넌트 내부에서 더함).
interface CashFlowFormulaProps {
    buyPrice: number; // 매입가(만원)
    costMin: number; // 공사비 최소(만원)
    costMax: number; // 공사비 최대(만원)
    sellPrice: number; // 매도가 = 리모델링 후 예상 시세(만원)
    gainMin: number; // 예상 차익 최소(만원)
    gainMax: number; // 예상 차익 최대(만원)
}

const CashFlowFormula = ({ buyPrice, costMin, costMax, sellPrice, gainMin, gainMax }: CashFlowFormulaProps) => {
    const investMin = buyPrice + costMin;
    const investMax = buyPrice + costMax;
    const gainSign = gainMin >= 0 && gainMax >= 0 ? "positive" : gainMin < 0 && gainMax < 0 ? "negative" : "neutral";

    return (
        <div className="report-cashflow-flow">
            <div className="report-cashflow-flow-row">
                <span className="report-cashflow-flow-label">매입가</span>
                <span className="report-cashflow-flow-value">{formatEok(buyPrice)}</span>
            </div>
            <div className="report-cashflow-flow-op" aria-hidden="true">
                +
            </div>
            <div className="report-cashflow-flow-row">
                <span className="report-cashflow-flow-label">공사비</span>
                <span className="report-cashflow-flow-value">
                    {formatEok(costMin)} ~ {formatEok(costMax)}
                </span>
            </div>
            <div className="report-cashflow-flow-op" aria-hidden="true">
                =
            </div>
            <div className="report-cashflow-flow-row report-cashflow-flow-row-total">
                <span className="report-cashflow-flow-label">총 투자금</span>
                <span className="report-cashflow-flow-value">
                    {formatEok(investMin)} ~ {formatEok(investMax)}
                </span>
            </div>

            <div className="report-cashflow-flow-divider" />

            <div className="report-cashflow-flow-row">
                <span className="report-cashflow-flow-label">매도가</span>
                <span className="report-cashflow-flow-value">{formatEok(sellPrice)}</span>
            </div>
            <div className="report-cashflow-flow-op" aria-hidden="true">
                −
            </div>
            <div className="report-cashflow-flow-row">
                <span className="report-cashflow-flow-label">총 투자금</span>
                <span className="report-cashflow-flow-value">
                    {formatEok(investMin)} ~ {formatEok(investMax)}
                </span>
            </div>
            <div className="report-cashflow-flow-op" aria-hidden="true">
                =
            </div>
            <div className={`report-cashflow-flow-row report-cashflow-flow-row-result report-cashflow-flow-${gainSign}`}>
                <span className="report-cashflow-flow-label">예상 차익</span>
                <span className="report-cashflow-flow-value">
                    {formatEok(gainMin)} ~ {formatEok(gainMax)}
                </span>
            </div>
        </div>
    );
};

export default CashFlowFormula;
