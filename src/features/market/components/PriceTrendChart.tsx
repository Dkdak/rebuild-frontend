import type { PriceTrendPoint } from "../api/marketApi";

// FEATURE_10_AI_REPORT.md §2.4 "시세 추이" 꺾은선 그래프 — SitePolygonDiagram.tsx와 같은 원칙(차트 라이브러리
// 없이 순수 SVG). x축은 매물이 있는 달만 촘촘히 이어붙인다(결측월 포함 등간격이 아니라 "거래가 있었던 달"만).
interface PriceTrendChartProps {
    points: PriceTrendPoint[];
}

const PriceTrendChart = ({ points }: PriceTrendChartProps) => {
    if (points.length < 2) {
        return <p className="right-panel-field-note">추이 표시 불가(비교 가능한 기간 부족)</p>;
    }

    const width = 280;
    const height = 100;
    const padX = 8;
    const padY = 14;

    const prices = points.map((p) => p.medianPricePerSqm);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const x = (index: number) => padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = (price: number) => padY + (1 - (price - minPrice) / priceRange) * (height - padY * 2);

    const linePoints = points.map((p, i) => `${x(i).toFixed(1)},${y(p.medianPricePerSqm).toFixed(1)}`).join(" ");
    const first = points[0];
    const last = points[points.length - 1];

    return (
        <div className="report-price-trend">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="시세 추이">
                <polyline points={linePoints} fill="none" stroke="var(--accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                {points.map((p, i) => (
                    // eslint-disable-next-line react/no-array-index-key -- 시간순 고정 배열, 재정렬되지 않는다.
                    <circle key={i} cx={x(i)} cy={y(p.medianPricePerSqm)} r={1.6} fill="var(--accent)" />
                ))}
            </svg>
            <div className="report-price-trend-labels">
                <span>
                    {first.month} · {Math.round(first.medianPricePerSqm).toLocaleString()}만원/㎡
                </span>
                <span>
                    {last.month} · {Math.round(last.medianPricePerSqm).toLocaleString()}만원/㎡
                </span>
            </div>
        </div>
    );
};

export default PriceTrendChart;
