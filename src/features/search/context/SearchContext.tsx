import { createContext, useContext, useState, type ReactNode } from "react";
import {
    searchProperties,
    type AddressCandidate,
    type PropertySearchResponse,
    type SearchFilters,
} from "../api/searchApi";

const PAGE_SIZE = 5;

export const DEFAULT_FILTERS: SearchFilters = {
    propertyTypes: [],
    buildYearMin: null,
    buildYearMax: null,
    areaMin: null,
    areaMax: null,
    nearSubway: false,
};

interface MapCenter {
    lat: number;
    lng: number;
}

interface SearchContextValue {
    filters: SearchFilters;
    updateFilters: (filters: SearchFilters) => void;
    searchResults: PropertySearchResponse | null;
    mapCenter: MapCenter | null;
    selectedPropertyId: number | null;
    selectProperty: (id: number | null) => void;
    sortOption: string;
    setSortOption: (sort: string) => void;
    page: number;
    goToPage: (page: number) => void;
    loading: boolean;
    runFilterSearch: () => void;
    runAddressSearch: (candidate: AddressCandidate) => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

// F-04_SEARCH.md §2.3: filters/searchResults/mapCenter/selectedPropertyId/sortOption/page를
// LeftPanel·KakaoMap·ResultList·RightPanel이 공유하는 상태.
export const SearchProvider = ({ children }: { children: ReactNode }) => {
    const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
    const [activeQuery, setActiveQuery] = useState<MapCenter | null>(null);
    const [searchResults, setSearchResults] = useState<PropertySearchResponse | null>(null);
    const [mapCenter, setMapCenter] = useState<MapCenter | null>(null);
    const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
    const [sortOption, setSortOptionState] = useState("grade-desc");
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);

    const runSearch = async (
        query: MapCenter | null,
        filtersSnapshot: SearchFilters,
        sort: string,
        pageNum: number
    ) => {
        setLoading(true);
        try {
            const response = await searchProperties({
                filters: query ? undefined : filtersSnapshot,
                lat: query?.lat,
                lng: query?.lng,
                sort,
                page: pageNum,
                size: PAGE_SIZE,
            });
            setSearchResults(response);
        } finally {
            setLoading(false);
        }
    };

    // 조건 필터 검색 — 주소 검색과 상호 배타적이며, mapCenter는 바꾸지 않는다 (§2.3).
    const runFilterSearch = () => {
        setActiveQuery(null);
        setAppliedFilters(filters);
        setPage(0);
        setSelectedPropertyId(null);
        runSearch(null, filters, sortOption, 0);
    };

    // 주소 검색 — 필터를 초기화하고, mapCenter를 해당 좌표로 이동시킨다 (§1.2).
    const runAddressSearch = async (candidate: AddressCandidate) => {
        setFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
        const query = { lat: candidate.lat, lng: candidate.lng };
        setActiveQuery(query);
        setMapCenter(query);
        setPage(0);

        setLoading(true);
        try {
            const response = await searchProperties({
                lat: candidate.lat,
                lng: candidate.lng,
                sort: sortOption,
                page: 0,
                size: PAGE_SIZE,
            });
            setSearchResults(response);
            const exactMatch = response.items.find((item) => item.address === candidate.address);
            setSelectedPropertyId(exactMatch ? exactMatch.id : null);
        } finally {
            setLoading(false);
        }
    };

    const goToPage = (nextPage: number) => {
        if (nextPage < 0) return;
        setPage(nextPage);
        runSearch(activeQuery, appliedFilters, sortOption, nextPage);
    };

    const setSortOption = (sort: string) => {
        setSortOptionState(sort);
        setPage(0);
        runSearch(activeQuery, appliedFilters, sort, 0);
    };

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
                page,
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
