import { buildRemodelingChecklist, buildVerdictReason, VERDICT_LABEL } from "../../remodeling/api/remodelingApi";
import { ESTIMATED_AREA_TYPES, formatCurrency } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../investment/api/analysisApi";
import GaugeBar from "../../../shared/components/common/GaugeBar";

interface RemodelingAnalysisPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    buildYear: number | null;
    propertyType: string | null;
    householdCount: number | null;
}

// cost API 값은 원 단위라 formatCurrency를 직접 쓴다(2026-08-1x 금액 표시 전역 통일 — 만원 변환용 로컬 래퍼
// 불필요, formatCurrency가 내부에서 억/만원 분기까지 전부 처리).
const formatWon = formatCurrency;

const COST_STATUS_MESSAGE: Record<string, string> = {
    NOT_APPLICABLE_REMODELING_NOT_POSSIBLE: "리모델링 불가로 공사비 산정 대상 아님",
    NO_REFERENCE_RATE: "해당 유형 기준단가 없음, 추정 불가",
    AREA_UNAVAILABLE: "산출 불가",
};

// FEATURE_10_AI_REPORT.md §2.3(2026-08-1x 재편, 구 "사업성 분석"): analysis.remodeling(F-06) + 공사비 카드
// (구 "수익 분석"에서 이동, F-07) — 새 API 없음. 2026-08-1x: 5카드 균등 스택 → 위계형 배치(종합판정 배너 →
// 예상 공사비 강조 카드 → "판단 근거" 소제목 아래 report-grid-3(게이지×2 + 세부 근거 표)).
const RemodelingAnalysisPage = ({ analysis, loading, buildYear, propertyType, householdCount }: RemodelingAnalysisPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis?.remodeling == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { remodeling, cost } = analysis;
    const { basis } = remodeling;
    const checklist = buildRemodelingChecklist(basis);
    const reason = buildVerdictReason(remodeling.verdict, checklist);

    // §2.3 item 3 "용적률 게이지" — API에 현재 용적률 필드가 없어 법정상한-여유로 역산(FEATURE_07_COST.md §2.1과 동일 근거).
    const currentFar =
        basis.floorAreaRatioLimit != null && basis.floorAreaRatioSurplus != null
            ? basis.floorAreaRatioLimit - basis.floorAreaRatioSurplus
            : null;
    const farPercent = currentFar != null && basis.floorAreaRatioLimit ? (currentFar / basis.floorAreaRatioLimit) * 100 : 0;

    const isHouseholdBased = propertyType != null && ESTIMATED_AREA_TYPES.includes(propertyType);
    // null이 아님을 별도 변수로 묶어 아래 JSX에서 non-null assertion(!) 없이 쓴다(analysisApi.ts의
    // buildProfitAnalysis류 "조건 충족 시에만 값 있는 객체" 관례와 동일).
    const costDetail =
        cost.status === "AVAILABLE" && cost.minCost != null && cost.maxCost != null && cost.basis != null
            ? { minCost: cost.minCost, maxCost: cost.maxCost, basis: cost.basis }
            : null;

    return (
        <>
            {/* 1. 헤더 — verdict 배지+판정 사유(F-05/요약 페이지와 동일 로직). 섹션 타이틀은 ReportPage의 번호 헤딩이
                이미 "리모델링 분석"으로 보여주므로 여기서는 반복하지 않고 더 구체적인 라벨을 쓴다. */}
            <section className="right-panel-card">
                <div className="right-panel-card-header">
                    <h5 className="right-panel-card-title">종합 판정</h5>
                    <span
                        className={`right-panel-verdict-badge right-panel-verdict-${remodeling.verdict.toLowerCase().replace("_", "-")}`}
                    >
                        {VERDICT_LABEL[remodeling.verdict]}
                    </span>
                </div>
                {reason && (
                    <>
                        <hr className="right-panel-card-divider" />
                        <p className="right-panel-verdict-reason">{reason}</p>
                    </>
                )}
            </section>

            {/* 2. 예상 공사비 — 강조 카드(위계 상 종합판정 다음으로 중요), 좌(헤드라인)/우(산출 근거 표) 2단.
                구 "수익 분석"(F-07)에서 이동, 2026-08-1x 위계형 재배치. */}
            <section className="right-panel-card report-card-emphasis">
                <h5 className="right-panel-card-title">
                    <span className="right-panel-estimate-anchor">
                        예상 공사비<span className="right-panel-estimate-tag">추정치 — 실측 견적 아님</span>
                    </span>
                </h5>
                {costDetail == null ? (
                    <p className="right-panel-field-note">{COST_STATUS_MESSAGE[cost.status] ?? "산출 불가"}</p>
                ) : (
                    <div className="report-cost-split">
                        <div className="report-cost-split-headline">
                            <p className="right-panel-market-cell-value">
                                {formatWon(costDetail.minCost)} ~ {formatWon(costDetail.maxCost)}
                            </p>
                            <p className="right-panel-market-cell-aux">
                                {householdCount != null && isHouseholdBased
                                    ? `세대당 약 ${formatWon(costDetail.minCost / householdCount)} ~ ${formatWon(costDetail.maxCost / householdCount)} · `
                                    : ""}
                                ㎡당 약 {formatWon(costDetail.minCost / costDetail.basis.grossFloorArea)} ~{" "}
                                {formatWon(costDetail.maxCost / costDetail.basis.grossFloorArea)}
                            </p>
                        </div>
                        <dl className="right-panel-fact-list report-cost-split-table">
                            <div>
                                <dt>연면적</dt>
                                <dd>{costDetail.basis.grossFloorArea}㎡</dd>
                            </div>
                            <div>
                                <dt>기준단가</dt>
                                <dd>{costDetail.basis.baseUnitPricePerSqm.toLocaleString()}원/㎡</dd>
                            </div>
                            <div>
                                <dt>노후도 보정계수</dt>
                                <dd>
                                    {costDetail.basis.agingFactorMin.toFixed(2)} ~ {costDetail.basis.agingFactorMax.toFixed(2)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                )}
            </section>

            {/* 3. 판단 근거 — 게이지 2개(상대적으로 작은 카드) + 세부 근거 표, report-grid-3(기본정보와 같은 클래스 재사용) */}
            <p className="report-subsection-title">판단 근거</p>
            <div className="report-grid-3">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">노후도 달성률</h5>
                    {basis.buildingAgeYears != null && basis.requiredYears != null ? (
                        <GaugeBar
                            label={`건축연수 ${basis.buildingAgeYears}년 / 필요연한 ${basis.requiredYears}년`}
                            percent={remodeling.score ?? 0}
                            tone={checklist.aging.ok ? "success" : "warning"}
                            caption={`달성률 ${remodeling.score ?? 0}% · ${basis.zoneName ?? "용도지역 미상"} 기준 필요연수 ${checklist.aging.ok ? "충족" : "미달"}`}
                        />
                    ) : (
                        <p className="right-panel-field-note">정보 없음</p>
                    )}
                </section>

                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">용적률 활용도</h5>
                    {currentFar != null && basis.floorAreaRatioLimit != null ? (
                        <GaugeBar
                            label={`${currentFar.toFixed(2)}% / ${basis.floorAreaRatioLimit}%`}
                            percent={farPercent}
                            tone="neutral"
                            caption={`여유 ${basis.floorAreaRatioSurplus}%p · 증축가능면적 약 ${basis.additionalBuildableAreaSqm ?? "?"}㎡ · 법정 상한 기준(완화 전)`}
                        />
                    ) : (
                        <p className="right-panel-field-note">정보 없음</p>
                    )}
                </section>

                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">세부 근거</h5>
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>용도지역</dt>
                            <dd>{basis.zoneName ?? "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>최근 인허가</dt>
                            <dd>
                                {basis.recentPermitType
                                    ? `${basis.recentPermitType}${basis.recentPermitDate ? ` (${basis.recentPermitDate})` : ""}`
                                    : "없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>건물 나이</dt>
                            <dd>
                                {basis.buildingAgeYears != null
                                    ? `${basis.buildingAgeYears}년${buildYear != null ? `(준공 ${buildYear}년)` : ""}`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>예상 세대 증가</dt>
                            <dd>
                                {!isHouseholdBased
                                    ? "해당 없음"
                                    : basis.estimatedAdditionalHouseholds != null
                                      ? `${basis.estimatedAdditionalHouseholds}세대`
                                      : "정보 없음"}
                            </dd>
                        </div>
                    </dl>
                </section>
            </div>
        </>
    );
};

export default RemodelingAnalysisPage;
