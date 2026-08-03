// FEATURE_05_PROPERTY_INFO.md §2.1 "리모델링 가능성 섹션 시각화 — 게이지 바 채택(2026-08-08)": 노후도 달성률·
// 용적률 활용도 둘 다 "현재값/기준값" 비율 구조라 이 컴포넌트 하나를 공유한다 — 라벨(현재·기준 병기)+진행률 바+보조 설명.
interface GaugeBarProps {
    label: string;
    percent: number;
    tone: "success" | "warning" | "neutral";
    caption?: string;
}

const GaugeBar = ({ label, percent, tone, caption }: GaugeBarProps) => {
    const width = Math.max(0, Math.min(100, percent));
    return (
        <div className="gauge-bar">
            <p className="gauge-bar-label">{label}</p>
            <div className="gauge-bar-track">
                <div className={`gauge-bar-fill gauge-bar-fill-${tone}`} style={{ width: `${width}%` }} />
            </div>
            {caption && <p className="gauge-bar-caption">{caption}</p>}
        </div>
    );
};

export default GaugeBar;
