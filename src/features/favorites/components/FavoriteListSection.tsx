import DonutStat from "../../board/components/DonutStat";
import { GRADE_META } from "../../board/data/dashboardStats";
import FavoriteButton from "./FavoriteButton";
import { GRADE_CLASS } from "../../search/api/searchApi";
import type { FavoriteRow } from "../api/favoritesApi";
import { useFavorites } from "../context/FavoritesContext";
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

interface FavoriteListSectionProps {
    rows: FavoriteRow[] | null;
    failed: boolean;
    onReload: () => void;
    onGoToMap: () => void;
}

const FavoriteListSection = ({ rows, failed, onReload, onGoToMap }: FavoriteListSectionProps) => {
    const { favoriteCount } = useFavorites();

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

                                    return (
                                        <tr key={row.buildingId}>
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
                                            <td className="is-right favorite-table-muted">—</td>
                                            {/* 완료 / 진행중 / 미시작 — F-19 목록 API 연동 후 채운다. */}
                                            <td className="favorite-table-muted">—</td>
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
