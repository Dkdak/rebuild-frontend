import ValueBadge from "../../../shared/components/ValueBadge";
import type { MeasurementDetail } from "../../analysis/api/measurementApi";
import type { BuildingReport } from "../api/reportApi";

// FEATURE_10_AI_REPORT.md §2.1-a — 리포트 본문 최상단의 실측 근거 밴드.
// 좌측 네비가 아니라 본문에 두는 이유: 리포트는 인쇄·제출용 문서라 네비는 종이에 안 남는다.
// 값마다 붙는 추정/실측 배지는 개별 값 단위라 전체 그림이 안 잡힌다 — DOMAIN.md §7.5의 "상단 카운트 상시
// 표시"를 리포트에도 적용한다. CASE 1(실측 없음)에도 밴드를 둔다 — 문서만 보고 어느 CASE인지 알 수 있어야 한다.
// 항목은 ROI를 직접 만드는 4개만(F-19 §2.3-b) — 14개를 다 나열하면 밴드가 아니라 또 하나의 섹션이 된다.
const BAND_ITEMS: { key: string; label: string }[] = [
    { key: "EXPANDABLE_AREA", label: "증축 면적" },
    { key: "ESTIMATE", label: "공사비" },
    { key: "PURCHASE_PRICE", label: "매입가" },
    { key: "FUTURE_VALUE", label: "미래가치" },
];

interface ReportEvidenceBandProps {
    report: BuildingReport | null;
    measurement: MeasurementDetail | null;
    onGoToAnalysis: () => void;
}

const ReportEvidenceBand = ({ report, measurement, onGoToAnalysis }: ReportEvidenceBandProps) => {
    const caseTwo = report?.caseTwo === true && measurement != null;

    if (!caseTwo) {
        return (
            <div className="report-evidence-band">
                <div className="report-evidence-head">
                    <span className="report-evidence-case">공공데이터 기준 · 실측 없음</span>
                    <button type="button" className="report-evidence-cta" onClick={onGoToAnalysis}>
                        이 매물 직접 분석하기
                    </button>
                </div>
            </div>
        );
    }

    const statuses = measurement.itemStatuses;
    const recheckCount = statuses.filter(
        (row) => row.status === "RECHECK" && BAND_ITEMS.some((item) => item.key === row.itemKey),
    ).length;
    const latest = statuses
        .filter((row) => row.inputAt)
        .sort((a, b) => ((a.inputAt ?? "") < (b.inputAt ?? "") ? 1 : -1))[0];

    return (
        <div className="report-evidence-band">
            <div className="report-evidence-head">
                <span className="analysis-chip is-ok">
                    실측 {measurement.progress.measured}/{measurement.progress.total}
                </span>
                {recheckCount > 0 && <span className="analysis-chip is-stale">재확인 {recheckCount}</span>}
                {latest?.inputAt && (
                    <span className="report-evidence-updated">최근 갱신 {latest.inputAt.slice(5, 10)}</span>
                )}
                <button type="button" className="report-evidence-cta" onClick={onGoToAnalysis}>
                    분석탭에서 이어하기
                </button>
            </div>
            <ul className="report-evidence-items">
                {BAND_ITEMS.map((item) => {
                    const row = statuses.find((status) => status.itemKey === item.key);
                    const status = row?.status ?? "ESTIMATED";
                    const elapsed = row?.elapsedDays != null ? `${row.elapsedDays}일 경과` : null;

                    return (
                        <li key={item.key}>
                            <span className="report-evidence-label">{item.label}</span>
                            <ValueBadge status={status} note={row?.anchorDate ?? undefined} />
                            <span className="report-evidence-note">
                                {status === "RECHECK" && elapsed
                                    ? `${elapsed} — 이 리포트의 ${item.label}는 그 시점 값입니다`
                                    : status === "MEASURED"
                                      ? (elapsed ?? "현장 확인 값")
                                      : "리포트 기준값 사용"}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ReportEvidenceBand;
