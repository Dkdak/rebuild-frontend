import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import AnalysisBand from "./AnalysisBand";
import AnalysisBuildingSummary from "./AnalysisBuildingSummary";
import AnalysisStepCard from "./AnalysisStepCard";
import {
    fetchMeasurementDetail,
    fetchMeasurementHistory,
    fetchMeasurements,
    fetchAgeAdjustedPrices,
    fetchCostEstimate,
    fetchRemodelingBasis,
    fetchZoningLimits,
    saveMeasurementStep,
    type MeasurementDetail,
    type MeasurementHistoryEntry,
    type MeasurementListItem,
    type StepSavePayload,
    type ZoningLimit,
} from "../api/measurementApi";
import {
    formatArea,
    formatPercent,
    ITEM_LABEL,
    STEPS,
    STEP_ITEM_KEYS,
    type AnalysisStepData,
    type ReferenceRow,
} from "../api/analysisMock";
import FarGauge from "./FarGauge";
import PricePositionBar from "./PricePositionBar";
import { fetchBuildingReport, type PricePositionField } from "../../report/api/reportApi";
import type { RemodelingBasis } from "../../remodeling/api/remodelingApi";
import { getBuildingDetail, type BuildingDetail } from "../../property/api/buildingApi";
import { CONFIDENCE_LABEL_SHORT, type ConfidenceLevel } from "../../market/api/marketApi";
import "./analysis.css";

// FEATURE_19_PERSONALIZED_ANALYSIS.md §2 — 분석탭. 마법사가 아니다: 순서 강제 없음, 전체 저장 버튼 없음,
// 아무 단계나 먼저 편집·저장할 수 있다(항목마다 확인해 줄 상대가 다르고 전체가 몇 주~몇 달 걸린다).
// 저장은 그 단계만 보내고(PUT .../steps/{stepNo}), 응답의 재계산 결과·항목 상태·진행도·재확인 목록으로
// 화면을 갱신한다. 재확인 대상 판정은 서버가 한다 — 프론트가 정하지 않는다.
// 계산을 기다리는 동안에도 밴드는 이전 값을 그대로 두고 "계산 중"만 얹는다(§2.3-c).
interface AnalysisPageProps {
    // 대시보드·리포트에서 특정 매물을 눌러 들어온 경우 그 대상을 먼저 연다. 아직 실측을 시작하지 않은 매물은
    // 목록(GET /measurements)에 없으므로 주소도 함께 받아 좌측 목록에 "저장 전" 항목으로 끼워 넣는다.
    initialTarget: { id: string; address: string } | null;
    onGoToFavorites: () => void;
}

// 이력 값은 항목마다 모양이 다른 jsonb 문자열이라, 값이 든 필드만 골라 보여준다(전부 null이면 "미입력").
const formatHistoryValue = (raw: string | null) => {
    if (!raw) return "미입력";

    try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed === null) return "미입력";
        if (typeof parsed !== "object") return String(parsed);

        const filled = Object.entries(parsed as Record<string, unknown>)
            .filter(([, value]) => value != null && value !== "")
            .map(([, value]) => String(value));
        return filled.length > 0 ? filled.join(" · ") : "미입력";
    } catch {
        return raw;
    }
};

const AnalysisPage = ({ initialTarget, onGoToFavorites }: AnalysisPageProps) => {
    const { token } = useAuth();
    const [targets, setTargets] = useState<MeasurementListItem[] | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<MeasurementDetail | null>(null);
    const [history, setHistory] = useState<MeasurementHistoryEntry[]>([]);
    const [editingStep, setEditingStep] = useState<number | null>(null);
    const [switchTo, setSwitchTo] = useState<number | null>(null);
    const [calc, setCalc] = useState<{ status: "idle" | "running" | "failed"; retry: (() => void) | null }>({
        status: "idle",
        retry: null,
    });
    const [failed, setFailed] = useState(false);
    // STEP 5 참고표 — 실거래 재조회라 무겁다. 편집을 열 때 1회만 받고, 저장 후에는 다시 받지 않는다.
    const [referenceRows, setReferenceRows] = useState<ReferenceRow[] | null>(null);
    const [costRows, setCostRows] = useState<ReferenceRow[] | null>(null);
    const [costAreaSqm, setCostAreaSqm] = useState<number | null>(null);
    const [marketAreaSqm, setMarketAreaSqm] = useState<number | null>(null);
    // STEP 4 시장 위치 — 리포트 04와 같은 값(서버가 매긴 위치)을 그대로 쓴다.
    const [pricePosition, setPricePosition] = useState<PricePositionField | null>(null);
    // STEP 2 증축 여력 근거 — 절반이 STEP 1에서 온다(용도지역 → 법정 상한, 안전진단 → 허용 증축 방식).
    const [capacityRows, setCapacityRows] = useState<ReferenceRow[] | null>(null);
    // 실측이 없는 항목은 공공데이터 값이 그대로 편집칸에 들어가야 한다(§2.2-b 규칙 2) — 실측 상세에는
    // 저장된 값만 있어서 F-06 판정 근거를 함께 읽는다.
    const [basis, setBasis] = useState<RemodelingBasis | null>(null);
    // 용도지역 목록·조례 상한 — 사용자와 무관한 기준표라 한 번만 받는다.
    const [zoningLimits, setZoningLimits] = useState<ZoningLimit[]>([]);
    // 상단 건물 요약 — 편집 중에도 어느 건물인지 보여야 한다(DOMAIN.md §7.6).
    const [buildingDetail, setBuildingDetail] = useState<BuildingDetail | null>(null);
    // 아직 한 번도 저장하지 않은 매물도 상세가 200으로 온다 — values만 비고 recalculation은 공공데이터
    // 추정치로 채워진다. 그래서 "미시작 전용 분기"가 없고, 저장 전후가 같은 코드 경로로 돈다.
    // 404는 buildingId 자체가 없을 때만 온다.

    const loadTargets = useCallback(() => {
        if (!token && !import.meta.env.DEV) return;

        fetchMeasurements(token)
            .then((rows) => {
                setTargets(rows);
                setSelectedId((previous) => initialTarget?.id ?? previous ?? rows[0]?.buildingId ?? null);
                setFailed(false);
            })
            .catch(() => setFailed(true));
    }, [token, initialTarget]);

    useEffect(() => {
        if (!selectedId) return;

        let cancelled = false;
        fetchBuildingReport(token, selectedId)
            .then((report) => !cancelled && setPricePosition(report.pricePosition))
            .catch(() => !cancelled && setPricePosition(null));
        return () => {
            cancelled = true;
        };
    }, [selectedId, token]);

    useEffect(() => {
        if (!selectedId) return;

        // 대상이 바뀌면 이전 건물 요약이 잠깐 남지 않도록 응답과 함께 교체한다.
        let cancelled = false;
        getBuildingDetail(selectedId)
            .then((result) => !cancelled && setBuildingDetail(result))
            .catch(() => !cancelled && setBuildingDetail(null));
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    useEffect(() => {
        fetchZoningLimits(token)
            .then(setZoningLimits)
            .catch(() => setZoningLimits([]));
    }, [token]);

    useEffect(() => {
        loadTargets();
    }, [loadTargets]);

    const loadDetail = useCallback(
        (buildingId: string) => {
            if (!token && !import.meta.env.DEV) return;

            Promise.all([
                fetchMeasurementDetail(token, buildingId),
                fetchMeasurementHistory(token, buildingId),
            ])
                .then(([detailResponse, historyResponse]) => {
                    setDetail(detailResponse);
                    setHistory(historyResponse);
                    setFailed(false);
                })
                .catch(() => setFailed(true));
        },
        [token],
    );

    useEffect(() => {
        if (selectedId) loadDetail(selectedId);
    }, [selectedId, loadDetail]);

    useEffect(() => {
        if (!selectedId) return;

        fetchRemodelingBasis(selectedId)
            .then((response) => setBasis(response.basis))
            .catch(() => setBasis(null));
    }, [selectedId]);

    // 증축형 리모델링 안전진단(주택법 §68)은 공동주택에만 적용된다 — 단독주택·근생·업무시설은 대상이
    // 아니라 항목 자체를 화면에서 뺀다(LAW-004 §0). isHousing으로 나누면 안 된다 — 단독주택도 "주택"이라
    // 취득세 분기(LAW-003)와 기준이 다르다. 판정은 건축물대장 주용도로 한다.
    const MULTI_FAMILY_USAGES = ["공동주택", "아파트", "연립주택", "다세대주택", "기숙사"];
    const isMultiFamilyHousing = MULTI_FAMILY_USAGES.some((usage) =>
        (buildingDetail?.mainUsageNm ?? "").includes(usage),
    );

    // 공사비·미래가치 단가가 어느 면적으로 환산된 값인지 — 서버가 쓴 면적을 그대로 적는다.
    // 공사비는 건물 전체(대장 연면적), 미래가치는 증축 후 대장 연면적이다(DOMAIN.md §7.6).
    const referenceAreaNoteOf = (stepNo: number) => {
        if (stepNo === 3 && costAreaSqm != null) return `대장 연면적 ${formatArea(costAreaSqm)}㎡ 기준`;
        if (stepNo === 5 && marketAreaSqm != null) return `증축 후 대장 연면적 ${formatArea(marketAreaSqm)}㎡ 기준`;
        return null;
    };

    const perSqm = (manwon: number | null) => {
        const area = buildingDetail?.grossFloorArea ?? null;
        return manwon != null && area != null && area > 0 ? manwon / area : null;
    };

    // 저장은 즉시 끝나고 계산만 기다린다 — 그 단계는 바로 보기 모드로 돌아간다(버튼을 붙잡지 않는다).
    const handleSave = (
        stepNo: number,
        payload: {
            value: number | null;
            documentDate: string | null;
            reason: string;
            fields: Record<string, string>;
        },
    ) => {
        if ((!token && !import.meta.env.DEV) || !selectedId) return;

        setEditingStep(null);

        const body: StepSavePayload = {};
        if (stepNo === 1) {
            // 규제 3개는 구청에 확인해 넣는 값이라 저장하면 밴드가 바뀐다 — 용적률 상한이 바뀌면 증축 상한이
            // 바뀌고, 그 결과 STEP 2·3·5가 재확인 대상이 된다(연쇄 판정은 서버가 한다).
            // 용적률 상한은 평소에 보내지 않는다 — 용도지역에서 서버가 파생시킨다. 지구단위계획을 적어
            // 조례와 달라진 경우에만 함께 보내고, 그때 backend가 오버라이드로 인정한다.
            const {
                zoneName,
                heightLimit,
                heightLimit__none: heightNone,
                districtPlanExists,
                districtPlan,
                farLimitPct,
                safetyStatus,
                safetyGrade,
            } = payload.fields;

            if (zoneName) body.zoneName = zoneName;
            // 확인 결과 제한이 없으면 그 사실을 값으로 남긴다(비우면 "미확인"으로 남는다).
            if (heightNone === "true") body.heightLimit = "제한 없음";
            else if (heightLimit) body.heightLimit = `${heightLimit}m`;
            if (districtPlanExists === "없음") body.districtPlan = "없음";
            else if (districtPlanExists === "있음" && districtPlan) body.districtPlan = districtPlan;
            // 상한 오버라이드는 지구단위계획이 "있음"일 때만 인정된다 — 그 외에는 서버가 용도지역에서 파생시킨다.
            if (districtPlanExists === "있음" && farLimitPct) body.farLimitPct = Number(farLimitPct);
            // 안전진단은 공동주택만 받는다 — 항목을 감춘 건물에서는 진단일도 보내지 않는다.
            if (isMultiFamilyHousing) {
                // 등급은 결과를 받은 경우에만 의미가 있다.
                if (safetyStatus === "결과 받음" && safetyGrade) body.safetyGrade = safetyGrade;
                body.safetyInspectionDate = payload.documentDate;
            }
        } else if (stepNo === 2) {
            if (payload.value != null) body.actualExpandableAreaSqm = payload.value;
            body.expandableAreaDocumentDate = payload.documentDate;
            if (payload.reason) body.reductionReason = payload.reason;
        } else if (stepNo === 3) {
            // 공사비는 원 단위로 저장한다(F-07 minCost/maxCost와 같은 단위) — 화면 입력은 억이라 환산한다.
            if (payload.value != null) body.actualConstructionEstimate = payload.value * 100_000_000;
            body.estimateDocumentDate = payload.documentDate;
            if (payload.reason) body.estimateSource = payload.reason;
        } else if (stepNo === 4) {
            // 매입가는 만원 단위(F-08 currentValue와 같은 단위).
            if (payload.value != null) body.actualPurchasePrice = payload.value * 10_000;
        } else if (stepNo === 5) {
            if (payload.value != null) body.postRemodelEstimatedPrice = payload.value * 10_000;
            if (payload.reason) body.valuationBasisMemo = payload.reason;
        }

        const run = () => {
            setCalc({ status: "running", retry: run });
            saveMeasurementStep(token, selectedId, stepNo, body)
                .then((response) => {
                    // 재계산 결과·항목 상태·진행도·재확인 목록을 응답 그대로 반영한다.
                    setDetail((previous) =>
                        previous
                            ? {
                                  ...previous,
                                  recalculation: response.recalculation,
                                  itemStatuses: response.itemStatuses,
                                  progress: response.progress,
                              }
                            : previous,
                    );
                    setCalc({ status: "idle", retry: null });
                    // 값·이력·목록은 서버가 계산한 결과를 다시 읽어 맞춘다.
                    loadDetail(selectedId);
                    loadTargets();
                })
                .catch(() => setCalc({ status: "failed", retry: run }));
        };

        run();
    };

    const requestEdit = (stepNo: number) => {
        if (editingStep != null && editingStep !== stepNo) {
            setSwitchTo(stepNo);
            return;
        }
        setEditingStep(stepNo);

        // STEP 2 참고표 — F-06 판정 근거를 그대로 읽는다(리포트 05를 보러 탭을 옮기지 않게, §2.2-f).
        // 현재 연면적·대지면적은 아직 응답에 없어 그 두 행은 값 대기 상태로 둔다(backend 요청 중).
        if (stepNo === 2 && selectedId && !capacityRows && basis) {
            // 상한은 STEP 1에서 저장한 실측값이 있으면 그 값이다(공공데이터 상한은 실측 전 기준).
            const limit = detail?.values.farLimitPct ?? basis.floorAreaRatioLimit;
            const surplus = basis.floorAreaRatioSurplus;
            const buildable =
                detail?.recalculation.additionalBuildableAreaSqm.value ??
                (limit !== basis.floorAreaRatioLimit ? null : basis.additionalBuildableAreaSqm);
            const land = basis.landAreaSqm;
            const gross = basis.grossFloorAreaSqm;
            // 산정 면적·현재 용적률은 대장 원본값을 그대로 쓴다(역산은 지구단위계획 오버라이드에서 어긋난다).
            const zoningArea =
                basis.farComputationGfa ??
                (land != null && limit != null ? (land * (limit - (surplus ?? 0))) / 100 : null);
            const currentFar =
                basis.currentFloorAreaRatio ?? (limit != null ? limit - (surplus ?? 0) : null);

            setCapacityRows([
                {
                    // 증축 여력은 산정 면적 기준이라 그 값을 주로 두고, 사용자가 아는 대장 값을 괄호로 병기한다.
                    label: "현재 연면적 / 대지면적",
                    value: 0,
                    unitPrice: "",
                    display:
                        zoningArea != null && land != null
                            ? `${formatArea(zoningArea)}㎡ / ${formatArea(land)}㎡` +
                              (gross != null ? ` (대장 ${formatArea(gross)}㎡)` : "")
                            : "—",
                    source: "산정 면적 · 건축물대장",
                    pickable: false,
                    desc: "",
                },
                {
                    label: "현재 용적률",
                    value: 0,
                    unitPrice: "",
                    display: currentFar != null ? `${formatPercent(currentFar)}%` : "—",
                    source: "계산",
                    pickable: false,
                    desc: "",
                },
                {
                    label: "법정 상한",
                    value: 0,
                    unitPrice: "",
                    display:
                        limit != null
                            ? `${limit}% · ${detail?.values.zoneName ?? basis.zoneName ?? "용도지역 미확인"}`
                            : "—",
                    source: "STEP 1 + 조례",
                    pickable: false,
                    desc: "",
                },
                {
                    label:
                        surplus != null ? `여유 ${formatPercent(surplus)}%p → 이론상 증축 상한` : "이론상 증축 상한",
                    value: buildable != null ? Math.round(buildable) : 0,
                    unitPrice: "",
                    display: buildable != null ? `${formatArea(buildable)}㎡` : "—",
                    source: "계산",
                    pickable: buildable != null,
                    desc: "",
                },
                {
                    label: "허용 증축 방식",
                    value: 0,
                    unitPrice: "",
                    display: "STEP 1 안전진단 결과에 따름",
                    source: "STEP 1 안전진단",
                    pickable: false,
                    desc: "",
                },
                {
                    label: "지구단위계획",
                    value: 0,
                    unitPrice: "",
                    display: basis.districtNames.length > 0 ? basis.districtNames.join(", ") : "없음",
                    source: "STEP 1",
                    pickable: false,
                    desc: "",
                },
            ]);
        }

        // 공사비 참고표(§2.2-c) — 국세청 고시 단가 기반이라 표본·완화 단계가 없다. 행별 ㎡당 단가는
        // baseUnitPricePerSqm × 보정계수로 만든다(받은 값을 표시 단위로 바꾸는 산술).
        if (stepNo === 3 && selectedId && !costRows) {
            fetchCostEstimate(selectedId)
                .then((cost) => {
                    const basis = cost.basis;
                    const toRow = (label: string, total: number, factor: number | undefined) => ({
                        label,
                        value: Number((total / 100000000).toFixed(1)),
                        unitPrice:
                            basis && factor
                                ? `${Math.round((basis.baseUnitPricePerSqm * factor) / 10000)} / ${Math.round(
                                      ((basis.baseUnitPricePerSqm * factor) / 10000) * 3.305785,
                                  )}만`
                                : "—",
                        desc: basis?.source ?? "국세청고시 단가",
                    });

                    setCostAreaSqm(basis?.grossFloorArea ?? null);
                    setCostRows([
                        toRow("리포트 최소(추정)", cost.minCost, basis?.agingFactorMin),
                        toRow("리포트 중간", cost.defaultCost, basis?.agingFactorDefault),
                        toRow("리포트 최대(보수적)", cost.maxCost, basis?.agingFactorMax),
                    ]);
                })
                .catch(() => setCostRows([]));
        }

        // 편집 진입 시 1회 조회. 값은 만원 단위라 화면 단위(억)로 바꾸고, ㎡·평 단가는 표시용 환산이다.
        if (stepNo === 5 && selectedId && !referenceRows) {
            fetchAgeAdjustedPrices(selectedId)
                .then((rows) => {
                    setMarketAreaSqm(rows[0]?.targetAreaSqm ?? null);
                    setReferenceRows(
                        rows.map((row) => ({
                            label: row.ageAdjustmentYears === 0 ? "보정없음" : `−${row.ageAdjustmentYears}년`,
                            value: Number((row.estimatedPrice.value / 10000).toFixed(1)),
                            unitPrice:
                                row.targetAreaSqm > 0
                                    ? `${Math.round(row.estimatedPrice.value / row.targetAreaSqm)} / ${Math.round(
                                          (row.estimatedPrice.value / row.targetAreaSqm) * 3.305785,
                                      )}만`
                                    : "—",
                            tradeCount: row.estimatedPrice.comparableCount,
                            confidenceLevel:
                                CONFIDENCE_LABEL_SHORT[row.estimatedPrice.confidenceLevel as ConfidenceLevel] ??
                                row.estimatedPrice.confidenceLevel,
                            insufficientSample: row.insufficientSample,
                            desc: row.ageAdjustmentYears === 0 ? "현재 연식 그대로" : "리모델링 후 연식 상당",
                        })),
                    );
                })
                .catch(() => setReferenceRows([]));
        }
    };

    if (!targets) {
        return (
            <div className="analysis-page">
                <p className="analysis-state">
                    {failed ? "분석 중인 대상을 불러오지 못했습니다." : "불러오는 중입니다…"}
                </p>
            </div>
        );
    }

    // 리포트에서 "직접 분석하기"로 들어오면 아직 실측 레코드가 없어 목록이 비어 있다 — 그때는 빈 상태가
    // 아니라 그 매물의 단계 화면을 연다(어느 단계든 먼저 저장하면 그 시점에 레코드가 생긴다).
    const pendingTarget =
        initialTarget && !targets.some((row) => row.buildingId === initialTarget.id) ? initialTarget : null;

    if (targets.length === 0 && !pendingTarget) {
        return (
            <div className="analysis-page">
                <div className="analysis-empty">
                    <p className="analysis-state">아직 분석을 시작한 매물이 없습니다.</p>
                    <p className="analysis-targets-note">
                        관심목록에 담아둔 매물에서 실측을 시작하면 여기에 나타납니다.
                    </p>
                    <button type="button" className="analysis-empty-cta" onClick={onGoToFavorites}>
                        관심목록에서 고르기
                    </button>
                </div>
            </div>
        );
    }

    // 단계 상태는 그 단계의 대표 항목 상태를 따른다 — 서버가 준 itemStatuses를 그대로 읽는다.
    const statusOf = (stepNo: number) => {
        const keys = STEP_ITEM_KEYS[stepNo] ?? [];
        const rows = (detail?.itemStatuses ?? []).filter((row) => keys.includes(row.itemKey));
        if (rows.some((row) => row.status === "RECHECK")) return { status: "RECHECK" as const, rows };
        if (rows.some((row) => row.status === "MEASURED")) return { status: "MEASURED" as const, rows };
        return { status: "ESTIMATED" as const, rows };
    };

    const statusNoteOf = (stepNo: number) => {
        const { rows } = statusOf(stepNo);
        // 단계 배지는 항목들을 묶은 값이라, 일부만 실측이면 그 사실을 부기한다(헤더와 항목이 다른 말을 하지 않게).
        const measured = rows.filter((row) => row.status !== "ESTIMATED").length;
        const partial = rows.length > 0 && measured > 0 && measured < rows.length ? `${measured}/${rows.length} ` : "";
        const dated = rows.filter((row) => row.inputAt);
        const latest = dated.sort((a, b) => ((a.inputAt ?? "") < (b.inputAt ?? "") ? 1 : -1))[0];
        if (!latest?.inputAt) return partial;

        // 날짜·경과일은 서버가 준 anchorDate/elapsedDays를 그대로 쓴다 — 프론트에서 계산하지 않는다.
        const elapsed = latest.elapsedDays != null ? ` · ${latest.elapsedDays}일 경과` : "";
        if (latest.anchorUsed === "DOCUMENT_DATE" && latest.anchorDate) {
            return `${partial}서류 날짜 ${latest.anchorDate}${elapsed}`;
        }
        return `${partial}입력일 기준 ${latest.anchorDate ?? latest.inputAt.slice(0, 10)}${elapsed}`;
    };

    // 저장 단위(원·만원)를 화면 단위(억)로 되돌린다. 실측이 없으면 추정치를 넣는다 — 편집 모드도 빈 양식이
    // 아니라서(§2.2-b 규칙 2) 그대로 저장하면 "확인해보니 추정치가 맞다"는 판단이 된다.
    const driverValueOf = (stepNo: number) => {
        const values = detail?.values;
        const recalculation = detail?.recalculation;
        if (!values) return null;

        if (stepNo === 2) {
            return values.actualExpandableAreaSqm ?? recalculation?.additionalBuildableAreaSqm.value ?? null;
        }
        if (stepNo === 3) {
            const raw = values.actualConstructionEstimate ?? recalculation?.constructionEstimate.value ?? null;
            return raw != null ? Number((raw / 100000000).toFixed(2)) : null;
        }
        if (stepNo === 4) {
            const raw = values.actualPurchasePrice ?? recalculation?.purchasePrice.value ?? null;
            return raw != null ? Number((raw / 10000).toFixed(2)) : null;
        }
        if (stepNo === 5) {
            const raw = values.postRemodelEstimatedPrice ?? recalculation?.projectedValue ?? null;
            return raw != null ? Number((raw / 10000).toFixed(2)) : null;
        }
        return null;
    };

    // STEP 1 항목별 현재 값 — 실측이 있으면 그 값, 없으면 공공데이터 값이 그대로 입력칸에 들어간다.
    const fieldValuesOf = (stepNo: number): Record<string, string> => {
        if (stepNo !== 1) return {};

        const values = detail?.values;
        const safety = values?.safetyInspection;
        const status = safety?.grade ? "결과 받음" : "";
        // 용도지역·용적률 상한·지구단위계획은 공공데이터에 값이 있다 — 실측이 없으면 그 값을 그대로 채운다.
        const zone = values?.zoneName ?? basis?.zoneName ?? "";
        const farLimit = values?.farLimitPct ?? basis?.floorAreaRatioLimit ?? null;
        const publicDistrictPlans = basis?.districtNames.filter((name) => name.includes("지구단위계획")) ?? [];
        const publicDistrict = basis ? (publicDistrictPlans.length > 0 ? "있음" : "없음") : "";

        // 높이제한은 "숫자(m)"와 "제한 없음"을 나눠 보관한다 — 비움(미확인)과 확인 결과 제한 없음은 다른 상태다.
        const heightDistrict = basis?.districtNames.find((name) => /높이|고도/.test(name)) ?? "";
        const heightRaw = values?.heightLimit ?? "";
        const heightNone = heightRaw.trim() === "제한 없음";
        const heightNumber = heightNone ? "" : heightRaw.replace(/[^0-9.]/g, "");
        const districtRaw = values?.districtPlan ?? "";
        const districtExists = districtRaw.trim() !== "" && districtRaw.trim() !== "없음";

        return {
            zoneName: zone,
            farLimitPct: farLimit != null ? String(farLimit) : "",
            heightLimit: heightNumber,
            heightLimit__none: String(heightNone),
            heightLimit__district: heightDistrict,
            districtPlanExists: districtRaw.trim() === "" ? publicDistrict : districtExists ? "있음" : "없음",
            districtPlan: districtExists ? districtRaw : publicDistrictPlans.join(", "),
            safetyStatus: status,
            safetyGrade: safety?.grade ?? "",
        };
    };

    const measuredFarLimit = detail?.values.farLimitPct ?? null;
    const gaugeFarLimit = measuredFarLimit ?? basis?.floorAreaRatioLimit ?? null;
    // 이론상 상한은 "용적률만 본 값"이다 — STEP 2를 실측하면 서버의 additionalBuildableAreaSqm이 그 실측값으로
    // 바뀌므로, 그때는 이론상 값으로 쓰지 않는다(검토값과 상한을 같은 수로 비교하면 "0㎡ 남김"이 된다).
    const serverAdd = detail?.recalculation.additionalBuildableAreaSqm;
    const publicAdd =
        measuredFarLimit != null && measuredFarLimit !== basis?.floorAreaRatioLimit
            ? null
            : (basis?.additionalBuildableAreaSqm ?? null);
    const gaugeTheoreticalAdd =
        detail?.recalculation.theoreticalAdditionalBuildableAreaSqm ??
        (serverAdd?.measured === false ? (serverAdd.value ?? publicAdd) : publicAdd);

    const visibleStep1Fields = (fields: AnalysisStepData["fields"]) =>
        isMultiFamilyHousing ? fields : fields.filter((field) => field.label !== "안전진단");

    // 주택 외(isHousing=false)는 개인·법인 취득세가 같아 취득 주체를 물으면 "반영되겠구나"라는 오해만 준다
    // — 항목 자체를 화면에서 뺀다(§3.3-a). 판정은 서버 값을 그대로 쓴다.
    const visibleStep4Fields = (fields: AnalysisStepData["fields"]) =>
        detail?.recalculation.isHousing === false
            ? fields.filter((field) => field.label !== "취득 주체")
            : fields;

    // 지구단위계획이 "있음"인데 상한을 안 넣으면 조례 값으로 계산된다 — 그 상태에서만 경고를 띄운다.
    // STEP 1 값이 STEP 2로 흐르므로 경고도 같이 흐른다(상한이 틀리면 증축 상한도 틀린다).
    // 추진 요건 미충족은 밴드 위 경고가 말한다 — 결과 카드는 값이 없는 다른 이유만 적는다.
    const addUnavailableReason =
        measuredFarLimit != null && measuredFarLimit !== basis?.floorAreaRatioLimit
            ? "저장한 용적률 상한 기준 값이 아직 없습니다"
            : null;

    const districtPlanExists = (() => {
        const saved = detail?.values.districtPlan?.trim() ?? "";
        if (saved) return saved !== "없음";
        return (basis?.districtNames.filter((name) => name.includes("지구단위계획")).length ?? 0) > 0;
    })();
    // 저장하면 서버가 조례값을 farLimitPct에 채운다 — 값이 있다고 지침을 확인한 것은 아니다.
    // 조례값과 다른 값이 들어와 있을 때만 "지침값을 넣었다"고 본다.
    const guidelineEntered =
        detail?.values.farLimitPct != null && detail.values.farLimitPct !== basis?.floorAreaRatioLimit;
    const districtPlanWarning =
        districtPlanExists && !guidelineEntered
            ? `지구단위계획 지침 미확인 — 조례 ${basis?.floorAreaRatioLimit ?? "기준"}%로 계산 중입니다. 지침값을 확인해 주세요`
            : null;

    // "이 단계가 바꾸는 값"은 서버가 준 재계산 결과를 그대로 쓴다 — 자리표시자를 남기지 않는다.
    const resultsOf = (step: AnalysisStepData) => {
        const recalculation = detail?.recalculation;
        const eok = (manwon: number | null | undefined) =>
            manwon != null ? `${(manwon / 10000).toFixed(1)}` : "—";

        if (step.stepNo === 1) {
            // 근거식은 막대 양 끝 값의 뺄셈으로 쓴다 — 여유 %p × 대지면적은 화면에 없는 숫자라 검산이 안 되고,
            // 상한이 바뀌면 문구만 뒤처진다.
            const limitArea =
                basis?.landAreaSqm != null && gaugeFarLimit != null
                    ? (basis.landAreaSqm * gaugeFarLimit) / 100
                    : null;
            const zoningArea = basis?.farComputationGfa ?? null;
            const over = limitArea != null && zoningArea != null && zoningArea > limitArea;
            const value = over
                ? "없음"
                : gaugeTheoreticalAdd != null
                  ? `${formatArea(gaugeTheoreticalAdd)}㎡`
                  : "산출 안 됨";
            const desc = over
                ? "이미 상한 초과"
                : gaugeTheoreticalAdd != null
                  ? limitArea != null && zoningArea != null
                      ? `${formatArea(limitArea)} − ${formatArea(zoningArea)}`
                      : ""
                  : (addUnavailableReason ?? "산출 조건 미확인");
            return [{ ...step.results[0], value, desc }];
        }

        if (step.stepNo === 2) {
            const added = driverValueOf(2);
            // 산정 면적은 대장 원본값(farComputationGfa)을 쓰고, 없을 때만 여유값에서 되돌린다.
            const zoningArea =
                basis?.farComputationGfa ??
                (basis?.landAreaSqm != null && basis.floorAreaRatioLimit != null
                    ? (basis.landAreaSqm * (basis.floorAreaRatioLimit - (basis.floorAreaRatioSurplus ?? 0))) / 100
                    : null);
            const afterZoning = zoningArea != null && added != null ? zoningArea + added : null;
            const afterGross =
                basis?.grossFloorAreaSqm != null && added != null ? basis.grossFloorAreaSqm + added : null;
            const text = (value: number | null) => (value != null ? formatArea(value) : "—");

            return [
                { ...step.results[0], value: text(afterZoning) },
                { ...step.results[1], value: text(afterGross) },
            ];
        }

        if (step.stepNo === 3) {
            const cost = recalculation?.constructionEstimate.value;
            return [{ ...step.results[0], value: cost != null ? (cost / 100000000).toFixed(1) : "—" }];
        }

        if (step.stepNo === 4) {
            return [{ ...step.results[0], value: eok(recalculation?.totalInvestment) }];
        }

        if (step.stepNo === 5) {
            return [{ ...step.results[0], value: eok(recalculation?.projectedValue) }];
        }

        return step.results;
    };

    const documentDateOf = (stepNo: number) => {
        const values = detail?.values;
        if (!values) return null;
        if (stepNo === 1) return values.safetyInspection?.inspectionDate ?? null;
        if (stepNo === 2) return values.expandableAreaDocumentDate;
        if (stepNo === 3) return values.estimateDocumentDate;
        return null;
    };

    return (
        <div className="analysis-page">
            <aside className="analysis-targets">
                <p className="analysis-targets-title">분석 중인 대상 · {targets.length + (pendingTarget ? 1 : 0)}</p>
                {pendingTarget && (
                    <button
                        type="button"
                        className={
                            pendingTarget.id === selectedId ? "analysis-target is-active" : "analysis-target"
                        }
                        onClick={() => setSelectedId(pendingTarget.id)}
                    >
                        <p className="analysis-target-address">{pendingTarget.address || pendingTarget.id}</p>
                        <p className="analysis-target-delta">실측 0/4 · ROI 없음</p>
                        <p className="analysis-target-meta">아직 저장 전 — 아무 단계나 먼저 입력하면 시작됩니다</p>
                    </button>
                )}
                {targets.map((item) => (
                    <button
                        type="button"
                        key={item.buildingId}
                        className={item.buildingId === selectedId ? "analysis-target is-active" : "analysis-target"}
                        onClick={() => setSelectedId(item.buildingId)}
                    >
                        <p className="analysis-target-address">{item.address}</p>
                        <span className="analysis-target-progress">
                            <i style={{ width: `${(item.progress.measured / item.progress.total) * 100}%` }} />
                        </span>
                        <p className="analysis-target-delta">
                            실측 {item.progress.measured}/{item.progress.total}
                            {item.measuredRoi != null ? ` · ROI ${item.measuredRoi}%` : " · ROI 없음"}
                        </p>
                        <p className="analysis-target-meta">
                            {item.status === "COMPLETED" ? "완료" : "진행중"}
                            {item.nextInputField &&
                                ` · 다음 입력 ${ITEM_LABEL[item.nextInputField] ?? item.nextInputField}`}
                        </p>
                    </button>
                ))}
                <button type="button" className="analysis-target is-add" onClick={onGoToFavorites}>
                    관심목록에서 고르기
                </button>
                <p className="analysis-targets-note">
                    실측을 시작한 매물만 남습니다. 담기만 한 매물은 <b>관심목록</b>에 있습니다.
                </p>
            </aside>

            <div className="analysis-main">
                {failed && (
                    <p className="analysis-calc-failed">
                        분석 내용을 불러오지 못했습니다.
                        <button type="button" onClick={() => selectedId && loadDetail(selectedId)}>
                            다시 시도
                        </button>
                    </p>
                )}
                <AnalysisBuildingSummary
                    address={targets?.find((row) => row.buildingId === selectedId)?.address ?? ""}
                    detail={buildingDetail}
                />
                <AnalysisBand
                    recalculation={detail?.recalculation ?? null}
                    progress={detail?.progress ?? null}
                    calculating={calc.status === "running"}
                />

                {/* 실패는 저장과 분리해 알린다 — "저장 실패"로 읽히면 같은 값을 다시 넣게 된다. */}
                {calc.status === "failed" && (
                    <p className="analysis-calc-failed">
                        값은 저장됐습니다. 계산에 실패했습니다.
                        <button type="button" onClick={() => calc.retry?.()}>
                            다시 계산
                        </button>
                    </p>
                )}

                {STEPS.map((step) => (
                    <AnalysisStepCard
                        // 편집을 열고 닫을 때마다 새로 마운트시켜 현재 값으로 폼을 채운다 — 카드가 계속
                        // 마운트돼 있으면 처음 렌더(상세 도착 전)의 빈 값이 그대로 굳는다. 드롭다운이 안
                        // 채워지면 첫 항목이 선택된 채로 저장돼 값이 조용히 바뀐다(§2.2-b).
                        key={`${selectedId}-${step.stepNo}-${editingStep === step.stepNo ? "edit" : "view"}`}
                        step={{
                            ...step,
                            // 결과값은 서버 재계산 결과로 채운다.
                            results: resultsOf(step),
                            // 참고표는 그 단계 소스에서 온 것으로 교체한다.
                            reference:
                                step.stepNo === 5
                                    ? (referenceRows ?? step.reference)
                                    : step.stepNo === 3
                                      ? (costRows ?? step.reference)
                                      : step.stepNo === 2
                                        ? (capacityRows ?? step.reference)
                                        : step.reference,
                            fields:
                                step.stepNo === 4
                                    ? visibleStep4Fields(step.fields)
                                    : step.stepNo === 1
                                      ? visibleStep1Fields(step.fields)
                                      : step.fields,
                        }}
                        status={statusOf(step.stepNo).status}
                        statusNote={statusNoteOf(step.stepNo)}
                        driverValue={driverValueOf(step.stepNo)}
                        fieldValues={fieldValuesOf(step.stepNo)}
                        zoningLimits={zoningLimits}
                        referenceAreaNote={referenceAreaNoteOf(step.stepNo)}
                        // STEP 4 입력칸 아래 시장 위치 막대 — 값이 시장 어디쯤인지는 숫자만으로 안 보인다.
                        inputAside={
                            step.stepNo === 4
                                ? (typed) => (
                                      <PricePositionBar
                                          pricePosition={pricePosition}
                                          myTotalManwon={typed != null ? typed * 10000 : null}
                                          estimateTotalManwon={detail?.recalculation.purchasePrice.value ?? null}
                                          perSqm={perSqm}
                                      />
                                  )
                                : undefined
                        }
                        documentDate={documentDateOf(step.stepNo)}
                        // 막대는 각 단계의 결과다 — STEP 1은 "얼마까지 가능한가", STEP 2는 "검토 후 얼마를
                        // 채웠나". 참고 영역에 같은 막대를 한 번 더 그리지 않는다.
                        resultGauge={
                            (step.stepNo === 1 || step.stepNo === 2) && basis ? (
                                <FarGauge
                                    landAreaSqm={basis.landAreaSqm ?? 0}
                                    grossFloorAreaSqm={basis.grossFloorAreaSqm}
                                    farLimitPct={gaugeFarLimit ?? 0}
                                    currentFarPct={
                                        basis.currentFloorAreaRatio ??
                                        (basis.floorAreaRatioLimit ?? 0) - (basis.floorAreaRatioSurplus ?? 0)
                                    }
                                    farComputationGfa={basis.farComputationGfa}
                                    addedAreaSqm={step.stepNo === 2 ? driverValueOf(2) : null}
                                    theoreticalAddSqm={gaugeTheoreticalAdd}
                                    afterOnly={step.stepNo === 2}
                                />
                            ) : undefined
                        }
                        warning={step.stepNo === 1 || step.stepNo === 2 ? districtPlanWarning : null}
                        editing={editingStep === step.stepNo}
                        saveDisabled={calc.status === "running"}
                        onEdit={() => requestEdit(step.stepNo)}
                        onCancel={() => setEditingStep(null)}
                        onSave={(payload) => handleSave(step.stepNo, payload)}
                    />
                ))}

                <section className="analysis-step">
                    <p className="analysis-step-results-label">입력 이력</p>
                    {history.length === 0 ? (
                        <p className="analysis-targets-note">아직 저장된 변경이 없습니다.</p>
                    ) : (
                        <table className="analysis-history">
                            <tbody>
                                {history.map((entry) => (
                                    <tr key={`${entry.changedAt}-${entry.itemKey}`}>
                                        <td className="analysis-history-date">{entry.changedAt.slice(5, 10)}</td>
                                        <td>
                                            <span className="analysis-history-who">STEP {entry.stepNo}</span>{" "}
                                            {ITEM_LABEL[entry.itemKey] ?? entry.itemKey}
                                            {/* 서버는 항목별 jsonb를 문자열로 준다 — 사람이 읽을 수 있게 값만 뽑는다. */}
                                            <span className="analysis-history-change">
                                                {" "}
                                                {formatHistoryValue(entry.previousValue)} →{" "}
                                                {formatHistoryValue(entry.newValue)}
                                            </span>
                                        </td>
                                        <td className="analysis-history-roi">
                                            {entry.measuredRoiAtChange != null
                                                ? `ROI ${entry.measuredRoiAtChange}%`
                                                : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>

            {switchTo != null && (
                <div className="analysis-confirm-backdrop" onClick={() => setSwitchTo(null)}>
                    <div
                        className="analysis-confirm"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="analysis-confirm-text">
                            편집 중인 STEP {editingStep}의 내용이 저장되지 않았습니다. 닫고 STEP {switchTo}로
                            이동할까요?
                        </p>
                        <div className="analysis-confirm-actions">
                            <button type="button" onClick={() => setSwitchTo(null)}>
                                계속 편집
                            </button>
                            <button
                                type="button"
                                className="is-primary"
                                onClick={() => {
                                    setEditingStep(switchTo);
                                    setSwitchTo(null);
                                }}
                            >
                                이동
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisPage;
