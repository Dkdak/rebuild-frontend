import { formatCount } from "../data/dashboardStats";

// 대시보드 분포 카드(투자등급·건물 유형)의 도넛 + 범례. 값은 이미 산출된 비율을 그대로 그리기만 한다.
// onSelectSegment가 있으면 조각과 범례가 지도 탭 진입점이 된다 — 키보드로도 쓸 수 있게 범례를 button으로
// 바꾸고, 도넛 조각은 같은 동작의 마우스 단축 경로로만 둔다(포커스 대상 중복을 만들지 않는다).
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface DonutSegment {
    label: string;
    count: number;
    ratio: number;
    tone: string;
}

interface DonutStatProps {
    total: number;
    unit: string;
    segments: DonutSegment[];
    onSelectSegment?: (segment: DonutSegment) => void;
    selectHint?: (segment: DonutSegment) => string;
    // 같은 카드 안에서도 지도로 옮길 수 있는 항목과 아닌 항목이 섞인다(건물 유형) — 옮길 수 없는 항목은
    // hover·커서 표시도 없이 텍스트로만 남긴다.
    isSelectable?: (segment: DonutSegment) => boolean;
}

// 각 조각의 시작 위치는 앞 조각들의 길이 누적값이라, 렌더 중 변수를 누적하지 않고 미리 계산해 둔다.
const toArcs = (segments: DonutSegment[]) =>
    segments.map((segment, index) => {
        const previousRatio = segments.slice(0, index).reduce((sum, item) => sum + item.ratio, 0);

        return {
            ...segment,
            length: (segment.ratio / 100) * CIRCUMFERENCE,
            offset: -(previousRatio / 100) * CIRCUMFERENCE,
        };
    });

const DonutStat = ({ total, unit, segments, onSelectSegment, selectHint, isSelectable }: DonutStatProps) => {
    const canSelect = (segment: DonutSegment) =>
        Boolean(onSelectSegment) && (isSelectable ? isSelectable(segment) : true);

    return (
        <div className="dashboard-donut">
            <svg viewBox="0 0 120 120" width="112" height="112" role="img" aria-label="분포 도넛 차트">
                {toArcs(segments).map((arc) => (
                    <circle
                        key={arc.label}
                        cx="60"
                        cy="60"
                        r={RADIUS}
                        fill="none"
                        strokeWidth="18"
                        className={
                            canSelect(arc)
                                ? `dashboard-donut-arc is-clickable dashboard-tone-${arc.tone}`
                                : `dashboard-donut-arc dashboard-tone-${arc.tone}`
                        }
                        strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                        strokeDashoffset={arc.offset}
                        transform="rotate(-90 60 60)"
                        onClick={canSelect(arc) ? () => onSelectSegment?.(arc) : undefined}
                    />
                ))}
                <text x="60" y="57" className="dashboard-donut-total" textAnchor="middle">
                    {formatCount(total)}
                </text>
                <text x="60" y="72" className="dashboard-donut-unit" textAnchor="middle">
                    {unit}
                </text>
            </svg>
            <ul className="dashboard-legend">
                {segments.map((segment) => {
                    const row = (
                        <>
                            <span className={`dashboard-legend-swatch dashboard-tone-${segment.tone}`} />
                            <span className="dashboard-legend-label">{segment.label}</span>
                            <span className="dashboard-legend-count">{formatCount(segment.count)}</span>
                            <span className="dashboard-legend-ratio">{segment.ratio}%</span>
                        </>
                    );

                    return (
                        <li key={segment.label}>
                            {canSelect(segment) ? (
                                <button
                                    type="button"
                                    className="dashboard-legend-row is-clickable"
                                    onClick={() => onSelectSegment?.(segment)}
                                    title={selectHint ? selectHint(segment) : undefined}
                                >
                                    {row}
                                </button>
                            ) : (
                                <div className="dashboard-legend-row">{row}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default DonutStat;
