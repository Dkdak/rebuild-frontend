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

// 2026-08-10 전면 교체(F-06 문구 확정분, FEATURE_06_REMODELING.md §2.1 + FEATURE_10_AI_REPORT.md §2.4) —
// "종합 판정"(→ "리모델링 추진 요건 판정") 카드에 verdict별로 고정 노출하는 안내 문단. 매물별로 계산되는
// buildVerdictReason(아래, "노후·불량 기준까지 N년 부족" 같은 구체적 사유)과는 다른 층위 — 이건 verdict 값
// 자체에 대한 고정 설명이라 매물 데이터와 무관하게 항상 같다. POSSIBLE도 이제 문단이 있다(기존엔 null이라
// 렌더링 안 함 — RemodelingAnalysisPage.tsx의 verdict 3종 [배지+헤드라인+문단] 구조 통일에 맞춰 정정).
export const VERDICT_REASON_PARAGRAPH: Record<RemodelingVerdict, string> = {
    POSSIBLE:
        "노후연한 기준을 충족하고, 진행 중인 개발행위도 확인되지 않았습니다. 사업성이나 인허가 승인 가능성을 판단한 결과는 아닙니다.",
    LIMITED:
        "노후연한 기준에 아직 도달하지 않아 현재 시점에서는 추진이 어렵습니다. 연한 도달 이후 다시 검토할 수 있으나, 용적률 여유 등 다른 조건은 별도 확인이 필요합니다.",
    NOT_POSSIBLE:
        "현재 확인된 데이터 기준으로는 리모델링 추진 요건을 충족하지 않습니다. 실제 추진 가능 여부는 관할 행정기관과 전문가의 확인이 필요합니다.",
};

// 2026-08-10 정정("프론트에 전달할 내용") — verdict 배지 아래 붙는 작은 서브라벨. LIMITED만 값이 있고 나머지는
// null(렌더링 안 함) — "가능/불가"는 그 자체로 결론이 분명해 별도 서브라벨이 필요 없다는 의미로 보임.
export const VERDICT_SUBLABEL: Record<RemodelingVerdict, string | null> = {
    POSSIBLE: null,
    LIMITED: "조건부 검토",
    NOT_POSSIBLE: null,
};

// 2026-08-17 신규(§확정분) — 판정 카드 재구성: 기존 VERDICT_REASON_PARAGRAPH(전체 문단)는 "결론" 카드로
// 이동하고, 판정 카드 자체엔 헤드라인 바로 아래 짧은 한 줄만 남긴다. VERDICT_REASON_PARAGRAPH와 같은 성격
// (verdict 값 자체에 대한 고정 설명, 매물 데이터 무관) — 다만 훨씬 짧게 압축.
export const VERDICT_SHORT_NOTE: Record<RemodelingVerdict, string> = {
    POSSIBLE: "사업성·인허가 승인 여부는 별도 판단 사항",
    LIMITED: "연한 도달 후 재검토 가능 · 경과연수 기준(실측 아님)",
    NOT_POSSIBLE: "행정기관·전문가 확인 필요",
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

    // 2026-08-12 표기 정정 — 원본 값을 그대로 문자열에 꽂아 "505.17%p"처럼 소수점이 그대로 노출됐다(백엔드가
    // 이미 소수점까지 계산해 내려주는 값) — 반올림 + "약" 접두로 통일(정밀한 값이 아니라 참고용 수치임을 표시).
    const farSurplus: RemodelingChecklistItem =
        basis.floorAreaRatioSurplus == null
            ? { ok: false, text: "용적률 여유 정보 없음" }
            : basis.floorAreaRatioSurplus > 0
              ? { ok: true, text: `용적률 여유 약 ${Math.round(basis.floorAreaRatioSurplus)}%p` }
              : { ok: false, text: "용적률 여유 없음" };

    // 2026-08-12 표기 정정 — 천단위 구분 쉼표 없이 "2301㎡"처럼 붙어 나오던 것 → toLocaleString(). 2026-08-17
    // 추가 정정 — toLocaleString()만으로는 소수점이 그대로 남아 "5,447.63㎡"처럼 어중간했다(위 farSurplus와
    // 같은 "약" 접두 참고용 수치인데 소수점만 남아있던 불일치) — Math.round까지 같이 적용해 "약 5,448㎡"로.
    const buildable: RemodelingChecklistItem =
        basis.additionalBuildableAreaSqm == null
            ? { ok: false, text: "증축 여유 정보 없음" }
            : basis.additionalBuildableAreaSqm > 0
              ? { ok: true, text: `증축 가능 약 ${Math.round(basis.additionalBuildableAreaSqm).toLocaleString()}㎡` }
              : { ok: false, text: "증축 여유 없음" };

    // 2026-08-10 정정(F-06 문구 확정분) — "지구/구역 규제 없음" → "확인된 지구/구역 지정 없음"(districtNames
    // 빈 배열일 때 전부 이 기준).
    const district: RemodelingChecklistItem =
        basis.districtNames.length === 0
            ? { ok: true, text: "확인된 지구/구역 지정 없음" }
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
