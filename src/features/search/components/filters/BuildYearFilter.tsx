import { useState } from "react";
import Popover from "../../../../shared/components/common/Popover";
import RangeSlider from "../../../../shared/components/common/RangeSlider";
import type { SearchFilters } from "../../api/searchApi";

// planning/rebuild/사용승인일.PNG 참고 — 준공 후 경과 연차 tick.
const AGE_TICKS = [
    { label: "입주예정", years: 0 },
    { label: "2년", years: 2 },
    { label: "4년", years: 4 },
    { label: "10년", years: 10 },
    { label: "15년", years: 15 },
    { label: "20년", years: 20 },
    { label: "25년", years: 25 },
    { label: "30년", years: 30 },
];
const LAST_INDEX = AGE_TICKS.length - 1;
const CURRENT_YEAR = new Date().getFullYear();

const yearsToBuildYear = (years: number) => CURRENT_YEAR - years;

interface BuildYearFilterProps {
    filters: SearchFilters;
    onApply: (buildYearMin: number | null, buildYearMax: number | null) => void;
}

// features/search: 사용승인일(건축연도) 필터 — 경과 연차 슬라이더 + 프리셋 그리드.
// §2.1-b: 프리셋 클릭은 1번째=시작(미확정)/2번째=끝(확정)을 반복한다 — 클릭 한 번에 즉시 확정되지 않는다.
const BuildYearFilter = ({ filters, onApply }: BuildYearFilterProps) => {
    const [open, setOpen] = useState(false);
    const [pendingStart, setPendingStart] = useState<number | null>(null);

    // buildYearMax(최신 상한) ↔ ageMinIndex, buildYearMin(최고령 하한) ↔ ageMaxIndex — 나이와 연도는 역방향.
    const buildYearToMinIndex = (): number => {
        if (filters.buildYearMax == null) return 0;
        const idx = AGE_TICKS.findIndex((t) => yearsToBuildYear(t.years) === filters.buildYearMax);
        return idx === -1 ? 0 : idx;
    };
    const buildYearToMaxIndex = (): number => {
        if (filters.buildYearMin == null) return LAST_INDEX;
        const idx = AGE_TICKS.findIndex((t) => yearsToBuildYear(t.years) === filters.buildYearMin);
        return idx === -1 ? LAST_INDEX : idx;
    };

    const confirmedMinIndex = buildYearToMinIndex();
    const confirmedMaxIndex = buildYearToMaxIndex();

    // 확정된 값이 있을 땐 그대로 보여주고, 시작점만 찍은(미확정) 상태면 두 핸들을 그 지점에 겹쳐 보여준다.
    const minIndex = pendingStart ?? confirmedMinIndex;
    const maxIndex = pendingStart ?? confirmedMaxIndex;

    const applyRange = (nextMin: number, nextMax: number) => {
        const buildYearMax = nextMin === 0 ? null : yearsToBuildYear(AGE_TICKS[nextMin].years);
        const buildYearMin = nextMax === LAST_INDEX ? null : yearsToBuildYear(AGE_TICKS[nextMax].years);
        onApply(buildYearMin, buildYearMax);
    };

    // 프리셋 클릭: 미확정 상태가 아니면(홀수 번째) 기존 확정값을 지우고 시작점만 기록,
    // 미확정 상태면(짝수 번째) 시작점과 이번 클릭 지점으로 범위를 확정한다(§2.1-b).
    const handlePresetClick = (tickIndex: number) => {
        if (pendingStart === null) {
            applyRange(0, LAST_INDEX);
            setPendingStart(tickIndex);
            return;
        }
        applyRange(Math.min(pendingStart, tickIndex), Math.max(pendingStart, tickIndex));
        setPendingStart(null);
    };

    // 슬라이더를 직접 드래그하면 즉시 양쪽을 확정하고 미확정 상태를 취소한다.
    const handleSliderChange = (nextMin: number, nextMax: number) => {
        setPendingStart(null);
        applyRange(nextMin, nextMax);
    };

    const handleReset = () => {
        setPendingStart(null);
        applyRange(0, LAST_INDEX);
    };

    const handleClose = () => {
        setPendingStart(null);
        setOpen(false);
    };

    const isFullRange = pendingStart === null && confirmedMinIndex === 0 && confirmedMaxIndex === LAST_INDEX;
    const rangeText =
        pendingStart !== null
            ? `${AGE_TICKS[pendingStart].label} ~ ?`
            : isFullRange
            ? "전체"
            : confirmedMaxIndex === LAST_INDEX
            ? `${AGE_TICKS[confirmedMinIndex].label} 이상`
            : confirmedMinIndex === 0
            ? `${AGE_TICKS[confirmedMaxIndex].label} 이하`
            : `${AGE_TICKS[confirmedMinIndex].label} ~ ${AGE_TICKS[confirmedMaxIndex].label}`;

    const triggerLabel = isFullRange ? "사용승인일" : rangeText;

    return (
        <Popover label={triggerLabel} open={open} onToggle={() => setOpen((v) => !v)} onClose={handleClose}>
            <div className="filter-popover-title">
                <button type="button" className="filter-popover-close" onClick={handleClose}>
                    ✕
                </button>
            </div>

            <p className="filter-popover-current-range">{rangeText}</p>

            <RangeSlider
                tickCount={AGE_TICKS.length}
                minIndex={minIndex}
                maxIndex={maxIndex}
                onChange={handleSliderChange}
            />

            <div className="filter-preset-grid">
                {AGE_TICKS.map((tick, tickIndex) => {
                    const isPending = pendingStart === tickIndex;
                    // isFullRange(아무 것도 선택 안 한 기본 상태)일 땐 아무 버튼도 켜지지 않아야 한다(AreaRangeControl과 동일 규칙).
                    const active =
                        !isPending &&
                        pendingStart === null &&
                        !isFullRange &&
                        (tickIndex === confirmedMinIndex || tickIndex === confirmedMaxIndex);
                    const inRange =
                        !active &&
                        !isPending &&
                        pendingStart === null &&
                        !isFullRange &&
                        tickIndex > confirmedMinIndex &&
                        tickIndex < confirmedMaxIndex;
                    return (
                        <button
                            key={tick.label}
                            type="button"
                            className={`filter-preset-btn ${active ? "filter-preset-btn-active" : ""} ${
                                inRange ? "filter-preset-btn-in-range" : ""
                            } ${isPending ? "filter-preset-btn-pending" : ""}`}
                            onClick={() => handlePresetClick(tickIndex)}
                        >
                            {/* 마지막 tick은 위쪽이 열려 있다 — 30년 이상(50년·100년 등 더 오래된 건물도 포함)임을 표시(§2.1-b). */}
                            {tickIndex === LAST_INDEX ? `${tick.label}~` : tick.label}
                        </button>
                    );
                })}
            </div>

            <button type="button" className="filter-popover-reset" onClick={handleReset}>
                조건삭제
            </button>
        </Popover>
    );
};

export default BuildYearFilter;
