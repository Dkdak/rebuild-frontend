import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5 확장(2026-08-10 신규 카드) — "손익분기·안전마진". 손익분기 매도가는 정의상
// 총 투자금과 같다(차익 0 지점, ProfitAnalysisResult.investMin/investMax 그대로 재사용, 새 계산 아님).
// 목표 ROI별 필요 매도가 = 총 투자금 × (1+목표ROI) — 최소/최대 투자금 두 기준으로 나란히 보여줘, 공사비
// 추정 범위(최소~최대)에 따라 목표를 달성하려면 매도가가 얼마나 더 필요한지 감을 잡게 한다.
const TARGET_ROI_PERCENTS = [0, 10, 20, 30, 50, 100];

interface BreakEvenTableProps {
    investMin: number; // 총 투자금 최소(만원)
    investMax: number; // 총 투자금 최대(만원)
}

const BreakEvenTable = ({ investMin, investMax }: BreakEvenTableProps) => (
    <>
        <dl className="right-panel-fact-list">
            <div>
                <dt>손익분기 매도가</dt>
                <dd>
                    {formatManwon(investMin)} ~ {formatManwon(investMax)}
                </dd>
            </div>
        </dl>
        {/* 2026-08-10 — §2.5 문서 확정: 손익분기 매도가 바로 아래 의미 설명 캡션. */}
        <p className="right-panel-field-note">총 투자금 이상으로 매각해야 투자원금 기준 손익분기 달성</p>
        <hr className="right-panel-card-divider" />
        <div className="report-trade-table-wrap">
            <table className="report-trade-table report-sensitivity-table">
                <thead>
                    <tr>
                        <th>목표 ROI</th>
                        <th>필요 매도가(최소 투자금 기준)</th>
                        <th>필요 매도가(최대 투자금 기준)</th>
                    </tr>
                </thead>
                <tbody>
                    {TARGET_ROI_PERCENTS.map((roiPercent) => (
                        <tr key={roiPercent}>
                            {/* 0%는 곧 손익분기 지점이라는 걸 라벨에서 바로 알 수 있게 병기(§2.5 문서 확정). */}
                            <th>{roiPercent === 0 ? "0%(손익분기)" : `${roiPercent}%`}</th>
                            <td>{formatManwon(investMin * (1 + roiPercent / 100))}</td>
                            <td>{formatManwon(investMax * (1 + roiPercent / 100))}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {/* 2026-08-10 — 표 아래 계산식 각주(§2.5 문서 확정). */}
        <p className="right-panel-field-note report-basis-caption">필요 매도가 = 총 투자금 × (1 + 목표 ROI)</p>
    </>
);

export default BreakEvenTable;
