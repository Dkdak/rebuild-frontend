import { apiClient } from "../../../shared/api/apiClient";
import type { RecentTrade } from "../../search/api/searchApi";

// FEATURE_05_PROPERTY_INFO.md §2.1 "건물정보" 카드 전용 상세 재조회 — 리스트 검색(PropertyItem) 캐시를 재사용하지
// 않고 매물 선택 시 market/remodeling과 같은 방식으로 별도 호출한다(2026-08-08, 백엔드 신규 API).
export interface BuildingDetail {
    siteArea: number | null;
    grossFloorArea: number | null;
    groundFloors: number | null; // F-05 RightPanel·F-10 BasicInfoPage 둘 다 "지상 N층·지하 M층" 분리 표시에 사용(2026-08-1x, §2.1)
    undergroundFloors: number | null; // 지하 층수 — 위와 짝
    buildingCoverageRatio: number | null;
    coverageRatioLimit: number | null; // 건폐율 법정상한(%) — F-05·F-10 둘 다 "값% / 법정상한 값%"로 병기(2026-08-1x, §2.1)
    floorAreaRatio: number | null;
    householdCount: number | null;
    useApprovalDate: string | null;
    structureNm: string | null;
    mainUsageNm: string | null;
    // F-10 "기본 정보" 3단 레이아웃 전용 5개 필드(2026-08-1x 추가, 건축물대장 표제부 원본 그대로) — F-05 RightPanel
    // "건물정보" 카드 스펙(§2.1)엔 없어 BasicInfoPage.tsx에서만 쓴다.
    roofNm: string | null; // 지붕구조
    elevatorCount: number | null; // 승강기 수(승용+비상용 합산) — F-17 "단지 정보"의 단지 전체 집계와는 다른, 이 건물 자체 값
    seismicDesignYn: string | null; // 내진설계 적용 여부 — 원본 코드값 그대로("1"=적용 확인됨, 나머지 값은 미확인)
    seismicCapacity: string | null; // 내진 성능 — 원본에 빈 문자열("")로 오는 경우 있음, "정보 없음"과 동일 취급
    auxiliaryBuildingCount: number | null; // 부속건축물 동수 — 이 건물(지번) 소속 별동(창고·경비실 등), F-17 "단지 정보"의 동수(주건축물수)와는 다른 값
    auxiliaryBuildingArea: number | null; // 부속건축물 면적
    parkingCount: number | null; // 주차대수(옥내외 기계식+자주식 4종 합산, 법정 대수는 데이터 없음 — 실제 대수만)
    // 건물 외곽선(GeoJSON Polygon 문자열, 화면 라벨 "건축물 도면") — F-05 RightPanel "건물정보"·F-10 BasicInfoPage
    // 둘 다 SitePolygonDiagram.tsx로 렌더링(2026-08-1x, §2.1 "대지 도면 흡수"). building_gis_mapping 미매칭이면 null.
    sitePolygon: string | null;
    // 대지 경계(GeoJSON Polygon 문자열, 화면 라벨 "대지 도면", 2026-08-09 백엔드 배포) — sitePolygon과 같은
    // 포맷이지만 별도 매칭 배치 결과라 독립적으로 null일 수 있다(실측 확인). SitePolygonDiagram.tsx가
    // sitePolygon과 겹쳐 그린다.
    siteBoundaryPolygon: string | null;
    // 2026-08-10 — 백엔드가 목록 검색(PropertyItem) 응답에서 recentTrade를 뺐다(커버리지 11.5%로 희박,
    // 카드에서도 안 쓰임). 이 건물 단건 조회 API는 영향 없이 그대로 내려준다 — F-05 RightPanel.tsx "최근
    // 실거래가" 행이 여기로 소스를 옮겨왔다(기존 PropertyItem.recentTrade는 삭제됨, searchApi.ts 참고).
    recentTrade: RecentTrade | null;
}

// buildingId(=bdrg_sn)가 building 테이블에 없으면 백엔드가 404 — apiClient 호출부에서 catch해 null 처리(market/remodelingApi.ts와 동일 패턴).
export const getBuildingDetail = async (buildingId: string): Promise<BuildingDetail | null> => {
    try {
        const response = await apiClient.get<BuildingDetail>(`/api/v1/properties/${buildingId}`);
        return response.data;
    } catch (error) {
        if (typeof error === "object" && error != null && "response" in error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 404) return null;
        }
        throw error;
    }
};

// useApprovalDate("YYYY-MM-DD")를 "YYYY년 M월 D일"로 — formatRecentTrade의 "년/월" 표기 관례를 일자까지 확장.
export const formatUseApprovalDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split("-");
    return year && month && day ? `${year}년 ${Number(month)}월 ${Number(day)}일` : null;
};

// seismicDesignYn 원본 코드값 → 표시 문구. 실측으로 "1"(적용) 확인됨 — 그 외 값(0/null 등)은 전부 "미확인" 취급하고
// "미적용"으로 단정하지 않는다(DOMAIN.md §4, "0"에 해당하는 실제 응답을 아직 확인 못 함).
// 2026-08-17 — BasicInfoPage.tsx 결측 표기 통일("정보 준비 중"/"정보 없음" 전부 "확인되지 않음")에 맞춰 교체.
// 현재 이 함수의 유일한 소비처가 BasicInfoPage.tsx라 다른 화면에 영향 없음(F-05 RightPanel은 미사용).
export const formatSeismicDesign = (yn: string | null): string => (yn === "1" ? "적용" : "확인되지 않음");
