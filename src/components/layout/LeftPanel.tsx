// TODO(F-04): 실제 검색 API 응답으로 교체 — 지금은 mock (F-01_LAYOUT.md §2.4 기준 A+~D 6등급 + 등급별 평균 ROI)
const GRADE_SUMMARY = [
    { grade: "A+", count: 18, avgRoi: 24 },
    { grade: "A", count: 36, avgRoi: 19 },
    { grade: "B+", count: 42, avgRoi: 14 },
    { grade: "B", count: 28, avgRoi: 11 },
    { grade: "C", count: 0, avgRoi: 0 },
    { grade: "D", count: 0, avgRoi: 0 },
];

const LeftPanel = () => {
    return (
        <aside className="left-panel">
            <h3 className="left-panel-title">조건 검색</h3>

            <label className="left-panel-field">
                부동산 유형
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field">
                거래 유형
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field">
                건축 연도
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field">
                가격
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field">
                면적
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field">
                투자 지표
                <select disabled>
                    <option>전체</option>
                </select>
            </label>
            <label className="left-panel-field left-panel-field-checkbox">
                <input type="checkbox" disabled /> 역세권 (500m 이내)
            </label>

            <button className="left-panel-search-btn" disabled>검색하기</button>

            <div className="left-panel-results">
                <h4>검색 결과 (목업)</h4>
                {GRADE_SUMMARY.map(({ grade, count, avgRoi }) => (
                    <div
                        key={grade}
                        className={`left-panel-result-row ${count === 0 ? "left-panel-result-row-empty" : ""}`}
                    >
                        <span className={`grade-badge grade-${grade.replace("+", "plus")}`}>{grade}</span>
                        <span className="left-panel-result-count">{count}건</span>
                        <span className="left-panel-result-roi">
                            {count > 0 ? `평균 ROI ${avgRoi}%` : "-"}
                        </span>
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default LeftPanel;
