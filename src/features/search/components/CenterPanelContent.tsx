import SearchMap from "./SearchMap";
import ResultList from "./ResultList";

interface CenterPanelContentProps {
    // 모바일 전용 — 카드의 "상세보기" 버튼이 호출(`FEATURE_01_LAYOUT.md` §2.2, 2026-08-04). FilterDrawer 트리거는 TopBar로 이동해 여기선 더 이상 필요 없음.
    onOpenDetail: () => void;
}

// 2026-08-10 — guide/DIRECTORY_RESTRUCTURE.md §1: shared/components/layout/CenterPanel.tsx(레이아웃 슬롯 껍데기)에서
// 실제 컨텐츠(지도+리스트, F-04)를 분리 — 같은 기능 폴더 안에서 SearchMap·ResultList와 나란히 관리한다.
const CenterPanelContent = ({ onOpenDetail }: CenterPanelContentProps) => {
    return (
        <section className="center-panel">
            <SearchMap />
            <ResultList onOpenDetail={onOpenDetail} />
        </section>
    );
};

export default CenterPanelContent;
