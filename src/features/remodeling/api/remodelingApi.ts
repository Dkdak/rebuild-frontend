// FEATURE_06_REMODELING.md §3.4: 백엔드 구현 완료(2026-08-08).
export type RemodelingVerdict = "POSSIBLE" | "LIMITED" | "NOT_POSSIBLE";

export interface RemodelingBasis {
    buildingAgeYears: number | null;
    gatePassed: boolean | null;
    gateYears: number | null;
    requiredYears: number | null;
    zoneName: string | null;
    districtNames: string[];
    floorAreaRatioLimit: number | null;
    floorAreaRatioSurplus: number | null;
    additionalBuildableAreaSqm: number | null;
    estimatedAdditionalHouseholds: number | null;
    recentPermitType: string | null;
    recentPermitDate: string | null;
    permitInProgress: boolean | null;
}

export interface RemodelingAnalysis {
    score: number | null;
    verdict: RemodelingVerdict;
    basis: RemodelingBasis;
}

// FEATURE_06_REMODELING.md §3.4 verdict — §2.1 UI 스펙 문구("가능/제한적 가능/불가") 그대로 매핑.
// F-05(RightPanel)·F-10(리포트 요약 페이지) 둘 다 재사용(FEATURE_05_PROPERTY_INFO.md §2.1-c "같은 데이터, 별도로 다시 계산하지 않음").
export const VERDICT_LABEL: Record<RemodelingVerdict, string> = {
    POSSIBLE: "가능",
    LIMITED: "제한적 가능",
    NOT_POSSIBLE: "불가",
};

// FEATURE_06_REMODELING.md §2.1(2026-08-08) "판정 근거 체크리스트" — basis 필드를 그대로 나열하지 않고 ✓/△로 재구성.
export interface RemodelingChecklistItem {
    ok: boolean;
    text: string;
}

export interface RemodelingChecklist {
    aging: RemodelingChecklistItem;
    farSurplus: RemodelingChecklistItem;
    buildable: RemodelingChecklistItem;
    district: RemodelingChecklistItem;
    permit: RemodelingChecklistItem;
}

export const buildRemodelingChecklist = (basis: RemodelingBasis): RemodelingChecklist => {
    const aging: RemodelingChecklistItem =
        basis.buildingAgeYears != null && basis.requiredYears != null
            ? basis.buildingAgeYears >= basis.requiredYears
                ? { ok: true, text: "노후·불량 기준 충족" }
                : { ok: false, text: `노후·불량 기준까지 ${basis.requiredYears - basis.buildingAgeYears}년 부족` }
            : { ok: false, text: "노후도 정보 없음" };

    const farSurplus: RemodelingChecklistItem =
        basis.floorAreaRatioSurplus == null
            ? { ok: false, text: "용적률 여유 정보 없음" }
            : basis.floorAreaRatioSurplus > 0
              ? { ok: true, text: `용적률 여유 ${basis.floorAreaRatioSurplus}%p` }
              : { ok: false, text: "용적률 여유 없음" };

    const buildable: RemodelingChecklistItem =
        basis.additionalBuildableAreaSqm == null
            ? { ok: false, text: "증축 여유 정보 없음" }
            : basis.additionalBuildableAreaSqm > 0
              ? { ok: true, text: `증축 가능 약 ${basis.additionalBuildableAreaSqm}㎡` }
              : { ok: false, text: "증축 여유 없음" };

    const district: RemodelingChecklistItem =
        basis.districtNames.length === 0
            ? { ok: true, text: "지구/구역 규제 없음" }
            : { ok: false, text: `${basis.districtNames.join(", ")} 지정` };

    const permit: RemodelingChecklistItem = !basis.permitInProgress
        ? { ok: true, text: "진행 중인 개발행위 없음" }
        : { ok: false, text: `최근 인허가 진행 중(${basis.recentPermitType ?? "종류 미상"})` };

    return { aging, farSurplus, buildable, district, permit };
};

// verdict 배지 부제: 노후도 > 진행중개발행위 > (용적률·증축·지구규제 중 첫 미충족) 우선순위(§2.1). POSSIBLE은 부제 없음.
export const buildVerdictReason = (verdict: RemodelingVerdict, checklist: RemodelingChecklist): string | null => {
    if (verdict === "POSSIBLE") return null;
    if (!checklist.aging.ok) return checklist.aging.text;
    if (!checklist.permit.ok) return checklist.permit.text;
    if (!checklist.farSurplus.ok) return checklist.farSurplus.text;
    if (!checklist.buildable.ok) return checklist.buildable.text;
    if (!checklist.district.ok) return checklist.district.text;
    return null;
};

export const remodelingChecklistItems = (checklist: RemodelingChecklist): RemodelingChecklistItem[] => [
    checklist.aging,
    checklist.farSurplus,
    checklist.buildable,
    checklist.district,
    checklist.permit,
];
