import { useEffect, useRef, useState } from "react";
import { useSearch } from "../context/SearchContext";
import { searchAddress, type SearchFilters, type SearchIndexCandidate } from "../api/searchApi";
import BuildYearFilter from "./filters/BuildYearFilter";
import PropertyTypeAccordion from "./filters/PropertyTypeAccordion";
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

// 대시보드 "후보 필터 기준"과 같은 4조건, 같은 설명 문구(F-06 §35·§53). 지도에서는 전부 토글 가능하고
// 기본값은 해제 — 지도는 후보 전용 화면이 아니다. 용적률 여유는 용도지역 확인에 의존해 종속 표시를 남긴다.
// backend 파라미터 확정 전이라 체크 상태는 검색 요청에 아직 실리지 않는다.
const CANDIDATE_CONDITIONS: {
    key: keyof SearchFilters["candidateConditions"];
    label: string;
    description: string;
    dependent: boolean;
}[] = [
    {
        key: "remodelingCandidate",
        label: "추진 요건 충족",
        description: "용도·구조별 노후연한 충족 · 진행 중 개발행위 없음",
        dependent: false,
    },
    { key: "zoneConfirmed", label: "용도지역 확인됨", description: "토지이용계획 매칭 성공", dependent: false },
    {
        key: "farSurplusPositive",
        label: "용적률 여유 있음",
        description: "기준 > 0 — 용도지역 확인이 있어야 계산됩니다",
        dependent: true,
    },
    {
        key: "districtUnrestricted",
        label: "지구·구역 규제 제외",
        description: "지정된 구역 없음",
        dependent: false,
    },
];

interface LeftPanelContentProps {
    // 모바일 FilterDrawer에서만 전달 — 검색 실행 시 시트를 닫아 바로 아래 결과가 보이게 한다. 데스크톱(상시 노출)은 전달 안 함.
    onSearchSubmit?: () => void;
}

// F-04_SEARCH.md §2.1-g(2026-08-01): 결과 요약(등급별 건수)은 리스트 헤더로 이동 — LeftPanel은 조건 입력 전용.
// 2026-08-10 — guide/DIRECTORY_RESTRUCTURE.md §1: shared/components/layout/LeftPanel.tsx(레이아웃 슬롯 껍데기)에서
// 실제 컨텐츠(F-04 조건 검색)를 분리 — 같은 기능 폴더 안에서 filters/·SearchContext와 나란히 관리한다.
const LeftPanelContent = ({ onSearchSubmit }: LeftPanelContentProps = {}) => {
    // 위치 입력/선택 후보는 SearchContext가 들고 있다 — 탭을 옮기면 이 패널이 언마운트되는데, 대시보드에서
    // 자치구를 눌러 넘어온 위치가 검색창에도 남아 있어야 하기 때문(위치 기본값은 §0-C, 백엔드가 더 이상
    // 위치 미지정을 보정하지 않아 중구를 기본으로 표시해둔다).
    const {
        filters,
        updateFilters,
        runFilterSearch,
        runAddressSearch,
        addressInput,
        setAddressInput,
        locationCandidate: selectedCandidate,
        setLocationCandidate: setSelectedCandidate,
    } = useSearch();
    const [addressCandidates, setAddressCandidates] = useState<SearchIndexCandidate[]>([]);
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

        // §2.1-j item 4: 조건이 하나도 없으면 400을 받기 전에 프론트가 먼저 막는다(클라이언트 사전 차단 원칙,
        // §2.4와 동일). 인라인 검증은 백엔드 400 규칙과 항상 같은 범위여야 한다 — 프론트가 더 좁게 막으면
        // API는 받아주는 검색을 버튼이 거부하게 된다. 등급은 리스트 헤더 소관이라 이 검증 대상이 아니다(§2.1-g).
        const hasSearchCondition =
            selectedCandidate != null ||
            filters.buildYearMin != null ||
            filters.buildYearMax != null ||
            filters.propertyTypeFilters.length > 0 ||
            Object.values(filters.candidateConditions).some(Boolean);

        if (!hasSearchCondition) {
            setValidationError("위치·건축연도·유형·후보 조건 중 하나는 선택해야 합니다.");
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
                <BuildYearFilter
                    filters={filters}
                    onApply={applyBuildYearRange}
                    disabled={filters.candidateConditions.remodelingCandidate}
                />
                {filters.candidateConditions.remodelingCandidate && (
                    <p className="left-panel-field-note">추진 요건이 노후연한 기준을 포함합니다.</p>
                )}
            </div>

            <div className="left-panel-field">
                <Popover label="투자지표 (준비 중)" open={false} onToggle={() => {}} onClose={() => {}} disabled />
            </div>

            <div className="left-panel-field">
                후보 조건
                <ul className="left-panel-candidate-list">
                    {CANDIDATE_CONDITIONS.map((condition) => (
                        <li key={condition.key}>
                            <label className="left-panel-candidate">
                                <input
                                    type="checkbox"
                                    checked={filters.candidateConditions[condition.key]}
                                    onChange={(e) =>
                                        updateFilters({
                                            ...filters,
                                            candidateConditions: {
                                                ...filters.candidateConditions,
                                                [condition.key]: e.target.checked,
                                            },
                                        })
                                    }
                                />
                                <span className="left-panel-candidate-label">{condition.label}</span>
                            </label>
                            <span
                                className={
                                    condition.dependent
                                        ? "left-panel-candidate-desc is-dependent"
                                        : "left-panel-candidate-desc"
                                }
                            >
                                {condition.dependent ? `⚠ ${condition.description}` : condition.description}
                            </span>
                        </li>
                    ))}
                </ul>
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

export default LeftPanelContent;
