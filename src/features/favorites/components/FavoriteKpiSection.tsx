import type { FavoriteRow } from "../api/favoritesApi";

// planning/rebuild/ReValue_대시보드_콘텐츠_구성안.md §2 — 로그인 직후 맨 위에서 보는 "내 파이프라인" 요약.
// 모든 지표가 관심목록 기준이다(서비스 전체 통계가 아니다, §10-4). 평균 투자등급은 넣지 않는다 — 등급은
// 순서 척도라 평균을 낼 수 없다(집계 영역과 같은 원칙).
// "확인 필요"는 넣지 않는다 — 어떻게 정의해도 다른 지표와 겹친다(ROI 산출 불가는 "ROI 산출 가능"의 여집합,
// 미시작은 관심목록 표의 실측 상태 컬럼, 미시작+진행중은 "실측 진행 중"을 삼킨다). 그 역할은 표의 실측 상태와
// 실측 진행 현황 카드의 "다음 입력 항목"이 더 구체적으로 답한다.
// "실측 진행 중"은 F-19 목록 API가 나와야 채워져서 지금은 자리만 둔다.
interface FavoriteKpiSectionProps {
    rows: FavoriteRow[] | null;
    onGoToMap: () => void;
}

const FavoriteKpiSection = ({ rows, onGoToMap }: FavoriteKpiSectionProps) => {
    const items = rows ?? [];
    const gradeACount = items.filter((row) => row.property?.grade === "A").length;
    const roiAvailableCount = items.filter((row) => row.property?.roi != null).length;

    if (rows != null && items.length === 0) {
        return (
            <section className="dashboard-card">
                <p className="dashboard-side-title">오늘의 한눈에 요약</p>
                <p className="dashboard-card-note">관심 매물을 담으면 여기에 현황이 표시됩니다.</p>
                <button type="button" className="dashboard-retry-btn" onClick={onGoToMap}>
                    지도에서 매물 찾기
                </button>
            </section>
        );
    }

    return (
        <section className="dashboard-card">
            <p className="dashboard-side-title">오늘의 한눈에 요약</p>
            <div className="dashboard-kpi-grid">
                <div className="dashboard-kpi">
                    <p className="dashboard-kpi-label">관심 건물</p>
                    <p className="dashboard-kpi-value">
                        {items.length}
                        <small>동</small>
                    </p>
                </div>
                <div className="dashboard-kpi">
                    <p className="dashboard-kpi-label">A등급 건물</p>
                    <p className="dashboard-kpi-value">
                        {gradeACount}
                        <small>동</small>
                    </p>
                    <p className="dashboard-kpi-desc">관심목록 기준</p>
                </div>
                {/* 예상 ROI(공공데이터)와 실측 ROI(사용자 입력)는 근거가 달라 한 숫자로 합치지 않는다 —
                    같은 카드 안에서 나란히 보여준다. 실측은 F-19 목록 API 연동 후 채운다. */}
                <div className="dashboard-kpi">
                    <p className="dashboard-kpi-label">ROI 산출 가능</p>
                    <div className="dashboard-kpi-pair">
                        <div>
                            <p className="dashboard-kpi-value">
                                {roiAvailableCount}
                                <small>동</small>
                            </p>
                            <p className="dashboard-kpi-desc">예상 · 관심 {items.length}동 중</p>
                        </div>
                        <div>
                            <p className="dashboard-kpi-value dashboard-kpi-pending">—</p>
                            <p className="dashboard-kpi-desc">실측 · F-19 연동 후</p>
                        </div>
                    </div>
                </div>
                <div className="dashboard-kpi">
                    <p className="dashboard-kpi-label">실측 진행 중</p>
                    <p className="dashboard-kpi-value dashboard-kpi-pending">—</p>
                    <p className="dashboard-kpi-desc">F-19 연동 후</p>
                </div>
            </div>
        </section>
    );
};

export default FavoriteKpiSection;
