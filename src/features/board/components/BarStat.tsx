import { formatCount } from "../data/dashboardStats";

// 대시보드 분포 카드(ROI 구간·노후도)의 막대. 건수가 0인 구간도 막대 없이 라벨과 0을 그대로 남긴다 —
// "0이라는 사실" 자체가 후보 정의(용도·구조별 노후연한)를 설명하는 정보라서다.
interface BarItem {
    label: string;
    count: number;
    negative: boolean;
}

interface BarStatProps {
    items: BarItem[];
}

const BarStat = ({ items }: BarStatProps) => {
    const max = Math.max(...items.map((item) => item.count), 1);

    return (
        <div className="dashboard-bars">
            {items.map((item) => (
                <div className="dashboard-bar-col" key={item.label}>
                    <span className="dashboard-bar-count">{formatCount(item.count)}</span>
                    <span
                        className={item.negative ? "dashboard-bar-fill is-negative" : "dashboard-bar-fill"}
                        style={{ height: `${(item.count / max) * 100}%` }}
                    />
                    <span className="dashboard-bar-label">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

export default BarStat;
