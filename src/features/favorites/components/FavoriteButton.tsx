import { useFavorites } from "../context/FavoritesContext";
import "./favorites.css";

// FEATURE_11_FAVORITES.md §2.0 — 확인 모달 없이 즉시 토글한다. 매물 카드 안에서는 카드 탭(매물 선택)과
// 이벤트가 겹치지 않도록 전파를 막는다.
interface FavoriteButtonProps {
    buildingId: string;
    // 카드 우측 상단처럼 위치가 다른 자리는 호출부가 클래스로 배치를 맡는다.
    className?: string;
    label?: string;
}

const FavoriteButton = ({ buildingId, className, label }: FavoriteButtonProps) => {
    const { isFavorited, toggleFavorite } = useFavorites();
    const active = isFavorited(buildingId);

    return (
        <button
            type="button"
            className={`favorite-button ${active ? "is-active" : ""} ${className ?? ""}`}
            aria-pressed={active}
            aria-label={active ? "관심목록에서 빼기" : "관심목록에 담기"}
            title={active ? "관심목록에서 빼기" : "관심목록에 담기"}
            onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(buildingId);
            }}
        >
            <span aria-hidden="true">{active ? "♥" : "♡"}</span>
            {label && <span className="favorite-button-label">{label}</span>}
        </button>
    );
};

export default FavoriteButton;
