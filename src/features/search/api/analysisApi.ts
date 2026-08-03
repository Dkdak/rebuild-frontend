import { apiClient } from "../../../shared/api/apiClient";
import type { RemodelingAnalysis } from "./remodelingApi";
import type { MarketAnalysis } from "./marketApi";
import type { CostEstimation } from "./costApi";

// FEATURE_05_PROPERTY_INFO.md §2.1: remodeling/market/grade/roi 통합 조회 — 기존에 따로 부르던
// getRemodelingAnalysis/getMarketAnalysis를 이 API 하나로 대체(2026-08-1x, 백엔드 구현 완료).
// grade/roi는 investment_result 스파이크 더미데이터가 아니라 이 응답의 실제 계산값 — RightPanel 개요 카드가 이번에 처음 연동.
// 배치(주기적 재실행) 결과라 updatedAt 기준 "최근 갱신" 라벨 필수 표시.
export type InvestmentGrade = "A_PLUS" | "A" | "B_PLUS" | "B" | "C" | "D";

export const GRADE_LABEL: Record<InvestmentGrade, string> = {
    A_PLUS: "A+",
    A: "A",
    B_PLUS: "B+",
    B: "B",
    C: "C",
    D: "D",
};

export interface PropertyAnalysis {
    grade: InvestmentGrade;
    roi: number;
    remodeling: RemodelingAnalysis;
    // 공사비 카드는 F-10 "수익 분석"으로 이동 예정이라 이 화면(F-05)에서는 아직 쓰지 않는다(costApi.ts 참고).
    cost: CostEstimation;
    market: MarketAnalysis;
    updatedAt: string;
}

// "2026-08-03T17:36:26" → "2026-08-03" — "최근 갱신" 라벨용(배치 결과, 실시간 값 아님을 알리는 목적).
export const formatUpdatedAt = (updatedAt: string): string => updatedAt.split("T")[0];

// buildingId(=bdrg_sn)가 building 테이블에 없으면 백엔드가 404 — apiClient 호출부에서 catch해 null 처리(market/remodelingApi.ts와 동일 패턴).
export const getPropertyAnalysis = async (buildingId: string): Promise<PropertyAnalysis | null> => {
    try {
        const response = await apiClient.get<PropertyAnalysis>(`/api/v1/properties/${buildingId}/analysis`);
        return response.data;
    } catch (error) {
        if (typeof error === "object" && error != null && "response" in error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 404) return null;
        }
        throw error;
    }
};
