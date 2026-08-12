import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 "민감도 분석(ROI 변화)" — 공사비축(최소/기준/최대) × 매도가축(보수적/기준/낙관적)
// 3×3, 프론트에서 (매도가-(매입가+공사비+부대비용))÷(매입가+공사비+부대비용)×100 재계산(새 API 없음,
// CashFlowFormula와 같은 ProfitAnalysisResult.baseValue 재사용). 축 라벨 아래에 실제 금액(formatManwon, 좁은
// 칸 전용)을 같이 보여줘 "최소"/"보수적" 같은 라벨만으로는 알 수 없던 실제 구간을 알 수 있게 한다(2026-08-1x).
// 2026-08-10 — acquisitionCost(부대비용) 추가(총 투자금 공식 변경 반영). 색상 등급(양/음 초록·빨강)은 제거
// (근거 없는 임의 임계값이라는 지적) — 숫자만 표시.
// 2026-08-10 재정정("§2.5 문서 확정") — 고정 "±10%/±20%" 라벨은 매물마다 실제 편차가 다른데 마치 공통 기준인
// 것처럼 보여서 제거. 대신 각 축값이 "기준"(가운데) 값 대비 실제로 몇 % 차이 나는지 그 자리에서 계산해
// 표시(variance = (scenario-base)/base*100) — 매물마다 다른 실제 값을 그대로 보여준다.
interface SensitivityMatrixProps {
    buyPrice: number; // 매입가(만원, 공사비 제외)
    acquisitionCost: number; // 부대비용(만원)
    costs: [number, number, number]; // [최소, 기준, 최대](만원)
    sellPrices: [number, number, number]; // [보수적, 기준, 낙관적](만원)
}

const COST_LABELS = ["최소", "기준", "최대"];
const SELL_LABELS = ["보수적", "기준", "낙관적"];

// base(가운데, "기준") 대비 편차 % — 고정 임계값이 아니라 매물의 실제 축값으로 그때그때 계산.
const variancePercent = (scenario: number, base: number): string => {
    if (base === 0) return "0.0%";
    const variance = ((scenario - base) / base) * 100;
    return `${variance >= 0 ? "+" : ""}${variance.toFixed(1)}%`;
};

// report-trade-table-wrap으로 감싸는 이유: report-trade-table 계열은 nowrap 기반이라(모바일 음절 줄바꿈
// 방지, ReportPage.css 참고) 좁은 화면에서 셀 폭이 넘치면 래퍼가 가로 스크롤로 흡수해야 한다 — 이 래퍼 없이
// 쓰면 유사 사례 표에서 났던 것과 같은 squish 문제가 재현된다.
const SensitivityMatrix = ({ buyPrice, acquisitionCost, costs, sellPrices }: SensitivityMatrixProps) => (
    <div className="report-trade-table-wrap">
        <table className="report-trade-table report-sensitivity-table">
            <thead>
                <tr>
                    <th>공사비 \ 매도가</th>
                    {SELL_LABELS.map((label, colIndex) => (
                        <th key={label}>
                            {label}
                            <br />
                            <span className="report-sensitivity-axis-value">{formatManwon(sellPrices[colIndex])}</span>
                            <br />
                            <span className="report-sensitivity-axis-variance">{variancePercent(sellPrices[colIndex], sellPrices[1])}</span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {costs.map((cost, rowIndex) => (
                    <tr key={COST_LABELS[rowIndex]}>
                        <th>
                            {COST_LABELS[rowIndex]}
                            <br />
                            <span className="report-sensitivity-axis-value">{formatManwon(cost)}</span>
                            <br />
                            <span className="report-sensitivity-axis-variance">{variancePercent(cost, costs[1])}</span>
                        </th>
                        {sellPrices.map((sellPrice, colIndex) => {
                            const totalInvest = buyPrice + cost + acquisitionCost;
                            const roi = totalInvest > 0 ? ((sellPrice - totalInvest) / totalInvest) * 100 : 0;
                            return <td key={SELL_LABELS[colIndex]}>{roi.toFixed(1)}%</td>;
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default SensitivityMatrix;
