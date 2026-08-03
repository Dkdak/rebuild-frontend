import { apiClient } from "../../../shared/api/apiClient";

// FEATURE_05_PROPERTY_INFO.md §2.1 "건물정보" 카드 전용 상세 재조회 — 리스트 검색(PropertyItem) 캐시를 재사용하지
// 않고 매물 선택 시 market/remodeling과 같은 방식으로 별도 호출한다(2026-08-08, 백엔드 신규 API).
export interface BuildingDetail {
    siteArea: number | null;
    grossFloorArea: number | null;
    groundFloors: number | null;
    buildingCoverageRatio: number | null;
    floorAreaRatio: number | null;
    householdCount: number | null;
    useApprovalDate: string | null;
    structureNm: string | null;
    mainUsageNm: string | null;
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
