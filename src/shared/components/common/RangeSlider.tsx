interface RangeSliderProps {
    tickCount: number;
    minIndex: number;
    maxIndex: number;
    onChange: (minIndex: number, maxIndex: number) => void;
}

// shared/components/common: 고정된 tick 개수 위를 움직이는 듀얼 핸들 슬라이더 (HELP5.md §2.2).
// 실제 값(평/㎡, 연차 등)으로의 변환은 사용하는 쪽(feature)에서 tick index를 기준으로 처리한다.
const RangeSlider = ({ tickCount, minIndex, maxIndex, onChange }: RangeSliderProps) => {
    const lastIndex = tickCount - 1;

    const handleMinChange = (value: number) => {
        onChange(Math.min(value, maxIndex), maxIndex);
    };
    const handleMaxChange = (value: number) => {
        onChange(minIndex, Math.max(value, minIndex));
    };

    const minPercent = lastIndex === 0 ? 0 : (minIndex / lastIndex) * 100;
    const maxPercent = lastIndex === 0 ? 100 : (maxIndex / lastIndex) * 100;

    return (
        <div className="range-slider">
            <div className="range-slider-track">
                <div
                    className="range-slider-track-fill"
                    style={{ left: `${minPercent}%`, width: `${maxPercent - minPercent}%` }}
                />
            </div>
            <input
                type="range"
                className="range-slider-input"
                min={0}
                max={lastIndex}
                step={1}
                value={minIndex}
                onChange={(e) => handleMinChange(Number(e.target.value))}
                aria-label="최소값"
            />
            <input
                type="range"
                className="range-slider-input"
                min={0}
                max={lastIndex}
                step={1}
                value={maxIndex}
                onChange={(e) => handleMaxChange(Number(e.target.value))}
                aria-label="최대값"
            />
        </div>
    );
};

export default RangeSlider;
