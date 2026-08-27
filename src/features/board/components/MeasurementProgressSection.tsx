import { useMeasurementRows } from "../../analysis/hooks/useMeasurementRows";

// planning/rebuild/ReValue_대시보드_콘텐츠_구성안.md §4 — "분석 중인 대상". 분석탭 좌측 목록과 같은 API·같은
// 데이터이고 화면만 다르다. 실측을 시작한 건물만 나오고, 담기만 한 건물은 관심목록에 있다.
// "산출 불가"만 보여주지 않고 다음에 무엇을 채우면 되는지까지 알린다 — 여기서는 진행중 ROI도 표시한다
// (관심목록과 달리 비교가 아니라 진행 확인이 목적이라, 반쪽 값이어도 의미가 있다).
interface MeasurementProgressSectionProps {
    onGoToAnalysis: (buildingId?: string, address?: string) => void;
}

const MeasurementProgressSection = ({ onGoToAnalysis }: MeasurementProgressSectionProps) => {
    const { rows } = useMeasurementRows();

    return (
        <section className="dashboard-card">
            <p className="dashboard-side-title">
                분석 중인 대상
                {rows && <span className="favorite-count">{rows.length}건</span>}
                <button
                    type="button"
                    className="dashboard-login-prompt dashboard-goto-analysis"
                    onClick={() => onGoToAnalysis()}
                >
                    분석탭에서 보기
                </button>
            </p>

            {rows == null ? (
                <p className="dashboard-card-note">불러오는 중입니다…</p>
            ) : rows.length === 0 ? (
                <p className="dashboard-card-note">
                    아직 실측을 시작한 매물이 없습니다. 관심목록의 <b>실측 상태</b>를 누르면 분석탭에서 시작할 수
                    있습니다.
                </p>
            ) : (
                <div className="favorite-table-wrap">
                    <table className="favorite-table">
                        <thead>
                            <tr>
                                <th>건물명</th>
                                <th>진행률</th>
                                <th>다음 입력 항목</th>
                                <th className="is-right">입력 기준 ROI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.buildingId}
                                    className="favorite-table-row"
                                    onClick={() => onGoToAnalysis(row.buildingId, row.address)}
                                >
                                    <td className="favorite-table-address">{row.address}</td>
                                    <td>
                                        <span className="measure-progress">
                                            <i
                                                style={{
                                                    width: `${(row.progress.measured / row.progress.total) * 100}%`,
                                                }}
                                            />
                                        </span>
                                        <span className="measure-progress-count">
                                            {row.progress.measured}/{row.progress.total}
                                        </span>
                                    </td>
                                    <td className="favorite-table-muted">{row.nextInputField ?? "—"}</td>
                                    <td className="is-right">
                                        {row.measuredRoi != null ? `${Math.round(row.measuredRoi)}%` : "—"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="dashboard-note">
                "—"는 <b>다음 입력 항목이 채워지면 산출됩니다.</b> 입력 기준 ROI는 사용자가 넣은 값으로 계산한
                결과이며, 미입력 항목은 추정값을 씁니다.
            </p>
        </section>
    );
};

export default MeasurementProgressSection;
