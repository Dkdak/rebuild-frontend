import { apiClient } from "../../../shared/api/apiClient";

// 대시보드 집계 — 배치가 만든 스냅샷 최신 행을 그대로 읽어온다(실시간 계산 아님). 인증 불필요.
// 스냅샷이 아직 없으면 404이고, 이건 오류가 아니라 "배치 미실행" 상태다.
const CANDIDATE_STATS_URL = "/api/v1/dashboard/candidate-stats";

export interface DashboardFunnel {
    totalBuilding: number;
    analysisTarget: number;
    candidates: number;
    narrowed3: number;
    undeterminedZone: number;
}

// 좁히기 3개의 조합별 집계. 각 행은 "세 플래그가 정확히 그 조합인 후보"의 건수·지역·분포를 모두 들고 있다.
// 용적률 여유는 용도지역 확인에 종속돼(용도지역 없이는 계산 자체가 안 됨) zoneConfirmed=false·
// farSurplusPositive=true 조합은 응답에 아예 없다 — 그래서 8종이 아니라 6종이다.
export interface FilterCombination {
    zoneConfirmed: boolean;
    farSurplusPositive: boolean;
    districtUnrestricted: boolean;
    count: number;
    districts: DashboardDistrict[];
    distributions: DashboardDistributions;
}

// 선택 상태별 사전 계산값 — 합산으로 만들 수 없는 통계(평균·중위·평균 연식)를 backend가 미리 내려준다.
// 여기의 boolean|null은 combinations의 boolean과 의미가 다르다: null은 "그 체크박스가 꺼져 제약이 없음"이고,
// combinations의 false는 "그 플래그가 false인 건물"이라는 분할 키다.
export interface SelectionStat {
    zoneConfirmed: boolean | null;
    farSurplusPositive: boolean | null;
    districtUnrestricted: boolean | null;
    count: number;
    roiAvg: number | null;
    roiMedian: number | null;
    agingAvgAge: number | null;
}

export interface DashboardFilters {
    zoneConfirmedCount: number;
    farSurplusPositiveCount: number;
    districtUnrestrictedCount: number;
    candidateTotal: number;
    combinations: FilterCombination[];
    selections: SelectionStat[] | null;
}

export interface DashboardDistrict {
    sggName: string;
    sigunguCd: string;
    count: number;
    pct: number;
}

export interface DashboardGradeSlice {
    grade: string;
    count: number;
    pct: number;
}

export interface DashboardRoi {
    ltNeg10: number;
    neg10To0: number;
    pos0To10: number;
    pos10To20: number;
    pos20To30: number;
    ge30: number;
    notCalculable: number;
    population: number;
    avg: number;
    median: number;
}

export interface DashboardBuildingTypeSlice {
    usageGroup: string;
    count: number;
    pct: number;
}

export interface DashboardAging {
    lt10: number;
    age10To20: number;
    age20To30: number;
    age30To40: number;
    ge40: number;
    avgAge: number;
    pctGe30: number;
    pctGe40: number;
    population: number;
}

export interface DashboardDataStatus {
    lastBatchRun: string;
    tradeLatestContractDate: string;
    permitLatestDate: string;
    matching: {
        tradeBuildingMatched: number;
        tradeBuildingTotal: number;
        permitMatched: number;
        permitTotal: number;
        landuseMatched: number;
        landuseTotal: number;
    };
}

export interface DashboardDistributions {
    grade: DashboardGradeSlice[];
    roi: DashboardRoi;
    buildingType: DashboardBuildingTypeSlice[];
    aging: DashboardAging;
}

export interface DashboardStats {
    computedAt: string;
    funnel: DashboardFunnel;
    filters: DashboardFilters;
    dataStatus: DashboardDataStatus;
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>(CANDIDATE_STATS_URL);
    return response.data;
};

// 대시보드 진입 시 기본 선택 — 좁히기 3개를 모두 적용한 집단이 후보 화면의 기본 관점이다.
export const ALL_NARROWING_ON: NarrowingSelection = {
    zoneConfirmed: true,
    farSurplusPositive: true,
    districtUnrestricted: true,
};

export interface NarrowingSelection {
    zoneConfirmed: boolean;
    farSurplusPositive: boolean;
    districtUnrestricted: boolean;
}

// combinations는 서로 겹치지 않는 분할이다 — 각 행은 "세 플래그가 정확히 그 조합인 후보"의 건수·지역·분포를
// 들고 있고, 여섯 행의 합이 후보 총계(candidateTotal)와 같다. 따라서 "체크한 조건만 적용"은 체크한 플래그가
// true인 행들을 더한 값이다(체크 해제 = 그 조건 미적용이지 false 강제가 아니다). 검색 API totalCount와
// 일치하는 것을 실측 확인했다: 전부 해제 341,614 / 용도지역+지구·구역 94,792 / 3개 모두 89,077.
const matchingCombinations = (combinations: FilterCombination[], selection: NarrowingSelection) =>
    combinations.filter(
        (combination) =>
            (!selection.zoneConfirmed || combination.zoneConfirmed) &&
            (!selection.farSurplusPositive || combination.farSurplusPositive) &&
            (!selection.districtUnrestricted || combination.districtUnrestricted),
    );

const toPct = (count: number, total: number) => (total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0);

const sumBy = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((sum, row) => sum + pick(row), 0);

// 평균·중위·평균연식은 분할을 더해서 만들 수 없어(건수가 아니라 값의 통계) backend가 선택 상태별로 미리
// 계산해 내려주는 filters.selections에서 읽는다. 그 값이 없으면 null로 두고 화면이 숫자를 지어내지 않게 한다.
export interface SelectionStats {
    count: number;
    districts: DashboardDistrict[];
    grade: DashboardGradeSlice[];
    buildingType: DashboardBuildingTypeSlice[];
    roi: Omit<DashboardRoi, "avg" | "median"> & { avg: number | null; median: number | null };
    aging: Omit<DashboardAging, "avgAge"> & { avgAge: number | null };
}

// 체크된 축은 true, 꺼진 축은 null로 매칭한다(위 SelectionStat 주석 참고).
const findSelectionStat = (selections: SelectionStat[] | null, selection: NarrowingSelection) =>
    selections?.find(
        (row) =>
            row.zoneConfirmed === (selection.zoneConfirmed ? true : null) &&
            row.farSurplusPositive === (selection.farSurplusPositive ? true : null) &&
            row.districtUnrestricted === (selection.districtUnrestricted ? true : null),
    ) ?? null;

export const aggregateSelection = (
    filters: DashboardFilters,
    selection: NarrowingSelection,
): SelectionStats => {
    const combinations = filters.combinations;
    const rows = matchingCombinations(combinations, selection);
    const count = sumBy(rows, (row) => row.count);
    const precomputed = findSelectionStat(filters.selections, selection);

    const districtTotals = new Map<string, DashboardDistrict>();
    rows.forEach((row) =>
        row.districts.forEach((district) => {
            const current = districtTotals.get(district.sigunguCd);
            districtTotals.set(district.sigunguCd, {
                ...district,
                count: (current?.count ?? 0) + district.count,
                pct: 0,
            });
        }),
    );
    const districts = [...districtTotals.values()]
        .map((district) => ({ ...district, pct: toPct(district.count, count) }))
        .sort((a, b) => b.count - a.count);

    const gradeTotals = new Map<string, number>();
    const typeTotals = new Map<string, number>();
    rows.forEach((row) => {
        row.distributions.grade.forEach((slice) =>
            gradeTotals.set(slice.grade, (gradeTotals.get(slice.grade) ?? 0) + slice.count),
        );
        row.distributions.buildingType.forEach((slice) =>
            typeTotals.set(slice.usageGroup, (typeTotals.get(slice.usageGroup) ?? 0) + slice.count),
        );
    });

    const roiPopulation = sumBy(rows, (row) => row.distributions.roi.population);
    const agingPopulation = sumBy(rows, (row) => row.distributions.aging.population);
    const ge40 = sumBy(rows, (row) => row.distributions.aging.ge40);
    const age30To40 = sumBy(rows, (row) => row.distributions.aging.age30To40);

    return {
        count,
        districts,
        grade: [...gradeTotals.entries()].map(([grade, gradeCount]) => ({
            grade,
            count: gradeCount,
            pct: toPct(gradeCount, count),
        })),
        buildingType: [...typeTotals.entries()]
            .map(([usageGroup, typeCount]) => ({
                usageGroup,
                count: typeCount,
                pct: toPct(typeCount, count),
            }))
            .sort((a, b) => b.count - a.count),
        roi: {
            ltNeg10: sumBy(rows, (row) => row.distributions.roi.ltNeg10),
            neg10To0: sumBy(rows, (row) => row.distributions.roi.neg10To0),
            pos0To10: sumBy(rows, (row) => row.distributions.roi.pos0To10),
            pos10To20: sumBy(rows, (row) => row.distributions.roi.pos10To20),
            pos20To30: sumBy(rows, (row) => row.distributions.roi.pos20To30),
            ge30: sumBy(rows, (row) => row.distributions.roi.ge30),
            notCalculable: sumBy(rows, (row) => row.distributions.roi.notCalculable),
            population: roiPopulation,
            avg: precomputed?.roiAvg ?? null,
            median: precomputed?.roiMedian ?? null,
        },
        aging: {
            lt10: sumBy(rows, (row) => row.distributions.aging.lt10),
            age10To20: sumBy(rows, (row) => row.distributions.aging.age10To20),
            age20To30: sumBy(rows, (row) => row.distributions.aging.age20To30),
            age30To40,
            ge40,
            population: agingPopulation,
            // 구간 합에서 그대로 나오는 비율이라 정확값이다(평균 연식과 달리 원본 값이 필요 없다).
            pctGe30: toPct(age30To40 + ge40, agingPopulation),
            pctGe40: toPct(ge40, agingPopulation),
            avgAge: precomputed?.agingAvgAge ?? null,
        },
    };
};

export const formatComputedAt = (isoDateTime: string) => isoDateTime.slice(0, 10);
