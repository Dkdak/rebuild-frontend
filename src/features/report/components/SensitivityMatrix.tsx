import { formatEok } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 "민감도 분석" — 공사비축(최소/기준/최대) × 매도가축(보수적/기준/낙관적) 3×3,
// 프론트에서 (매도가-(매입가+공사비))÷(매입가+공사비)×100 재계산(새 API 없음, CashFlowFormula와 같은
// ProfitAnalysisResult.baseValue 재사용). 축 라벨 아래에 실제 금액(formatEok, 좁은 칸 전용)을 같이 보여줘
// "최소"/"보수적" 같은 라벨만으로는 알 수 없던 실제 구간을 알 수 있게 한다(2026-08-1x).
interface SensitivityMatrixProps {
    buyPrice: number; // 매입가(만원, 공사비 제외)
    costs: [number, number, number]; // [최소, 기준, 최대](만원)
    sellPrices: [number, number, number]; // [보수적, 기준, 낙관적](만원)
}

const COST_LABELS = ["최소", "기준", "최대"];
const SELL_LABELS = ["보수적", "기준", "낙관적"];

// report-trade-table-wrap으로 감싸는 이유: report-trade-table 계열은 nowrap 기반이라(모바일 음절 줄바꿈
// 방지, ReportPage.css 참고) 좁은 화면에서 셀 폭이 넘치면 래퍼가 가로 스크롤로 흡수해야 한다 — 이 래퍼 없이
// 쓰면 유사 사례 표에서 났던 것과 같은 squish 문제가 재현된다.
const SensitivityMatrix = ({ buyPrice, costs, sellPrices }: SensitivityMatrixProps) => (
    <div className="report-trade-table-wrap">
        <table className="report-trade-table report-sensitivity-table">
            <thead>
                <tr>
                    <th>공사비 \ 매도가</th>
                    {SELL_LABELS.map((label, colIndex) => (
                        <th key={label}>
                            {label}
                            <br />
                            <span className="report-sensitivity-axis-value">{formatEok(sellPrices[colIndex])}</span>
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
                            <span className="report-sensitivity-axis-value">{formatEok(cost)}</span>
                        </th>
                        {sellPrices.map((sellPrice, colIndex) => {
                            const totalInvest = buyPrice + cost;
                            const roi = totalInvest > 0 ? ((sellPrice - totalInvest) / totalInvest) * 100 : 0;
                            return (
                                <td
                                    key={SELL_LABELS[colIndex]}
                                    className={roi >= 0 ? "report-sensitivity-positive" : "report-sensitivity-negative"}
                                >
                                    {roi.toFixed(1)}%
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default SensitivityMatrix;
