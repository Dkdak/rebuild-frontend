import { useState } from "react";
import { useSearch } from "../../../features/search/context/SearchContext";
import { searchAddress, type AddressCandidate } from "../../../features/search/api/searchApi";

// F-04_SEARCH.md §0-B: 1차엔 건축물대장 필드만 동작 — 부동산유형/건축연도/면적/역세권은 활성화, 가격·투자지표는 비활성 유지.
const PROPERTY_TYPES = ["아파트", "다세대주택", "단독주택", "오피스텔"];

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
    const [addressCandidates, setAddressCandidates] = useState<AddressCandidate[]>([]);
    const [validationError, setValidationError] = useState("");

    const handleAddressInputChange = async (value: string) => {
        setAddressInput(value);
        if (!value.trim()) {
            setAddressCandidates([]);
            return;
        }
        const candidates = await searchAddress(value);
        setAddressCandidates(candidates);
    };

    const handleSelectAddress = (candidate: AddressCandidate) => {
        setAddressInput("");
        setAddressCandidates([]);
        runAddressSearch(candidate);
    };

    const togglePropertyType = (type: string) => {
        const next = filters.propertyTypes.includes(type)
            ? filters.propertyTypes.filter((t) => t !== type)
            : [...filters.propertyTypes, type];
        updateFilters({ ...filters, propertyTypes: next });
    };

    const updateRangeField = (
        field: "buildYearMin" | "buildYearMax" | "areaMin" | "areaMax",
        value: string
    ) => {
        updateFilters({ ...filters, [field]: value === "" ? null : Number(value) });
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
        if (filters.areaMin != null && filters.areaMax != null && filters.areaMin > filters.areaMax) {
            setValidationError("면적 최소값이 최대값보다 클 수 없습니다.");
            return;
        }

        runFilterSearch();
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
                {addressCandidates.length > 0 && (
                    <ul className="left-panel-address-candidates">
                        {addressCandidates.map((candidate) => (
                            <li key={candidate.address}>
                                <button type="button" onClick={() => handleSelectAddress(candidate)}>
                                    {candidate.address}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {addressInput.trim() !== "" && addressCandidates.length === 0 && (
                    <p className="left-panel-address-empty">검색된 주소가 없습니다.</p>
                )}
            </div>

            <h3 className="left-panel-title">조건 검색</h3>

            <div className="left-panel-field">
                부동산 유형
                <div className="left-panel-checkbox-group">
                    {PROPERTY_TYPES.map((type) => (
                        <label key={type} className="left-panel-checkbox-item">
                            <input
                                type="checkbox"
                                checked={filters.propertyTypes.includes(type)}
                                onChange={() => togglePropertyType(type)}
                            />
                            {type}
                        </label>
                    ))}
                </div>
            </div>

            <label className="left-panel-field">
                거래 유형
                <select disabled>
                    <option>매매</option>
                </select>
            </label>

            <div className="left-panel-field">
                건축 연도
                <div className="left-panel-range">
                    <input
                        type="number"
                        placeholder="최소"
                        value={filters.buildYearMin ?? ""}
                        onChange={(e) => updateRangeField("buildYearMin", e.target.value)}
                    />
                    <span>~</span>
                    <input
                        type="number"
                        placeholder="최대"
                        value={filters.buildYearMax ?? ""}
                        onChange={(e) => updateRangeField("buildYearMax", e.target.value)}
                    />
                </div>
            </div>

            <label className="left-panel-field">
                가격
                <select disabled>
                    <option>가격 정보 준비 중</option>
                </select>
            </label>

            <div className="left-panel-field">
                면적(㎡)
                <div className="left-panel-range">
                    <input
                        type="number"
                        placeholder="최소"
                        value={filters.areaMin ?? ""}
                        onChange={(e) => updateRangeField("areaMin", e.target.value)}
                    />
                    <span>~</span>
                    <input
                        type="number"
                        placeholder="최대"
                        value={filters.areaMax ?? ""}
                        onChange={(e) => updateRangeField("areaMax", e.target.value)}
                    />
                </div>
            </div>

            <label className="left-panel-field">
                투자 지표
                <select disabled>
                    <option>등급 산정 준비 중</option>
                </select>
            </label>

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
