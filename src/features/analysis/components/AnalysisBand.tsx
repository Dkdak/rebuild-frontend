import { formatManwon } from "../../search/api/searchApi";
import ValueBadge from "../../../shared/components/ValueBadge";
import type { MeasurementProgress, MeasurementRecalculation } from "../api/measurementApi";

// 상단 고정 밴드 — 어느 단계를 저장하든 즉시 갱신된다. 계산 중에도 값을 비우지 않고 이전 결과를 그대로 둔다.
// 총 투입·미래가치·ROI는 서버 재계산 결과만 표시한다(낙관적 업데이트로 미리 만들지 않는다, §2.3-c).
// 실측이 없는 항목은 서버가 공공데이터 추정치로 계산하므로, 개별 입력값 칸은 "리포트 추정 사용"으로 남긴다.
interface AnalysisBandProps {
    recalculation: MeasurementRecalculation | null;
    progress: MeasurementProgress | null;
    calculating: boolean;
}

const AnalysisBand = ({ recalculation, progress, calculating }: AnalysisBandProps) => {
    // 세대수가 없어 막힌 칸은 "—"가 아니라 "입력 필요"다 — 결측과 결론을 구분한다(§2.2-f).
    // 증축 면적·공사비는 연면적 기준이라 세대수를 타지 않아 그대로 계산된다.
    const householdMissing = recalculation?.householdCountMissing === true;
    const blocked = (value: number | null | undefined) => householdMissing && value == null;

    // 실측이 없는 항목도 서버가 추정치를 값으로 내려준다 — 빈 칸을 만들지 않고 measured만 배지로 옮긴다.
    const cells = [
        {
            label: "증축 면적",
            text:
                recalculation?.additionalBuildableAreaSqm.value != null
                    ? `${recalculation.additionalBuildableAreaSqm.value}`
                    : null,
            unit: "㎡",
            measured: recalculation?.additionalBuildableAreaSqm.measured,
        },
        {
            label: "매입가",
            text:
                recalculation?.purchasePrice.value != null
                    ? formatManwon(recalculation.purchasePrice.value)
                    : blocked(recalculation?.purchasePrice.value)
                      ? "입력 필요"
                      : null,
            unit: "",
            measured: recalculation?.purchasePrice.measured,
        },
        {
            label: "공사비",
            // 공사비는 원 단위라 만원으로 바꿔 넘긴다(F-07 minCost/maxCost와 같은 단위).
            text:
                recalculation?.constructionEstimate.value != null
                    ? formatManwon(recalculation.constructionEstimate.value / 10000)
                    : null,
            unit: "",
            measured: recalculation?.constructionEstimate.measured,
        },
        {
            label: "총 투입",
            text:
                recalculation?.totalInvestment != null
                    ? formatManwon(recalculation.totalInvestment)
                    : blocked(recalculation?.totalInvestment)
                      ? "입력 필요"
                      : null,
            unit: "",
            measured: recalculation?.totalInvestmentMeasured,
        },
        {
            label: "미래가치",
            text:
                recalculation?.projectedValue != null
                    ? formatManwon(recalculation.projectedValue)
                    : blocked(recalculation?.projectedValue)
                      ? "입력 필요"
                      : null,
            unit: "",
            measured: recalculation?.projectedValueMeasured,
        },
    ];

    // 추진 요건을 못 넘긴 건물도 계산은 나온다 — 그 숫자가 무엇을 가정한 값인지 결과보다 먼저 말한다.
    // 사용자가 입력해서 풀 수 있는 것이 아니라 건물 자체의 조건이다(§2.3-d와 같은 성격).
    const verdictWarning =
        recalculation?.verdict === "NOT_POSSIBLE" || recalculation?.verdict === "LIMITED"
            ? recalculation.verdictReason
            : null;

    return (
        <div className="analysis-band">
            {verdictWarning && (
                <p className="analysis-band-verdict">
                    ⚠ 리모델링 추진 요건 미충족 — {verdictWarning}
                    <span>아래 숫자는 요건을 충족했다고 가정한 값입니다</span>
                </p>
            )}
            {householdMissing && (
                <p className="analysis-band-info">
                    ℹ 세대수 정보가 없어 매입가·미래가치를 추정할 수 없습니다
                    <span>STEP 4 매입가와 STEP 5 미래가치를 직접 입력하면 계산됩니다</span>
                </p>
            )}
            <div className="analysis-band-head">
                <b>지금까지의 결과</b>
                {calculating ? (
                    <span className="analysis-calc-running">계산 중 — 이전 결과를 그대로 보여주는 중입니다</span>
                ) : (
                    <span>저장할 때마다 즉시 갱신 · 실측이 없는 값은 리포트 추정치입니다</span>
                )}
            </div>
            <div className="analysis-band-flow">
                {cells.map((cell) => (
                    <div className="analysis-band-cell" key={cell.label}>
                        <p className="analysis-band-label">{cell.label}</p>
                        <p className="analysis-band-value">
                            {cell.text ?? "—"}
                            {cell.text && cell.unit && <small>{cell.unit}</small>}
                        </p>
                        {/* "입력 필요"는 추정치가 없다는 뜻이다 — 그 칸에 "추정" 배지를 달면 말이 어긋난다. */}
                        {cell.measured != null && cell.text !== "입력 필요" && (
                            <p className="analysis-band-delta is-flat">
                                <ValueBadge status={cell.measured ? "MEASURED" : "ESTIMATED"} />
                            </p>
                        )}
                    </div>
                ))}
                <div className="analysis-band-cell is-highlight">
                    <p className="analysis-band-label">예상 ROI</p>
                    <p className="analysis-band-value">
                        {recalculation?.roi != null
                            ? recalculation.roi
                            : blocked(recalculation?.roi)
                              ? "입력 필요"
                              : "—"}
                        {recalculation?.roi != null && <small>%</small>}
                    </p>
                </div>
            </div>
            {/* 진행도는 % 막대 대신 "무엇이 남았는지"로 쓴다 — 71%는 남은 하나가 미래가치인지를 감춘다. */}
            <p className="analysis-band-progress">
                {progress && (
                    <span className="analysis-chip is-ok">
                        실측 {progress.measured}/{progress.total}
                    </span>
                )}
                <span className="analysis-band-note">
                    ROI를 만드는 값 <b>4개</b> 기준입니다 · 나머지 항목은 부속이며 진행도에 세지 않습니다
                </span>
            </p>
        </div>
    );
};

export default AnalysisBand;
