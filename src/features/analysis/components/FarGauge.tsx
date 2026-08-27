import { formatArea, formatPercent } from "../api/analysisMock";
// FEATURE_19_PERSONALIZED_ANALYSIS.md §2.2-f — STEP 2 용적률 막대. 표만으로는 "얼마나 남았는지"가 안 잡힌다.
// 초록 막대 끝과 빨간 선(법정 상한) 사이 공백이 곧 미사용분이다. 검토값을 넣으면 아래 줄이 다시 그려진다.
// 값은 전부 서버에서 온 것(대지면적·연면적·법정 상한)이고, 여기서는 비율만 계산해 그린다.
interface FarGaugeProps {
    landAreaSqm: number;
    grossFloorAreaSqm: number | null;
    farLimitPct: number;
    // 대장이 계산해 둔 현재 용적률(%)과 용적률 산정 연면적 — 프론트에서 역산하지 않는다.
    // 건축물대장 연면적에는 지하·주차처럼 용적률 산정에서 빠지는 면적이 섞여 있어 연면적÷대지로 계산하면
    // 상한을 넘는 값이 나온다.
    currentFarPct: number;
    farComputationGfa: number | null;
    // 건축사 검토값(㎡). 아직 없으면 아래 줄을 그리지 않는다.
    addedAreaSqm: number | null;
    // 이론상 증축 상한(㎡) — 첫 줄의 "여유"에 함께 적는다.
    theoreticalAddSqm: number | null;
    // 검토 후 줄만 그린다(STEP 2) — 원초값·현재 막대는 STEP 1 결과가 이미 보여준다. 같은 회색 막대를
    // 두 번 그리면 어느 것이 이 단계의 결과인지 흐려진다.
    afterOnly?: boolean;
}

const FarGauge = ({
    landAreaSqm,
    grossFloorAreaSqm,
    farLimitPct,
    currentFarPct,
    farComputationGfa,
    addedAreaSqm,
    theoreticalAddSqm,
    afterOnly = false,
}: FarGaugeProps) => {
    if (!landAreaSqm || !farLimitPct) {
        return (
            <p className="far-gauge-empty">
                용적률 데이터 없음 — 증축 여력을 산출할 수 없습니다
                <span>{!landAreaSqm ? "대지면적" : "용적률 상한"}이 건축물대장·토지이용계획에 없습니다</span>
            </p>
        );
    }

    const currentFar = currentFarPct;
    const limitArea = (landAreaSqm * farLimitPct) / 100;
    // 용적률 산정 기준 면적 — 대장 원본값이 있으면 그대로 쓴다.
    const currentArea = farComputationGfa ?? (landAreaSqm * currentFar) / 100;
    // 막대 폭은 법정 상한을 100%로 본다 — 상한선이 항상 오른쪽 끝에 온다.
    const currentWidth = limitArea > 0 ? Math.min(100, (currentArea / limitArea) * 100) : 0;

    const afterArea = addedAreaSqm != null ? currentArea + addedAreaSqm : null;
    const afterFar = afterArea != null ? (afterArea / landAreaSqm) * 100 : null;
    const addedWidth =
        addedAreaSqm != null && limitArea > 0
            ? Math.max(0, Math.min(100 - currentWidth, (addedAreaSqm / limitArea) * 100))
            : 0;
    const unusedArea = afterArea != null ? limitArea - afterArea : null;

    return (
        <div className="far-gauge">
            {/* 원초값(입력)은 감추지 않는다 — 대지면적이 없으면 "96 × 200% = 192"를 확인할 수 없어
                증축 가능 84㎡가 근거 없는 숫자가 된다(DOMAIN.md §7.5). 줄일 것은 설명이지 입력값이 아니다. */}
            {!afterOnly && (
                <p className="far-gauge-source">
                    대지 <b>{formatArea(landAreaSqm)}㎡</b>
                    {grossFloorAreaSqm != null && (
                        <>
                            {" · 연면적 "}
                            <b>{formatArea(grossFloorAreaSqm)}㎡</b>
                            {Math.abs(currentArea - grossFloorAreaSqm) >= 0.01 &&
                                ` (용적률 산정 ${formatArea(currentArea)}㎡)`}
                        </>
                    )}
                </p>
            )}

            {!afterOnly && (
                <div className="far-gauge-row">
                    {/* 막대 양 끝이 각각 몇 ㎡인지 보여준다 — 산정 108 + 증축 84 = 상한 192가 화면에서 검산된다. */}
                    <div className="far-gauge-head">
                        <span>
                            <b>{formatPercent(currentFar)}%</b> 사용
                            {currentArea > limitArea && <em className="far-gauge-over">상한 초과</em>}
                        </span>
                        <span>
                            법정 상한 <b>{farLimitPct}%</b>
                        </span>
                    </div>
                    <div className={currentArea > limitArea ? "far-gauge-bar is-over" : "far-gauge-bar"}>
                        <i className="is-now" style={{ width: `${currentWidth}%` }} />
                        <u />
                    </div>
                    <div className="far-gauge-foot">
                        <span>
                            <b>{formatArea(currentArea)}㎡</b>
                        </span>
                        <span>
                            상한 <b>{formatArea(limitArea)}㎡</b>
                        </span>
                    </div>
                </div>
            )}

            {afterArea != null && afterFar != null && (
                <div className="far-gauge-row">
                    <div className="far-gauge-head">
                        <span>
                            검토 후 <b>{formatPercent(afterFar)}%</b>
                        </span>
                        {/* 검토값과 이론상 상한의 차 — 적으면 "남김", 많으면 그 사실을 그대로 쓴다(판정은
                            서버가 한다, 여기서는 두 값의 차이만 말한다). */}
                        {theoreticalAddSqm != null && addedAreaSqm != null && (
                            <span className={addedAreaSqm > theoreticalAddSqm ? "is-over-text" : "is-down"}>
                                {addedAreaSqm > theoreticalAddSqm
                                    ? `상한보다 ${formatArea(addedAreaSqm - theoreticalAddSqm)}㎡ 많음`
                                    : `${formatArea(theoreticalAddSqm - addedAreaSqm)}㎡ 남김`}
                            </span>
                        )}
                    </div>
                    <div className="far-gauge-bar">
                        <i className="is-now" style={{ width: `${currentWidth}%` }} />
                        <i className="is-add" style={{ left: `${currentWidth}%`, width: `${addedWidth}%` }} />
                        <u />
                    </div>
                    <div className="far-gauge-foot">
                        <span>
                            증축 후 <b>{formatArea(afterArea)}㎡</b>
                        </span>
                        {unusedArea != null && (
                            <span>
                                미사용 <b>{formatArea(unusedArea)}㎡</b>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarGauge;
