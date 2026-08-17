import { Fragment } from "react";
import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 확장(2026-08-10 신규 카드) — "손익분기·안전마진". 손익분기 매도가는 정의상
// 총 투자금과 같다(차익 0 지점, ProfitAnalysisResult.investMin/investMax 그대로 재사용, 새 계산 아님).
// 목표 ROI별 필요 매도가 = 총 투자금 × (1+목표ROI) — 최소/최대 투자금 두 기준으로 나란히 보여줘, 공사비
// 추정 범위(최소~최대)에 따라 목표를 달성하려면 매도가가 얼마나 더 필요한지 감을 잡게 한다.
// 2026-08-17 구조 개편(planning/rebuild/widgets/2026-08-17_business_analysis_confirmed_final.html 확정본) —
// 헤더 문구 압축("필요 매도가(최소 투자금 기준)"→"필요 매도가(최소)"), "현재 추정 미래가치" 강조줄 추가.
// 2026-08-17 같은 날 재정정(planning/rebuild/widgets/2026-08-17_breakeven_card_final.html 확정본) — "손익분기
// 매도가"를 표 위 별도 박스로 승격했던 걸 다시 삭제(표의 "0%(손익분기)" 행과 값이 완전히 중복이었다는 지적) —
// 대신 그 행 자체를 회색 배경+테두리로 강조(report-breakeven-highlight-row, ReportPage.css).
const TARGET_ROI_PERCENTS = [0, 10, 20, 30, 50, 100];

interface BreakEvenTableProps {
    investMin: number; // 총 투자금 최소(만원)
    investMax: number; // 총 투자금 최대(만원)
    futureValue: number; // 현재 추정 미래가치(만원, profitAnalysis.value) — 목표 ROI 표 안에서 이 값이 어느
    // 구간에 해당하는지 강조줄로 보여준다(새 계산 아님, 이미 있는 값 재사용).
}

const BreakEvenTable = ({ investMin, investMax, futureValue }: BreakEvenTableProps) => {
    // 각 목표 ROI 행의 "최소/최대 투자금 기준" 임계값 — 필요 매도가 = 총 투자금 × (1+목표ROI), 기존 표와 동일 산식.
    const rows = TARGET_ROI_PERCENTS.map((roiPercent) => ({
        roiPercent,
        minThreshold: investMin * (1 + roiPercent / 100),
        maxThreshold: investMax * (1 + roiPercent / 100),
    }));
    // 삽입 위치 — "최소 투자금 기준" 열(표의 기준 열)과 비교해 futureValue가 처음으로 못 미치는 행 앞에 넣는다.
    // 전부 넘으면(100% 목표보다도 큼) 표 맨 아래에 "100%도 이미 넘어섬" 문구를 붙여서, 0% 문턱보다도 작으면
    // (손익분기 미달) 표 맨 위에 넣는다.
    let insertBeforeIndex = rows.findIndex((row) => futureValue < row.minThreshold);
    const exceedsAll = insertBeforeIndex === -1;
    if (exceedsAll) insertBeforeIndex = rows.length;
    // 캡션용 — 현재 추정 미래가치로 실제 달성 가능한 가장 높은 목표 ROI(마지막으로 넘어선 행). 손익분기에도
    // 못 미치면(insertBeforeIndex===0) 달성한 구간이 아예 없다는 뜻이라 캡션 자체를 생략.
    const achievedPercent = insertBeforeIndex > 0 ? rows[insertBeforeIndex - 1].roiPercent : null;

    const currentValueRow = (
        <tr className="report-breakeven-current-row">
            <td colSpan={3}>
                현재 추정 미래가치 {formatManwon(futureValue)}
                {exceedsAll && "(목표 ROI 100%도 이미 넘어섬)"}
            </td>
        </tr>
    );

    return (
        <>
            {/* 2026-08-17 삭제(§확정분) — "손익분기 매도가" 강조 박스 제거, 표의 "0%(손익분기)" 행과 값이
                완전히 중복이었다(아래 그 행에 report-breakeven-highlight-row로 대신 강조). 캡션만 남긴다. */}
            <p className="right-panel-field-note">총 투자금 이상으로 매각해야 투자원금 기준 손익분기 달성</p>
            <div className="report-trade-table-wrap">
                <table className="report-trade-table report-sensitivity-table">
                    <thead>
                        <tr>
                            <th>목표 ROI</th>
                            <th>필요 매도가(최소)</th>
                            <th>필요 매도가(최대)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {insertBeforeIndex === 0 && currentValueRow}
                        {rows.map((row, index) => (
                            <Fragment key={row.roiPercent}>
                                {/* 2026-08-17 — "0%(손익분기)" 행 강조(report-breakeven-highlight-row, ReportPage.css) —
                                    회색 배경+테두리로 손익분기 시작점을 표시. 아래 파란 "현재 추정 미래가치" 줄
                                    (지금 예상되는 실제 위치)과 색을 다르게 써서 두 지점을 구분. */}
                                <tr className={row.roiPercent === 0 ? "report-breakeven-highlight-row" : undefined}>
                                    {/* 2026-08-17 정정 — "0%(손익분기)" 괄호 설명 삭제. 행 자체가 회색 배경+테두리로
                                        이미 강조돼 있고 카드 제목도 "손익분기 및 목표 수익률"이라 "0%"만으로도
                                        충분히 알아볼 수 있다는 지적 — 모바일 표 폭 축소에도 도움. */}
                                    <th>{row.roiPercent}%</th>
                                    <td>{formatManwon(row.minThreshold)}</td>
                                    <td>{formatManwon(row.maxThreshold)}</td>
                                </tr>
                                {insertBeforeIndex === index + 1 && currentValueRow}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* 2026-08-10 — 표 아래 계산식 각주(§2.5 문서 확정). 2026-08-17 추가 — 현재 추정 미래가치로 실제
                달성되는 목표 ROI 구간을 한 문장으로(100% 초과는 위 강조줄에서 이미 다뤄서 중복 표기 안 함). */}
            <p className="right-panel-field-note report-basis-caption">
                필요 매도가 = 총 투자금 × (1 + 목표 ROI){achievedPercent != null && !exceedsAll && ` — 현재 추정 미래가치로는 ${achievedPercent}%까지 도달합니다.`}
            </p>
        </>
    );
};

export default BreakEvenTable;
