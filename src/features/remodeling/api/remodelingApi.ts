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

// 2026-08-10 확정("프론트에 전달할 내용") — "종합 판정" 카드에 verdict별로 고정 노출하는 안내 문장. 매물별로
// 계산되는 buildVerdictReason(아래, "노후·불량 기준까지 N년 부족" 같은 구체적 사유)과는 다른 층위 —
// 이건 verdict 값 자체에 대한 고정 설명이라 매물 데이터와 무관하게 항상 같다. POSSIBLE은 null(렌더링 안 함).
// 지금은 RemodelingAnalysisPage.tsx(F-10)만 쓰지만 VERDICT_LABEL과 같은 이유로 여기 둔다(다른 소비처 생기면 재사용).
export const VERDICT_REASON_PARAGRAPH: Record<RemodelingVerdict, string | null> = {
    POSSIBLE: null,
    LIMITED: "현재 시점에서 리모델링 추진은 어려우나, 향후 기준 충족 시 사업 가능성 검토 가치가 있습니다.",
    NOT_POSSIBLE: "법적 요건을 충족하지 못해 현재는 리모델링을 추진할 수 없습니다.",
};

// 2026-08-10 정정("프론트에 전달할 내용") — verdict 배지 아래 붙는 작은 서브라벨. LIMITED만 값이 있고 나머지는
// null(렌더링 안 함) — "가능/불가"는 그 자체로 결론이 분명해 별도 서브라벨이 필요 없다는 의미로 보임.
export const VERDICT_SUBLABEL: Record<RemodelingVerdict, string | null> = {
    POSSIBLE: null,
    LIMITED: "조건부 검토",
    NOT_POSSIBLE: null,
};

// 2026-08-10 확정("프론트에 전달할 내용") — "종합 판정" 카드가 이제 POSSIBLE도 배지+헤드라인을 보여준다.
// buildVerdictReason은 POSSIBLE이면 항상 null(위 §참고, verdict 배지 "부제"용으로 설계돼 있었음)이라 그
// 자리에 쓸 헤드라인이 없다 — POSSIBLE 판정 자체가 "노후·불량 기준 충족" 조건 하나로만 결정되는 값이라
// 항상 성립하는 고정 문구로 대체(새 API 필드 아님, 매물마다 달라지지 않음). buildRemodelingChecklist의
// aging.ok===true 텍스트("노후·불량 기준 충족", 위 70번째 줄 부근)와 우연히 같은 문구지만 별개로 관리 —
// checklist를 거치지 않고 verdict 값만으로 바로 결정하기 위한 명시적 상수.
export const VERDICT_HEADLINE_FALLBACK: Partial<Record<RemodelingVerdict, string>> = {
    POSSIBLE: "노후·불량 기준 충족",
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
