import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 "민감도 분석(ROI 변화)" — 공사비축(최소/기준/최대) × 매도가축(보수적/기준/낙관적)
// 3×3, 프론트에서 (매도가-(매입가+공사비+부대비용))÷(매입가+공사비+부대비용)×100 재계산(새 API 없음,
// CashFlowFormula와 같은 ProfitAnalysisResult.baseValue 재사용).
// 2026-08-17 재구성(planning/rebuild/widgets/2026-08-17_business_analysis_confirmed_final.html 확정본) —
// (a) 헤더 라벨 "공사비 \ 매도가"→"공사비 \ 미래 매도가". (b) 가운데 셀(기준×기준)만 진하게 확대 강조, 나머지
// 8칸은 매도가 열(보수적/기준/낙관적) 단위로 3색 참고 배경 — ROI 값 기준 색칠이 아니라(2026-08-10 "근거
// 없는 임의 임계값" 지적으로 이미 한 번 폐기된 접근) 순수 열 구분용, 확정본의 정확한 hex 그대로(새 토큰
// 추가 없이 이 표 전용 리터럴로 — 기존 success/warning 톤과는 별개 팔레트라 재사용 불가, 확정본에 색값이
// 명시돼 있어 임의 판단 아님).
// 2026-08-17 같은 날 재정정(planning/rebuild/widgets/2026-08-17_sensitivity_axis_label_fix.html 확정본) —
// 코너 셀에 "공사비"/"미래 매도가" 두 축 이름을 <br/>로 쌓아뒀더니 열 헤더 행과 같은 줄이라 두 라벨이
// 뒤바뀐 것처럼 보인다는 지적(데이터 매핑 costs=행/sellPrices=열 자체는 항상 정확했음, 라벨 배치만 문제).
// → "공사비"는 행 라벨 열의 자체 헤더로(2번째 헤더 행, BreakEvenTable의 "목표 ROI"와 같은 자리),
// "미래 매도가"→"예상 매도가"(다른 카드 어휘 통일)는 데이터 3열 위에 걸치는 별도 캡션 행(colSpan=3)으로
// 분리 — 표가 이제 헤더 2행(캡션행+열헤더행)+본문 3행 구조. 행·열 헤더 각 값 옆에 기준값(인덱스1) 대비
// 편차 %도 추가(기준값 칸 자체는 "기준값" 텍스트로 대체) — 시나리오가 기준에서 얼마나 벗어난 값인지 바로
// 보여준다.
interface SensitivityMatrixProps {
    buyPrice: number; // 매입가(만원, 공사비 제외)
    acquisitionCost: number; // 부대비용(만원)
    costs: [number, number, number]; // [최소, 기준, 최대](만원)
    sellPrices: [number, number, number]; // [보수적, 기준, 낙관적](만원)
}

const COST_LABELS = ["최소", "기준", "최대"];
const SELL_LABELS = ["보수적", "기준", "낙관적"];
// 매도가 열(0/1/2)별 참고용 톤 — ROI 값이 아니라 열(시나리오) 자체에 고정으로 매긴다.
const SELL_COLUMN_TONES = ["report-sensitivity-col-a", "report-sensitivity-col-b", "report-sensitivity-col-c"];
// 두 축 공통 — 인덱스1이 "기준" 값(costs[1]/sellPrices[1]).
const BASELINE_INDEX = 1;

// 기준값 대비 편차 % — "((시나리오값-기준값)/기준값×100).toFixed(1)+"%"", 부호는 toFixed가 음수에 "-"를
// 자동으로 붙여주니 양수일 때만 "+"를 앞에 추가. 기준값 칸 자체(colIndex/rowIndex===BASELINE_INDEX)는 이
// 함수를 호출하지 않고 호출부에서 "기준값" 텍스트로 대체.
const formatDeltaPercent = (value: number, baseline: number): string => {
    if (baseline === 0) return "-";
    const delta = ((value - baseline) / baseline) * 100;
    return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
};

// report-trade-table-wrap으로 감싸는 이유: report-trade-table 계열은 nowrap 기반이라(모바일 음절 줄바꿈
// 방지, ReportPage.css 참고) 좁은 화면에서 셀 폭이 넘치면 래퍼가 가로 스크롤로 흡수해야 한다 — 이 래퍼 없이
// 쓰면 유사 사례 표에서 났던 것과 같은 squish 문제가 재현된다.
const SensitivityMatrix = ({ buyPrice, acquisitionCost, costs, sellPrices }: SensitivityMatrixProps) => (
    <div className="report-trade-table-wrap">
        {/* report-sensitivity-matrix — report-sensitivity-table(BreakEvenTable.tsx와 공유하는 압축 패딩)과는
            별개로 이 표만의 열 너비 고정용 클래스(ReportPage.css) — 두 표가 같은 클래스를 공유해서 폭 규칙을
            거기 얹으면 열이 3개뿐인 BreakEvenTable까지 영향받는다. */}
        <table className="report-trade-table report-sensitivity-table report-sensitivity-matrix">
            <colgroup>
                <col className="report-sensitivity-col-label" />
                <col className="report-sensitivity-col-data" />
                <col className="report-sensitivity-col-data" />
                <col className="report-sensitivity-col-data" />
            </colgroup>
            <thead>
                {/* 헤더 1행 — 코너는 비워두고(행 라벨은 아래 2행의 "공사비"가 이미 담당), "예상 매도가"는
                    데이터 3열 위에 걸치는 캡션(colSpan=3)으로 가로축임을 명시. */}
                <tr>
                    <th className="report-sensitivity-corner" aria-hidden="true" />
                    <th colSpan={3} className="report-sensitivity-group-header">
                        예상 매도가
                    </th>
                </tr>
                {/* 헤더 2행 — "공사비"는 행 라벨 열의 자체 헤더(BreakEvenTable의 "목표 ROI"와 같은 자리),
                    나머지 3칸은 매도가 시나리오별 값+라벨+기준 대비 편차. */}
                <tr>
                    <th className="report-sensitivity-row-axis-label">공사비</th>
                    {SELL_LABELS.map((label, colIndex) => (
                        <th key={label} className={SELL_COLUMN_TONES[colIndex]}>
                            <span className="report-sensitivity-axis-value">{formatManwon(sellPrices[colIndex])}</span>
                            <br />
                            <span className="report-sensitivity-axis-label">{label}</span>
                            <span className="report-sensitivity-axis-delta">
                                {colIndex === BASELINE_INDEX
                                    ? "기준값"
                                    : formatDeltaPercent(sellPrices[colIndex], sellPrices[BASELINE_INDEX])}
                            </span>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {costs.map((cost, rowIndex) => (
                    <tr key={COST_LABELS[rowIndex]}>
                        <th>
                            <span className="report-sensitivity-axis-value">{formatManwon(cost)}</span>
                            <br />
                            <span className="report-sensitivity-axis-label">{COST_LABELS[rowIndex]}</span>
                            <span className="report-sensitivity-axis-delta">
                                {rowIndex === BASELINE_INDEX ? "기준값" : formatDeltaPercent(cost, costs[BASELINE_INDEX])}
                            </span>
                        </th>
                        {sellPrices.map((sellPrice, colIndex) => {
                            const totalInvest = buyPrice + cost + acquisitionCost;
                            const roi = totalInvest > 0 ? ((sellPrice - totalInvest) / totalInvest) * 100 : 0;
                            const isCenter = rowIndex === BASELINE_INDEX && colIndex === BASELINE_INDEX;
                            return (
                                <td
                                    key={SELL_LABELS[colIndex]}
                                    className={isCenter ? "report-sensitivity-cell-center" : SELL_COLUMN_TONES[colIndex]}
                                >
                                    {roi.toFixed(1)}%
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
        {/* 2026-08-17 재정정("06 최종 확정 구조" §확정분) — 가운데 셀이 정확히 무엇의 조합인지 괄호로 명시(공사비
            적정 추정치 × 미래가치 중앙값), 뒤 문장("시나리오의 실현 가능성을 나타내지 않습니다")은 정보 과다로
            판단돼 삭제. */}
        <p className="right-panel-field-note report-basis-caption">
            가운데 진한 셀 = 현재 추정 기준값(공사비 적정 추정치 × 미래가치 중앙값). 나머지는 참고용 시나리오입니다.
        </p>
    </div>
);

export default SensitivityMatrix;
