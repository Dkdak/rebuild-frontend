import RightPanel from "../../../shared/components/layout/RightPanel";
import FavoriteButton from "../../favorites/components/FavoriteButton";
import { useSearch } from "../../search/context/SearchContext";

interface DetailBottomSheetProps {
    open: boolean;
    onClose: () => void;
    onOpenReport: () => void;
}

// FEATURE_11_FAVORITES.md §2.0 — 시트가 열리면 리스트가 가려져 카드 ♥에 접근할 수 없으므로 여기에도 둔다
// (데스크톱 RightPanel에는 넣지 않는다 — 리스트와 상세가 같이 보여 카드 ♥가 항상 옆에 있다).
const DetailBottomSheet = ({ open, onClose, onOpenReport }: DetailBottomSheetProps) => {
    const { selectedPropertyId } = useSearch();

    if (!open) return null;

    return (
        <div className="detail-sheet-backdrop" onClick={onClose}>
            <div className="detail-sheet-panel" onClick={(e) => e.stopPropagation()}>
                <div className="detail-sheet-handle" />
                <button className="detail-sheet-close" onClick={onClose} aria-label="닫기">×</button>
                {selectedPropertyId && (
                    <FavoriteButton buildingId={selectedPropertyId} className="favorite-button-sheet" />
                )}
                <RightPanel
                    onOpenReport={() => {
                        onClose();
                        onOpenReport();
                    }}
                />
            </div>
        </div>
    );
};

export default DetailBottomSheet;
