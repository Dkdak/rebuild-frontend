// planning/rebuild/ReValue_대시보드_콘텐츠_구성안.md §4 — 실측 진행 현황. 실측을 입력한 건물만 나온다
// (담기만 한 건물은 관심목록에만 있다). "산출 불가"만 보여주지 않고 다음에 무엇을 채우면 되는지까지 알린다.
// F-19 목록 API 연동 전이라 지금은 표 구조와 빈 상태만 둔다 — 값은 API가 나오면 채운다.
interface MeasurementRow {
    buildingId: string;
    address: string;
    completed: number;
    total: number;
    nextField: string | null;
    roi: number | null;
}

interface MeasurementProgressSectionProps {
    rows?: MeasurementRow[];
}

const MeasurementProgressSection = ({ rows }: MeasurementProgressSectionProps) => (
    <section className="dashboard-card">
        <p className="dashboard-side-title">
            실측 진행 현황
            {rows && <span className="favorite-count">{rows.length}건</span>}
        </p>

        {rows == null || rows.length === 0 ? (
            <p className="dashboard-card-note">
                {rows == null
                    ? "실측 입력 현황은 F-19 목록 API 연동 후 표시됩니다."
                    : "실측을 입력한 건물이 없습니다."}
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
                            <tr key={row.buildingId}>
                                <td className="favorite-table-address">{row.address}</td>
                                <td>
                                    <span className="measure-progress">
                                        <i style={{ width: `${(row.completed / row.total) * 100}%` }} />
                                    </span>
                                    <span className="measure-progress-count">
                                        {row.completed}/{row.total}
                                    </span>
                                </td>
                                <td className="favorite-table-muted">{row.nextField ?? "—"}</td>
                                <td className="is-right">{row.roi != null ? `${row.roi}%` : "—"}</td>
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

export default MeasurementProgressSection;
