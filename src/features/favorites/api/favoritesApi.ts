import { apiClient as api } from "../../../shared/api/apiClient";
import type { PropertyItem } from "../../search/api/searchApi";

// FEATURE_11_FAVORITES.md §4. 등록 시점 등급·ROI는 서버가 investment_result에서 읽어 저장한다 —
// 프론트가 보내지 않는다(화면 값이 낡았을 수 있어서). 목록의 매물 정보는 F-04 items[] 스키마 그대로다.
// 매물 정보는 F-04 PropertyResponse를 그대로 품고 있다 — 카드 컴포넌트를 그대로 재사용한다.
// 배치에서 사라진 건물은 목록에서 지우지 않고 property가 null로 내려온다(§3.2) — 그 행은 카드로 그리지 않고
// "더 이상 조회할 수 없는 건물"로 표시하고 해제만 가능하게 한다.
export interface FavoriteRow {
    // property가 null이어도 해제(DELETE)가 가능하도록 backend가 top-level로 항상 내려준다.
    buildingId: string;
    property: PropertyItem | null;
    gradeAtSave: string | null;
    roiAtSave: number | null;
    savedAt: string;
}

export interface FavoriteListResponse {
    items: FavoriteRow[];
    totalCount: number;
    page: number;
    size: number;
    totalPages: number;
}

const authHeader = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const fetchFavoriteIds = async (token: string): Promise<string[]> => {
    const response = await api.get<string[]>("/api/v1/favorites/ids", authHeader(token));
    return response.data;
};

export const fetchFavorites = async (token: string, page = 1, size = 5): Promise<FavoriteListResponse> => {
    const response = await api.get<FavoriteListResponse>("/api/v1/favorites", {
        ...authHeader(token),
        params: { page, size },
    });
    return response.data;
};

export const addFavorite = async (token: string, buildingId: string): Promise<void> => {
    await api.post("/api/v1/favorites", { buildingId }, authHeader(token));
};

// 해제는 멱등이라 이미 빠진 건물을 다시 해제해도 에러가 아니다.
export const removeFavorite = async (token: string, buildingId: string): Promise<void> => {
    await api.delete(`/api/v1/favorites/${buildingId}`, authHeader(token));
};
