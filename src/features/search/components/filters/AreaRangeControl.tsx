import { useState } from "react";
import RangeSlider from "../../../../shared/components/common/RangeSlider";

const PYEONG_TO_SQM = 3.305785;

// planning/rebuild/면적.PNG 참고 — 9개 tick(경계). 주거용 4종(아파트/연립다세대/단독다가구/오피스텔)에 적용(§2.1-a).
const AREA_TICKS_PYEONG = [0, 10, 20, 30, 40, 50, 60, 70, 100];
const LAST_INDEX = AREA_TICKS_PYEONG.length - 1;
// 프리셋 버튼은 각 tick "지점"을 고르는 포인트 선택자다(§2.1-b, 범위가 아니라 시작/끝 한 점) — index 0("0평")은
// 의미 있는 선택 지점이 아니라서 버튼을 두지 않는다(필요하면 슬라이더를 끝까지 드래그해서 도달 가능).
const PRESET_TICK_INDICES = [1, 2, 3, 4, 5, 6, 7, 8];

const toSqm = (pyeong: number) => Math.round(pyeong * PYEONG_TO_SQM);

const boundLabel = (index: number, unit: "py" | "sqm"): string => {
    const pyeong = AREA_TICKS_PYEONG[index];
    return unit === "py" ? `${pyeong}평` : `${toSqm(pyeong)}㎡`;
};

// 마지막 tick(index === LAST_INDEX)은 위쪽이 열려 있는 지점이라 "~"를 붙인다(예: "100평~").
const presetLabel = (index: number, unit: "py" | "sqm"): string =>
    index === LAST_INDEX ? `${boundLabel(index, unit)}~` : boundLabel(index, unit);

interface AreaRangeControlProps {
    areaMin: number | null;
    areaMax: number | null;
    onChange: (areaMin: number | null, areaMax: number | null) => void;
}

// features/search: 면적 프리셋 컨트롤 — 평/㎡ 토글 + 듀얼 슬라이더 + 프리셋 그리드 (F-04_SEARCH.md §2.1-a, planning/rebuild/면적.PNG).
// Popover로 감싸지 않는다 — 부동산유형 아코디언 패널 안에 인라인으로 쓰인다.
// §2.1-b: 프리셋 클릭은 1번째=시작(미확정)/2번째=끝(확정)을 반복한다 — 클릭 한 번에 즉시 확정되지 않는다.
const AreaRangeControl = ({ areaMin, areaMax, onChange }: AreaRangeControlProps) => {
    const [unit, setUnit] = useState<"py" | "sqm">("py");
    const [pendingStart, setPendingStart] = useState<number | null>(null);

    const sqmToTickIndex = (sqm: number | null, fallback: number): number => {
        if (sqm == null) return fallback;
        const idx = AREA_TICKS_PYEONG.findIndex((py) => toSqm(py) === sqm);
        return idx === -1 ? fallback : idx;
    };

    const confirmedMinIndex = sqmToTickIndex(areaMin, 0);
    const confirmedMaxIndex = sqmToTickIndex(areaMax, LAST_INDEX);

    // 확정된 값이 있을 땐 그대로 보여주고, 시작점만 찍은(미확정) 상태면 두 핸들을 그 지점에 겹쳐 보여준다.
    const minIndex = pendingStart ?? confirmedMinIndex;
    const maxIndex = pendingStart ?? confirmedMaxIndex;

    const applyRange = (nextMin: number, nextMax: number) => {
        const nextAreaMin = nextMin === 0 ? null : toSqm(AREA_TICKS_PYEONG[nextMin]);
        const nextAreaMax = nextMax === LAST_INDEX ? null : toSqm(AREA_TICKS_PYEONG[nextMax]);
        onChange(nextAreaMin, nextAreaMax);
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

    // 슬라이더를 직접 드래그하면(클릭식 프리셋과는 별개 동작) 즉시 양쪽을 확정하고 미확정 상태를 취소한다.
    const handleSliderChange = (nextMin: number, nextMax: number) => {
        setPendingStart(null);
        applyRange(nextMin, nextMax);
    };

    const handleReset = () => {
        setPendingStart(null);
        applyRange(0, LAST_INDEX);
    };

    const isFullRange = pendingStart === null && confirmedMinIndex === 0 && confirmedMaxIndex === LAST_INDEX;
    const rangeText =
        pendingStart !== null
            ? `${boundLabel(pendingStart, unit)} ~ ?`
            : isFullRange
            ? "전체"
            : confirmedMaxIndex === LAST_INDEX
            ? `${boundLabel(confirmedMinIndex, unit)} 이상`
            : confirmedMinIndex === 0
            ? `${boundLabel(confirmedMaxIndex, unit)} 이하`
            : `${boundLabel(confirmedMinIndex, unit)} ~ ${boundLabel(confirmedMaxIndex, unit)}`;

    return (
        <div className="area-range-control">
            <div className="filter-popover-unit-toggle">
                <button
                    type="button"
                    className={`filter-popover-unit-btn ${unit === "py" ? "filter-popover-unit-btn-active" : ""}`}
                    onClick={() => setUnit("py")}
                >
                    평
                </button>
                <button
                    type="button"
                    className={`filter-popover-unit-btn ${unit === "sqm" ? "filter-popover-unit-btn-active" : ""}`}
                    onClick={() => setUnit("sqm")}
                >
                    ㎡
                </button>
            </div>

            <p className="filter-popover-current-range">{rangeText}</p>

            <RangeSlider
                tickCount={AREA_TICKS_PYEONG.length}
                minIndex={minIndex}
                maxIndex={maxIndex}
                onChange={handleSliderChange}
            />

            <div className="filter-preset-grid">
                {PRESET_TICK_INDICES.map((tickIndex) => {
                    const isPending = pendingStart === tickIndex;
                    // isFullRange(아무 것도 선택 안 한 기본 상태, min=0&&max=LAST_INDEX 둘 다 기본값)일 땐 아무 버튼도 켜지지 않아야 한다.
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
                            key={tickIndex}
                            type="button"
                            className={`filter-preset-btn ${active ? "filter-preset-btn-active" : ""} ${
                                inRange ? "filter-preset-btn-in-range" : ""
                            } ${isPending ? "filter-preset-btn-pending" : ""}`}
                            onClick={() => handlePresetClick(tickIndex)}
                        >
                            {presetLabel(tickIndex, unit)}
                        </button>
                    );
                })}
            </div>

            <button type="button" className="filter-popover-reset" onClick={handleReset}>
                조건삭제
            </button>
        </div>
    );
};

export default AreaRangeControl;
