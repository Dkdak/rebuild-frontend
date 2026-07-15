import LeftPanel from "./LeftPanel";

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
                <LeftPanel />
            </div>
        </div>
    );
};

export default FilterDrawer;
