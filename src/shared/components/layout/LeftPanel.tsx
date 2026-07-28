import { useEffect, useRef, useState } from "react";
import { useSearch } from "../../../features/search/context/SearchContext";
import { searchAddress, type SearchIndexCandidate } from "../../../features/search/api/searchApi";
import BuildYearFilter from "../../../features/search/components/filters/BuildYearFilter";
import PropertyTypeAccordion from "../../../features/search/components/filters/PropertyTypeAccordion";
import Popover from "../../../shared/components/common/Popover";
import "../../../shared/components/common/common.css";

// F-04_SEARCH.md §2.4: search_index의 pg_trgm 인덱스가 3글자 트라이그램 기반이라 2자 미만은 호출하지 않는다.
const MIN_KEYWORD_LENGTH = 2;
const DEBOUNCE_MS = 300;

const DEFAULT_GRADE_SUMMARY = [
    { grade: "A+", count: 0, avgRoi: 0 },
    { grade: "A", count: 0, avgRoi: 0 },
    { grade: "B+", count: 0, avgRoi: 0 },
    { grade: "B", count: 0, avgRoi: 0 },
    { grade: "C", count: 0, avgRoi: 0 },
    { grade: "D", count: 0, avgRoi: 0 },
];

const LeftPanel = () => {
    const { filters, updateFilters, runFilterSearch, runAddressSearch, searchResults } = useSearch();
    const [addressInput, setAddressInput] = useState("");
    const [addressCandidates, setAddressCandidates] = useState<SearchIndexCandidate[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<SearchIndexCandidate | null>(null);
    const [validationError, setValidationError] = useState("");
    const debounceRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, []);

    const handleAddressInputChange = (value: string) => {
        setAddressInput(value);
        setSelectedCandidate(null);

        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }

        if (value.trim().length < MIN_KEYWORD_LENGTH) {
            setAddressCandidates([]);
            return;
        }

        debounceRef.current = window.setTimeout(async () => {
            const candidates = await searchAddress(value);
            setAddressCandidates(candidates);
        }, DEBOUNCE_MS);
    };

    // 후보를 고른다고 바로 조회하지 않는다 — 입력값은 유지하고 "검색하기"를 눌러야 실행된다.
    const handleSelectAddress = (candidate: SearchIndexCandidate) => {
        setAddressInput(candidate.displayText);
        setAddressCandidates([]);
        setSelectedCandidate(candidate);
    };

    const applyBuildYearRange = (buildYearMin: number | null, buildYearMax: number | null) => {
        updateFilters({ ...filters, buildYearMin, buildYearMax });
    };

    const handleSearch = () => {
        setValidationError("");

        if (
            filters.buildYearMin != null &&
            filters.buildYearMax != null &&
            filters.buildYearMin > filters.buildYearMax
        ) {
            setValidationError("건축 연도 최소값이 최대값보다 클 수 없습니다.");
            return;
        }
        const invalidAreaType = filters.propertyTypeFilters.find(
            (f) => f.areaMin != null && f.areaMax != null && f.areaMin > f.areaMax
        );
        if (invalidAreaType) {
            setValidationError(`${invalidAreaType.type} 면적 최소값이 최대값보다 클 수 없습니다.`);
            return;
        }

        if (selectedCandidate) {
            runAddressSearch(selectedCandidate);
        } else {
            runFilterSearch();
        }
    };

    const gradeSummary = searchResults?.gradeSummary ?? DEFAULT_GRADE_SUMMARY;

    return (
        <aside className="left-panel">
            <div className="left-panel-address-search">
                <input
                    type="text"
                    placeholder="주소, 지역으로 검색"
                    value={addressInput}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                />
                {selectedCandidate && (
                    <button
                        type="button"
                        className="left-panel-address-clear"
                        onClick={() => {
                            setAddressInput("");
                            setSelectedCandidate(null);
                        }}
                    >
                        ✕
                    </button>
                )}
                {addressCandidates.length > 0 && (
                    <ul className="left-panel-address-candidates">
                        {addressCandidates.map((candidate) => (
                            <li key={`${candidate.type}-${candidate.buildingId ?? candidate.bjdongCd}`}>
                                <button type="button" onClick={() => handleSelectAddress(candidate)}>
                                    <span
                                        className={`left-panel-address-type left-panel-address-type-${candidate.type.toLowerCase()}`}
                                    >
                                        {candidate.type === "BUILDING" ? "건물" : "지역"}
                                    </span>
                                    {candidate.displayText}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {!selectedCandidate && addressInput.trim().length >= MIN_KEYWORD_LENGTH && addressCandidates.length === 0 && (
                    <p className="left-panel-address-empty">검색된 주소가 없습니다.</p>
                )}
            </div>

            <h3 className="left-panel-title">조건 검색</h3>

            <div className="left-panel-field">
                부동산 유형
                <PropertyTypeAccordion
                    propertyTypeFilters={filters.propertyTypeFilters}
                    onChange={(propertyTypeFilters) => updateFilters({ ...filters, propertyTypeFilters })}
                />
            </div>

            <div className="left-panel-field">
                <Popover label="거래유형 (매매만 지원)" open={false} onToggle={() => {}} onClose={() => {}} disabled />
            </div>

            <div className="left-panel-field">
                <BuildYearFilter filters={filters} onApply={applyBuildYearRange} />
            </div>

            <div className="left-panel-field">
                <Popover label="투자지표 (준비 중)" open={false} onToggle={() => {}} onClose={() => {}} disabled />
            </div>

            <label className="left-panel-field left-panel-field-checkbox">
                <input
                    type="checkbox"
                    checked={filters.nearSubway}
                    onChange={(e) => updateFilters({ ...filters, nearSubway: e.target.checked })}
                />
                역세권 (500m 이내)
            </label>

            {validationError && <p className="left-panel-validation-error">{validationError}</p>}

            <button className="left-panel-search-btn" onClick={handleSearch}>검색하기</button>

            <div className="left-panel-results">
                <h4>검색 결과{searchResults ? ` (${searchResults.totalCount}건)` : ""}</h4>
                {gradeSummary.map(({ grade, count, avgRoi }) => (
                    <div
                        key={grade}
                        className={`left-panel-result-row ${count === 0 ? "left-panel-result-row-empty" : ""}`}
                    >
                        <span className={`grade-badge grade-${grade.replace("+", "plus")}`}>{grade}</span>
                        <span className="left-panel-result-count">{count}건</span>
                        <span className="left-panel-result-roi">
                            {count > 0 ? `평균 ROI ${avgRoi}%` : "-"}
                        </span>
                    </div>
                ))}
            </div>
        </aside>
    );
};

export default LeftPanel;
