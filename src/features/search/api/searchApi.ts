import { apiClient } from "../../../shared/api/apiClient";

// ===== 실제 백엔드 연동 (F-04_SEARCH.md §3.1) =====

export type SearchIndexCandidateType = "BUILDING" | "DONG";

export interface SearchIndexCandidate {
    type: SearchIndexCandidateType;
    buildingId: string | null;
    bjdongCd: string | null;
    displayText: string;
    lat: number | null;
    lng: number | null;
}

export interface PropertyItem {
    id: string;
    propertyType: string | null;
    address: string;
    price: number | null;
    area: number | null;
    buildYear: number | null;
    lat: number | null;
    lng: number | null;
    grade: string | null;
    roi: number | null;
}

export interface GradeSummaryItem {
    grade: string;
    count: number;
    avgRoi: number | null;
}

export interface PropertySearchResponse {
    items: PropertyItem[];
    gradeSummary: GradeSummaryItem[];
    totalCount: number;
    page: number;
    size: number;
    totalPages: number;
}

// 주소/지역 통합 검색 — search_index를 ILIKE로 조회. 후보 타입은 BUILDING(건물)/DONG(법정동)만 있다.
export const searchAddress = async (keyword: string): Promise<SearchIndexCandidate[]> => {
    if (!keyword.trim()) return [];
    const response = await apiClient.get<SearchIndexCandidate[]>("/api/v1/search-index/search", {
        params: { keyword },
    });
    return response.data;
};

// F-04_SEARCH.md §0-D: 6종 전부 (아파트/연립다세대/단독다가구/오피스텔/상업업무용/공장창고).
export interface PropertyTypeFilter {
    type: string;
    areaMin: number | null;
    areaMax: number | null;
    expanded: boolean;
}

export interface SearchFilters {
    propertyTypeFilters: PropertyTypeFilter[];
    buildYearMin: number | null;
    buildYearMax: number | null;
    nearSubway: boolean;
}

interface PropertySearchQuery {
    buildingId?: string;
    bjdongCd?: string;
    buildYearMin?: number;
    buildYearMax?: number;
    propertyTypeFilters?: { type: string; areaMin?: number; areaMax?: number }[];
    page?: number;
    size?: number;
}

// buildingId/bjdongCd는 동시 전달 불가하며, 둘 다 없으면 위치 기본값 중구가 적용된다(§0-C).
// buildYearMin/Max(둘 다 없으면 20년 이상 경과 기본값 §0-C)는 위치 조건과 결합해서 같이 적용된다(§2.3).
// propertyTypeFilters([{type,areaMin,areaMax}], §2.1-a·§3.1)는 유형별로 면적을 따로 적용 — 비어있으면 유형/면적 제한 없음.
// price/roi/nearSubway/sort는 1차 데이터에 대응 필드가 없어 아직 미구현 — 전달하지 않는다.
// ⚠️ 2026-07-28: GET에서 POST+JSON body로 계약 변경됨(GET은 405) — FEATURE_04_SEARCH.md §3.1에 반영된 실제 동작 기준.
export const searchProperties = async (query: PropertySearchQuery): Promise<PropertySearchResponse> => {
    const response = await apiClient.post<PropertySearchResponse>("/api/v1/properties/search", query);
    return response.data;
};

// ===== 정렬 (클라이언트 사이드) — 백엔드 API에 sort 파라미터가 없어 현재 페이지 결과만 재정렬한다 =====

export const sortPropertyItems = (items: PropertyItem[], sort: string): PropertyItem[] => {
    const sorted = [...items];
    switch (sort) {
        case "price-asc":
            return sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        case "price-desc":
            return sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        case "roi-desc":
            return sorted.sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
        case "grade-desc":
        default:
            return sorted;
    }
};
