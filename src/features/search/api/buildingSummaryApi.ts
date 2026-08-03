import { apiClient } from "../../../shared/api/apiClient";

// FEATURE_17_BUILDING_SUMMARY_MIGRATION.md §3.3: 백엔드 구현 완료(2026-08-08).
export interface BuildingSummary {
    householdCount: number | null;
    mainBuildingCount: number | null;
    elevatorPassengerCount: number | null;
    elevatorEmergencyCount: number | null;
}

// buildingId(=bdrg_sn)가 building 테이블에 없으면 백엔드가 404 — marketApi.ts/remodelingApi.ts와 동일 패턴.
export const getBuildingSummary = async (buildingId: string): Promise<BuildingSummary | null> => {
    try {
        const response = await apiClient.get<BuildingSummary>(`/api/v1/properties/${buildingId}/building-summary`);
        return response.data;
    } catch (error) {
        if (typeof error === "object" && error != null && "response" in error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 404) return null;
        }
        throw error;
    }
};
