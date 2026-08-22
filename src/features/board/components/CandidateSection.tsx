import { useState } from "react";
import CardSubHeading from "../../../shared/components/CardSubHeading";
import {
    type DashboardDistrict,
    type DashboardFilters,
    type DashboardFunnel,
    type NarrowingSelection,
    type SelectionStats,
} from "../api/dashboardApi";
import { CANDIDATE_DEFINITION, formatCount, NARROWING_FILTERS } from "../data/dashboardStats";

// 후보 정의(F-06 추진 요건)와 좁히기 필터를 2단으로 나눠 보여준다 — 판정에 들어가지 않는 조건을 후보 정의에
// 넣으면 F-06 상세 화면의 판정과 대시보드 숫자가 서로 다른 말을 하게 된다(FEATURE_06_REMODELING.md §53).
// 좁히기 조합별 건수는 응답의 combinations를 그대로 읽는다 — 프론트에서 계산하지 않는다.
// 자치구 행은 지도 탭 진입점이다(F-01_LAYOUT.md §2.3-b "AI 투자 리포트 보기"와 같은 탭 전환 패턴).
const TOP_DISTRICT_COUNT = 5;

interface CandidateSectionProps {
    funnel: DashboardFunnel;
    filters: DashboardFilters;
    selected: SelectionStats;
    selectionLabel: string;
    selection: NarrowingSelection;
    onToggleNarrowing: (key: keyof NarrowingSelection, checked: boolean) => void;
    onSelectDistrict: (district: DashboardDistrict) => void;
}

const CandidateSection = ({
    funnel,
    filters,
    selected,
    selectionLabel,
    selection,
    onToggleNarrowing,
    onSelectDistrict,
}: CandidateSectionProps) => {
    const singleCounts: Record<keyof NarrowingSelection, number> = {
        zoneConfirmed: filters.zoneConfirmedCount,
        farSurplusPositive: filters.farSurplusPositiveCount,
        districtUnrestricted: filters.districtUnrestrictedCount,
    };

    // "기타 지역"은 나머지를 합친 줄이자 펼치기 버튼이다 — 눌러야 6위 이하 자치구가 나온다.
    const [restExpanded, setRestExpanded] = useState(false);

    // 조합이 바뀌면 순위 자체가 달라질 수 있어 집계된 목록에서 다시 상위 5개를 뽑는다.
    const topDistricts = selected.districts.slice(0, TOP_DISTRICT_COUNT);
    const rest = selected.districts.slice(TOP_DISTRICT_COUNT);
    const restCount = rest.reduce((sum, district) => sum + district.count, 0);
    const restPct = rest.reduce((sum, district) => sum + district.pct, 0);
    const topMax = topDistricts[0]?.count ?? 1;

    const selectedCount = selected.count;
    const selectedLabels = NARROWING_FILTERS.filter((filter) => selection[filter.key]).map((filter) => filter.label);
    const narrowedRatio =
        filters.candidateTotal > 0 ? ((selectedCount / filters.candidateTotal) * 100).toFixed(1) : null;

    return (
        <section className="dashboard-card">
            <CardSubHeading number={1} title="후보 필터 기준" />
            <p className="dashboard-card-note">
                후보 정의는 추진 요건 하나이고, 나머지는 후보를 좁히는 선택 필터입니다.
            </p>

            <p className="dashboard-filter-group">
                후보 정의 <em>해제할 수 없는 고정 조건</em>
            </p>
            <div className="dashboard-filter dashboard-filter-fixed">
                <div className="dashboard-filter-head">
                    <b>
                        {CANDIDATE_DEFINITION.label}
                        <span className="dashboard-filter-lock">고정</span>
                    </b>
                    <span className="dashboard-filter-count">{formatCount(filters.candidateTotal)}</span>
                </div>
                <span className="dashboard-filter-desc">{CANDIDATE_DEFINITION.description}</span>
            </div>

            <p className="dashboard-filter-group">
                좁히기 필터 <em>체크한 조건을 추가로 만족하는 건물만 남깁니다</em>
            </p>
            <div className="dashboard-filter-list">
                {NARROWING_FILTERS.map((filter) => {
                    // 용도지역이 꺼져 있으면 용적률 여유는 성립하지 않는 조합이라 함께 잠근다(응답에도 그 조합이 없다).
                    const locked = filter.dependsOnZone && !selection.zoneConfirmed;

                    return (
                        <label className="dashboard-filter" key={filter.key}>
                            <div className="dashboard-filter-head">
                                <b>
                                    <input
                                        type="checkbox"
                                        checked={selection[filter.key]}
                                        disabled={locked}
                                        onChange={(e) => onToggleNarrowing(filter.key, e.target.checked)}
                                    />
                                    {filter.label}
                                </b>
                                <span className="dashboard-filter-count">{formatCount(singleCounts[filter.key])}</span>
                            </div>
                            <span
                                className={
                                    filter.dependsOnZone
                                        ? "dashboard-filter-desc is-dependent"
                                        : "dashboard-filter-desc"
                                }
                            >
                                {filter.dependsOnZone ? `⚠ ${filter.description}` : filter.description}
                            </span>
                        </label>
                    );
                })}
            </div>
            <p className="dashboard-note">
                <b>후보 판정에 들어가는 조건은 추진 요건 하나뿐입니다.</b> 용도지역·용적률 여유·지구/구역은
                판정에 들어가지 않아 후보 정의가 아니라 좁히기 필터로 둡니다. 각 숫자는 그 조건 하나만 적용했을
                때의 건수라 더해도 후보 수가 되지 않습니다.
            </p>

            <CardSubHeading number={2} title="적용 결과" />
            <div className="dashboard-funnel">
                <div className="dashboard-funnel-item">
                    <p className="dashboard-funnel-label">분석 대상</p>
                    <p className="dashboard-funnel-value">
                        {formatCount(funnel.analysisTarget)}
                        <small>동</small>
                    </p>
                    <p className="dashboard-funnel-desc">
                        서울 건축물 전체 {formatCount(funnel.totalBuilding)}동 중 — 부속건축물·범위 밖 제외
                    </p>
                </div>
                <div className="dashboard-funnel-item is-main">
                    <p className="dashboard-funnel-label">1차 조건 통과 건물</p>
                    <p className="dashboard-funnel-value">
                        {formatCount(funnel.candidates)}
                        <small>동</small>
                    </p>
                    <p className="dashboard-funnel-desc">분석 대상 대비 — 추진 요건 충족</p>
                </div>
                <div className="dashboard-funnel-item is-narrowed">
                    <p className="dashboard-funnel-label">
                        └ <b>{selectedLabels.length > 0 ? selectedLabels.join(" · ") : "좁히기 필터 미적용"}</b>
                    </p>
                    <p className="dashboard-funnel-value">
                        {formatCount(selectedCount)}
                        <small>{narrowedRatio ? `동 · ${narrowedRatio}%` : "동"}</small>
                    </p>
                    <p className="dashboard-funnel-desc">
                        1차 조건 통과 {formatCount(filters.candidateTotal)}동 대비
                    </p>
                </div>
            </div>
            <p className="dashboard-note">
                <b>증축 여력 미산출 {formatCount(funnel.undeterminedZone)}동은 탈락이 아닙니다.</b> 추진 요건은
                통과했지만 용도지역을 찾지 못한 건물이라 후보 안에 남습니다.
            </p>

            <CardSubHeading number={3} title="후보 지역" />
            <p className="dashboard-card-note">
                {selectionLabel} {formatCount(selectedCount)}동 = 100%
            </p>
            <ul className="dashboard-hood">
                {topDistricts.map((district, index) => (
                    <li key={district.sigunguCd}>
                        <button
                            type="button"
                            className="dashboard-hood-row is-clickable"
                            onClick={() => onSelectDistrict(district)}
                            title={`지도에서 ${district.sggName} 후보 보기`}
                        >
                            <span className="dashboard-hood-rank">{index + 1}</span>
                            <span className="dashboard-hood-name">{district.sggName.replace("서울특별시 ", "")}</span>
                            <span className="dashboard-hood-track">
                                <i style={{ width: `${(district.count / topMax) * 100}%` }} />
                            </span>
                            <span className="dashboard-hood-value">
                                {formatCount(district.count)} 동 <em>({district.pct}%)</em>
                            </span>
                        </button>
                    </li>
                ))}
                {rest.length > 0 && (
                    <li>
                        <button
                            type="button"
                            className="dashboard-hood-row is-clickable"
                            onClick={() => setRestExpanded((previous) => !previous)}
                            aria-expanded={restExpanded}
                            title={restExpanded ? "기타 지역 접기" : `나머지 ${rest.length}개 자치구 보기`}
                        >
                            <span className="dashboard-hood-rank">{restExpanded ? "−" : "+"}</span>
                            <span className="dashboard-hood-name">기타 지역</span>
                            <span className="dashboard-hood-track">
                                <i style={{ width: `${(restCount / topMax) * 100}%` }} />
                            </span>
                            <span className="dashboard-hood-value">
                                {formatCount(restCount)} 동 <em>({restPct.toFixed(1)}%)</em>
                            </span>
                        </button>
                    </li>
                )}
                {restExpanded &&
                    rest.map((district, index) => (
                        <li key={district.sigunguCd}>
                            <button
                                type="button"
                                className="dashboard-hood-row is-clickable is-rest"
                                onClick={() => onSelectDistrict(district)}
                                title={`지도에서 ${district.sggName} 후보 보기`}
                            >
                                <span className="dashboard-hood-rank">{TOP_DISTRICT_COUNT + index + 1}</span>
                                <span className="dashboard-hood-name">
                                    {district.sggName.replace("서울특별시 ", "")}
                                </span>
                                <span className="dashboard-hood-track">
                                    <i style={{ width: `${(district.count / topMax) * 100}%` }} />
                                </span>
                                <span className="dashboard-hood-value">
                                    {formatCount(district.count)} 동 <em>({district.pct}%)</em>
                                </span>
                            </button>
                        </li>
                    ))}
            </ul>
        </section>
    );
};

export default CandidateSection;
