import DonutStat from "../../board/components/DonutStat";
import { GRADE_META } from "../../board/data/dashboardStats";
import FavoriteButton from "./FavoriteButton";
import { GRADE_CLASS } from "../../search/api/searchApi";
import type { FavoriteRow } from "../api/favoritesApi";
import { useFavorites } from "../context/FavoritesContext";
import { useMeasurementRows } from "../../analysis/hooks/useMeasurementRows";
import "./favorites.css";

// planning/rebuild/ReValue_대시보드_콘텐츠_구성안.md §3 — 좌 1/3 등급 분포, 우 2/3 관심 건물 목록.
// 목록은 한 건당 한 줄, 넘치면 카드 내부 스크롤(관심목록이 100건을 넘길 일이 없어 페이지네이션은 과하다).
// 등급 5행은 해당 건물이 없어도 0으로 남긴다 — 그래야 담고 뺄 때마다 카드 높이가 흔들리지 않는다.
// 평균 등급은 내지 않는다(순서 척도).
const GRADE_ORDER = ["A", "B", "C", "D", "NA"];
const GRADE_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

const toGradeSegments = (rows: FavoriteRow[]) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
        const grade = row.property?.grade;
        if (grade) counts.set(grade, (counts.get(grade) ?? 0) + 1);
    });
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

    return GRADE_ORDER.map((grade) => {
        const count = counts.get(grade) ?? 0;
        return {
            label: GRADE_META[grade]?.label ?? grade,
            count,
            ratio: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
            tone: GRADE_META[grade]?.tone ?? "na",
        };
    });
};

// 등록 시점 등급과 다를 때만 방향 표시 — A~D는 순서가 있어 화살표, NA가 끼면 방향이 없어 변경만 알린다.
const gradeChangeMark = (gradeAtSave: string | null, grade: string | null) => {
    if (!gradeAtSave || !grade || gradeAtSave === grade) return null;

    const from = GRADE_RANK[gradeAtSave];
    const to = GRADE_RANK[grade];
    if (from == null || to == null) return "변경";
    return to > from ? "↓" : "↑";
};

// F-03 §2.5-a — 한 행의 동작은 셋이다: 행 전체는 리포트(담아둔 매물은 대개 아직 판단 전이라 리포트를 먼저
// 본다), "실측 상태" 셀은 그 매물의 분석탭(사용자 지시, 2026-08-23 — 목록을 훑다 바로 이어서 작업하는 경로),
// ♥는 해제. 셀 단위로 클릭 영역을 나눈다.
// 상태 칸에는 상태만 쓴다 — "분석 시작"·"이어하기" 같은 동작 문구를 넣으면 컬럼 이름과 내용이 어긋난다.
interface FavoriteListSectionProps {
    rows: FavoriteRow[] | null;
    failed: boolean;
    onReload: () => void;
    onGoToMap: () => void;
    onGoToReport: (buildingId: string, address: string) => void;
    onGoToAnalysis: (buildingId: string, address: string) => void;
}

const FavoriteListSection = ({
    rows,
    failed,
    onReload,
    onGoToMap,
    onGoToReport,
    onGoToAnalysis,
}: FavoriteListSectionProps) => {
    const { favoriteCount } = useFavorites();
    const { byBuildingId } = useMeasurementRows();

    if (favoriteCount === 0) {
        return (
            <section className="dashboard-card">
                <p className="dashboard-side-title">관심목록</p>
                <p className="dashboard-card-note">관심 있는 매물을 담아보세요.</p>
                <button type="button" className="dashboard-retry-btn" onClick={onGoToMap}>
                    지도에서 매물 찾기
                </button>
            </section>
        );
    }

    const items = rows ?? [];
    const segments = toGradeSegments(items);
    const gradedCount = segments.reduce((sum, segment) => sum + segment.count, 0);

    return (
        <section className="dashboard-card">
            <p className="dashboard-side-title">
                관심목록 <span className="favorite-count">{favoriteCount}건</span>
            </p>

            {failed ? (
                <>
                    <p className="dashboard-card-note">관심목록을 불러오지 못했습니다.</p>
                    <button type="button" className="dashboard-retry-btn" onClick={onReload}>
                        다시 시도
                    </button>
                </>
            ) : rows == null ? (
                <p className="dashboard-card-note">불러오는 중입니다…</p>
            ) : (
                <div className="favorite-split">
                    <div>
                        <p className="dashboard-card-note">투자등급 분포</p>
                        <DonutStat total={gradedCount} unit="동" segments={segments} />
                    </div>

                    <div className="favorite-table-wrap">
                        <table className="favorite-table">
                            <thead>
                                <tr>
                                    <th>건물명</th>
                                    <th>투자등급</th>
                                    <th className="is-right">예상 ROI</th>
                                    <th className="is-right">실측 ROI</th>
                                    <th>실측 상태</th>
                                    <th aria-label="관심목록 해제" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((row) => {
                                    const grade = row.property?.grade ?? null;
                                    const mark = gradeChangeMark(row.gradeAtSave, grade);

                                    const measurement = byBuildingId.get(row.buildingId);
                                    // 재확인이 우선이다 — 완료·진행중이라도 낡은 항목이 있으면 "재확인 n"으로
                                    // 보여야 한다("완료"는 할 일 없음으로 읽히는데 확인할 값이 남아 있다).
                                    // 건수는 진행중·재확인에만 붙인다(미시작 0/4·완료 4/4는 자명하다).
                                    const measureState = !measurement
                                        ? { label: "미시작", tone: "is-none" }
                                        : measurement.recheckCount > 0
                                          ? { label: `재확인 ${measurement.recheckCount}`, tone: "is-recheck" }
                                          : measurement.status === "COMPLETED"
                                            ? { label: "완료", tone: "is-done" }
                                            : {
                                                  label: `진행중 ${measurement.progress.measured}/${measurement.progress.total}`,
                                                  tone: "is-progress",
                                              };

                                    return (
                                        <tr
                                            key={row.buildingId}
                                            className="favorite-table-row"
                                            onClick={() =>
                                                onGoToReport(row.buildingId, row.property?.address ?? "")
                                            }
                                        >
                                            <td className="favorite-table-address">
                                                {row.property ? (
                                                    row.property.address
                                                ) : (
                                                    <span className="favorite-unavailable">조회 불가</span>
                                                )}
                                            </td>
                                            <td>
                                                {grade ? (
                                                    <span className={`grade-text ${GRADE_CLASS[grade] ?? ""}`}>
                                                        {grade}
                                                        {mark && <span className="favorite-grade-mark"> {mark}</span>}
                                                    </span>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                            <td className="is-right">
                                                {row.property?.roi != null ? `${Math.round(row.property.roi)}%` : "—"}
                                            </td>
                                            {/* 실측 ROI는 완료건에만 값이 있다 — 진행중 값은 반쪽이라 예상 ROI와
                                                나란히 비교할 대상이 못 되고, 아래 실측 진행 현황 카드가 그 값을
                                                "입력 기준 ROI"로 따로 보여준다. 변화 방향(↑↓)은 이 칸 안에서
                                                표시한다. F-19 목록 API 연동 후 채운다. */}
                                            {/* 실측 ROI는 완료건에만 — 진행중 값은 미입력분을 추정치로 채운
                                                반쪽이라 예상 ROI와 나란히 놓을 수 없다(§3.2-a). */}
                                            <td className="is-right">
                                                {measurement?.status === "COMPLETED" && measurement.measuredRoi != null
                                                    ? `${Math.round(measurement.measuredRoi)}%`
                                                    : "—"}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={`favorite-measure-state is-clickable ${measureState.tone}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onGoToAnalysis(
                                                            row.buildingId,
                                                            row.property?.address ?? "",
                                                        );
                                                    }}
                                                    title="분석탭에서 열기"
                                                >
                                                    {measureState.label}
                                                </button>
                                            </td>
                                            <td className="is-right">
                                                <FavoriteButton buildingId={row.buildingId} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
};

export default FavoriteListSection;
