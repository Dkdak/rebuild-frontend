import SearchMap from "../../../features/search/components/SearchMap";
import ResultList from "../../../features/search/components/ResultList";

interface CenterPanelProps {
    // 모바일 전용 — 카드의 "상세보기" 버튼이 호출(`FEATURE_01_LAYOUT.md` §2.2, 2026-08-04). FilterDrawer 트리거는 TopBar로 이동해 여기선 더 이상 필요 없음.
    onOpenDetail: () => void;
}

// F-01 소관: 레이아웃 셸(지도/리스트 세로 비율)만 담당. 실제 렌더링은 F-04 소관 컴포넌트에 위임.
const CenterPanel = ({ onOpenDetail }: CenterPanelProps) => {
    return (
        <section className="center-panel">
            <SearchMap />
            <ResultList onOpenDetail={onOpenDetail} />
        </section>
    );
};

export default CenterPanel;
