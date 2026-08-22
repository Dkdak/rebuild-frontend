// 대시보드의 "값이 아닌 것"만 남긴 파일 — 숫자는 전부 집계 API(dashboardApi.ts)에서 온다.
// 여기 있는 건 라벨·설명 문구·차트 색·지도 이동 매핑처럼 배치 결과와 무관한 표시 규칙이다.

// 후보 정의는 F-06 verdict 기준 하나뿐이다(verdict='POSSIBLE' — LIMITED는 노후연한 미도달이라 후보가 아님,
// FEATURE_06_REMODELING.md §47·§53). 노후연한은 단일 숫자가 아니라 용도·구조·층수 조합으로 갈린다(§120~127).
export const CANDIDATE_DEFINITION = {
    label: "추진 요건 충족",
    description: "용도·구조별 노후연한 충족 · 진행 중 개발행위 없음(인허가 허가일 기준)",
};

// 좁히기 필터 — 판정에 들어가지 않아 후보 정의가 아니라 선택 필터다. key는 검색 API 파라미터명과 같다.
export interface NarrowingFilterMeta {
    key: "zoneConfirmed" | "farSurplusPositive" | "districtUnrestricted";
    label: string;
    description: string;
    // 용적률 여유는 용도지역 확인 없이는 계산 자체가 안 된다 — 종속 표시를 달고, 용도지역이 꺼지면 함께 꺼진다.
    dependsOnZone: boolean;
}

export const NARROWING_FILTERS: NarrowingFilterMeta[] = [
    { key: "zoneConfirmed", label: "용도지역 확인됨", description: "토지이용계획 매칭 성공", dependsOnZone: false },
    {
        key: "farSurplusPositive",
        label: "용적률 여유 있음",
        description: "용도지역 확인이 있어야 계산됩니다",
        dependsOnZone: true,
    },
    {
        key: "districtUnrestricted",
        label: "지구·구역 규제 제외",
        description: "지정된 구역 없음",
        dependsOnZone: false,
    },
];

// 등급은 A/B/C/D/NA 5종(FEATURE_09_INVESTMENT.md §3.1) — 순서 척도라 평균을 내지 않고 분포로만 표시한다.
// grade는 검색 API가 쓰는 raw 코드라 지도 이동에 그대로 넘긴다.
export const GRADE_META: Record<string, { label: string; tone: string }> = {
    A: { label: "A", tone: "a" },
    B: { label: "B", tone: "b" },
    C: { label: "C", tone: "c" },
    D: { label: "D", tone: "d" },
    NA: { label: "NA(정보부족)", tone: "na" },
};

// 대장 주용도(usageGroup) → 화면 라벨·차트 색·지도 검색 유형.
// propertyTypes는 대장 주용도와 검색 6종이 같은 집합일 때만 채운다(backend PropertyTypeClassifier 기준) —
// 단독주택=SINGLE_FAMILY 하나, 공동주택은 지상 5층 기준으로 아파트/연립다세대로 갈려 둘 다 넣어야 한다.
// 근생은 COMMERCIAL이 업무·판매·숙박시설까지 포함해 지도 결과가 더 넓어지므로 이동하지 않는다.
// 오피스텔은 building에 구분 필드가 없어 분류 자체가 불가능하다(FEATURE_08_MARKET.md §5.1).
export const BUILDING_TYPE_META: Record<string, { label: string; tone: string; propertyTypes: string[] | null }> = {
    단독주택: { label: "단독주택", tone: "u1", propertyTypes: ["단독다가구"] },
    제1종근린생활시설: { label: "제1종근생", tone: "u4", propertyTypes: null },
    공동주택: { label: "공동주택", tone: "u2", propertyTypes: ["아파트", "연립다세대"] },
    제2종근린생활시설: { label: "제2종근생", tone: "u3", propertyTypes: null },
    기타: { label: "기타", tone: "u5", propertyTypes: null },
};

export const ROI_BUCKET_LABELS = [
    { key: "ltNeg10", label: "-10% 미만", negative: true },
    { key: "neg10To0", label: "-10~0%", negative: true },
    { key: "pos0To10", label: "0~10%", negative: false },
    { key: "pos10To20", label: "10~20%", negative: false },
    { key: "pos20To30", label: "20~30%", negative: false },
    { key: "ge30", label: "30% 이상", negative: false },
] as const;

// 20년 미만 구간이 0인 것 자체가 정보(노후연한 기준이 용도·구조에 따라 최소 20년)라 구간을 지우지 않는다.
export const AGING_BUCKET_LABELS = [
    { key: "lt10", label: "10년 미만", negative: false },
    { key: "age10To20", label: "10~20년", negative: false },
    { key: "age20To30", label: "20~30년", negative: false },
    { key: "age30To40", label: "30~40년", negative: true },
    { key: "ge40", label: "40년 이상", negative: true },
] as const;

export const formatCount = (value: number) => value.toLocaleString("ko-KR");
