import { useState } from "react";
import RangeSlider from "../../../../shared/components/common/RangeSlider";

// 상업업무용/공장창고 면적 슬라이더 — 기존 드롭다운(select) UI를 슬라이더로 전환(사용자 제공 참고 이미지 기준).
// 두 유형 모두 면적 분포가 극단적으로 넓어(§2.1-a, 공장창고 95%ile 9,298평) 평 단위가 아니라 ㎡ 단위 큰 구간으로 나눈다 —
// 주거용(AreaRangeControl)과 달리 평/㎡ 토글은 없음(상업/산업용 실무에서는 ㎡가 기본).
// 각 구간 폭이 서로 달라(100/900/4,000/5,000/90,000㎡ 등) AREA_TICKS_PYEONG처럼 균등 폭이 아니다 — 마지막에
// sentinel(마지막 값 중복)을 추가해 "100,000㎡초과"(열린 구간)가 닫힌 마지막 버킷과 같은 인덱스를 공유하지 않게 한다
// (AreaRangeControl에서 sentinel 분리 없이 겪었던 "닫힌 구간이 열린 구간으로 잘못 표시되는" 버그를 처음부터 방지).
const TICKS_SQM = [0, 100, 1000, 5000, 10000, 100000, 100000];
const LAST_INDEX = TICKS_SQM.length - 1;
const PRESET_TICK_INDICES = [0, 1, 2, 3, 4, 5];
const LAST_PRESET_INDEX = PRESET_TICK_INDICES[PRESET_TICK_INDICES.length - 1];

const fmt = (sqm: number): string => sqm.toLocaleString();

// 버튼 라벨 — 주거용 AreaRangeControl의 ㎡ 모드(sqmBucketLabel)와 동일한 물결(~) 축약 표기를 그대로 따른다:
// 열린 하한은 "미만", 열린 상한은 "~", 가운데 버킷은 "from~to㎡" — "초과/이하" 같은 장황한 문구는 쓰지 않는다.
const bucketLabel = (bucketStart: number): string => {
    const from = TICKS_SQM[bucketStart];
    const to = TICKS_SQM[Math.min(bucketStart + 1, LAST_INDEX)];
    if (bucketStart === 0) return `${fmt(to)}㎡ 미만`;
    if (bucketStart === LAST_PRESET_INDEX) return `${fmt(from)}㎡~`;
    return `${fmt(from)}~${fmt(to)}㎡`;
};

interface CommercialAreaRangeControlProps {
    areaMin: number | null;
    areaMax: number | null;
    onChange: (areaMin: number | null, areaMax: number | null) => void;
}

// features/search: 상업업무용/공장창고 면적 슬라이더 — 듀얼 슬라이더 + 프리셋 그리드, 평/㎡ 토글 없음(항상 ㎡).
// Popover로 감싸지 않는다 — 부동산유형 아코디언 패널 안에 인라인으로 쓰인다(AreaRangeControl과 동일 배치).
// 슬라이더 드래그/트랙클릭은 §2.1-b(1번째=시작 미확정/2번째=끝 확정), 프리셋 버튼은 §2.1-c(원클릭 즉시 확정+합집합 확장) 규칙을 그대로 따른다.
const CommercialAreaRangeControl = ({ areaMin, areaMax, onChange }: CommercialAreaRangeControlProps) => {
    const [pendingStart, setPendingStart] = useState<number | null>(null);
    const [presetClickCount, setPresetClickCount] = useState(0);

    const sqmToTickIndex = (sqm: number | null, fallback: number): number => {
        if (sqm == null) return fallback;
        const idx = TICKS_SQM.findIndex((v) => v === sqm);
        return idx === -1 ? fallback : idx;
    };

    const confirmedMinIndex = sqmToTickIndex(areaMin, 0);
    const confirmedMaxIndex = sqmToTickIndex(areaMax, LAST_INDEX);

    const minIndex = pendingStart ?? confirmedMinIndex;
    const maxIndex = pendingStart ?? confirmedMaxIndex;

    const applyRange = (nextMin: number, nextMax: number) => {
        const nextAreaMin = nextMin === 0 ? null : TICKS_SQM[nextMin];
        const nextAreaMax = nextMax === LAST_INDEX ? null : TICKS_SQM[nextMax];
        onChange(nextAreaMin, nextAreaMax);
    };

    const bucketRange = (tickIndex: number): [number, number] => [tickIndex, Math.min(tickIndex + 1, LAST_INDEX)];

    const handlePresetClick = (tickIndex: number) => {
        const [bucketMin, bucketMax] = bucketRange(tickIndex);

        if (presetClickCount !== 1) {
            applyRange(bucketMin, bucketMax);
            setPresetClickCount(1);
            return;
        }

        const isSameBucket = confirmedMinIndex === bucketMin && confirmedMaxIndex === bucketMax;
        if (isSameBucket) {
            applyRange(0, LAST_INDEX);
            setPresetClickCount(0);
            return;
        }
        applyRange(Math.min(confirmedMinIndex, bucketMin), Math.max(confirmedMaxIndex, bucketMax));
        setPresetClickCount(2);
    };

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
    const isSingleBucket = !isFullRange && confirmedMaxIndex - confirmedMinIndex === 1;
    const rangeText =
        pendingStart !== null
            ? `${bucketLabel(pendingStart)} ~ ?`
            : isFullRange
            ? "전체"
            : isSingleBucket
            ? bucketLabel(confirmedMinIndex)
            : confirmedMaxIndex === LAST_INDEX
            ? `${fmt(TICKS_SQM[confirmedMinIndex])}㎡ 이상`
            : confirmedMinIndex === 0
            ? `${fmt(TICKS_SQM[confirmedMaxIndex])}㎡ 이하`
            : `${fmt(TICKS_SQM[confirmedMinIndex])}㎡ ~ ${fmt(TICKS_SQM[confirmedMaxIndex])}㎡`;

    return (
        <div className="area-range-control">
            <p className="filter-popover-current-range">{rangeText}</p>

            <RangeSlider
                tickCount={TICKS_SQM.length}
                minIndex={minIndex}
                maxIndex={maxIndex}
                onChange={handleSliderChange}
            />

            <div className="filter-preset-grid filter-preset-grid-commercial">
                {PRESET_TICK_INDICES.map((tickIndex) => {
                    const [bucketMin, bucketMax] = bucketRange(tickIndex);
                    const selected = !isFullRange && bucketMin >= confirmedMinIndex && bucketMax <= confirmedMaxIndex;
                    return (
                        <button
                            key={tickIndex}
                            type="button"
                            className={`filter-preset-btn ${selected ? "filter-preset-btn-active" : ""}`}
                            onClick={() => handlePresetClick(tickIndex)}
                        >
                            {bucketLabel(tickIndex)}
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

export default CommercialAreaRangeControl;
