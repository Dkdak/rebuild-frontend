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
    totalBuildingArea: number | null;
    householdCount: number | null;
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
    grade?: string;
    page?: number;
    size?: number;
}

// buildingId/bjdongCd는 동시 전달 불가하며, 둘 다 없으면 위치 기본값 중구가 적용된다(§0-C).
// buildYearMin/Max(둘 다 없으면 20년 이상 경과 기본값 §0-C)는 위치 조건과 결합해서 같이 적용된다(§2.3).
// propertyTypeFilters([{type,areaMin,areaMax}], §2.1-a·§3.1)는 유형별로 면적을 따로 적용 — 비어있으면 유형/면적 제한 없음.
// grade(§2.1-g, 리스트 헤더 등급 배지)는 1차엔 전 항목 grade:null이라 실질적으로 항상 0건.
// price/roi/nearSubway/sort는 1차 데이터에 대응 필드가 없어 아직 미구현 — 전달하지 않는다.
// ⚠️ 2026-07-28: GET에서 POST+JSON body로 계약 변경됨(GET은 405) — FEATURE_04_SEARCH.md §3.1에 반영된 실제 동작 기준.
export const searchProperties = async (query: PropertySearchQuery): Promise<PropertySearchResponse> => {
    const response = await apiClient.post<PropertySearchResponse>("/api/v1/properties/search", query);
    return response.data;
};

// ===== 매물 카드 면적 표시 (F-04_SEARCH.md §2.1-e) =====

// 아파트·연립다세대는 area가 세대당 추정 면적(gfa/hh_cnt)이라 전용/공급면적으로 오인되지 않게 "추정" 표시가 항상 필요하다.
const ESTIMATED_AREA_TYPES = ["아파트", "연립다세대"];

export interface AreaDisplay {
    main: string;
    aux: string | null;
}

// main: 카드 메인 표시값(area). 유형이 세대당 추정 대상이면 "약 84㎡(추정)"처럼 라벨을 붙인다(§2.1-e).
// aux: 보조 표시값(totalBuildingArea) — main과 다를 때만("세대당 추정" 유형) 채워진다.
export const formatAreaDisplay = (item: PropertyItem): AreaDisplay => {
    if (item.area == null) {
        return { main: "면적 정보 없음", aux: null };
    }
    const isEstimated = item.propertyType != null && ESTIMATED_AREA_TYPES.includes(item.propertyType);
    const main = isEstimated ? `약 ${item.area}㎡(추정)` : `${item.area}㎡`;
    const aux =
        item.totalBuildingArea != null && item.totalBuildingArea !== item.area
            ? `건물 전체 ${item.totalBuildingArea}㎡`
            : null;
    return { main, aux };
};

// 리모델링 투자 판단엔 준공 연도 자체보다 "몇 년 됐는지"가 핵심 신호라, 카드엔 원본 연도 대신 연식("OO년차")을 보여준다(§2.1).
// 연식 계산은 BuildYearFilter.tsx의 yearsToBuildYear(CURRENT_YEAR - years)와 동일한 기준(현재 연도 - 준공 연도)을 쓴다.
export const formatBuildYear = (buildYear: number | null): string => {
    if (buildYear == null) return "준공년도 미확인";
    const age = new Date().getFullYear() - buildYear;
    return `${age}년차`;
};

// 세대수(householdCount)는 아파트·연립다세대만 값이 있고 나머지 유형은 null — 백엔드가 이미 유형별로 걸러서 내려준다.
export const formatHouseholdCount = (householdCount: number | null): string | null =>
    householdCount != null ? `${householdCount.toLocaleString()}세대` : null;

// ===== 리스트 헤더 등급 배지 (F-04_SEARCH.md §2.1-g) =====

// 배지는 등급 내림차순 고정(A+ 최상단) — 백엔드 gradeSummary 배열 순서를 신뢰하지 않고 프론트에서 정렬한다.
const GRADE_ORDER = ["A+", "A", "B+", "B", "C", "D"];

export const sortGradeSummary = (gradeSummary: GradeSummaryItem[]): GradeSummaryItem[] =>
    [...gradeSummary].sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

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
