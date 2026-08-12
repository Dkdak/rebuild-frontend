import type { ReactNode } from "react";

// FEATURE_05_PROPERTY_INFO.md §2.1 "리모델링 가능성 섹션 시각화 — 게이지 바 채택(2026-08-08)": 노후도 달성률·
// 용적률 활용도 둘 다 "현재값/기준값" 비율 구조라 이 컴포넌트 하나를 공유한다.
// 2026-08-10 — 확정 목업(planning/rebuild/widgets/2026-08-10_remodeling_analysis_final.html) 반영: 라벨+바+
// 캡션 한 줄짜리 단순 구조에서, 큰 강조 숫자(bigValue)·tone별 색상·완료사유 배지(reasonBadge, 노후도 카드
// 전용)·일반 보조설명(note, 용적률 카드 전용)까지 확장. 두 카드가 서로 다른 하단 요소(배지 vs 일반 텍스트)를
// 쓰기 때문에 reasonBadge/note를 별도 prop으로 분리 — 하나로 합치면 스타일 분기가 호출부로 새어나간다.
// invertFill(용적률 카드 전용) — 이 카드는 "여유"가 헤드라인이라 트랙 전체를 tone색으로 채우고 사용된 부분만
// 배경색 바로 덮어써서(목업 원본 그대로) "차있는 게 곧 여유"로 읽히게 한다 — 일반 fill과 시각적으로 반대.
interface GaugeBarProps {
    label: string;
    bigValue: ReactNode;
    percent: number;
    tone: "success" | "warning" | "neutral";
    invertFill?: boolean;
    reasonBadge?: string;
    note?: string;
}

// 2026-08-10 추가 — 경고/성공 배지·정보 캡션에 아이콘 접두(사용자 지적: "정보인 경우는 느낌표 주면 안돼?").
// 이 프로젝트에서 이미 쓰던 글자 그대로 재사용(PropertyDetailContent.tsx의 ⚠, ReportPage.tsx 장점 목록의 ✓,
// SearchMap.tsx dev-notice의 ⓘ) — 새 아이콘 세트를 만들지 않는다.
const REASON_BADGE_ICON: Record<"success" | "warning" | "neutral", string> = {
    success: "✓",
    warning: "⚠",
    neutral: "ⓘ",
};

const GaugeBar = ({ label, bigValue, percent, tone, invertFill, reasonBadge, note }: GaugeBarProps) => {
    const width = Math.max(0, Math.min(100, percent));
    return (
        <div className="gauge-bar">
            <p className="gauge-bar-label">{label}</p>
            <p className={`gauge-bar-value gauge-bar-value-${tone}`}>{bigValue}</p>
            <div className={`gauge-bar-track ${invertFill ? `gauge-bar-track-filled-${tone}` : ""}`}>
                <div
                    className={invertFill ? "gauge-bar-fill-inverse" : `gauge-bar-fill gauge-bar-fill-${tone}`}
                    style={{ width: `${width}%` }}
                />
            </div>
            {reasonBadge && (
                <p className={`gauge-bar-reason-badge gauge-bar-reason-badge-${tone}`}>
                    <span aria-hidden="true">{REASON_BADGE_ICON[tone]}</span> {reasonBadge}
                </p>
            )}
            {/* note는 항상 "정보" 취급(ⓘ, tone과 무관) — 용적률 카드의 여유면적 설명처럼 경고/성공이 아니라
                참고용 부연설명이라 별도 색 톤(accent, 이 프로젝트의 기존 정보성 파란 톤) 고정. */}
            {note && (
                <p className="gauge-bar-note">
                    <span aria-hidden="true">ⓘ</span> {note}
                </p>
            )}
        </div>
    );
};

export default GaugeBar;
