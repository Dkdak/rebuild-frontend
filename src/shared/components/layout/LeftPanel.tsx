import { useEffect, useRef, useState } from "react";
import { DEFAULT_LOCATION_CANDIDATE, useSearch } from "../../../features/search/context/SearchContext";
import { searchAddress, type SearchIndexCandidate } from "../../../features/search/api/searchApi";
import BuildYearFilter from "../../../features/search/components/filters/BuildYearFilter";
import PropertyTypeAccordion from "../../../features/search/components/filters/PropertyTypeAccordion";
import Popover from "../../../shared/components/common/Popover";
import "../../../shared/components/common/common.css";

// F-04_SEARCH.md §2.4: search_index의 pg_trgm 인덱스가 3글자 트라이그램 기반이라 2자 미만은 호출하지 않는다.
const MIN_KEYWORD_LENGTH = 2;
const DEBOUNCE_MS = 300;

const CANDIDATE_TYPE_LABEL: Record<string, string> = {
    BUILDING: "건물",
    DONG: "동",
    GU: "구",
};

interface LeftPanelProps {
    // 모바일 FilterDrawer에서만 전달 — 검색 실행 시 시트를 닫아 바로 아래 결과가 보이게 한다. 데스크톱(상시 노출)은 전달 안 함.
    onSearchSubmit?: () => void;
}

// F-04_SEARCH.md §2.1-g(2026-08-01): 결과 요약(등급별 건수)은 리스트 헤더로 이동 — LeftPanel은 조건 입력 전용.
const LeftPanel = ({ onSearchSubmit }: LeftPanelProps = {}) => {
    const { filters, updateFilters, runFilterSearch, runAddressSearch } = useSearch();
    // 위치 기본값(§0-C, 2026-08-03) — 백엔드가 더 이상 위치 미지정을 보정하지 않아, 검색창에 기본 위치(중구)를 항상 표시해둔다.
    const [addressInput, setAddressInput] = useState(DEFAULT_LOCATION_CANDIDATE.displayText);
    const [addressCandidates, setAddressCandidates] = useState<SearchIndexCandidate[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<SearchIndexCandidate | null>(DEFAULT_LOCATION_CANDIDATE);
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

        // §2.1-i item 4: 위치·건축연도 둘 다 없으면 400을 받기 전에 프론트가 먼저 막는다(클라이언트 사전 차단 원칙, §2.4와 동일).
        if (!selectedCandidate && filters.buildYearMin == null && filters.buildYearMax == null) {
            setValidationError("위치 또는 건축연도 중 하나는 선택해야 합니다.");
            return;
        }

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
        onSearchSubmit?.();
    };

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
                                        {CANDIDATE_TYPE_LABEL[candidate.type] ?? candidate.type}
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
                <Popover label="거래유형 (준비 중)" open={false} onToggle={() => {}} onClose={() => {}} disabled />
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
        </aside>
    );
};

export default LeftPanel;
