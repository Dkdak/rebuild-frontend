import type { CSSProperties } from "react";
import { useSearch } from "../context/SearchContext";
import {
    formatAreaDisplay,
    formatBuildYear,
    formatHouseholdCount,
    formatManwon,
    GRADE_CLASS,
    sortGradeSummary,
    sortPropertyItems,
} from "../api/searchApi";
import { priceConfidenceFromLevel, priceConfidenceTone } from "../api/analysisApi";
import Pagination from "./Pagination";

// .grade-A 등(layout.css)과 동일한 색상 — 선택된 배지 강조에 재사용(인라인 CSS 변수로 전달).
// 2026-08-1x: 6단계 → 4단계(A/B/C/D)+NA로 재편, 톤은 유지하며 재배분(FEATURE_09_INVESTMENT.md 확정 값 그대로).
// 키를 "정보부족"으로 잘못 넣어서 실제 배지가 안 뜨던 버그 수정 — GET .../search 응답은 grade/gradeSummary
// 둘 다 raw 코드 "NA"를 그대로 보낸다(한글 번역 안 함, 실측 확인).
const GRADE_COLOR: Record<string, string> = {
    A: "#16a34a",
    B: "#f59e0b",
    C: "#64748b",
    D: "#475569",
    NA: "#9ca3af",
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
                            return (
                                <li
                                    key={item.id}
                                    className={`center-list-item ${
                                        selectedPropertyId === item.id ? "center-list-item-selected" : ""
                                    }`}
                                    onClick={() => selectProperty(item.id)}
                                >
                                    {/* 2026-08-1x: 리모델링 가능여부 배지 완전 삭제, 등급을 카드 왼쪽 44x44 박스로 승격
                                        (기존 헤더 등급배지와 같은 grade-badge/GRADE_CLASS 색상 재사용) — 1/3줄이던
                                        텍스트 내용은 오른쪽 콘텐츠 컬럼으로 묶는다. */}
                                    <div className="center-list-item-row">
                                        <div className="center-list-item-grade-wrapper">
                                            <div
                                                className={`grade-badge center-list-item-grade-box ${item.grade ? (GRADE_CLASS[item.grade] ?? "") : ""}`}
                                            >
                                                {item.grade ?? "-"}
                                            </div>
                                            {/* 2026-08-09 — item.estimatedPrice.confidenceLevel 근사치(카드 목록엔
                                                postRemodelEstimatedPrice가 별도로 없음, F-05/F-10 상세엔 정확한 값). */}
                                            {(() => {
                                                const c = priceConfidenceFromLevel(item.estimatedPrice.confidenceLevel);
                                                return c && <span className="grade-box-confidence-caption">신뢰도 {c}</span>;
                                            })()}
                                        </div>
                                        <div className="center-list-item-content">
                                            {/* 1줄: 유형 + 주소 */}
                                            <div className="center-list-item-main">
                                                <span className="center-list-item-type">{item.propertyType}</span>
                                                <span className="center-list-item-address">{item.address}</span>
                                            </div>
                                            {/* 2줄(구 3줄): 면적·연식·ROI·최근실거래가(흐린 텍스트) — 기존 내용 그대로.
                                                item.price(정식 매매가, 2차 미착수)는 항상 null — recentTrade(§2.1-h item 5)가
                                                있으면 그걸 가격 자리에 보여주고, 둘 다 없을 때만 플레이스홀더. */}
                                            <div className="center-list-item-meta">
                                                <span>
                                                    {areaMain}
                                                    {" · "}
                                                    {formatBuildYear(item.buildYear)}
                                                </span>
                                                {/* FEATURE_04_SEARCH.md §2.1-h item 5/8(2026-08-09) — recentTrade 대신
                                                    estimatedPrice로 교체. recentTrade는 건물 전체 대비 작은 호실 하나
                                                    거래가 "건물 전체가 이 가격"처럼 보이는 착시가 있었는데(그래서
                                                    "건물 일부 거래" 경고를 따로 달아야 했다), estimatedPrice는 전
                                                    유형 공통으로 스케일이 맞아 이 착시 자체가 없다 — 경고 문구도
                                                    함께 제거(카드에서만, RightPanel.tsx "최근 실거래가" 행은 유지).
                                                    순서: 면적·연식(물리정보) / 시세·ROI(재무정보) 두 묶음으로 분리,
                                                    재무정보 묶음 안에서는 시세가 ROI보다 앞(2026-08-09 확정). */}
                                                {/* 2026-08-09 — "추정치" 고정 문구 대신 신뢰도 등급(A~D) 표시(analysisApi.ts
                                                    priceConfidenceFromLevel), 배지 톤도 등급별 success/warning으로
                                                    구분(priceConfidenceTone). null이면 UNAVAILABLE이라 태그 자체 생략.
                                                    ROI 옆 개별 태그는 취소 — 44x44 등급 박스 아래 캡션 하나로 통합. */}
                                                {item.price != null ? (
                                                    <span>{item.price}만원</span>
                                                ) : item.estimatedPrice.value != null ? (
                                                    <span className="right-panel-estimate-anchor">
                                                        시세 {formatManwon(item.estimatedPrice.value)}
                                                        {(() => {
                                                            const c = priceConfidenceFromLevel(item.estimatedPrice.confidenceLevel);
                                                            return (
                                                                c && (
                                                                    <span
                                                                        className={`right-panel-estimate-tag right-panel-estimate-tag-${priceConfidenceTone(c)}`}
                                                                    >
                                                                        신뢰도 {c}
                                                                    </span>
                                                                )
                                                            );
                                                        })()}
                                                    </span>
                                                ) : (
                                                    <span>가격 정보 준비 중</span>
                                                )}
                                                {/* roi==null이면 backend stage != FULL(F-05/F-10과 동일 근거) — "산정
                                                    중"은 곧 채워질 것처럼 오해를 줘서 "산출 불가"로 정정(2026-08-1x). */}
                                                <span>ROI {item.roi != null ? `${Math.round(item.roi)}%` : "산출 불가"}</span>
                                            </div>
                                            {auxLine && <div className="center-list-item-area-aux">{auxLine}</div>}
                                        </div>
                                    </div>
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
