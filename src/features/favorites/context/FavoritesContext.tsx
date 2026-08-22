import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { addFavorite, fetchFavoriteIds, removeFavorite } from "../api/favoritesApi";
import "../components/favorites.css";

// FEATURE_11_FAVORITES.md §2.3 — 즐겨찾기 여부는 프론트가 ID 목록(Set)을 들고 카드 렌더링 시 매칭한다.
// 검색 응답에 isFavorited를 넣지 않는 이유는 검색이 게스트도 쓰는 기능이라서다.
// 토글은 낙관적 업데이트(§2.0) — UI를 먼저 바꾸고 실패하면 되돌린 뒤 토스트로 알린다(조용히 실패하지 않는다).
interface FavoritesContextValue {
    favoriteIds: Set<string>;
    favoriteCount: number;
    // 목록 화면이 자기 데이터를 다시 불러올 시점을 알기 위한 값 — 토글될 때마다 증가한다.
    revision: number;
    isFavorited: (buildingId: string) => boolean;
    toggleFavorite: (buildingId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

const EMPTY_IDS: Set<string> = new Set();

interface FavoritesProviderProps {
    children: ReactNode;
    // 비로그인 상태에서 ♥를 누르면 F-01 로그인 모달로 유도한다(§4).
    onRequireLogin: () => void;
}

export const FavoritesProvider = ({ children, onRequireLogin }: FavoritesProviderProps) => {
    const { token } = useAuth();
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
    const [revision, setRevision] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    // 비로그인 상태에서 누른 매물 — 로그인에 성공하면 그 매물을 자동으로 담는다(§4).
    const pendingRef = useRef<string | null>(null);
    // 해제 전에만 확인을 받는다 — 해제는 되돌릴 수 없기 때문이다. 재등록하면 gradeAtSave/roiAtSave가
    // 재등록 시점 값으로 갱신돼(§3.1) "담은 뒤 등급이 떨어졌다"는 기록이 사라진다. 담기는 잘못해도 잃는 게
    // 없어 즉시 반영한다(매번 2클릭이 되면 여러 매물을 빠르게 담는 흐름에 마찰이 생긴다).
    const [confirming, setConfirming] = useState<string | null>(null);

    const applyLocal = (buildingId: string, next: boolean) => {
        setFavoriteIds((previous) => {
            const updated = new Set(previous);
            if (next) {
                updated.add(buildingId);
            } else {
                updated.delete(buildingId);
            }
            return updated;
        });
        setRevision((previous) => previous + 1);
    };

    const commit = useCallback(
        (authToken: string, buildingId: string, next: boolean) => {
            applyLocal(buildingId, next);
            const request = next ? addFavorite(authToken, buildingId) : removeFavorite(authToken, buildingId);
            request.catch(() => {
                applyLocal(buildingId, !next);
                setErrorMessage(next ? "관심목록에 담지 못했습니다." : "관심목록에서 빼지 못했습니다.");
            });
        },
        [],
    );

    // 로그인 시점에 ID 목록을 한 번 받아 Set으로 들고 있는다. 로그아웃 상태에서는 아래 effectiveIds가 빈
    // Set을 내보내므로 여기서 상태를 지우지 않는다(다음 로그인 때 조회 결과로 통째로 교체된다).
    useEffect(() => {
        if (!token) return;

        fetchFavoriteIds(token)
            .then((ids) => {
                setFavoriteIds(new Set(ids));
                const pending = pendingRef.current;
                pendingRef.current = null;
                if (pending && !ids.includes(pending)) {
                    commit(token, pending, true);
                }
            })
            .catch(() => setErrorMessage("관심목록을 불러오지 못했습니다."));
    }, [token, commit]);

    // 비로그인 상태에서는 ♥를 전부 빈 상태로 보여준다(§2.3).
    const effectiveIds = token ? favoriteIds : EMPTY_IDS;

    const value: FavoritesContextValue = {
        favoriteIds: effectiveIds,
        favoriteCount: effectiveIds.size,
        revision,
        isFavorited: (buildingId: string) => effectiveIds.has(buildingId),
        toggleFavorite: (buildingId: string) => {
            if (!token) {
                pendingRef.current = buildingId;
                onRequireLogin();
                return;
            }
            if (effectiveIds.has(buildingId)) {
                setConfirming(buildingId);
                return;
            }
            commit(token, buildingId, true);
        },
    };

    const confirmRemove = () => {
        if (!confirming || !token) return;

        commit(token, confirming, false);
        setConfirming(null);
    };

    return (
        <FavoritesContext.Provider value={value}>
            {children}
            {confirming && (
                <div className="favorite-confirm-backdrop" onClick={() => setConfirming(null)}>
                    <div
                        className="favorite-confirm"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="favorite-confirm-text">이 매물을 관심목록에서 빼시겠습니까?</p>
                        {/* 해제에만 모달을 붙인 이유를 문구로도 남긴다 — 재등록하면 gradeAtSave가 그 시점
                            값으로 갱신돼 "담은 뒤 등급이 떨어졌다"는 기록이 사라진다(§3.1).
                            실측이 있는 매물은 "입력한 내용은 저장한 분석에 그대로 남습니다"가 앞에 붙는데,
                            진행률을 F-19 목록 API에서 받아야 해서 그 분기는 연동 시 추가한다. */}
                        <p className="favorite-confirm-note">
                            다시 담으면 담은 시점 등급 기록이 새로 시작됩니다.
                        </p>
                        <div className="favorite-confirm-actions">
                            <button type="button" onClick={() => setConfirming(null)}>
                                취소
                            </button>
                            <button type="button" className="is-primary" onClick={confirmRemove}>
                                빼기
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {errorMessage && (
                <div className="favorite-toast" role="status">
                    {errorMessage}
                    <button type="button" onClick={() => setErrorMessage("")} aria-label="알림 닫기">
                        ×
                    </button>
                </div>
            )}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = (): FavoritesContextValue => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error("useFavorites must be used within a FavoritesProvider");
    }
    return context;
};
