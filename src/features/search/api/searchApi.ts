import { apiClient } from "../../../shared/api/apiClient";

// ===== 실제 백엔드 연동 (F-04_SEARCH.md §3.1) =====

export type SearchIndexCandidateType = "BUILDING" | "DONG" | "GU";

export interface SearchIndexCandidate {
    type: SearchIndexCandidateType;
    buildingId: string | null;
    // GU 타입은 별도 필드 없이 이 필드에 sigunguCd(5자리 시군구 코드)를 재사용해서 내려준다(백엔드 계약, 2026-08-03).
    bjdongCd: string | null;
    displayText: string;
    lat: number | null;
    lng: number | null;
}

// F-04_SEARCH.md §2.1-h item 5(2026-08-07 구현 완료) — 건물의 가장 최근 실거래 1건(해제 제외). price는 만원 단위,
// 매칭 안 된 건물(주로 상업업무용·공장창고 마스킹 지번)은 recentTrade 자체가 null.
export interface RecentTrade {
    price: number | null;
    area: number | null;
    contractDate: string | null;
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
    recentTrade: RecentTrade | null;
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

// 주소/지역 통합 검색 — search_index를 pg_trgm 인덱스로 조회. 후보 타입은 BUILDING(건물)/DONG(법정동)/GU(자치구, 2026-08-03 추가) 세 가지.
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
    sigunguCd?: string;
    buildYearMin?: number;
    buildYearMax?: number;
    propertyTypeFilters?: { type: string; areaMin?: number; areaMax?: number }[];
    grade?: string;
    page?: number;
    size?: number;
}

// buildingId/bjdongCd/sigunguCd는 서로 동시 전달 불가(위치 지정 방식 하나만) — 세 개 다 없으면 백엔드가 400(§0-C, §3.2, 2026-08-03).
// 위치 기본값(중구)·건축연도 기본값(20년 이상)은 더 이상 백엔드가 암묵 처리하지 않는다 — 프론트가 직접 관리(SearchContext의 DEFAULT_FILTERS/DEFAULT_LOCATION_CANDIDATE).
// propertyTypeFilters([{type,areaMin,areaMax}], §2.1-a·§3.1)는 유형별로 면적을 따로 적용 — 비어있으면 유형/면적 제한 없음.
// grade(§2.1-g, 리스트 헤더 등급 배지)는 investment_result 스파이크 더미데이터 기준으로 실제 필터링됨(§3.1, 2026-08-02 구현 완료).
// price/roi/nearSubway/sort는 1차 데이터에 대응 필드가 없어 아직 미구현 — 전달하지 않는다.
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

// ===== 최근 실거래가 (F-04_SEARCH.md §2.1-h item 5) =====

// 만원 단위 원본 → "3억 5,000만원" 형식(1억=10,000만원). 매물 상세가 아니라 카드용 요약이라 억 단위로 뭉뚱그리지 않는다.
const formatManwon = (manwon: number): string => {
    const eok = Math.floor(manwon / 10000);
    const rest = Math.round(manwon % 10000);
    if (eok === 0) return `${rest.toLocaleString()}만원`;
    if (rest === 0) return `${eok}억`;
    return `${eok}억 ${rest.toLocaleString()}만원`;
};

// recentTrade가 null(매칭 안 됨)이면 그 필드만 생략 — 별도 안내 문구 없음(§2.1-h item 5 그대로).
// 날짜는 "년/월"을 명시적으로 풀어쓴다("2024년 10월") — "2024.10"처럼 점 표기는 연도인지 월인지 한눈에 안 들어와 혼동됨(2026-08-08 피드백).
export const formatRecentTrade = (recentTrade: RecentTrade | null): string | null => {
    if (recentTrade == null || recentTrade.price == null) return null;
    const priceText = formatManwon(recentTrade.price);
    const [year, month] = recentTrade.contractDate?.split("-") ?? [];
    const dateText = year && month ? `${year}년 ${Number(month)}월` : null;
    return dateText ? `최근 실거래 ${priceText} (${dateText})` : `최근 실거래 ${priceText}`;
};

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
