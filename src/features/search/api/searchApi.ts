export interface PropertySearchItem {
    id: number;
    propertyType: string;
    address: string;
    price: number | null;
    area: number;
    buildYear: number;
    lat: number;
    lng: number;
    grade: string | null;
    roi: number | null;
}

export interface GradeSummaryItem {
    grade: string;
    count: number;
    avgRoi: number;
}

export interface PropertySearchResponse {
    items: PropertySearchItem[];
    gradeSummary: GradeSummaryItem[];
    totalCount: number;
    page: number;
    size: number;
}

export interface SearchFilters {
    propertyTypes: string[];
    buildYearMin: number | null;
    buildYearMax: number | null;
    areaMin: number | null;
    areaMax: number | null;
    nearSubway: boolean;
}

export interface AddressCandidate {
    address: string;
    lat: number;
    lng: number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// TODO(F-04): 백엔드 GET /api/v1/properties/search 준비되면 axios 호출로 교체 (docs/features/FEATURE_04_SEARCH.md §3.1 참고)
// 1차 스코프(건축물대장 기반)를 그대로 반영 — price/grade/roi는 null, gradeSummary는 전 등급 0건.
const MOCK_ALL_ITEMS: PropertySearchItem[] = [
    { id: 1, propertyType: "아파트", address: "서울 중구 태평로1가 31", price: null, area: 84, buildYear: 1991, lat: 37.5665, lng: 126.978, grade: null, roi: null },
    { id: 2, propertyType: "다세대주택", address: "서울 마포구 공덕동 256-11", price: null, area: 45, buildYear: 1988, lat: 37.5446, lng: 126.9514, grade: null, roi: null },
    { id: 3, propertyType: "단독주택", address: "서울 성북구 성북동 78-9", price: null, area: 52, buildYear: 1990, lat: 37.5894, lng: 126.9995, grade: null, roi: null },
    { id: 4, propertyType: "아파트", address: "서울 송파구 잠실동 22-7", price: null, area: 59, buildYear: 1992, lat: 37.5133, lng: 127.1001, grade: null, roi: null },
    { id: 5, propertyType: "오피스텔", address: "서울 서초구 반포동 19-3", price: null, area: 38, buildYear: 1987, lat: 37.5048, lng: 127.0021, grade: null, roi: null },
];

const EMPTY_GRADE_SUMMARY: GradeSummaryItem[] = [
    { grade: "A+", count: 0, avgRoi: 0 },
    { grade: "A", count: 0, avgRoi: 0 },
    { grade: "B+", count: 0, avgRoi: 0 },
    { grade: "B", count: 0, avgRoi: 0 },
    { grade: "C", count: 0, avgRoi: 0 },
    { grade: "D", count: 0, avgRoi: 0 },
];

const MOCK_ADDRESS_BOOK: AddressCandidate[] = [
    { address: "서울 중구 태평로1가 31", lat: 37.5665, lng: 126.978 },
    { address: "서울 마포구 공덕동 256-11", lat: 37.5446, lng: 126.9514 },
    { address: "서울 성북구 성북동 78-9", lat: 37.5894, lng: 126.9995 },
    { address: "서울 송파구 잠실동 22-7", lat: 37.5133, lng: 127.1001 },
    { address: "서울 서초구 반포동 19-3", lat: 37.5048, lng: 127.0021 },
    { address: "서울 강남구 역삼동 123-4", lat: 37.5006, lng: 127.0365 },
];

interface SearchOptions {
    filters?: SearchFilters;
    lat?: number;
    lng?: number;
    sort?: string;
    page?: number;
    size?: number;
}

const applyFilters = (items: PropertySearchItem[], filters?: SearchFilters): PropertySearchItem[] => {
    if (!filters) return items;

    return items.filter((item) => {
        if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(item.propertyType)) {
            return false;
        }
        if (filters.buildYearMin != null && item.buildYear < filters.buildYearMin) return false;
        if (filters.buildYearMax != null && item.buildYear > filters.buildYearMax) return false;
        if (filters.areaMin != null && item.area < filters.areaMin) return false;
        if (filters.areaMax != null && item.area > filters.areaMax) return false;
        // nearSubway(역세권)는 1차 mock 데이터에 거리 정보가 없어 필터링에 반영하지 않는다.
        return true;
    });
};

const applySort = (items: PropertySearchItem[], sort?: string): PropertySearchItem[] => {
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

export const searchProperties = async (options: SearchOptions): Promise<PropertySearchResponse> => {
    await delay(400);

    const { filters, lat, lng, sort, page = 0, size = 5 } = options;

    let matched: PropertySearchItem[];
    if (lat != null && lng != null) {
        // 주소 검색 모드: 좌표 기준 반경 1km 이내(mock에서는 좌표 근접순 정렬로 대체)
        matched = [...MOCK_ALL_ITEMS].sort((a, b) => {
            const da = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
            const db = (b.lat - lat) ** 2 + (b.lng - lng) ** 2;
            return da - db;
        });
    } else {
        matched = applyFilters(MOCK_ALL_ITEMS, filters);
    }

    const sorted = applySort(matched, sort);
    const totalCount = sorted.length;
    const pageItems = sorted.slice(page * size, page * size + size);

    return {
        items: pageItems,
        gradeSummary: EMPTY_GRADE_SUMMARY,
        totalCount,
        page,
        size,
    };
};

// TODO(F-04): 백엔드/카카오 로컬 API 연동 준비되면 실제 호출로 교체 (docs/features/FEATURE_04_SEARCH.md §3.1 참고)
export const searchAddress = async (keyword: string): Promise<AddressCandidate[]> => {
    await delay(200);

    if (!keyword.trim()) return [];

    return MOCK_ADDRESS_BOOK.filter((candidate) => candidate.address.includes(keyword));
};
