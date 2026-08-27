import { useEffect, useState } from "react";
import ValueBadge, { type ValueStatus } from "../../../shared/components/ValueBadge";
import type { AnalysisStepData } from "../api/analysisMock";
import type { ZoningLimit } from "../api/measurementApi";

// 한 단계 카드. 보기/편집 두 모드이고, 편집은 동시에 한 단계만 연다.
// 입력과 결과를 좌우로 나누지 않는다 — 각 단계 안에서 입력 바로 아래 "이 단계가 바꾸는 값"이 붙는다.
// 앞 단계가 바뀌어도 뒤 단계 값을 지우거나 비활성화하지 않는다(재확인 배지만 붙는다).
interface AnalysisStepCardProps {
    // "이 단계가 바꾸는 값" 옆에 붙는 막대 — 그 값이 무엇인지 그림으로 같이 보여준다.
    resultGauge?: React.ReactNode;
    warning?: string | null;
    step: AnalysisStepData;
    status: ValueStatus;
    statusNote: string;
    driverValue: number | null;
    // 편집 모드도 빈 양식이 아니다(§2.2-b 규칙 2) — 보기 모드에 보이던 값이 그대로 입력칸에 들어가 있고,
    // 사용자는 바꿀 것만 바꾼다. 안 건드린 값이 빈 값으로 덮이면 안 된다.
    fieldValues: Record<string, string>;
    // 용도지역 목록과 조례 상한은 서버가 준다(zoning_limit) — 프론트에 매핑을 두지 않는다.
    zoningLimits: ZoningLimit[];
    // 참고표 단가의 기준 면적(서버가 환산에 쓴 면적) — 문구를 프론트에서 만들지 않고 값만 받아 적는다.
    referenceAreaNote: string | null;
    // 입력칸 아래에 붙는 보조 그림(STEP 4 시장 위치 막대) — 단계 밖에서 만들어 그대로 그린다.
    inputAside?: (currentInput: number | null) => React.ReactNode;
    documentDate: string | null;
    editing: boolean;
    // 다른 단계가 계산 중이면 저장만 막는다 — 편집·입력 자체는 계속 할 수 있어야 한다(§2.3-c).
    saveDisabled: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: (payload: {
        value: number | null;
        documentDate: string | null;
        reason: string;
        fields: Record<string, string>;
    }) => void;
}

// 범위 밖이면 판단 근거가 필수이고, 극단값(상한 1.5배 초과·하한 0.5배 미만)이면 경고를 더 붙인다.
// 어느 구간에서도 입력을 막지 않는다 — 자릿수 오타를 잡기 위한 장치다.
const evaluateRange = (value: number, range?: { min: number; max: number }) => {
    if (!range) return "in";
    if (value > range.max * 1.5 || value < range.min * 0.5) return "extreme";
    if (value > range.max || value < range.min) return "out";
    return "in";
};

const AnalysisStepCard = ({
    step,
    resultGauge,
    warning,
    status,
    statusNote,
    driverValue,
    fieldValues,
    zoningLimits,
    referenceAreaNote,
    inputAside,
    documentDate,
    editing,
    saveDisabled,
    onEdit,
    onCancel,
    onSave,
}: AnalysisStepCardProps) => {
    const [input, setInput] = useState(driverValue != null ? String(driverValue) : "");
    // 진단일을 비우면 서버가 입력일(오늘)을 기준으로 잡는다 — 그럴 바에 오늘을 미리 채워 보여준다.
    const [docDate, setDocDate] = useState(documentDate ?? new Date().toISOString().slice(0, 10));
    const [fields, setFields] = useState<Record<string, string>>(fieldValues);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [pickedFrom, setPickedFrom] = useState<{
        label: string;
        value: number;
    } | null>(null);
    // 참고표(연식별 유사거래)는 조회가 무겁다 — 표만 기다리고 입력칸은 먼저 연다. 늦게 와도 사용자가 이미
    // 넣은 값을 덮어쓰지 않는다(값은 라디오를 눌러야만 채워진다).
    const [referenceReady, setReferenceReady] = useState(false);

    // 편집을 열면 참고표를 조회한다(연식별 유사거래 재조회는 무겁다). 입력칸은 그동안에도 열려 있다.
    useEffect(() => {
        if (!editing || !step.reference) return;

        const timer = window.setTimeout(() => setReferenceReady(true), 1200);
        return () => window.clearTimeout(timer);
    }, [editing, step.reference]);

    // 행 값이 비어 있거나 "미확인"이면 영향 문구를 쓰지 않는다.
    const rowEffect = (field: AnalysisStepData["fields"][number]) => {
        if (!field.effect) return "";

        const shown = field.editKeys
            ? (fieldValues.safetyStatus ?? "")
            : field.editKey && field.editKey !== "__driver"
              ? (fieldValues[field.editKey] ?? "")
              : "value";
        const unknown = !shown || shown === "미확인" || shown === "미입력";
        if (unknown) {
            return field.editKey === "heightLimit" && fieldValues.heightLimit__district
                ? "상한에 영향 가능 — 수치 확인 필요"
                : "영향 미정";
        }
        if (field.editKey === "districtPlanExists") {
            return shown === "있음" ? "지침값이 상한을 바꿀 수 있음" : "확인함 — 해당 없음";
        }
        return field.effect;
    };

    const ordinanceLimitOf = (zoneName: string) =>
        zoningLimits.find((item) => item.zoneName === zoneName)?.floorAreaRatioLimit ?? null;

    // 용도지역을 바꾸면 조례 상한이 즉시 따라온다 — 저장해야 바뀌면 틀린 상한을 보고 저장하게 된다.
    // 지구단위계획 "있음"일 때는 사용자가 넣은 지침값이 우선이라 그 값은 유지한다.
    const changeZone = (zoneName: string) => {
        const ordinance = ordinanceLimitOf(zoneName);
        // 지금 칸에 있는 값이 직전 용도지역의 조례값이면 사용자가 넣은 값이 아니다 — 새 조례값으로 바꾼다.
        // 조례값과 다른 값이면 지구단위계획 지침값이므로 용도지역이 바뀌어도 그대로 둔다.
        const previousOrdinance = ordinanceLimitOf(fields.zoneName ?? "");
        const current = fields.farLimitPct ?? "";
        const isUserGuideline = current !== "" && previousOrdinance != null && Number(current) !== previousOrdinance;
        setFields({
            ...fields,
            zoneName,
            ...(isUserGuideline || ordinance == null ? {} : { farLimitPct: String(ordinance) }),
        });
    };

    const isMarketReference = step.referenceKind === "MARKET";
    const isCapacityReference = step.referenceKind === "CAPACITY";
    // STEP 1처럼 항목마다 입력이 다른 단계는 각 행의 값 칸에서 컨트롤이 열린다.
    const renderFieldControl = (fieldKey: string) => {
        const field = step.editableFields?.find((item) => item.key === fieldKey);
        if (!field) return null;

        const locked = field.enabledWhen ? (fields[field.enabledWhen.key] ?? "") !== field.enabledWhen.value : false;
        const noneChecked = fields[`${field.key}__none`] === "true";
        const current = fields[field.key] ?? "";
        // 목록에 없는 기존 값도 선택지에 남겨 사용자가 값을 잃지 않게 한다.
        const ordinance = ordinanceLimitOf(fields.zoneName ?? "");
        const ordinanceHint =
            ordinance != null
                ? `조례 ${ordinance}%${
                      (fields.farLimitPct ?? "") && Number(fields.farLimitPct) !== ordinance
                          ? " → 지구단위계획 지침값 입력됨"
                          : " — 지침값이 다르면 그 값을 넣으세요"
                  }`
                : "";
        const baseOptions =
            field.key === "zoneName" && zoningLimits.length > 0
                ? zoningLimits.map((item) => item.zoneName)
                : (field.options ?? []);
        const zoneOptions = current && !baseOptions.includes(current) ? [current, ...baseOptions] : baseOptions;
        const options = zoneOptions;

        return (
            <span className="analysis-inline-input">
                {field.type === "segment" ? (
                    <span className="analysis-segment">
                        {options?.map((option) => (
                            <button
                                type="button"
                                key={option}
                                className={current === option ? "is-on" : undefined}
                                disabled={locked}
                                onClick={() => setFields({ ...fields, [field.key]: option })}
                            >
                                {option}
                            </button>
                        ))}
                    </span>
                ) : field.type === "select" ? (
                    <select
                        value={current}
                        disabled={locked}
                        onChange={(e) =>
                            field.key === "zoneName"
                                ? changeZone(e.target.value)
                                : setFields({ ...fields, [field.key]: e.target.value })
                        }
                    >
                        <option value="">선택</option>
                        {zoneOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                ) : field.type === "readonly" ? (
                    <input type="text" value={current} readOnly />
                ) : (
                    <input
                        type={field.type}
                        value={noneChecked ? "" : current}
                        disabled={locked || noneChecked}
                        onChange={(e) => setFields({ ...fields, [field.key]: e.target.value })}
                    />
                )}
                {field.unit && <span className="analysis-edit-unit">{field.unit}</span>}
                {/* 지구단위계획 지침값을 넣으면 조례값과 나란히 보여준다 — 화면의 숫자가 조례인지 지침인지
                    구분되지 않으면 사용자가 어느 기준으로 판단하는지 알 수 없다. */}
                {field.key === "heightLimit" && fieldValues.heightLimit__district ? (
                    <span className="analysis-inline-hint">{fieldValues.heightLimit__district} — 수치는 구청 확인</span>
                ) : field.key === "farLimitPct" && !locked && ordinanceHint ? (
                    <span className="analysis-inline-hint">{ordinanceHint}</span>
                ) : (
                    field.note && <span className="analysis-inline-hint">{field.note}</span>
                )}
                {field.noneLabel && (
                    <label className="analysis-edit-none">
                        <input
                            type="checkbox"
                            checked={noneChecked}
                            onChange={(e) =>
                                setFields({
                                    ...fields,
                                    [`${field.key}__none`]: String(e.target.checked),
                                    ...(e.target.checked ? { [field.key]: "" } : {}),
                                })
                            }
                        />
                        {field.noneLabel}
                    </label>
                )}
            </span>
        );
    };

    // 보기 모드의 값 자리에 들어가는 현재 값 — 실측이 없으면 추정치가 그대로 보인다(빈 양식이 아니다).
    const driverText = driverValue != null ? `${driverValue}${step.driver ? step.driver.unit : ""}` : "미입력";
    const parsed = Number(input);
    const rangeLevel = evaluateRange(parsed, step.referenceRange);
    const reasonRequired = rangeLevel !== "in";

    const handleSave = () => {
        if (step.driver && (!input.trim() || Number.isNaN(parsed) || parsed <= 0)) {
            setError("값을 숫자로 입력해주세요.");
            return;
        }
        if (step.driver && reasonRequired && !reason.trim()) {
            setError("참고 범위 밖의 값이라 판단 근거가 필요합니다.");
            return;
        }
        setError("");
        // 서류 날짜는 선택 입력이다 — 비우면 서버가 입력 시각을 앵커로 쓴다.
        onSave({
            value: step.driver ? parsed : null,
            documentDate: docDate.trim() || null,
            reason: reason.trim(),
            fields,
        });
    };

    return (
        <section className={editing ? "analysis-step is-editing" : "analysis-step"}>
            <div className="analysis-step-head">
                <span className="analysis-step-no">{step.stepNo}</span>
                <h4>{step.title}</h4>
                <span className="analysis-step-who">{step.who}</span>
                <ValueBadge status={status} note={statusNote} />
                {!editing && (step.driver || step.documentDate || step.editableFields) && (
                    <button type="button" className="analysis-step-edit" onClick={onEdit}>
                        편집
                    </button>
                )}
            </div>
            <p className="analysis-step-decides">→ {step.decides}</p>
            <p className="analysis-step-source">
                {step.source}
                {step.documentDate &&
                    (documentDate
                        ? ` · ${step.documentDate.label} ${documentDate}`
                        : ` · ${step.documentDate.label} 미입력 — 입력일 기준`)}
            </p>

            {/* 참고 영역은 입력칸 "위"에 온다 — 근거를 보고 값을 정하는 순서라서다(§2.2-f). */}
            {/* 막대·경고는 보기 모드에서도 보여준다 — 근거이지 입력 도구가 아니다. 참고표(고르는 표)만
                편집 모드에서 연다. */}
            {warning && !editing && (
                <div className="analysis-reference-block">
                    <p className="analysis-warning">⚠ {warning}</p>
                </div>
            )}

            {editing && (step.reference || warning) && (
                <div className="analysis-reference-block">
                    {warning && <p className="analysis-warning">⚠ {warning}</p>}
                    <p className="analysis-reference-title">
                        참고 — {step.stepNo === 5 ? "연식별 유사거래" : "산출 근거"}
                        <em> · 행을 누르면 아래 입력칸에 채워집니다</em>
                        {/* ㎡당 단가가 어느 면적으로 환산된 값인지 밝힌다 — 기준 면적이 안 보이면 검산이 안 된다. */}
                        {referenceAreaNote && <em> · {referenceAreaNote}</em>}
                    </p>
                    {/* 참고표는 고르는 표가 아니라 출발점이다 — 클릭하면 입력칸이 채워지고 사용자가 그 값을 고친다. */}
                    {step.reference && !referenceReady && (
                        <p className="analysis-reference-loading">참고표를 불러오는 중입니다 — 직접 입력해도 됩니다</p>
                    )}
                    {step.reference && referenceReady && (
                        <table className="analysis-reference">
                            <thead>
                                <tr>
                                    <th>{isCapacityReference ? "항목" : "기준"}</th>
                                    {!isCapacityReference && <th>㎡당 / 평당</th>}
                                    <th>{isCapacityReference ? "값" : "총액 환산"}</th>
                                    {isMarketReference ? (
                                        <>
                                            <th>비교거래</th>
                                            <th>완화 단계</th>
                                        </>
                                    ) : (
                                        <th>{isCapacityReference ? "출처" : "근거"}</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {step.reference.map((row) => {
                                    // 표본 부족 판정은 서버 플래그를 그대로 쓴다(하한이 잠정치라 프론트에서
                                    // 다시 판정하지 않는다). 값 대신 사유를 보여주고 고를 수 없게 하되 행을
                                    // 숨기지는 않는다 — "근거가 없다"도 정보다.
                                    const thin =
                                        (isMarketReference && row.insufficientSample === true) ||
                                        (isCapacityReference && row.pickable === false);

                                    return (
                                        <tr key={row.label} className={thin ? "is-thin" : undefined}>
                                            <td>
                                                <label>
                                                    <input
                                                        type="radio"
                                                        name={`ref-${step.stepNo}`}
                                                        disabled={thin}
                                                        onChange={() => {
                                                            setInput(String(row.value));
                                                            setPickedFrom({
                                                                label: row.label,
                                                                value: row.value,
                                                            });
                                                        }}
                                                    />
                                                    <b>{row.label}</b>
                                                </label>
                                            </td>
                                            {!isCapacityReference && <td>{thin ? "—" : row.unitPrice}</td>}
                                            <td>
                                                {isCapacityReference
                                                    ? (row.display ?? "—")
                                                    : thin
                                                      ? "—"
                                                      : `${row.value}억`}
                                            </td>
                                            {isMarketReference ? (
                                                <>
                                                    <td>
                                                        {thin
                                                            ? `표본 부족(${row.tradeCount ?? 0}건)`
                                                            : `${row.tradeCount ?? 0}건`}
                                                    </td>
                                                    <td>{row.confidenceLevel}</td>
                                                </>
                                            ) : (
                                                <td>{isCapacityReference ? (row.source ?? "—") : row.desc}</td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {step.referenceNote && <p className="analysis-reference-note">{step.referenceNote}</p>}
                </div>
            )}

            {/* 편집은 이 행의 값 칸에서 그대로 열린다 — 아래에 같은 항목을 다시 늘어놓지 않는다(§2.2-b). */}
            {step.fields
                .filter(
                    (field) =>
                        (!field.visibleWhen ||
                            (fields[field.visibleWhen.key] ?? fieldValues[field.visibleWhen.key] ?? "") ===
                                field.visibleWhen.value) &&
                        (editing || field.editKey !== "districtPlan"),
                )
                .map((field) => (
                    <div className="analysis-row" key={field.label}>
                        <div className="analysis-row-label">
                            {field.label}
                            <em>{field.hint}</em>
                        </div>
                        <div className="analysis-row-value">
                            {editing && field.editKeys ? (
                                // 한 항목이면 한 행 안에서 같이 받는다(안전진단 = 상태 + 등급 + 진단일).
                                <span className="analysis-inline-group">
                                    {field.editKeys.map((key) =>
                                        key === "__docdate" ? (
                                            <span className="analysis-inline-input" key={key}>
                                                <input
                                                    type="date"
                                                    value={docDate}
                                                    onChange={(e) => setDocDate(e.target.value)}
                                                />
                                            </span>
                                        ) : (
                                            <span key={key}>{renderFieldControl(key)}</span>
                                        ),
                                    )}
                                </span>
                            ) : editing && field.editKey === "__docdate" ? (
                                <span className="analysis-inline-input">
                                    <input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                                </span>
                            ) : editing && field.editKey === "__reason" ? (
                                <span className="analysis-inline-input is-wide">
                                    <input
                                        type="text"
                                        value={reason}
                                        placeholder="누구에게 확인했는지, 왜 이 값인지"
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </span>
                            ) : editing && field.editKey && field.editKey !== "__driver" ? (
                                renderFieldControl(field.editKey)
                            ) : editing && field.editKey === "__driver" && step.driver ? (
                                <span className="analysis-inline-input">
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                    />
                                    <span className="analysis-edit-unit">{step.driver.unit}</span>
                                </span>
                            ) : field.editKey === "__driver" ? (
                                driverText
                            ) : field.editKey === "__docdate" ? (
                                (documentDate ?? "미입력 — 입력일 기준")
                            ) : field.editKey === "__reason" ? (
                                reason || "—"
                            ) : field.editKeys ? (
                                // 등급은 사용자가 받아온 결과다 — 보여주되 해석하지 않는다(DOMAIN.md §7.5).
                                // "B등급이면 수직증축 가능" 같은 근거 문구는 붙이지 않는다(LAW-004 확인 전).
                                !fieldValues.safetyStatus ? (
                                    "미확인"
                                ) : fieldValues.safetyStatus === "결과 받음" ? (
                                    [
                                        fieldValues.safetyGrade ? `${fieldValues.safetyGrade}등급` : "등급 미입력",
                                        documentDate,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")
                                ) : (
                                    fieldValues.safetyStatus
                                )
                            ) : field.editKey === "heightLimit" &&
                              !fieldValues.heightLimit &&
                              fieldValues.heightLimit__none !== "true" &&
                              fieldValues.heightLimit__district ? (
                                <>
                                    제한 있음 — 수치 미확인
                                    <span className="analysis-row-subnote">
                                        {fieldValues.heightLimit__district}으로 지정됨
                                    </span>
                                </>
                            ) : field.editKey === "districtPlanExists" ? (
                                // "있음"만 쓰면 어느 계획인지 알 수 없다 — 지정된 계획 이름을 그대로 보여준다.
                                fieldValues.districtPlanExists === "있음" ? (
                                    fieldValues.districtPlan || "있음 — 계획 명칭 미확인"
                                ) : (
                                    fieldValues.districtPlanExists || "미확인"
                                )
                            ) : field.editKey ? (
                                (fieldValues[`${field.editKey}__none`] === "true"
                                    ? "제한 없음"
                                    : fieldValues[field.editKey]
                                      ? fieldValues[field.editKey]
                                      : fieldValues[`${field.editKey}__district`]) || "미확인"
                            ) : (
                                field.value
                            )}
                        </div>
                        {/* 값이 "미확인"이면 영향을 단정하지 않는다 — 모르는 상태에서 "영향 없음"이라고 쓰면
                        아래 결과 영역과 다른 말을 하게 된다. */}
                        <div className="analysis-row-effect">{rowEffect(field)}</div>
                    </div>
                ))}

            {/* 값을 어디서 가져와 얼마나 고쳤는지, 범위를 벗어났는지는 입력 행 바로 아래에 붙인다 —
                별도 폼 상자를 만들지 않는다(§2.2-b 인라인 편집). */}
            {editing && step.driver && pickedFrom && !Number.isNaN(parsed) && (
                <p className="analysis-edit-trace">
                    {pickedFrom.label} {pickedFrom.value}
                    {step.driver.unit}에서 가져와
                    {Number((parsed - pickedFrom.value).toFixed(1)) >= 0 ? " +" : " "}
                    {Number((parsed - pickedFrom.value).toFixed(1))}
                    {step.driver.unit} 조정
                </p>
            )}

            {editing && step.driver && rangeLevel !== "in" && (
                <p className="analysis-edit-warning">
                    <span className="analysis-chip is-stale">참고 범위 밖</span>
                    {rangeLevel === "extreme" && <b>근거를 다시 확인하세요</b>}
                </p>
            )}

            {/* 값이 시장 어디쯤인지는 입력칸 바로 아래에 있어야 한다 — 입력하면서 위치를 같이 본다. */}
            {/* 빈 입력칸은 0이 아니라 "아직 없음"이다 — Number("")이 0이라 그대로 넘기면 마커가 왼쪽 끝에 선다. */}
            {editing && inputAside?.(input.trim() === "" || Number.isNaN(parsed) ? null : parsed)}

            {editing && error && <p className="analysis-edit-error">{error}</p>}

            {editing && (
                <div className="analysis-step-actions">
                    <button type="button" className="is-primary" onClick={handleSave} disabled={saveDisabled}>
                        {saveDisabled ? "계산 중 — 잠시 후 저장" : "저장하고 다시 계산"}
                    </button>
                    <button type="button" onClick={onCancel}>
                        취소
                    </button>
                </div>
            )}

            <div className="analysis-step-results">
                <p className="analysis-step-results-label">{step.resultsLabel ?? "이 단계가 바꾸는 값"}</p>
                {/* 오른쪽 칸은 결과 항목이 있을 때만 만든다 — 항목이 없으면 막대가 그 폭까지 쓴다. */}
                <div
                    className={
                        resultGauge && step.results.length > 0
                            ? "analysis-step-results-grid has-gauge"
                            : "analysis-step-results-grid"
                    }
                >
                    {resultGauge && <div className="analysis-result-gauge">{resultGauge}</div>}
                    {step.results.map((result) => (
                        // 막대 옆에 결과가 하나뿐이면 그게 이 단계의 결론이다 — 시안대로 강조해 둔다.
                        <div
                            key={result.label}
                            className={
                                resultGauge && step.results.length === 1 ? "analysis-result-primary" : undefined
                            }
                        >
                            <p className="analysis-result-label">{result.label}</p>
                            <p className="analysis-result-value">
                                {result.value}
                                <small>{result.unit}</small>
                            </p>
                            <p className="analysis-result-desc">{result.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AnalysisStepCard;
