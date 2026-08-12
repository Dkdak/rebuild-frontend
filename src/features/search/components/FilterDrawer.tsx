// 2026-08-10 — FilterDrawer.tsx가 features/search/components/로 이동해오면서 LeftPanelContent와 같은 폴더가 됨
// (guide/DIRECTORY_RESTRUCTURE.md §1) — shared/components/layout/LeftPanel.tsx 껍데기를 거치지 않고 바로 참조.
import LeftPanelContent from "./LeftPanelContent";

interface FilterDrawerProps {
    open: boolean;
    onClose: () => void;
}

const FilterDrawer = ({ open, onClose }: FilterDrawerProps) => {
    if (!open) return null;

    return (
        <div className="filter-drawer-backdrop" onClick={onClose}>
            <div className="filter-drawer-panel" onClick={(e) => e.stopPropagation()}>
                <button className="filter-drawer-close" onClick={onClose} aria-label="닫기">×</button>
                <LeftPanelContent onSearchSubmit={onClose} />
            </div>
        </div>
    );
};

export default FilterDrawer;
