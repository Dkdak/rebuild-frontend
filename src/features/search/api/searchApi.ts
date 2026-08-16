import { apiClient } from "../../../shared/api/apiClient";
import type { RemodelingVerdict } from "../../remodeling/api/remodelingApi";
import type { EstimatedPrice } from "../../market/api/marketApi";

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
    // 2026-08-10 — 백엔드가 이 리스트 응답에서 recentTrade 필드 자체를 제거(매매 가능 건물의 11.5%에만 존재할
    // 정도로 커버리지가 희박하고, 카드 3번째 줄도 이미 estimatedPrice를 쓰고 있어 리스트에서는 안 쓰이고
    // 있었다는 근거). F-05 RightPanel.tsx "최근 실거래가" 행은 buildingApi.ts BuildingDetail.recentTrade
    // (건물 단건 조회, 이 API는 영향 없음)로 소스를 옮겼다 — 아래 참고.
    // 카드 2줄(등급+리모델링 가능여부 배지, 2026-08-1x 3줄 재정리) — F-06 verdict 그대로(실측 확인, 새 계산 없음).
    remodelingVerdict: RemodelingVerdict | null;
    // FEATURE_04_SEARCH.md §2.1-h item 5(2026-08-09 백엔드 구현 완료) — F-08 `.../market` 응답의 estimatedPrice와
    // 완전히 같은 모양(investment_result.market_basis에서 추가 계산 없이 그대로 꺼냄). 카드 3번째 줄이 recentTrade
    // 대신 이 값을 쓰는 이유: 단독다가구·상업업무용 등은 recentTrade 자체가 없거나, 매칭돼도 건물 전체 대비 작은
    // 호실 하나 거래가 "건물 전체가 이 가격"처럼 보이는 착시가 있었다(㎡당가×건물전체면적인 estimatedPrice는
    // 전 유형 공통으로 스케일이 맞아 이 착시가 안 생긴다).
    estimatedPrice: EstimatedPrice;
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
// grade(§2.1-g, 리스트 헤더 등급 배지)는 investment_result 실제 계산값 기준으로 필터링됨(§3.1, 2026-08-02 구현 완료 —
// F-09 스파이크 단계 지나 실계산으로 전환, 상세 화면과 동일 테이블 사용은 analysisApi.ts 참고).
// price/roi/nearSubway/sort는 1차 데이터에 대응 필드가 없어 아직 미구현 — 전달하지 않는다.
export const searchProperties = async (query: PropertySearchQuery): Promise<PropertySearchResponse> => {
    const response = await apiClient.post<PropertySearchResponse>("/api/v1/properties/search", query);
    return response.data;
};

// ===== 매물 카드 면적 표시 (F-04_SEARCH.md §2.1-e) =====

// 아파트·연립다세대는 area가 세대당 추정 면적(gfa/hh_cnt)이라 전용/공급면적으로 오인되지 않게 "추정" 표시가 항상 필요하다.
// F-05 "단지 정보" 카드(공동주택 매물만 노출, FEATURE_17_BUILDING_SUMMARY_MIGRATION.md §3.3)도 같은 기준을 쓴다.
export const ESTIMATED_AREA_TYPES = ["아파트", "연립다세대"];

export interface AreaDisplay {
    main: string;
    aux: string | null;
}

// main: 카드 메인 표시값(area). 유형이 세대당 추정 대상이면 "약 84㎡(추정)"처럼 라벨을 붙인다(§2.1-e).
// aux: 보조 표시값(totalBuildingArea) — main과 다를 때만("세대당 추정" 유형) 채워진다.
// 1평 = 3.305785㎡(정확한 환산값) — RightPanel.tsx의 sqmToPyeong·AreaRangeControl.tsx의 PYEONG_TO_SQM과 동일
// 상수로 통일(2026-08-1x, 검색 카드 면적에도 평수 병기 요청).
const SQM_PER_PYEONG = 3.305785;
const withPyeong = (sqm: number): string => `${sqm.toLocaleString()}㎡(${Math.round(sqm / SQM_PER_PYEONG).toLocaleString()}평)`;

export const formatAreaDisplay = (item: PropertyItem): AreaDisplay => {
    if (item.area == null) {
        return { main: "면적 정보 없음", aux: null };
    }
    const isEstimated = item.propertyType != null && ESTIMATED_AREA_TYPES.includes(item.propertyType);
    const main = isEstimated
        ? `약 ${item.area.toLocaleString()}㎡(${Math.round(item.area / SQM_PER_PYEONG).toLocaleString()}평, 추정)`
        : withPyeong(item.area);
    const aux =
        item.totalBuildingArea != null && item.totalBuildingArea !== item.area
            ? `건물 전체 ${withPyeong(item.totalBuildingArea)}`
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

// FEATURE_08_MARKET.md/FEATURE_10_AI_REPORT.md 공통 확정(2026-08-1x) — 금액 표시 전역 통일. 이전엔 formatManwon
// ("N억 M,MMM만원", 만원 입력)과 formatEok("N.NN억", 만원 입력, F-10 좁은 칸 전용)가 서로 다른 규칙을 써서
// 화면마다 표기가 갈렸다("검색카드/F-05/F-08/F-10 전체를 공용 포맷터 하나로 통일" 요청) — formatCurrency(원
// 입력) 하나를 단일 출처로 두고, 만원 단위 값을 쓰는 기존 소비처를 위해 formatManwon을 그 위의 얇은 래퍼로만
// 남긴다. 2026-08-17 표기 정정(`docs/CONTENT_TAXONOMY.md` §2 "A. 값" 규칙 — 금액=억 소수1자리+천단위) —
// 억 단위에 자릿수 구분 쉼표가 없고 소수 둘째자리("1317.84억")까지 나오던 것을 소수 첫째자리+쉼표
// ("1,317.8억")로 통일. 규칙: 1억 이상이면 소수 첫째자리+천단위 쉼표 억, 미만이면 반올림 정수 만원("601만원").
// 예시: 131,784,000,000원 → "1,317.8억", 6,009,000원 → "601만원". 음수(예상 차익 손실 케이스)는 절댓값
// 기준으로 억/만원 분기하되 부호는 그대로 살린다(toLocaleString이 음수 부호를 자동으로 유지) — 사용자가 준
// 스니펫엔 없던 처리지만, 리포트에서 음수 금액이 실제로 나오므로("-4.5억" 등) 반드시 필요하다.
export const formatCurrency = (won: number): string => {
    const eok = won / 100_000_000;
    if (Math.abs(eok) >= 1) return `${eok.toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억`;
    return `${Math.round(won / 10_000).toLocaleString()}만원`;
};

// 기존 만원 단위 소비처(recentTrade.price, market.estimatedPrice.value 등 "만원 단위" 관례를 따르는 값들)가
// 호출부를 안 바꿔도 되도록 얇게 감싼 래퍼 — 원 단위 값(예: 토지당 가격, cost API)은 formatManwon을 거치지
// 말고 formatCurrency를 직접 쓴다.
export const formatManwon = (manwon: number): string => formatCurrency(manwon * 10_000);

// building(동 단위)과 trade(호실/유닛 단위)는 단위가 달라 매칭이 정확해도 "건물 전체가 이 가격에 팔렸다"는
// 착시가 생길 수 있다(DOMAIN.md §5.1, 을지로6가 실측 사례 — 연면적 23,658㎡ 건물에 3.77㎡ 호실 거래가 매칭). V1 대응:
// trade.area를 항상 같이 표시하고, 건물 전체 면적(totalBuildingArea) 대비 20% 미만이면 "건물 일부 거래" 플래그.
// 2026-08-10: buildProfitAnalysis(analysisApi.ts)의 baseValue 산정도 같은 기준으로 recentTrade.price를
// 건너뛰어야 해서 export — 두 곳이 각자 다른 기준으로 "일부 거래"를 판정하면 한쪽만 경고하고 다른 쪽은 그
// 값을 그대로 계산에 쓰는 불일치가 생긴다.
export const PARTIAL_TRADE_AREA_RATIO = 0.2;

export interface RecentTradeDisplay {
    text: string;
    isPartial: boolean;
}

// recentTrade가 null(매칭 안 됨)이면 그 필드만 생략 — 별도 안내 문구 없음(§2.1-h item 5 그대로).
// 날짜는 "년/월"을 명시적으로 풀어쓴다("2024년 10월") — "2024.10"처럼 점 표기는 연도인지 월인지 한눈에 안 들어와 혼동됨(2026-08-08 피드백).
export const formatRecentTrade = (
    recentTrade: RecentTrade | null,
    totalBuildingArea: number | null,
    propertyType: string | null
): RecentTradeDisplay | null => {
    if (recentTrade == null || recentTrade.price == null) return null;
    const priceText = formatManwon(recentTrade.price);
    const [year, month] = recentTrade.contractDate?.split("-") ?? [];
    const dateText = year && month ? `${year}년 ${Number(month)}월` : null;
    const areaText = recentTrade.area != null ? `${recentTrade.area}㎡` : null;
    const detail = [areaText, dateText].filter(Boolean).join(", ");
    const text = detail ? `최근 실거래 ${priceText} (${detail})` : `최근 실거래 ${priceText}`;
    // 아파트·연립다세대는 세대 여러 개가 건물 하나를 나눠 쓰므로 "거래 1건 = 세대 1개"가 정상이라, 거래 면적이
    // 건물 전체 대비 작은 게 당연하다 — 이 유형은 착시 경고 대상이 아니다(ESTIMATED_AREA_TYPES와 동일 기준).
    const isMultiUnitType = propertyType != null && ESTIMATED_AREA_TYPES.includes(propertyType);
    const isPartial =
        !isMultiUnitType &&
        recentTrade.area != null &&
        totalBuildingArea != null &&
        totalBuildingArea > 0
            ? recentTrade.area / totalBuildingArea < PARTIAL_TRADE_AREA_RATIO
            : false;
    return { text, isPartial };
};

// ===== 리스트 헤더 등급 배지 (F-04_SEARCH.md §2.1-g) =====

// 배지는 등급 내림차순 고정(A 최상단) — 백엔드 gradeSummary 배열 순서를 신뢰하지 않고 프론트에서 정렬한다.
// 2026-08-1x: 6단계(A+/A/B+/B/C/D) → 4단계(A/B/C/D)+NA로 재편(FEATURE_09_INVESTMENT.md 확정, 백엔드 배포 완료
// 후 실측) — 키를 "정보부족"(한글 번역)으로 잘못 넣었었는데, 실제 GET .../search 응답은 grade/gradeSummary
// 둘 다 raw 코드 "NA"를 그대로 보낸다(다른 등급도 "A"/"B" 등 raw, 번역 안 함 — 실측 확인). "NA"는 성능 등급이
// 아니라 데이터 부족 케이스라 5번째(맨 끝)에 둔다.
const GRADE_ORDER = ["A", "B", "C", "D", "NA"];

export const sortGradeSummary = (gradeSummary: GradeSummaryItem[]): GradeSummaryItem[] =>
    [...gradeSummary].sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));

// .grade-A 등(layout.css) 배경색 클래스 — ResultList(리스트 배지)·RightPanel(상세 개요) 공용.
export const GRADE_CLASS: Record<string, string> = {
    A: "grade-A",
    B: "grade-B",
    C: "grade-C",
    D: "grade-D",
    NA: "grade-NA",
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
