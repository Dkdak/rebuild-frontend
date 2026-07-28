import type { PropertyTypeFilter } from "../../api/searchApi";
import AreaRangeControl from "./AreaRangeControl";

// F-04_SEARCH.md §0-D: 6종 전부. §2.1-a: 주거용 4종만 면적 프리셋 재사용, 상업업무용/공장창고는
// 실제 면적 분포 조사 전이라(§5.1 Open Item) 프리셋 없이 단순 최소/최대 입력으로 둔다.
const PROPERTY_TYPES = ["아파트", "연립다세대", "단독다가구", "오피스텔", "상업업무용", "공장창고"];
const PRESET_TYPES = new Set(["아파트", "연립다세대", "단독다가구", "오피스텔"]);
const OFFICETEL = "오피스텔";

interface PropertyTypeAccordionProps {
    propertyTypeFilters: PropertyTypeFilter[];
    onChange: (next: PropertyTypeFilter[]) => void;
}

// features/search: 부동산유형 체크박스 + 유형별 면적·매매가 아코디언 (F-04_SEARCH.md §2.1-a).
const PropertyTypeAccordion = ({ propertyTypeFilters, onChange }: PropertyTypeAccordionProps) => {
    const isSelected = (type: string) => propertyTypeFilters.some((f) => f.type === type);

    // 체크: 처음 선택한 유형만 기본 펼침, 이후 추가되는 유형은 접힌 채로 추가(§2.1-a step 3).
    // 체크 해제: 해당 유형의 패널과 입력값을 함께 제거(§2.1-a step 5).
    const toggleType = (type: string) => {
        if (isSelected(type)) {
            onChange(propertyTypeFilters.filter((f) => f.type !== type));
            return;
        }
        const expanded = propertyTypeFilters.length === 0;
        onChange([...propertyTypeFilters, { type, areaMin: null, areaMax: null, expanded }]);
    };

    // 여러 패널을 동시에 펼쳐둘 수 있다 — 클래식(하나만 열리는) 아코디언 아님(§2.1-a step 4).
    const toggleExpanded = (type: string) => {
        onChange(propertyTypeFilters.map((f) => (f.type === type ? { ...f, expanded: !f.expanded } : f)));
    };

    const updateArea = (type: string, areaMin: number | null, areaMax: number | null) => {
        onChange(propertyTypeFilters.map((f) => (f.type === type ? { ...f, areaMin, areaMax } : f)));
    };

    return (
        <div className="property-type-accordion">
            <div className="left-panel-checkbox-group">
                {PROPERTY_TYPES.map((type) => (
                    <label key={type} className="left-panel-checkbox-item">
                        <input type="checkbox" checked={isSelected(type)} onChange={() => toggleType(type)} />
                        {type}
                    </label>
                ))}
            </div>

            {propertyTypeFilters.map((filter) => (
                <div key={filter.type} className="property-type-panel">
                    <button
                        type="button"
                        className="property-type-panel-header"
                        onClick={() => toggleExpanded(filter.type)}
                    >
                        <span>{filter.type}</span>
                        <span className="popover-trigger-caret">{filter.expanded ? "▴" : "▾"}</span>
                    </button>

                    {filter.expanded && (
                        <div className="property-type-panel-body">
                            {filter.type === OFFICETEL && (
                                <p className="left-panel-field-note">
                                    매핑 데이터가 없어 오피스텔은 항상 0건으로 조회됩니다.
                                </p>
                            )}

                            <div className="property-type-panel-field">
                                <span className="property-type-panel-label">면적</span>
                                {PRESET_TYPES.has(filter.type) ? (
                                    <AreaRangeControl
                                        areaMin={filter.areaMin}
                                        areaMax={filter.areaMax}
                                        onChange={(areaMin, areaMax) => updateArea(filter.type, areaMin, areaMax)}
                                    />
                                ) : (
                                    <div className="left-panel-range-plain">
                                        <input
                                            type="number"
                                            placeholder="최소(㎡)"
                                            value={filter.areaMin ?? ""}
                                            onChange={(e) =>
                                                updateArea(
                                                    filter.type,
                                                    e.target.value === "" ? null : Number(e.target.value),
                                                    filter.areaMax
                                                )
                                            }
                                        />
                                        <span>~</span>
                                        <input
                                            type="number"
                                            placeholder="최대(㎡)"
                                            value={filter.areaMax ?? ""}
                                            onChange={(e) =>
                                                updateArea(
                                                    filter.type,
                                                    filter.areaMin,
                                                    e.target.value === "" ? null : Number(e.target.value)
                                                )
                                            }
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="property-type-panel-field">
                                <span className="property-type-panel-label">매매가</span>
                                <span className="left-panel-field-note">준비 중</span>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default PropertyTypeAccordion;
