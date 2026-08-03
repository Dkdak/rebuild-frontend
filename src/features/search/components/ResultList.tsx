import type { CSSProperties } from "react";
import { useSearch } from "../context/SearchContext";
import {
    formatAreaDisplay,
    formatBuildYear,
    formatHouseholdCount,
    formatRecentTrade,
    GRADE_CLASS,
    sortGradeSummary,
    sortPropertyItems,
} from "../api/searchApi";
import Pagination from "./Pagination";

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

interface ResultListProps {
    // 모바일 전용 — 카드의 "상세보기" 버튼이 호출(`FEATURE_01_LAYOUT.md` §2.2, 2026-08-04: 카드 탭 자체는 선택만, 상세 시트는 별도 버튼으로 분리).
    onOpenDetail: () => void;
}

// F-04 소관: 검색 결과 렌더링. SearchContext의 searchResults를 지도(KakaoMap)와 공유한다 (§0-A, §2.3).
const ResultList = ({ onOpenDetail }: ResultListProps) => {
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
                {/* F-04_SEARCH.md §2.1-g item 1(2026-08-04) — 데스크톱은 제목·배지·정렬 한 줄 통합. 폭 부족 시 `.center-list-header`의 flex-wrap으로 자동 줄바꿈. 모바일은 CSS로 숨기고 아래 등급 select 사용. */}
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
                {/* F-04_SEARCH.md §2.1-g item 2 — 등급 배지(A+~D)의 모바일 대체 UI. 정렬 select보다 앞(왼쪽)에 둬서, 검색 전후로 정렬 select 위치가 안 바뀌게 함(§5.1 버그 수정) — 클릭 대신 선택이지만 동작은 동일하게 selectGradeFilter 호출. */}
                {searchResults && (
                    <select
                        className="center-list-grade-select"
                        value={gradeFilter ?? ""}
                        onChange={(e) => {
                            if (e.target.value) selectGradeFilter(e.target.value);
                        }}
                    >
                        <option value="" disabled>
                            등급
                        </option>
                        {gradeSummary.map((item) => (
                            <option key={item.grade} value={item.grade}>
                                {item.grade} {item.count.toLocaleString()}
                            </option>
                        ))}
                    </select>
                )}
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
                            const recentTrade = formatRecentTrade(
                                item.recentTrade,
                                item.totalBuildingArea,
                                item.propertyType
                            );
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
                                        {/* item.price(정식 매매가, 2차 미착수)는 항상 null — recentTrade(§2.1-h item 5)가 있으면 그걸 가격 자리에 보여주고, 둘 다 없을 때만 플레이스홀더. */}
                                        <span>
                                            {item.price != null
                                                ? `${item.price}만원`
                                                : (recentTrade?.text ?? "가격 정보 준비 중")}
                                        </span>
                                    </div>
                                    {/* DOMAIN.md §5.1 "최근 실거래가 표시 착시" V1 — building(동 단위)·trade(호실 단위) 단위 불일치로
                                        건물 전체가 팔린 것처럼 보이는 착시 방지. 거래 면적이 건물 전체의 20% 미만이면 경고. */}
                                    {recentTrade?.isPartial && (
                                        <div className="center-list-item-partial-trade-warning">
                                            ⚠ 건물 일부 거래(호실 단위 실거래가)
                                        </div>
                                    )}
                                    {auxLine && <div className="center-list-item-area-aux">{auxLine}</div>}
                                    {/* `FEATURE_01_LAYOUT.md` §2.2(2026-08-04) — 카드 탭은 선택만, 상세 시트는 이 버튼으로만 연다(모바일 전용) */}
                                    <button
                                        type="button"
                                        className="center-list-item-detail-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            selectProperty(item.id);
                                            onOpenDetail();
                                        }}
                                    >
                                        상세보기
                                    </button>
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
