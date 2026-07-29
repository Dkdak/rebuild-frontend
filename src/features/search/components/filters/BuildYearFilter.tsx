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
// 슬라이더 드래그/트랙클릭은 §2.1-b(1번째=시작 미확정/2번째=끝 확정)를, 프리셋 버튼 클릭은 §2.1-c(원클릭 즉시 확정+합집합 확장)를 따른다 — 서로 다른 규칙.
const BuildYearFilter = ({ filters, onApply }: BuildYearFilterProps) => {
    const [open, setOpen] = useState(false);
    const [pendingStart, setPendingStart] = useState<number | null>(null);
    // 프리셋 전용 클릭 주기 — 0/1: 아직 확정 전(다음 클릭이 1번째 또는 2번째), 2: 이미 2클릭으로 확정됨(다음 클릭은 무조건 리셋).
    const [presetClickCount, setPresetClickCount] = useState(0);

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

    // 프리셋 버튼: 원클릭 즉시 확정(§2.1-c, AreaRangeControl과 동일한 규칙) — 슬라이더의 2-클릭 대기(§2.1-b)와는 별개.
    // 각 tick은 면적처럼 폭 있는 버킷이 아니라 점(point)이라, 1번째 클릭은 그 점 하나(min=max=그 지점)로 확정한다.
    // 2번째 클릭(다른 점) → 두 점을 잇는 범위로 확장. 2번째 클릭(같은 점) → 해제. 3번째 이후 → 리셋하고 새로 시작.
    const handlePresetClick = (tickIndex: number) => {
        if (presetClickCount !== 1) {
            applyRange(tickIndex, tickIndex);
            setPresetClickCount(1);
            return;
        }

        const isSamePoint = confirmedMinIndex === tickIndex && confirmedMaxIndex === tickIndex;
        if (isSamePoint) {
            applyRange(0, LAST_INDEX);
            setPresetClickCount(0);
            return;
        }
        applyRange(Math.min(confirmedMinIndex, tickIndex), Math.max(confirmedMaxIndex, tickIndex));
        setPresetClickCount(2);
    };

    // 슬라이더를 직접 드래그하면 즉시 양쪽을 확정하고 미확정 상태를 취소한다.
    const handleSliderChange = (nextMin: number, nextMax: number) => {
        setPendingStart(null);
        applyRange(nextMin, nextMax);
    };

    const handleReset = () => {
        setPendingStart(null);
        setPresetClickCount(0);
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
            : confirmedMinIndex === confirmedMaxIndex
            ? confirmedMinIndex === LAST_INDEX
                ? `${AGE_TICKS[confirmedMinIndex].label} 이상`
                : AGE_TICKS[confirmedMinIndex].label
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
                    // 이 지점이 확정된 범위 안에 들어가면 선택된 것으로 표시한다(포인트라 양끝 포함, §2.1-c).
                    const selected = !isFullRange && tickIndex >= confirmedMinIndex && tickIndex <= confirmedMaxIndex;
                    return (
                        <button
                            key={tick.label}
                            type="button"
                            className={`filter-preset-btn ${selected ? "filter-preset-btn-active" : ""}`}
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
