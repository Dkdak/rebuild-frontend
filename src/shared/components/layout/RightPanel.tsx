import { useSearch } from "../../../features/search/context/SearchContext";
import { formatAreaDisplay, formatBuildYear, formatHouseholdCount } from "../../../features/search/api/searchApi";

// F-04_SEARCH.md §1.1: 선택된 매물을 RightPanel에 최소 반영한다. 상세 내용(개요/입지분석/건물정보/시세분석/AI 리포트)은 F-05~F-10 범위.
const RightPanel = () => {
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;
    const areaDisplay = selected ? formatAreaDisplay(selected) : null;
    const householdCountText = selected ? formatHouseholdCount(selected.householdCount) : null;
    const auxLine = [areaDisplay?.aux, householdCountText].filter(Boolean).join(" · ");

    return (
        <aside className="right-panel">
            {selected ? (
                <div className="right-panel-selected">
                    <h4 className="right-panel-selected-title">{selected.address}</h4>
                    <p className="right-panel-selected-meta">
                        {selected.propertyType ?? "유형 미확인"}
                        {" · "}
                        {areaDisplay?.main}
                        {" · "}
                        {formatBuildYear(selected.buildYear)}
                    </p>
                    {auxLine && <p className="right-panel-selected-area-aux">{auxLine}</p>}
                </div>
            ) : (
                <p className="right-panel-empty">선택된 매물이 없습니다.</p>
            )}

            <div className="placeholder-box right-panel-placeholder">
                <span>매물 상세 패널<br />(개요 / 입지분석 / 건물정보 / 시세분석 / AI 리포트)<br />추후 구현</span>
            </div>
        </aside>
    );
};

export default RightPanel;
