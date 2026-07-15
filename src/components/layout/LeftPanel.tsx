const GRADE_COUNTS = [
    { grade: "A+", count: 18 },
    { grade: "A", count: 36 },
    { grade: "B+", count: 42 },
    { grade: "B", count: 28 },
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
                {GRADE_COUNTS.map(({ grade, count }) => (
                    <div key={grade} className="left-panel-result-row">
                        <span className={`grade-badge grade-${grade.replace("+", "plus")}`}>{grade}</span>
                        <span>{count}건</span>
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default LeftPanel;
