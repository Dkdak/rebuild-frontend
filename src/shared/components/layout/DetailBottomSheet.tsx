import RightPanel from "./RightPanel";

interface DetailBottomSheetProps {
    open: boolean;
    onClose: () => void;
}

const DetailBottomSheet = ({ open, onClose }: DetailBottomSheetProps) => {
    if (!open) return null;

    return (
        <div className="detail-sheet-backdrop" onClick={onClose}>
            <div className="detail-sheet-panel" onClick={(e) => e.stopPropagation()}>
                <div className="detail-sheet-handle" />
                <button className="detail-sheet-close" onClick={onClose} aria-label="닫기">×</button>
                <RightPanel />
            </div>
        </div>
    );
};

export default DetailBottomSheet;
