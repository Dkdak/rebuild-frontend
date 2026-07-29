import { useState } from "react";
import RangeSlider from "../../../../shared/components/common/RangeSlider";

const PYEONG_TO_SQM = 3.305785;

// planning/rebuild/면적.PNG 참고 — 9개 실측 tick + 맨 끝에 "무한대(열림)" 전용 sentinel tick 1개 추가한 10개.
// 주거용 4종(아파트/연립다세대/단독다세대/오피스텔)에 적용(§2.1-a).
// sentinel을 "100"과 분리해두는 이유: 분리하지 않으면 "70평"(70~100 버킷)의 끝이 곧 "무한대 처리 기준"과
// 같은 자리가 돼서, "70평"을 눌러도 닫힌 70~100이 아니라 열린 "70평 이상"으로 잘못 나온다(2026-07-30 확인).
const AREA_TICKS_PYEONG = [0, 10, 20, 30, 40, 50, 60, 70, 100, 100];
const LAST_INDEX = AREA_TICKS_PYEONG.length - 1;
// 프리셋 버튼은 각 tick에서 시작하는 구간(버킷)을 나타낸다(§2.1-c) — index 0("~10평")부터
// index 8("100평~", 위쪽이 열린 구간)까지 총 9개. index 9(LAST_INDEX)는 버튼이 없는 sentinel이다.
const PRESET_TICK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const LAST_PRESET_INDEX = PRESET_TICK_INDICES[PRESET_TICK_INDICES.length - 1];

const toSqm = (pyeong: number) => Math.round(pyeong * PYEONG_TO_SQM);

const boundLabel = (index: number, unit: "py" | "sqm"): string => {
    const pyeong = AREA_TICKS_PYEONG[index];
    return unit === "py" ? `${pyeong}평` : `${toSqm(pyeong)}㎡`;
};

// §2.1-d: ㎡는 공식 단위라 버킷 경계를 뭉뚱그릴 수 없어 항상 정확한 범위로 보여준다(버튼·요약 공용).
// 열린 하한은 "미만", 열린 상한은 "~"(평의 "이상"과 다르게 물결로 표시) — 문서에 명시된 그대로.
const sqmBucketLabel = (bucketStart: number): string => {
    const from = toSqm(AREA_TICKS_PYEONG[bucketStart]);
    const to = toSqm(AREA_TICKS_PYEONG[Math.min(bucketStart + 1, LAST_INDEX)]);
    if (bucketStart === 0) return `${to}㎡ 미만`;
    if (bucketStart === LAST_PRESET_INDEX) return `${from}㎡~`;
    return `${from}~${to}㎡`;
};

// 평 표기(버튼+요약 공용, 2026-07-31 재확정) — 가운데 버킷은 "10평대"처럼 축약, 양 끝은 물결(~)로 열림 표시.
// ㎡는 버킷 경계를 뭉뚱그릴 수 없어 항상 정확한 범위(sqmBucketLabel)를 쓴다 — 두 단위 표기 방식이 서로 다르다.
// bucketStart===LAST_PRESET_INDEX-1(70평 tick) 버킷만 폭이 70~100(30평)로 다른 버킷(10평씩)보다 훨씬 넓다 —
// "70평대"라고 하면 70~80만 뜻하는 것처럼 보여 혼동되므로, 그 구간의 상한(100)으로 이름 붙인다(2026-07-31).
const pyeongBucketLabel = (bucketStart: number): string => {
    if (bucketStart === 0) return `~${boundLabel(1, "py")}`;
    if (bucketStart === LAST_PRESET_INDEX) return `${boundLabel(bucketStart, "py")}~`;
    if (bucketStart === LAST_PRESET_INDEX - 1) return `${boundLabel(LAST_PRESET_INDEX, "py")}대`;
    return `${boundLabel(bucketStart, "py")}대`;
};

// 프리셋 버튼 라벨과 요약(단일 버킷 선택 시) 라벨이 이제 동일하다 — 버튼도 요약도 같은 §2.1-d 표기를 그대로 쓴다.
const presetLabel = (index: number, unit: "py" | "sqm"): string =>
    unit === "sqm" ? sqmBucketLabel(index) : pyeongBucketLabel(index);

interface AreaRangeControlProps {
    areaMin: number | null;
    areaMax: number | null;
    onChange: (areaMin: number | null, areaMax: number | null) => void;
}

// features/search: 면적 프리셋 컨트롤 — 평/㎡ 토글 + 듀얼 슬라이더 + 프리셋 그리드 (F-04_SEARCH.md §2.1-a, planning/rebuild/면적.PNG).
// Popover로 감싸지 않는다 — 부동산유형 아코디언 패널 안에 인라인으로 쓰인다.
// 슬라이더 드래그/트랙클릭은 §2.1-b(1번째=시작 미확정/2번째=끝 확정)를, 프리셋 버튼 클릭은 §2.1-c(원클릭 즉시 확정+합집합 확장)를 따른다 — 서로 다른 규칙.
const AreaRangeControl = ({ areaMin, areaMax, onChange }: AreaRangeControlProps) => {
    const [unit, setUnit] = useState<"py" | "sqm">("py");
    const [pendingStart, setPendingStart] = useState<number | null>(null);
    // 프리셋 전용 클릭 주기 — 0/1: 아직 확정 전(다음 클릭이 1번째 또는 2번째), 2: 이미 2클릭으로 확정됨(다음 클릭은 무조건 리셋).
    const [presetClickCount, setPresetClickCount] = useState(0);

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

    // 프리셋 버튼이 나타내는 구간 — [tickIndex, tickIndex+1). "100평~"(index 8)는 [8, LAST_INDEX(9)]로,
    // 끝이 sentinel(무한대)이라 applyRange가 이걸 null(상한 없음)로 바꿔준다 — 폭이 0인 버킷은 이제 없다.
    const bucketRange = (tickIndex: number): [number, number] => [tickIndex, Math.min(tickIndex + 1, LAST_INDEX)];

    // 프리셋 버튼: 슬라이더(§2.1-b)와 같은 2클릭 주기를 갖되, "미확정 대기" 없이 매 클릭이 바로 반영된다(§2.1-c).
    // 1번째 클릭 → 그 버킷 하나로 확정. 2번째 클릭(다른 버튼) → 합집합으로 확장, (같은 버튼) → 해제.
    // 3번째 클릭(이미 2클릭으로 확정된 뒤에 오는 모든 추가 클릭) → 기존 확정 범위를 버리고 이 클릭 하나로 새 주기 시작.
    const handlePresetClick = (tickIndex: number) => {
        const [bucketMin, bucketMax] = bucketRange(tickIndex);

        if (presetClickCount !== 1) {
            // 새 주기의 1번째 클릭 — 처음이거나, 이미 2클릭으로 확정된 뒤라 리셋하고 새로 시작.
            applyRange(bucketMin, bucketMax);
            setPresetClickCount(1);
            return;
        }

        // 새 주기의 2번째 클릭.
        const isSameBucket = confirmedMinIndex === bucketMin && confirmedMaxIndex === bucketMax;
        if (isSameBucket) {
            applyRange(0, LAST_INDEX);
            setPresetClickCount(0);
            return;
        }
        applyRange(Math.min(confirmedMinIndex, bucketMin), Math.max(confirmedMaxIndex, bucketMax));
        setPresetClickCount(2);
    };

    // 슬라이더를 직접 드래그하면(클릭식 프리셋과는 별개 동작) 즉시 양쪽을 확정하고 미확정 상태를 취소한다.
    const handleSliderChange = (nextMin: number, nextMax: number) => {
        setPendingStart(null);
        applyRange(nextMin, nextMax);
    };

    const handleReset = () => {
        setPendingStart(null);
        setPresetClickCount(0);
        applyRange(0, LAST_INDEX);
    };

    const isFullRange = pendingStart === null && confirmedMinIndex === 0 && confirmedMaxIndex === LAST_INDEX;
    // 버킷 폭이 정확히 1(=하나만 선택)일 때만 §2.1-d의 단일 버킷 축약 표기를 쓴다 — 여러 버킷에 걸치면 명시적 범위(item 2).
    const isSingleBucket = !isFullRange && confirmedMaxIndex - confirmedMinIndex === 1;
    const rangeText =
        pendingStart !== null
            ? `${presetLabel(pendingStart, unit)} ~ ?`
            : isFullRange
            ? "전체"
            : isSingleBucket
            ? presetLabel(confirmedMinIndex, unit)
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

            <div className="filter-preset-grid filter-preset-grid-area">
                {PRESET_TICK_INDICES.map((tickIndex) => {
                    const [bucketMin, bucketMax] = bucketRange(tickIndex);
                    // 이 버튼이 나타내는 구간이 확정된 범위 안에 통째로 들어가면 선택된 것으로 표시한다(§2.1-c).
                    // sentinel tick 분리로 모든 버킷이 실제 폭을 가지므로, 예외 없이 이 규칙 하나로 충분하다.
                    const selected = !isFullRange && bucketMin >= confirmedMinIndex && bucketMax <= confirmedMaxIndex;
                    return (
                        <button
                            key={tickIndex}
                            type="button"
                            className={`filter-preset-btn ${selected ? "filter-preset-btn-active" : ""}`}
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
