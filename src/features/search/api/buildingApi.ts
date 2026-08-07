import { apiClient } from "../../../shared/api/apiClient";

// FEATURE_05_PROPERTY_INFO.md §2.1 "건물정보" 카드 전용 상세 재조회 — 리스트 검색(PropertyItem) 캐시를 재사용하지
// 않고 매물 선택 시 market/remodeling과 같은 방식으로 별도 호출한다(2026-08-08, 백엔드 신규 API).
export interface BuildingDetail {
    siteArea: number | null;
    grossFloorArea: number | null;
    groundFloors: number | null;
    undergroundFloors: number | null; // 지하 층수 — F-10 §2.1-b "지상 N층·지하 M층 분리" 표시용(2026-08-1x)
    buildingCoverageRatio: number | null;
    coverageRatioLimit: number | null; // 건폐율 법정상한(%) — floorAreaRatioLimit(F-06 basis)의 짝, zoning_limit 재사용(2026-08-1x)
    floorAreaRatio: number | null;
    householdCount: number | null;
    useApprovalDate: string | null;
    structureNm: string | null;
    mainUsageNm: string | null;
    // F-10 "기본 정보" 섹션용 7개 필드(2026-08-1x 추가, 건축물대장 표제부 원본 그대로) — F-05 RightPanel
    // "건물정보" 카드는 기존 필드 그대로 유지, 이 7개는 BasicInfoPage.tsx에서만 쓴다(사용자 확인).
    roofNm: string | null; // 지붕구조
    elevatorCount: number | null; // 승강기 수(승용+비상용 합산) — F-17 "단지 정보"의 단지 전체 집계와는 다른, 이 건물 자체 값
    seismicDesignYn: string | null; // 내진설계 적용 여부 — 원본 코드값 그대로("1"=적용 확인됨, 나머지 값은 미확인)
    seismicCapacity: string | null; // 내진 성능 — 원본에 빈 문자열("")로 오는 경우 있음, "정보 없음"과 동일 취급
    auxiliaryBuildingCount: number | null; // 부속건축물 동수 — 이 건물(지번) 소속 별동(창고·경비실 등), F-17 "단지 정보"의 동수(주건축물수)와는 다른 값
    auxiliaryBuildingArea: number | null; // 부속건축물 면적
    parkingCount: number | null; // 주차대수(옥내외 기계식+자주식 4종 합산, 법정 대수는 데이터 없음 — 실제 대수만)
    // FEATURE_10_AI_REPORT.md §2.1-a 대지 도면 — 실측 확인 결과 이미 값이 내려온다(GeoJSON Polygon 문자열,
    // 2026-08-1x). 사용자 요청은 "지금은 자리만"이라 타입만 맞춰두고 BasicInfoPage에서 렌더링하지 않는다.
    sitePolygon: string | null;
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
export const formatSeismicDesign = (yn: string | null): string => (yn === "1" ? "적용" : "정보 없음");
