import SearchMap from "../../../features/search/components/SearchMap";
import ResultList from "../../../features/search/components/ResultList";

// F-01 소관: 레이아웃 셸(지도/리스트 세로 비율)만 담당. 실제 렌더링은 F-04 소관 컴포넌트에 위임.
const CenterPanel = () => {
    return (
        <section className="center-panel">
            <SearchMap />
            <ResultList />
        </section>
    );
};

export default CenterPanel;
