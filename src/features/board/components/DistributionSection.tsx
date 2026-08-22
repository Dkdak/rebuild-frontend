import CardSubHeading from "../../../shared/components/CardSubHeading";
import BarStat from "./BarStat";
import DonutStat from "./DonutStat";
import type { SelectionStats } from "../api/dashboardApi";
import {
    AGING_BUCKET_LABELS,
    BUILDING_TYPE_META,
    formatCount,
    GRADE_META,
    ROI_BUCKET_LABELS,
} from "../data/dashboardStats";

// 모집단은 카드마다 다르다 — 등급·유형·노후도는 좁히기 3개를 모두 적용한 집단, ROI는 그중 산출 가능한 건만.
// 값은 배치가 낸 그대로 표시하고 대시보드에서 보정하지 않는다.
// 투자등급·건물 유형만 지도 탭 진입점이다. ROI 구간은 SearchFilters에 범위 필드가 없고(F-04 §5.1 미구현),
// 노후도는 기본 필터(경과 연차)와 구간 이동이 충돌해 V1에서 제외 — 두 카드는 hover 효과도 주지 않는다.
interface DistributionSectionProps {
    selected: SelectionStats;
    selectionLabel: string;
    onSelectGrade: (grade: string) => void;
    onSelectBuildingType: (propertyTypes: string[]) => void;
}

// 모집단은 선택한 좁히기 조합을 따른다 — 조합을 바꾸면 카드 제목의 모집단 라벨도 함께 바뀐다.
// 평균·중위·평균연식은 합산할 수 없어 backend가 선택 상태별로 미리 계산한 값(filters.selections)을 쓴다.
const DistributionSection = ({
    selected,
    selectionLabel,
    onSelectGrade,
    onSelectBuildingType,
}: DistributionSectionProps) => {
    const distributions = selected;
    const narrowedTotal = selected.count;
    const basis = `${selectionLabel} ${formatCount(narrowedTotal)}동 기준`;

    const gradeSegments = distributions.grade.map((slice) => ({
        label: GRADE_META[slice.grade]?.label ?? slice.grade,
        count: slice.count,
        ratio: slice.pct,
        tone: GRADE_META[slice.grade]?.tone ?? "na",
    }));
    const gradeCodeByLabel = new Map(
        distributions.grade.map((slice) => [GRADE_META[slice.grade]?.label ?? slice.grade, slice.grade]),
    );

    const typeSegments = distributions.buildingType.map((slice) => ({
        label: BUILDING_TYPE_META[slice.usageGroup]?.label ?? slice.usageGroup,
        count: slice.count,
        ratio: slice.pct,
        tone: BUILDING_TYPE_META[slice.usageGroup]?.tone ?? "u5",
    }));
    const propertyTypesByLabel = new Map(
        distributions.buildingType.map((slice) => [
            BUILDING_TYPE_META[slice.usageGroup]?.label ?? slice.usageGroup,
            BUILDING_TYPE_META[slice.usageGroup]?.propertyTypes ?? null,
        ]),
    );

    const roiItems = ROI_BUCKET_LABELS.map((bucket) => ({
        label: bucket.label,
        count: distributions.roi[bucket.key],
        negative: bucket.negative,
    }));
    const agingItems = AGING_BUCKET_LABELS.map((bucket) => ({
        label: bucket.label,
        count: distributions.aging[bucket.key],
        negative: bucket.negative,
    }));

    const topGrade = [...distributions.grade].sort((a, b) => b.count - a.count)[0];

    return (
        <div className="dashboard-dist-grid">
            <section className="dashboard-card">
                <CardSubHeading number={4} title="투자등급" />
                <p className="dashboard-card-note">{basis}</p>
                <DonutStat
                    total={narrowedTotal}
                    unit="동"
                    segments={gradeSegments}
                    onSelectSegment={(segment) => onSelectGrade(gradeCodeByLabel.get(segment.label) ?? segment.label)}
                    selectHint={(segment) => `지도에서 ${segment.label} 등급 매물 보기`}
                />
                <p className="dashboard-note">
                    등급을 누르면 지도 탭에서 그 등급으로 좁혀 봅니다.{" "}
                    {topGrade && (
                        <b>
                            이 집단의 {topGrade.pct}%가 {GRADE_META[topGrade.grade]?.label ?? topGrade.grade}
                            등급입니다.
                        </b>
                    )}{" "}
                    후보는 물리적 조건을 통과했다는 뜻이지 투자등급이 높다는 뜻이 아닙니다.
                </p>
            </section>

            <section className="dashboard-card">
                <CardSubHeading number={5} title="예상 ROI" />
                <p className="dashboard-card-note">
                    산출 가능 {formatCount(distributions.roi.population)}동 기준
                </p>
                <BarStat items={roiItems} />
                <div className="dashboard-statline">
                    <span>
                        평균 <b>{distributions.roi.avg != null ? `${distributions.roi.avg}%` : "—"}</b>
                    </span>
                    <span>
                        중위{" "}
                        <b className={distributions.roi.median != null ? "is-negative" : undefined}>
                            {distributions.roi.median != null ? `${distributions.roi.median}%` : "—"}
                        </b>
                    </span>
                    <span>
                        산출 불가 <b>{formatCount(distributions.roi.notCalculable)}동</b>
                    </span>
                </div>
                <p className="dashboard-note">
                    <b>평균과 중위의 부호가 다릅니다.</b> 소수의 큰 양수가 평균을 끌어올린 것이라 평균만 보면 안
                    됩니다.
                </p>
            </section>

            <section className="dashboard-card">
                <CardSubHeading number={6} title="건물 유형" />
                <p className="dashboard-card-note">{basis}</p>
                <DonutStat
                    total={narrowedTotal}
                    unit="동"
                    segments={typeSegments}
                    isSelectable={(segment) => propertyTypesByLabel.get(segment.label) != null}
                    onSelectSegment={(segment) => {
                        const propertyTypes = propertyTypesByLabel.get(segment.label);
                        if (propertyTypes) onSelectBuildingType(propertyTypes);
                    }}
                    selectHint={(segment) => `지도에서 ${segment.label} 매물 보기`}
                />
                <p className="dashboard-note">
                    단독주택·공동주택만 지도 탭으로 이어집니다. 근린생활시설은 검색 유형(상업업무용)이 업무·판매·
                    숙박시설까지 포함해 대시보드 건수보다 넓은 결과가 나와 이동하지 않습니다.
                    <b> 오피스텔은 별도 분류가 불가능합니다</b> — 건축물대장에 구분 필드가 없습니다.
                </p>
            </section>

            <section className="dashboard-card">
                <CardSubHeading number={7} title="노후도" />
                <p className="dashboard-card-note">건축연수 기준 · {basis}</p>
                <BarStat items={agingItems} />
                <div className="dashboard-statline">
                    <span>
                        평균 <b>{distributions.aging.avgAge != null ? `${distributions.aging.avgAge}년` : "—"}</b>
                    </span>
                    <span>
                        30년 이상 <b>{distributions.aging.pctGe30}%</b>
                    </span>
                    <span>
                        40년 이상 <b>{distributions.aging.pctGe40}%</b>
                    </span>
                </div>
                <p className="dashboard-note">
                    <b>20년 미만 구간은 0입니다.</b> 노후연한 기준이 용도·구조에 따라 최소 20년이라, 그보다 새
                    건물은 후보가 될 수 없습니다. 20~30년 {formatCount(distributions.aging.age20To30)}동은 공동주택
                    기준(20년)이 적용된 건물입니다.
                </p>
            </section>
        </div>
    );
};

export default DistributionSection;
