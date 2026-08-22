import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { fetchFavorites, type FavoriteRow } from "../api/favoritesApi";
import { useFavorites } from "../context/FavoritesContext";

// 관심목록 응답은 KPI 요약과 목록 카드가 함께 쓴다 — 대시보드가 한 번 받아 두 곳에 내려준다(요청 중복 방지).
// 관심목록은 많아야 수백 건이라(F-11 §2.3) 한 번에 받아 화면에서 나눠 쓴다.
const FETCH_SIZE = 200;

export interface FavoriteRowsState {
    rows: FavoriteRow[] | null;
    failed: boolean;
    reload: () => void;
}

export const useFavoriteRows = (): FavoriteRowsState => {
    const { token } = useAuth();
    const { revision } = useFavorites();
    const [rows, setRows] = useState<FavoriteRow[] | null>(null);
    const [failed, setFailed] = useState(false);

    const reload = useCallback(() => {
        if (!token) return;

        fetchFavorites(token, 1, FETCH_SIZE)
            .then((response) => {
                setRows(response.items);
                setFailed(false);
            })
            .catch(() => setFailed(true));
    }, [token]);

    // 담기·해제로 목록이 바뀌면 다시 불러온다(revision이 토글마다 증가한다).
    useEffect(() => {
        reload();
    }, [reload, revision]);

    return { rows, failed, reload };
};
