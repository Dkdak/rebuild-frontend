import {
    buildRemodelingChecklist,
    buildVerdictReason,
    VERDICT_HEADLINE_FALLBACK,
    VERDICT_LABEL,
    VERDICT_REASON_PARAGRAPH,
    VERDICT_SHORT_NOTE,
    VERDICT_SUBLABEL,
} from "../../remodeling/api/remodelingApi";
import { ESTIMATED_AREA_TYPES, formatCurrency } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../investment/api/analysisApi";
import { formatCostSourceShort } from "../../cost/api/costApi";
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
    // 2026-08-10 확정 — "종합 판정" 헤드라인은 이제 POSSIBLE도 예외 없이 보여준다. buildVerdictReason은
    // POSSIBLE이면 항상 null이라(verdict 배지 "부제"용으로 설계돼 있었음) 그 자리엔 VERDICT_HEADLINE_FALLBACK의
    // 고정 문구를 대신 쓴다(매물마다 계산 안 함, verdict 값 자체로만 결정).
    const verdictHeadline = remodeling.verdict === "POSSIBLE" ? (VERDICT_HEADLINE_FALLBACK.POSSIBLE ?? null) : reason;

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
            {/* 1. 종합 판정 + 판정 사유 요약 — 별개 카드 2개, 고정 1:1 그리드(2026-08-10 최종 확정, 가변폭 아님).
                섹션 타이틀은 ReportPage의 번호 헤딩이 이미 "리모델링 분석"으로 보여주므로 여기서는 반복하지
                않고 더 구체적인 라벨을 쓴다. */}
            <div className="report-verdict-row">
                <section className="right-panel-card report-verdict-card">
                    <h5 className="right-panel-card-title">리모델링 추진 요건 판정</h5>
                    {/* 2026-08-10 추가 — 제목 아래 판정 기준 캡션(F-06 문구 확정분). */}
                    <p className="right-panel-field-note">노후연한과 진행 중 개발행위 두 가지를 기준으로 판정합니다.</p>
                    {/* 2026-08-17 재구성(§확정분) — 판정 카드는 헤드라인+짧은 부연 한 줄만 남긴다. 기존
                        VERDICT_REASON_PARAGRAPH(전체 문단)와 판정에 영향을 주는 한계 2줄은 전부 아래 신규
                        "결론" 카드로 이동(문장 삭제 없음, 위치만 이동) — 판정 카드는 "무엇인지"만, 근거·한계는
                        "결론" 카드에서 한 번에. verdictHeadline은 remodelingApi.ts에 필드로 없는 값이라(전달받은
                        diff의 remodeling.basis.reason은 실제 타입에 없음) 이미 계산해 둔 로컬 값을 재사용. */}
                    <div className="report-verdict-content">
                        <div className="report-verdict-badge-col">
                            <span
                                className={`right-panel-verdict-badge right-panel-verdict-${remodeling.verdict.toLowerCase().replace("_", "-")}`}
                            >
                                {VERDICT_LABEL[remodeling.verdict]}
                            </span>
                            {VERDICT_SUBLABEL[remodeling.verdict] && (
                                <span className="report-verdict-sublabel">{VERDICT_SUBLABEL[remodeling.verdict]}</span>
                            )}
                        </div>
                        <div className="report-verdict-text-col">
                            {verdictHeadline && (
                                <div className="verdict-headline">
                                    <p className="headline">{verdictHeadline}</p>
                                    <p className="short-note">{VERDICT_SHORT_NOTE[remodeling.verdict]}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                <section className="right-panel-card report-verdict-summary-card">
                    <h5 className="right-panel-card-title">판정 사유 요약</h5>
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>노후도</dt>
                            <dd>
                                {basis.buildingAgeYears != null && basis.requiredYears != null
                                    ? `${basis.buildingAgeYears} / ${basis.requiredYears}년`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>용적률 여유</dt>
                            {/* 원본 diff는 (floorAreaRatioLimit - floorAreaRatio)였지만 RemodelingBasis에 floorAreaRatio
                                필드가 없다 — "용적률 여유"는 이미 basis.floorAreaRatioSurplus로 직접 내려온다(아래
                                "용적률 활용도" 게이지 캡션과 같은 값, 재계산 아님).
                                2026-08-12 표기 정정 — toFixed(2)로 "505.17%p"처럼 소수점이 그대로 보이던 것을
                                반올림+"약" 접두로 통일(remodelingApi.ts의 farSurplus.text와 같은 표기 규칙). */}
                            <dd>{basis.floorAreaRatioSurplus != null ? `약 ${Math.round(basis.floorAreaRatioSurplus)}%p` : "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>증축 여력</dt>
                            {/* 2026-08-12 표기 정정 — 천단위 쉼표 추가. 2026-08-17 추가 정정 — toLocaleString()만으론
                                소수점이 그대로 남는다(remodelingApi.ts의 buildable.text와 같은 문제) — Math.round까지. */}
                            <dd>
                                {basis.additionalBuildableAreaSqm != null
                                    ? `약 ${Math.round(basis.additionalBuildableAreaSqm).toLocaleString()}㎡`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>입지/용도지역</dt>
                            <dd>{basis.zoneName ?? "정보 없음"}</dd>
                        </div>
                    </dl>
                </section>
            </div>

            {/* 2. 판단 근거 — 게이지 2개(상대적으로 작은 카드) + 세부 근거 표, report-grid-3(기본정보와 같은 클래스 재사용).
                2026-08-10 — 예상 공사비보다 위로 순서 변경(판정 → 판단 근거 → 공사비). */}
            <p className="report-subsection-title">판단 근거</p>
            {/* 2026-08-10 추가 — 소제목 아래 캡션: 판정에 실제로 반영된 값 vs 참고용 지표를 구분(F-06 문구 확정분). */}
            <p className="right-panel-field-note">
                노후도 달성률은 위 판정에 직접 반영된 값입니다. 용적률·증축 여력·용도지역·지구/구역 지정은 판정에
                반영되지 않은 사업 검토용 참고 지표입니다.
            </p>
            <div className="report-grid-3">
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">노후도 달성률</h5>
                    {/* 2026-08-10 목업 반영 — "달성률 97% · 용도지역 기준 필요연수 충족/미달" 한 줄 텍스트는 폐기.
                        "OO지역 기준 필요연수 미달"이라는 문구는 API 필드가 아니라 프론트가 임의로 붙인
                        설명이었다는 지적 확인 — checklist.aging.text(실제 계산값, "노후·불량 기준까지 N년
                        부족"/"충족")만 tone 배지로 보여주고 그 외 창작 문구는 전부 제거.
                        2026-08-10 추가 — score가 null이면(buildingAgeYears/requiredYears는 있어도) 게이지 자체를
                        그리지 않고 "산출 불가"로 표시(기존 `remodeling.score ?? 0`은 null을 0%로 렌더링해버려
                        "노후도 0%"처럼 잘못 읽혔다 — F-06 문구 확정분). */}
                    {basis.buildingAgeYears != null && basis.requiredYears != null && remodeling.score != null ? (
                        <GaugeBar
                            label={`건축연수 ${basis.buildingAgeYears}년 / 필요연수 ${basis.requiredYears}년`}
                            bigValue={`${remodeling.score}%`}
                            percent={remodeling.score}
                            tone={checklist.aging.ok ? "success" : "warning"}
                            reasonBadge={checklist.aging.text}
                        />
                    ) : (
                        <p className="right-panel-field-note">산출 불가</p>
                    )}
                </section>

                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">용적률 활용도</h5>
                    {/* "법정상한 기준(완화 전)"도 위와 같은 이유로 제거 — additionalBuildableAreaSqm은 실측값 그대로,
                        "이론상 여유면적... 추가 검토 필요"는 목업 원문 그대로(창작 아님, 확정 지시분). */}
                    {/* 2026-08-12 표기 정정 — toFixed(2)/comma 없는 raw 숫자 전부 정리(analysisApi.ts·
                        remodelingApi.ts와 같은 규칙: %p는 반올림+"약", ㎡는 천단위 쉼표). 문구 자체는
                        그대로(이전 라운드에서 목업 원문대로 확정한 부분 — 숫자 표기만 수정). */}
                    {currentFar != null && basis.floorAreaRatioLimit != null ? (
                        <GaugeBar
                            label={`사용 ${currentFar.toFixed(2)}% / 법정상한 ${basis.floorAreaRatioLimit}%`}
                            bigValue={
                                <>
                                    약 {basis.floorAreaRatioSurplus != null ? Math.round(basis.floorAreaRatioSurplus) : "?"}%p{" "}
                                    <span className="gauge-bar-value-suffix">여유</span>
                                </>
                            }
                            percent={farPercent}
                            tone="neutral"
                            invertFill
                            note={
                                // 2026-08-17 정정 — 위 "증축 여력" dd와 같은 표기 규칙(Math.round+toLocaleString)으로 통일.
                                basis.additionalBuildableAreaSqm != null
                                    ? `이론상 여유면적 약 ${Math.round(basis.additionalBuildableAreaSqm).toLocaleString()}㎡ — 실제 증축 가능 면적은 추가 검토 필요`
                                    : undefined
                            }
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
                                    : "확인된 이력 없음"}
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
                                      ? `이론상 약 ${basis.estimatedAdditionalHouseholds}세대`
                                      : "정보 없음"}
                            </dd>
                        </div>
                        {/* 2026-08-10 추가 — 지구/구역 지정 전부 나열(개수 제한 없음, F-06 문구 확정분). */}
                        <div>
                            <dt>지구/구역 지정</dt>
                            <dd>{basis.districtNames.length > 0 ? basis.districtNames.join(", ") : "확인된 지정 없음"}</dd>
                        </div>
                    </dl>
                </section>
            </div>

            {/* 3. 예상 공사비 — 강조 카드, 좌(헤드라인)/우(산출 근거 표) 2단. 구 "수익 분석"(F-07)에서 이동.
                2026-08-17 3차 재정정 — 판단 근거 3카드 바로 다음(맨 아래에서 세 번째)으로 순서 변경, 카드
                내부 구조는 변경 없음. */}
            <section className="right-panel-card report-card-emphasis">
                <h5 className="right-panel-card-title">
                    <span className="right-panel-estimate-anchor">
                        {/* 2026-08-17 표기 정정 — docs/CONTENT_TAXONOMY.md §2 "A. 값 보조"(2~8자) 예산 초과였다
                            ("추정치 — 실측 견적 아님" 11자). "추정치"만으로도 실측 견적이 아니라는 뜻은 이미
                            전달되고, 상세 한계는 아래 "결과" 카드 문단에서 다룬다(중복 아님, layout.css의
                            right-panel-estimate-tag 주석이 이미 "추정치"(2자) 짧은 형태를 소비처 예시로 들고
                            있었음). */}
                        예상 공사비<span className="right-panel-estimate-tag">추정치</span>
                    </span>
                </h5>
                {costDetail == null ? (
                    <p className="right-panel-field-note">{COST_STATUS_MESSAGE[cost.status] ?? "산출 불가"}</p>
                ) : (
                    <div className="report-cost-split">
                        <div className="report-cost-split-headline">
                            {/* 2026-08-10 버그 수정 — F-05용 소형 클래스(14px) 대신 이 카드 전용 report-cost-amount
                                (20px/800, report-stat-value 투자등급 칸과 같은 크기)로 교체. */}
                            <p className="report-cost-amount">
                                {formatWon(costDetail.minCost)} ~ {formatWon(costDetail.maxCost)}
                            </p>
                            <p className="right-panel-market-cell-aux">
                                {householdCount != null && isHouseholdBased
                                    ? `세대당 약 ${formatWon(costDetail.minCost / householdCount)} ~ ${formatWon(costDetail.maxCost / householdCount)} · `
                                    : ""}
                                ㎡당 약 {formatWon(costDetail.minCost / costDetail.basis.grossFloorArea)} ~{" "}
                                {formatWon(costDetail.maxCost / costDetail.basis.grossFloorArea)}
                            </p>
                            {/* 2026-08-17 삭제(§확정분) — "개략 추정치이며..." 박스가 카드 제목 옆 "추정치 —
                                실측 견적 아님" 배지와 같은 말을 중복 전달하고 있었다. */}
                        </div>
                        <dl className="right-panel-fact-list report-cost-split-table">
                            <div>
                                <dt>연면적</dt>
                                {/* 2026-08-17 표기 정정(docs/CONTENT_TAXONOMY.md §2 "A. 값") — 쉼표 없이 원본
                                    그대로 나오던 것(예: "23658.32㎡") → 반올림+천단위 쉼표. */}
                                <dd>{Math.round(costDetail.basis.grossFloorArea).toLocaleString()}㎡</dd>
                            </div>
                            <div>
                                <dt>기준단가</dt>
                                {/* 2026-08-10 버그 수정 — toLocaleString()+"원/㎡" 수동 조합 대신 formatCurrency로 통일
                                    (1억 이상이면 억 단위로 자동 전환). 단위(㎡당)는 formatCurrency가 안 붙여줘서
                                    /㎡는 그대로 유지 — 없으면 "98만원"처럼 단가라는 정보가 사라진다. */}
                                <dd>{formatCurrency(costDetail.basis.baseUnitPricePerSqm)}/㎡</dd>
                            </div>
                            {/* 2026-08-10 — cost_base_price.source(백엔드 반영 완료). 기준단가만의 근거라(노후도
                                보정계수는 같은 고시의 다른 조항, 제10조) 바로 아래 순서로 둬서 혼동을 막는다.
                                조항 번호("제6조...")까지 보여주면 보정계수 근거로 오인될 수 있어 고시 번호까지만
                                잘라 표시(formatCostSourceShort, costApi.ts). */}
                            <div>
                                <dt>기준 산정 방식</dt>
                                <dd>{costDetail.basis.source != null ? formatCostSourceShort(costDetail.basis.source) : "정보 없음"}</dd>
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

            {/* 2026-08-17 6차 재정정(§확정분, 최종) — 4줄 중 3번째("용적률·세부 근거 — ...")가 서로 다른 두
                출처(용적률 여유/지구·구역 제한)를 한 줄에 욱여넣어 출처명만 나열되고 의미가 안 통한다는 지적
                — 그 한 줄만 "용적률 여유" 항목과 "세부 근거의 지구/구역 제한" 항목으로 분리(총 4줄→5줄).
                1·2·5번째 줄(구 4번째, 면책)은 문구 그대로. "행정기관 확인" 문구는 새 4번째 줄(지구/구역
                제한)로 옮겨가고, 5번째(면책)는 그만큼 간결해짐 — 내용 삭제가 아니라 재배치. 1문단·카드
                위치·구조는 변경 없음. */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">결과</h5>
                {/* 판정 결과 자체는 아래 부가 정보 목록(옅은 회색)과 위계가 달라야 하는데 right-panel-field-note
                    (12px 회색)를 그대로 써서 구분이 안 됐다 — 진한 본문색(text-primary급)·13px 전용 클래스로. */}
                <p className="report-result-headline">{VERDICT_REASON_PARAGRAPH[remodeling.verdict]}</p>
                {/* 세션 전체 가독성 정책(폰트 12px 이상)에 맞춰 11px 대신 12px 적용 — 그 외 문구·구조는 그대로. */}
                <ul className="report-result-notes">
                    <li>노후도 — 사용승인일 기준 경과연수, 실제 노후 상태(배관·설비 등)는 반영되지 않음</li>
                    <li>진행 중 개발행위 — 인허가 매칭률 86.6% 한계로 미확인 사례 있을 수 있음</li>
                    <li>용적률 여유 — 법정 상한 완화 전 기준으로 계산(임대주택 공급 등 완화 시 실제 여유는 더 클 수 있음)</li>
                    <li>세부 근거의 지구/구역 제한 — 구체적 내용은 관할 행정기관 확인 필요</li>
                    <li>이 분석은 공공데이터 기반 참고 자료로, 사업 추진 가능성이나 투자 수익을 보장하지 않음</li>
                </ul>
            </section>
        </>
    );
};

export default RemodelingAnalysisPage;
