import type { CSSProperties } from "react";
import { useSearch } from "../context/SearchContext";
import {
    formatAreaDisplay,
    formatBuildYear,
    formatHouseholdCount,
    sortGradeSummary,
    sortPropertyItems,
} from "../api/searchApi";
import Pagination from "./Pagination";

const GRADE_CLASS: Record<string, string> = {
    "A+": "grade-Aplus",
    A: "grade-A",
    "B+": "grade-Bplus",
    B: "grade-B",
    C: "grade-C",
    D: "grade-D",
};

// .grade-Aplus 등(layout.css)과 동일한 색상 — 선택된 배지 강조에 재사용(인라인 CSS 변수로 전달).
const GRADE_COLOR: Record<string, string> = {
    "A+": "#16a34a",
    A: "#22c55e",
    "B+": "#f59e0b",
    B: "#9ca3af",
    C: "#64748b",
    D: "#475569",
};

// F-04_SEARCH.md §2.2: 등급/ROI/가격 정렬 옵션. 정확한 값은 1차엔 전부 null이라 실질적 정렬 효과는 F-09 연동 후 나타난다.
const SORT_OPTIONS = [
    { value: "grade-desc", label: "등급 높은순" },
    { value: "roi-desc", label: "예상 ROI 높은순" },
    { value: "price-asc", label: "매매가 낮은순" },
    { value: "price-desc", label: "매매가 높은순" },
];

// F-04 소관: 검색 결과 렌더링. SearchContext의 searchResults를 지도(KakaoMap)와 공유한다 (§0-A, §2.3).
const ResultList = () => {
    const {
        searchResults,
        selectedPropertyId,
        selectProperty,
        loading,
        sortOption,
        setSortOption,
        gradeFilter,
        selectGradeFilter,
    } = useSearch();

    const items = sortPropertyItems(searchResults?.items ?? [], sortOption);
    const totalCount = searchResults?.totalCount ?? 0;
    const gradeSummary = sortGradeSummary(searchResults?.gradeSummary ?? []);

    return (
        <div className="center-list-panel">
            <div className="center-list-header">
                <div className="center-list-header-left">
                    <h4 className="center-list-title">
                        검색결과{searchResults ? ` (${totalCount}건)` : ""}
                    </h4>
                </div>
                <select
                    className="center-list-sort"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {searchResults && (
                <div className="center-list-grade-badges">
                    {gradeSummary.map((item) => (
                        <button
                            key={item.grade}
                            type="button"
                            className={`grade-badge-btn ${
                                gradeFilter === item.grade ? "grade-badge-btn-active" : ""
                            } ${item.count === 0 ? "grade-badge-btn-empty" : ""}`}
                            style={{ "--grade-badge-color": GRADE_COLOR[item.grade] } as CSSProperties}
                            onClick={() => selectGradeFilter(item.grade)}
                        >
                            <span className={`grade-badge ${GRADE_CLASS[item.grade] ?? ""}`}>{item.grade}</span>
                            <span className="grade-badge-count">{item.count.toLocaleString()}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="center-list-body">
                {loading ? (
                    <p className="center-list-empty">검색 중...</p>
                ) : !searchResults ? (
                    <p className="center-list-empty">조건을 설정하고 검색해보세요.</p>
                ) : items.length === 0 ? (
                    <p className="center-list-empty">조건에 맞는 매물이 없습니다.</p>
                ) : (
                    <ul className="center-list-items">
                        {items.map((item) => {
                            const { main: areaMain, aux: areaAux } = formatAreaDisplay(item);
                            const householdCountText = formatHouseholdCount(item.householdCount);
                            const auxLine = [areaAux, householdCountText].filter(Boolean).join(" · ");
                            return (
                                <li
                                    key={item.id}
                                    className={`center-list-item ${
                                        selectedPropertyId === item.id ? "center-list-item-selected" : ""
                                    }`}
                                    onClick={() => selectProperty(item.id)}
                                >
                                    <div className="center-list-item-main">
                                        <span className="center-list-item-type">{item.propertyType}</span>
                                        <span className="center-list-item-address">{item.address}</span>
                                    </div>
                                    <div className="center-list-item-meta">
                                        <span>
                                            {areaMain}
                                            {" · "}
                                            {formatBuildYear(item.buildYear)}
                                        </span>
                                        <span>{item.grade ?? "등급 산정 중"}</span>
                                        <span>{item.price != null ? `${item.price}만원` : "가격 정보 준비 중"}</span>
                                    </div>
                                    {auxLine && <div className="center-list-item-area-aux">{auxLine}</div>}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <Pagination />
        </div>
    );
};

export default ResultList;
