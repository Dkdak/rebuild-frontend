import { useSearch } from "../context/SearchContext";
import { sortPropertyItems } from "../api/searchApi";

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
        page,
        totalPages,
        hasNextPage,
        goToPage,
    } = useSearch();

    const items = sortPropertyItems(searchResults?.items ?? [], sortOption);
    const totalCount = searchResults?.totalCount ?? 0;

    return (
        <div className="center-list-panel">
            <div className="center-list-header">
                <h4 className="center-list-title">
                    투자 후보 리스트{searchResults ? ` (${totalCount}건)` : ""}
                </h4>
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

            {loading ? (
                <p className="center-list-empty">검색 중...</p>
            ) : !searchResults ? (
                <p className="center-list-empty">조건을 설정하고 검색해보세요.</p>
            ) : items.length === 0 ? (
                <p className="center-list-empty">조건에 맞는 매물이 없습니다.</p>
            ) : (
                <ul className="center-list-items">
                    {items.map((item) => (
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
                                    {item.area != null ? `${item.area}㎡` : "면적 정보 없음"}
                                    {" · "}
                                    {item.buildYear != null ? `${item.buildYear}년` : "준공년도 미확인"}
                                </span>
                                <span>{item.grade ?? "등급 산정 중"}</span>
                                <span>{item.price != null ? `${item.price}만원` : "가격 정보 준비 중"}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {searchResults && (
                <div className="center-list-pagination">
                    <button disabled={page === 1} onClick={() => goToPage(page - 1)}>이전</button>
                    <span>
                        {page} / 전체 {totalPages}페이지{totalCount > 0 ? ` (${totalCount}건)` : ""}
                    </span>
                    <button disabled={!hasNextPage} onClick={() => goToPage(page + 1)}>다음</button>
                </div>
            )}
        </div>
    );
};

export default ResultList;
