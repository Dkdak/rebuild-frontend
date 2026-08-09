import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
    searchProperties,
    type PropertySearchResponse,
    type SearchFilters,
    type SearchIndexCandidate,
} from "../api/searchApi";

const PAGE_SIZE = 5;

// 건축연도 기본값 "20년 이상 경과"(§0-C) — 원래 백엔드가 buildYearMin/Max 둘 다 없을 때(null,null) 암묵적으로 적용했으나,
// 화면엔 "전체"로 보이는데 실제론 필터가 걸려있어 헷갈린다는 문제로 백엔드 쪽 암묵 처리는 제거하고 프론트가 명시적으로 기본값을 갖는다.
const DEFAULT_BUILD_YEAR_MAX = new Date().getFullYear() - 20;

export const DEFAULT_FILTERS: SearchFilters = {
    propertyTypeFilters: [],
    buildYearMin: null,
    buildYearMax: DEFAULT_BUILD_YEAR_MAX,
    nearSubway: false,
};

// 위치 기본값(§0-C, 2026-08-03) — 백엔드가 더 이상 위치 미지정을 중구로 암묵 보정하지 않아, 프론트가 검색창 초기값으로 GU(구) 후보를 직접 갖는다.
// bjdongCd 필드에 sigunguCd(서울특별시 중구, "11140")를 담아 보낸다 — search_index의 GU 타입 응답과 동일한 형태(§3.1).
export const DEFAULT_LOCATION_CANDIDATE: SearchIndexCandidate = {
    type: "GU",
    buildingId: null,
    bjdongCd: "11140",
    displayText: "서울특별시 중구",
    lat: null,
    lng: null,
};

interface MapCenter {
    lat: number;
    lng: number;
}

// 현재 활성 검색 방식 — goToPage/selectGradeFilter에서 "무엇을 다시 조회해야 하는지" 판단 기준.
type ActiveQuery =
    | { mode: "filters" }
    | { mode: "building"; buildingId: string }
    | { mode: "dong"; bjdongCd: string }
    | { mode: "gu"; sigunguCd: string }
    | null;

interface SearchContextValue {
    filters: SearchFilters;
    updateFilters: (filters: SearchFilters) => void;
    searchResults: PropertySearchResponse | null;
    mapCenter: MapCenter | null;
    selectedPropertyId: string | null;
    selectProperty: (id: string | null) => void;
    sortOption: string;
    setSortOption: (sort: string) => void;
    gradeFilter: string | null;
    selectGradeFilter: (grade: string | null) => void;
    page: number;
    totalPages: number;
    hasNextPage: boolean;
    goToPage: (page: number) => void;
    loading: boolean;
    runFilterSearch: () => void;
    runAddressSearch: (candidate: SearchIndexCandidate) => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

const average = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

// 좌표가 없는 매물(null)은 평균 계산에서 제외한다 — 안 그러면 평균이 엉뚱한 값으로 튄다.
const computeMapCenter = (items: { lat: number | null; lng: number | null }[]): MapCenter | null => {
    const coords = items.filter(
        (item): item is { lat: number; lng: number } => item.lat != null && item.lng != null
    );
    if (coords.length === 0) return null;
    return {
        lat: average(coords.map((item) => item.lat)),
        lng: average(coords.map((item) => item.lng)),
    };
};

// buildYearMin/Max·propertyTypeFilters·grade를 쿼리 파라미터로 변환 — null/빈 배열은 axios가 생략하도록 undefined로 바꾼다.
// propertyTypeFilters 미선택 시 "전체"로 간주(§2.4)하므로 빈 배열은 보내지 않는다. expanded는 UI 전용이라 전송하지 않는다(§2.3).
// grade(§2.1-g)는 filters와 독립적으로 함께 적용(AND) — filters를 초기화하지 않는다.
const toFilterParams = (filters: SearchFilters, grade: string | null) => ({
    buildYearMin: filters.buildYearMin ?? undefined,
    buildYearMax: filters.buildYearMax ?? undefined,
    propertyTypeFilters:
        filters.propertyTypeFilters.length > 0
            ? filters.propertyTypeFilters.map((f) => ({
                  type: f.type,
                  areaMin: f.areaMin ?? undefined,
                  areaMax: f.areaMax ?? undefined,
              }))
            : undefined,
    grade: grade ?? undefined,
});

// F-04_SEARCH.md §2.3: filters/searchResults/mapCenter/selectedPropertyId/sortOption/gradeFilter/page를
// LeftPanel·KakaoMap·ResultList·RightPanel이 공유하는 상태.
export const SearchProvider = ({ children }: { children: ReactNode }) => {
    const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
    const [searchResults, setSearchResults] = useState<PropertySearchResponse | null>(null);
    const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
    const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState("grade-desc");
    const [gradeFilter, setGradeFilter] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    // 재조회(페이지 이동·등급 필터)에만 필요한 값 — 화면에 직접 반영되지 않으므로 ref로 관리.
    const activeQueryRef = useRef<ActiveQuery>(null);
    const appliedFiltersRef = useRef<SearchFilters>(DEFAULT_FILTERS);

    // 조건 필터 검색 — 위치 미지정 시 백엔드가 중구로 기본 제한한다(§0-C). LeftPanel 액션이 새 기준 결과라 등급 필터는 "전체"로 리셋된다(§2.3).
    const runFilterSearch = () => {
        activeQueryRef.current = { mode: "filters" };
        appliedFiltersRef.current = filters;
        setPage(1);
        setSelectedPropertyId(null);
        setGradeFilter(null);
        setLoading(true);

        searchProperties({ ...toFilterParams(filters, null), page: 1, size: PAGE_SIZE })
            .then((response) => {
                setSearchResults(response);
                // 2026-08-1x 사용자 피드백 — 검색 결과가 나오면 항상 리스트 첫 번째 행이 선택된 채로
                // 상세정보(RightPanel)가 바로 보이게 한다. 결과 없으면 null 그대로.
                setSelectedPropertyId(response.items[0]?.id ?? null);
            })
            .finally(() => setLoading(false));
    };

    // 주소/지역 검색 — 필터를 초기화하지 않고 위치 조건과 결합해서 같이 적용한다(§2.3, 2026-07-27 계약 변경).
    // LeftPanel 액션(후보 선택)도 새 기준 결과이므로 등급 필터는 "전체"로 리셋된다(§2.3, 2026-08-01).
    const runAddressSearch = async (candidate: SearchIndexCandidate) => {
        appliedFiltersRef.current = filters;
        setPage(1);
        setGradeFilter(null);
        setLoading(true);

        try {
            if (candidate.type === "BUILDING" && candidate.buildingId) {
                activeQueryRef.current = { mode: "building", buildingId: candidate.buildingId };
                const response = await searchProperties({
                    buildingId: candidate.buildingId,
                    ...toFilterParams(filters, null),
                    page: 1,
                    size: 1,
                });
                setSearchResults(response);
                setSelectedPropertyId(response.items[0]?.id ?? null);

                if (candidate.lat != null && candidate.lng != null) {
                    setMapCenter({ lat: candidate.lat, lng: candidate.lng });
                } else {
                    setMapCenter(computeMapCenter(response.items));
                }
            } else if (candidate.type === "DONG" && candidate.bjdongCd) {
                activeQueryRef.current = { mode: "dong", bjdongCd: candidate.bjdongCd };
                const response = await searchProperties({
                    bjdongCd: candidate.bjdongCd,
                    ...toFilterParams(filters, null),
                    page: 1,
                    size: PAGE_SIZE,
                });
                setSearchResults(response);
                // 2026-08-1x — 검색 결과가 나오면 항상 첫 행이 선택된 채로 상세정보가 보이게 한다(아래 GU도 동일).
                setSelectedPropertyId(response.items[0]?.id ?? null);
                // mapCenter는 참고용 상태로 유지하되(§2.3), 실제 화면 범위는 KakaoMap이 마커 기준으로 자동 맞춘다(fit bounds).
                setMapCenter(computeMapCenter(response.items));
            } else if (candidate.type === "GU" && candidate.bjdongCd) {
                // GU 후보는 bjdongCd 필드에 sigunguCd를 재사용해서 담아온다(§3.1) — DONG과 조회 흐름은 동일하고 파라미터 이름만 다르다.
                activeQueryRef.current = { mode: "gu", sigunguCd: candidate.bjdongCd };
                const response = await searchProperties({
                    sigunguCd: candidate.bjdongCd,
                    ...toFilterParams(filters, null),
                    page: 1,
                    size: PAGE_SIZE,
                });
                setSearchResults(response);
                setSelectedPropertyId(response.items[0]?.id ?? null);
                setMapCenter(computeMapCenter(response.items));
            }
        } finally {
            setLoading(false);
        }
    };

    // 페이지 이동·등급 필터 토글 공용 재조회 — grade는 상태 타이밍 문제를 피하려 인자로 명시적으로 받는다.
    // 2026-08-1x: 재조회로 새 결과가 나올 때도 첫 행을 선택 상태로 — 페이지를 넘기거나 등급 필터를 바꿔도
    // 상세정보(RightPanel)가 항상 그 페이지 첫 매물을 보여준다(선택 없이 텅 빈 상태로 남지 않게).
    const refetch = async (nextPage: number, grade: string | null) => {
        const query = activeQueryRef.current;
        if (!query || query.mode === "building") return; // building 모드는 결과가 항상 1건이라 페이지/등급 필터가 없다.

        setPage(nextPage);
        setLoading(true);
        try {
            if (query.mode === "filters") {
                const response = await searchProperties({
                    ...toFilterParams(appliedFiltersRef.current, grade),
                    page: nextPage,
                    size: PAGE_SIZE,
                });
                setSearchResults(response);
                setSelectedPropertyId(response.items[0]?.id ?? null);
            } else if (query.mode === "dong") {
                const response = await searchProperties({
                    bjdongCd: query.bjdongCd,
                    ...toFilterParams(appliedFiltersRef.current, grade),
                    page: nextPage,
                    size: PAGE_SIZE,
                });
                setSearchResults(response);
                setSelectedPropertyId(response.items[0]?.id ?? null);
                setMapCenter(computeMapCenter(response.items));
            } else {
                const response = await searchProperties({
                    sigunguCd: query.sigunguCd,
                    ...toFilterParams(appliedFiltersRef.current, grade),
                    page: nextPage,
                    size: PAGE_SIZE,
                });
                setSearchResults(response);
                setSelectedPropertyId(response.items[0]?.id ?? null);
                setMapCenter(computeMapCenter(response.items));
            }
        } finally {
            setLoading(false);
        }
    };

    const goToPage = (nextPage: number) => {
        if (nextPage < 1) return;
        refetch(nextPage, gradeFilter);
    };

    // 등급 배지 클릭(§2.1-g, 2026-08-01 "전체" 칩 추가) — 클릭한 값을 그대로 선택(토글 아님), "전체"(null) 클릭으로 필터 해제 통일.
    // 위치·조건(filters)에는 영향 없음 — 지금 결과 위에서만 등급으로 좁히거나 푼다(§2.3).
    const selectGradeFilter = (grade: string | null) => {
        setGradeFilter(grade);
        refetch(1, grade);
    };

    const totalPages = searchResults?.totalPages ?? 1;
    const hasNextPage = searchResults != null && page < totalPages;

    return (
        <SearchContext.Provider
            value={{
                filters,
                updateFilters: setFilters,
                searchResults,
                mapCenter,
                selectedPropertyId,
                selectProperty: setSelectedPropertyId,
                sortOption,
                setSortOption,
                gradeFilter,
                selectGradeFilter,
                page,
                totalPages,
                hasNextPage,
                goToPage,
                loading,
                runFilterSearch,
                runAddressSearch,
            }}
        >
            {children}
        </SearchContext.Provider>
    );
};

export const useSearch = (): SearchContextValue => {
    const context = useContext(SearchContext);
    if (!context) {
        throw new Error("useSearch must be used within a SearchProvider");
    }
    return context;
};
