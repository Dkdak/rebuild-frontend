import { useEffect, useState } from "react";
import { useSearch } from "../../search/context/SearchContext";
import { formatManwon } from "../../search/api/searchApi";
import { buildRemodelingChecklist, remodelingChecklistItems } from "../../remodeling/api/remodelingApi";
import {
    CONFIDENCE_MATCH_STAGE_LABEL,
    hasPriceConfidenceBadge,
    PRICE_DISPLAY_TONE,
    resolvePriceDisplayLabel,
    type ConfidenceLevel,
} from "../../market/api/marketApi";
import {
    buildProfitAnalysis,
    buildRiskChecklist,
    displayGainRange,
    formatUpdatedAt,
    GAIN_LABEL,
    gainSign,
    getPropertyAnalysis,
    getRecommendation,
    GRADE_LABEL,
    type PropertyAnalysis,
} from "../../investment/api/analysisApi";
import BasicInfoPage from "./BasicInfoPage";
import LocationPage from "./LocationPage";
import MarketAnalysisPage from "../../market/components/MarketAnalysisPage";
import RemodelingAnalysisPage from "./RemodelingAnalysisPage";
import BusinessAnalysisPage from "./BusinessAnalysisPage";
import AIOpinionPage from "./AIOpinionPage";
import ReferencePage from "./ReferencePage";
import FavoriteButton from "../../favorites/components/FavoriteButton";
import ValueBadge from "../../../shared/components/ValueBadge";
import { fetchBuildingReport, type BuildingReport } from "../api/reportApi";
import ReportEvidenceBand from "./ReportEvidenceBand";
import { fetchMeasurementDetail, type MeasurementDetail } from "../../analysis/api/measurementApi";
import { useAuth } from "../../../shared/context/AuthContext";
import SectionHeading from "../../../shared/components/SectionHeading";
import CardSubHeading from "../../../shared/components/CardSubHeading";
import "./ReportPage.css";

// FEATURE_10_AI_REPORT.md §2.1(2026-08-1x 카테고리 재편, planning/rebuild/레포트.png 재대조): F-05 RightPanel과
// 같은 원칙 — 8개 섹션을 한 페이지에 전부 스크롤로 쌓고, 좌측 네비는 탭 전환이 아니라 그 섹션으로 스크롤
// 이동하는 앵커다. 번호는 각 섹션 본문의 report-section-heading-number(01~08)와 동일한 값.
// 구 "종합 평가"(데이터 완성도)는 레퍼런스에 대응 개념이 없어 폐지, 구 "리스크 분석"은 요약 섹션 주의사항으로,
// 구 "유사 사례"는 시장 분석의 비교 거래 표로 흡수 — 10개→9개.
// 2026-08-18 — 구 "07 미래 가치 예측"(FutureValuePage.tsx) 삭제, 9개→8개로 재편(FEATURE_10_OPINION.md/
// FEATURE_10_REFERENCE.md 전면 재설계 착수와 함께). "참고 자료"→"근거 및 참고자료" 명칭 변경(레퍼런스 명칭
// 채택 — 법규·인허가 "준비 중" 카드에서 04/05/06 산정식·데이터출처를 모으는 방법론 섹션으로 재정의됨).
const NAV_ITEMS: { label: string; number: string; sectionId: string }[] = [
    { label: "요약 정보", number: "01", sectionId: "report-section-summary" },
    { label: "기본 정보", number: "02", sectionId: "report-section-basic-info" },
    { label: "입지 분석", number: "03", sectionId: "report-section-location" },
    { label: "시장 분석", number: "04", sectionId: "report-section-market" },
    { label: "리모델링 분석", number: "05", sectionId: "report-section-remodeling" },
    { label: "사업성 분석", number: "06", sectionId: "report-section-viability" },
    { label: "투자 종합 의견", number: "07", sectionId: "report-section-ai-opinion" },
    { label: "근거 및 참고자료", number: "08", sectionId: "report-section-reference" },
];

const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

interface ReportPageProps {
    onBackToMap: () => void;
    onGoToAnalysis: (buildingId: string, address: string) => void;
}

// FEATURE_10_AI_REPORT.md §2.2 "요약 섹션 구성(위→아래 고정 순서)": 헤더 → 통계 5칸 → 핵심 요약(장점/주의사항,
// 주의사항엔 구 "리스크 분석" 5항목도 흡수).
// FEATURE_19 §1.1 — CASE1/CASE2 통합 응답. 값별 measured를 그대로 배지로 옮긴다(등급은 실측으로 바뀌지
// 않으므로 배지를 붙이지 않는다). 실측이 없으면 전부 measured=false라 화면은 분기 없이 같은 코드로 돈다.
const measuredBadge = (measured: boolean | undefined) =>
    measured == null ? null : <ValueBadge status={measured ? "MEASURED" : "ESTIMATED"} />;

const ReportPage = ({ onBackToMap, onGoToAnalysis }: ReportPageProps) => {
    const { token } = useAuth();
    const [report, setReport] = useState<BuildingReport | null>(null);
    // 근거 밴드의 항목별 상태·경과일은 실측 상세에서 온다 — 실측이 없으면 404라 CASE 1 밴드로 나온다.
    const [measurement, setMeasurement] = useState<MeasurementDetail | null>(null);
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;

    // FEATURE_05_PROPERTY_INFO.md §2.1: RightPanel과 동일하게 GET .../analysis 하나로 remodeling/grade/roi/cost/market 조회.
    // §2.1 공통규칙 — 좌측 네비가 가리키는 모든 섹션이 이 응답 하나를 재사용(섹션 전환 시 재호출 없음). 기본
    // 정보만 예외(BasicInfoPage 내부에서 건축물대장·F-17 단지정보 별도 호출, 2026-08-10: 단지정보 호출이
    // MarketAnalysisPage에서 여기로 이동).
    const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    // CASE1/2 통합 응답 — 로그인 계정 기준이라 토큰이 있을 때만 부른다. 실패하면 배지 없이 기존 화면 그대로.
    useEffect(() => {
        if (!selected || !token) return;

        let cancelled = false;
        fetchBuildingReport(token, selected.id)
            .then((result) => {
                if (!cancelled) setReport(result);
            })
            .catch(() => {
                if (!cancelled) setReport(null);
            });

        fetchMeasurementDetail(token, selected.id)
            .then((result) => {
                if (!cancelled) setMeasurement(result);
            })
            .catch(() => {
                if (!cancelled) setMeasurement(null);
            });

        return () => {
            cancelled = true;
        };
    }, [selected, token]);

    useEffect(() => {
        if (!selected) {
            setAnalysis(null);
            return;
        }
        let cancelled = false;
        setAnalysisLoading(true);
        getPropertyAnalysis(selected.id)
            .then((result) => {
                if (!cancelled) setAnalysis(result);
            })
            .finally(() => {
                if (!cancelled) setAnalysisLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selected?.id]);

    // 매물이 바뀌면 항상 맨 위(요약 섹션)로 되돌아온다 — 이전 매물을 보다가 스크롤이 아래쪽에 남아있으면 새 매물과 안 맞는 위치로 보일 수 있음.
    useEffect(() => {
        document.querySelector(".report-page")?.scrollTo({ top: 0 });
    }, [selected?.id]);

    // 추천여부(2026-08-09 재편) — grade 단독 매핑에서 grade×시세 신뢰도 매트릭스로 확장(analysisApi.ts
    // getRecommendation). postRemodelConfidenceLevel은 요약 통계 밴드 "시세 신뢰도" 칸·예상차익/미래가치/ROI
    // 정밀도 조정(isLowConfidence)·핵심 요약 주의사항 문구까지 공유하는 단일 출처(같은 값 재계산 안 함).
    // 2026-08-17 — A/B/C/D 등급 폐지, marketApi.ts resolvePriceDisplayLabel 라벨 체계로 통일. postRemodel은
    // 미래 추정값이라 recentTrade 개념이 없어(아직 일어나지 않은 거래) hasRecentTrade 인자는 항상 false.
    const postRemodelConfidenceLevel = analysis?.market.postRemodelEstimatedPrice?.confidenceLevel ?? null;
    const priceConfidenceLabel = postRemodelConfidenceLevel != null ? resolvePriceDisplayLabel(postRemodelConfidenceLevel, false) : null;
    const recommendation = analysis?.grade != null ? getRecommendation(analysis.grade, postRemodelConfidenceLevel) : "-";
    // 2026-08-18 — product 전달, "매우 낮음"(공백)→"매우낮음"(무공백) 최종 확정(marketApi.ts ConfidenceLabel과 동일).
    const isLowConfidence = priceConfidenceLabel === "매우낮음";
    // "리모델링 후 추정" 헤더 배지 노출 여부만 별도 — priceConfidenceLabel 자체(isLowConfidence/recommendation이
    // 쓰는 값)는 그대로 두고, UNAVAILABLE이면 배지만 숨긴다(hasPriceConfidenceBadge, 신뢰도 스티커 통일 §확정분).
    const postRemodelHasBadge = postRemodelConfidenceLevel != null && hasPriceConfidenceBadge(postRemodelConfidenceLevel, false);

    // 2026-08-10 — 요약 통계 밴드 "현재가" 칸용. 위 postRemodelConfidenceLevel(postRemodelEstimatedPrice 기준,
    // 등급/추천여부/예상차익·미래가치·ROI 정밀도에 공유)와는 다른 출처 — "현재가"는 리모델링 전 현재 시세라
    // estimatedPrice 기준 신뢰도를 따로 계산한다(재사용하면 안 됨). 2026-08-17 — recentTrade(실제 성사된
    // 거래) 있으면 confidenceLevel과 무관하게 "실거래"가 최우선(신뢰도 체계 정리 §확정분). 같은 날 재정정
    // (신뢰도 스티커 통일) — UNAVAILABLE(& !hasRecentTrade)이면 hasPriceConfidenceBadge가 false를 반환해
    // 배지 자체를 안 띄운다(구 시스템의 "grade null이면 숨김"과 결과적으로 같은 동작, 확정본 재확인).
    const currentPriceHasRecentTrade = analysis?.market.recentTrade?.price != null;
    const currentPriceLabel =
        analysis && hasPriceConfidenceBadge(analysis.market.estimatedPrice.confidenceLevel, currentPriceHasRecentTrade)
            ? resolvePriceDisplayLabel(analysis.market.estimatedPrice.confidenceLevel, currentPriceHasRecentTrade)
            : null;

    // 핵심 요약(유리한 조건/확인이 필요한 사항) — 유리한 조건은 F-06 체크리스트, 확인이 필요한 사항은 리스크
    // 흡수 5항목만 사용한다(2026-08-1x 카테고리 재편 — 판정 로직은 그대로, buildRiskChecklist를 여기로
    // 옮겨왔을 뿐).
    const remodelingChecklist = analysis?.remodeling ? buildRemodelingChecklist(analysis.remodeling.basis) : null;
    const remodelingItems = remodelingChecklist ? remodelingChecklistItems(remodelingChecklist) : [];
    const riskChecklist = analysis ? buildRiskChecklist(analysis) : null;
    const strengths = remodelingItems.filter((item) => item.ok);
    // 2026-08-17 근본 수정(FEATURE_10_AI_REPORT.md §2.2, 1차 패치가 불완전했음이 실측으로 확인) — F-06
    // 체크리스트와 리스크 흡수 5항목이 노후도/지구·구역 규제/진행중 개발행위 3개 카테고리를 둘 다 갖고 있어서,
    // 각 카테고리가 두 소스에서 각자 한 줄씩 만들어져 화면에 그대로 두 번 나온다("노후·불량 기준까지 N년
    // 부족"도, "지구/구역 지정"도 둘 다 실측으로 중복 확인됨). 카테고리별로 패치(district만 빼기, aging 텍스트
    // 비교로 빼기)하지 않고 **F-06 체크리스트(remodelingItems)를 이 목록의 소스에서 완전히 제외** — 리스크
    // 흡수 5항목만 사용해 3개 카테고리 전부 한 번에 해결한다(F-06 체크리스트 자체는 05 리모델링 분석에서
    // 그대로 노출되니 데이터 손실 아님). confidenceRisk는 여전히 제외(위 §확정분 — 카드 캡션으로 이동).
    const riskCautions = riskChecklist
        ? [riskChecklist.permitRisk, riskChecklist.districtRisk, riskChecklist.costRangeRisk, riskChecklist.agingMarginRisk].filter(
              (item) => !item.ok
          )
        : [];

    // 2026-08-17 재배치(§확정분) — "평가"/"리모델링 후 추정" 카드 하단 캡션을 전부 없애고(숫자만 남김), 그
    // 캡션 3개(시세 매칭단계 2건 + 금융비용 등 미반영 고지 1건)를 전부 "확인이 필요한 사항" 목록으로 이동.
    // CONFIDENCE_LABEL이 DONG_TYPE_AVERAGE/GU_TYPE_AVERAGE 2단계에서만 "면적·연식 미반영" 설명을 포함하던
    // 것(marketApi.ts)과 같은 기준 — 이 2단계일 때만 문구에 그 단서를 덧붙인다(SAME_DONG/SAME_GU/
    // WIDENED_RANGE는 완화된 범위라도 면적·연식을 반영하므로 붙이면 부정확). 목록 항목이라 카드 캡션 때와
    // 달리 끝에 마침표를 안 붙인다(다른 목록 항목들과 같은 문체).
    const isAreaAgeAgnosticLevel = (level: ConfidenceLevel) => level === "DONG_TYPE_AVERAGE" || level === "GU_TYPE_AVERAGE";
    const currentPriceMatchCaption =
        analysis && analysis.market.estimatedPrice.confidenceLevel !== "UNAVAILABLE"
            ? `현재가는 ${CONFIDENCE_MATCH_STAGE_LABEL[analysis.market.estimatedPrice.confidenceLevel]} 기준입니다${
                  isAreaAgeAgnosticLevel(analysis.market.estimatedPrice.confidenceLevel) ? "(면적·연식 미반영)" : ""
              }`
            : "현재가 산출 근거는 확인할 수 없습니다";
    const postRemodelPriceMatchCaption =
        analysis?.market.postRemodelEstimatedPrice?.confidenceLevel != null
            ? `리모델링 후 시세도 ${CONFIDENCE_MATCH_STAGE_LABEL[analysis.market.postRemodelEstimatedPrice.confidenceLevel]} 기준입니다${
                  isAreaAgeAgnosticLevel(analysis.market.postRemodelEstimatedPrice.confidenceLevel) ? "(면적·연식 미반영)" : ""
              }`
            : null;
    const cautions = [
        ...riskCautions,
        { ok: false as const, text: currentPriceMatchCaption },
        ...(postRemodelPriceMatchCaption != null ? [{ ok: false as const, text: postRemodelPriceMatchCaption }] : []),
        { ok: false as const, text: "금융비용·양도소득세·보유비용은 반영되지 않았습니다" },
    ];

    // 요약 통계 밴드의 예상차익/미래가치 — "사업성 분석" 섹션과 같은 계산(analysisApi.ts의 buildProfitAnalysis, 재계산 안 함).
    const profitAnalysis = analysis
        ? buildProfitAnalysis(analysis, selected?.householdCount ?? null, selected?.propertyType ?? null, selected?.totalBuildingArea ?? null)
        : null;
    // 2026-08-17 — 라벨-부호 어긋남 정정, "06 사업성 분석"과 같은 gainSign() 재사용(analysisApi.ts).
    const gainDisplaySign = profitAnalysis ? gainSign(profitAnalysis.gainMin, profitAnalysis.gainMax) : "positive";
    const [gainLo, gainHi] = profitAnalysis
        ? displayGainRange(profitAnalysis.gainMin, profitAnalysis.gainMax, gainDisplaySign)
        : [0, 0];

    // "핵심 데이터 n/4 확보" — 폐지된 구 "종합 평가"(EvaluationPage.tsx) 로직 그대로 이동(2026-08-1x, 헤더 캡션으로 흡수,
    // 판정 로직 변경 없음, 새 API 없음).
    const dataCompletenessItems = analysis
        ? [
              analysis.market.recentTrade?.price != null || analysis.market.estimatedPrice.value != null,
              analysis.market.officialPrice != null,
              analysis.market.landPrice != null,
              analysis.remodeling.basis.zoneName != null,
          ]
        : [];
    const dataCompletenessCount = dataCompletenessItems.filter(Boolean).length;

    return (
        <div className="report-page">
            <div className="report-layout">
                <nav className="report-nav">
                    {/* FEATURE_11_FAVORITES.md §2.0의 리포트 저장 지점 — 헤더(맨 위)에 두면 스크롤을 올려야
                        눌러서, 스크롤을 따라오는 좌측 네비 상단으로 옮겼다(사용자 지시, 2026-08-23). */}
                    {selected && (
                        <div className="report-nav-actions">
                            <FavoriteButton
                                buildingId={selected.id}
                                className="report-nav-favorite"
                                label="관심목록에 저장"
                            />
                            {/* FEATURE_19_PERSONALIZED_ANALYSIS.md §8 — 리포트에서 분석탭으로 넘어가는 진입점. */}
                            <button
                                type="button"
                                className="report-nav-analysis"
                                onClick={() => onGoToAnalysis(selected.id, selected.address)}
                            >
                                이 매물 직접 분석하기
                            </button>
                            <button
                                type="button"
                                className="report-pdf-button report-nav-pdf"
                                disabled
                                title="F-09 완료 후 제공"
                            >
                                PDF 다운로드
                            </button>
                        </div>
                    )}
                    {NAV_ITEMS.map(({ label, number, sectionId }) => (
                        <button key={label} type="button" className="report-nav-item" onClick={() => scrollToSection(sectionId)}>
                            <span className="report-nav-item-number" aria-hidden="true">
                                {number}
                            </span>
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="report-content">
                    {!selected ? (
                        // FEATURE_10_AI_REPORT.md §4: 매물 컨텍스트 없이 탭 진입 — 최소 대응으로 지도 탭 유도(§5.1 Open Item, 향후 확정 시 교체)
                        <div className="report-empty">
                            <p>먼저 매물을 선택해주세요.</p>
                            <button type="button" className="report-empty-back" onClick={onBackToMap}>
                                지도에서 매물 선택하기
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* 헤더 — 주소만 남긴다. 등급은 01 요약 섹션에 이미 있어 중복이고, 저장·PDF는
                                스크롤을 따라오는 좌측 네비로 옮겼다(사용자 지시, 2026-08-23). */}
                            <div className="report-header">
                                <h3 className="report-header-address">{selected.address}</h3>
                            </div>

                            {/* 실측 근거 밴드 — 본문 최상단(§2.1-a). 인쇄물에도 남아야 해서 네비가 아니라 본문에 둔다. */}
                            <ReportEvidenceBand
                                report={report}
                                measurement={measurement}
                                onGoToAnalysis={() => onGoToAnalysis(selected.id, selected.address)}
                            />
                            {/* 배치(주기적 재실행) 결과라 실시간 값이 아님을 알린다 — RightPanel과 동일 문구/기준. */}
                            {analysis?.updatedAt && (
                                <p className="right-panel-market-cell-aux">
                                    최근 갱신: {formatUpdatedAt(analysis.updatedAt)} · 핵심 데이터 {dataCompletenessCount}/4 확보
                                </p>
                            )}

                            {/* 1. 요약 섹션 — 등급/예상차익/미래가치/ROI/추천여부 통계 5칸(레퍼런스 상단 밴드 참고) */}
                            <div id="report-section-summary">
                                <SectionHeading number="01" title="요약 정보" />
                                {/* 2026-08-17 — 밴드(report-summary-band, head/band/foot 3단) 구현 폐기, 카드 2개로
                                    최종 확정(§확정분). "평가"(투자등급→검토 우선순위→현재가) / "리모델링 후 추정"
                                    (미래가치→예상차익→ROI, report-card-emphasis로 accent 강조) 각각 독립 right-panel-
                                    card. 현재가 신뢰도 배지는 삭제가 아니라 값 바로 아래 줄바꿈(.grid-3 .tag는
                                    display:block, ReportPage.css)해서 보조 설명처럼 배치 — 이전 밴드의 절대배치
                                    right-panel-estimate-tag 대신 새 tag/tag-ok/tag-warn 클래스 사용(레이아웃이 달라
                                    기존 컴포넌트 재사용 불가). 두 카드의 card-title이 같은 스타일이라 좌우 카드가
                                    같은 줄에서 시작한다. */}
                                <div className="report-summary-cards">
                                    <section className="right-panel-card">
                                        {/* 2026-08-18 product 전달(docs/FEATURE.md §8.24) — "평가"→"현재 평가"로 개명(모호해서
                                            구체화), CardSubHeading으로 번호 부여. */}
                                        <CardSubHeading number={1} title="현재 평가" />
                                        <div className="grid-3">
                                            <div>
                                                {/* report-stat-value가 이미 자체 font-size/weight(18~20px/800)를 쓰고
                                                    있어 grade-color-{grade} 전용 클래스로 색상만 얹는다(등급 박스 폐지
                                                    후속). */}
                                                <p className="report-stat-label">투자등급</p>
                                                <p className="report-stat-value">
                                                    {analysis?.grade ? (
                                                        <span className={`grade-color-${analysis.grade}`}>{GRADE_LABEL[analysis.grade]}</span>
                                                    ) : analysisLoading ? (
                                                        "분석 중..."
                                                    ) : (
                                                        "-"
                                                    )}
                                                </p>
                                            </div>
                                            <div>
                                                {/* "추천여부"(추천/비추천 뉘앙스) → "검토 우선순위"(적극 검토/검토/추가
                                                    확인/보류 뉘앙스)로 라벨·값 둘 다 개명. 값 자체는 getRecommendation이
                                                    이미 LABEL_MAP으로 치환해서 내려준다(analysisApi.ts, 재계산 안 함). */}
                                                <p className="report-stat-label">검토 우선순위</p>
                                                <p className="report-stat-value">{recommendation}</p>
                                            </div>
                                            <div>
                                                {/* baseValue는 06 "사업성 요약" 카드가 이미 쓰는 값(ProfitAnalysisResult.
                                                    baseValue, 매입가/공사비 제외) 그대로 재사용 — F-05 "시세"
                                                    (estimatedPrice.value)를 직접 쓰면 안 됨(세대 기반 유형은 세대당 vs
                                                    건물 전체로 스케일이 다름, 사용자 지적). */}
                                                <p className="report-stat-label">현재가</p>
                                                <p className="report-stat-value">
                                                    {profitAnalysis ? formatManwon(profitAnalysis.baseValue) : "산출 불가"}
                                                </p>
                                                {/* 2026-08-17 — A/B/C/D→라벨 전환, 같은 날 재정정(신뢰도 스티커 통일,
                                                    planning/rebuild/widgets/2026-08-17_report_full_confidence_context.html
                                                    확정본) — 999px 완전 pill(구 tag/tag-ok/tag-warn)에서 04/06과
                                                    같은 4px 라운드 칩(report-chip)으로 스타일 통일. currentPriceLabel이
                                                    이미 hasPriceConfidenceBadge로 걸러져 있어(위) null이면 UNAVAILABLE
                                                    이라 배지 자체를 안 띄운다. */}
                                                {currentPriceLabel != null && (
                                                    <span className={`report-chip report-chip-${PRICE_DISPLAY_TONE[currentPriceLabel]}`}>
                                                        신뢰도 {currentPriceLabel}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {/* 2026-08-17 — 카드 하단 캡션 전면 삭제(§확정분, 숫자만 남긴다). "투자등급은
                                            개발 여력·입지·리스크 지표를..." 문장은 섹션 맨 아래 report-summary-
                                            disclaimer로 승격, "현재가는 {매칭단계}..." 문장은 확인이 필요한 사항
                                            목록으로 이동(위 cautions 참고) — 삭제가 아니라 재배치. */}
                                    </section>

                                    <section className="right-panel-card report-card-emphasis">
                                        {/* postRemodel은 미래 추정값이라 "실거래" 라벨이 나올 일이 없다(위 §확정분).
                                            2026-08-17 재정정(신뢰도 스티커 통일) — 톤 무관 고정 accent(구 tag-note)
                                            였던 걸 04/06과 같은 톤 기반 칩(report-chip-{tone})으로 교체하고,
                                            postRemodelConfidenceLevel이 UNAVAILABLE이면(hasPriceConfidenceBadge)
                                            배지 자체를 숨긴다 — priceConfidenceLabel은 isLowConfidence 계산에도
                                            쓰여 그대로 두고, 배지 노출 여부만 별도로 판단(postRemodelHasBadge).
                                            2026-08-17 재정정 — "시세 신뢰도 {라벨}"에서 "시세" 삭제. 카드
                                            제목이 이미 "리모델링 후 추정"이라 이 배지가 그 시세에 대한
                                            신뢰도라는 건 문맥상 분명함(중복).
                                            2026-08-18 product 전달 — CardSubHeading으로 번호 부여(children으로
                                            배지 그대로 전달, 마크업·판정 로직 변경 없음). */}
                                        <CardSubHeading number={2} title="리모델링 후 추정">
                                            {postRemodelHasBadge && priceConfidenceLabel != null && (
                                                <span className={`report-chip report-chip-${PRICE_DISPLAY_TONE[priceConfidenceLabel]}`}>
                                                    신뢰도 {priceConfidenceLabel}
                                                </span>
                                            )}
                                        </CardSubHeading>
                                        <div className="grid-3">
                                            <div>
                                                <p className="report-stat-label">
                                                    미래가치 {measuredBadge(report?.projectedValue.measured)}
                                                </p>
                                                <p className="report-stat-value">
                                                    {profitAnalysis
                                                        ? `${isLowConfidence ? "약 " : ""}${formatManwon(profitAnalysis.value)}`
                                                        : "산출 불가"}
                                                </p>
                                            </div>
                                            <div>
                                                {/* "추정치" 태그 제거, 대신 isLowConfidence(시세 신뢰도 D)면 범위 대신
                                                    중앙값 하나만 "약 N.N억"로 — 낮은 신뢰도로 산출한 넓은 범위를 그대로
                                                    보여주면 오히려 정밀해 보이는 착시가 있었다는 지적. 2026-08-17 —
                                                    라벨-부호 어긋남 정정: gainLo/gainHi가 이미 "예상 손실"이면
                                                    절댓값+오름차순으로 정리된 값이라 중앙값도 그대로 재사용. */}
                                                <p className="report-stat-label">
                                                    {GAIN_LABEL[gainDisplaySign]}{" "}
                                                    {measuredBadge(report?.expectedProfit.measured)}
                                                </p>
                                                <p className="report-stat-value">
                                                    {profitAnalysis
                                                        ? isLowConfidence
                                                            ? `약 ${formatManwon((gainLo + gainHi) / 2)}`
                                                            : `${formatManwon(gainLo)} ~ ${formatManwon(gainHi)}`
                                                        : "산출 불가"}
                                                </p>
                                            </div>
                                            <div>
                                                {/* roi==null이면 backend stage != FULL(실측 확인) — "산정 중"은 곧 채워질
                                                    것처럼 오해를 줘서 "산출 불가"로 정정(§2.2). 소수점 제거(ResultList/
                                                    RightPanel과 동일 패턴) + isLowConfidence면 "약 " 접두. */}
                                                <p className="report-stat-label">
                                                    ROI {measuredBadge(report?.roi.measured)}
                                                </p>
                                                <p className="report-stat-value">
                                                    {analysisLoading
                                                        ? "분석 중..."
                                                        : analysis?.roi != null
                                                          ? `${isLowConfidence ? "약 " : ""}${Math.round(analysis.roi)}%`
                                                          : "산출 불가"}
                                                    {/* 2026-08-17 추가 — ROI 음수면 3단계 인라인 보조(§2.2, 06과 공유 규칙). */}
                                                    {analysis?.roi != null && analysis.roi < 0 && (
                                                        <span className="report-row-aux"> 투자금 대비 손실</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        {/* 2026-08-17 — 카드 하단 캡션 전면 삭제(§확정분, 숫자만 남긴다). "매입가·
                                            공사비·부대비용을 반영한 추정값입니다"는 폐기, "금융비용·양도소득세·
                                            보유비용은 반영되지 않았습니다"와 "리모델링 후 시세도 {매칭단계}..."는
                                            확인이 필요한 사항 목록으로 이동(위 cautions 참고). */}
                                    </section>
                                </div>

                                {/* 핵심 요약 — 유리한 조건(F-06, 구 "장점")/확인이 필요한 사항(F-06+구 리스크 분석,
                                    구 "주의사항") 2단. 2026-08-12 개명(§확정분) — "장점/주의사항"이 투자 조언처럼
                                    읽혀 개발 여력 지표라는 성격을 명확히 하는 이름으로 교체, 판정 로직은 그대로. */}
                                {analysisLoading ? (
                                    <p className="right-panel-field-note">조회 중...</p>
                                ) : analysis?.remodeling == null ? (
                                    <p className="right-panel-field-note">정보 없음</p>
                                ) : (
                                    <div className="report-summary-grid">
                                        <div className="report-summary-col">
                                            {/* 2026-08-18 product 전달(§8.24) — 번호 부여. 카드가 아니라 요약 그리드
                                                안 열 라벨(right-panel-ai-summary-label)이라 CardSubHeading 대신
                                                번호만 텍스트로 앞에 붙인다(스타일 그대로 유지). */}
                                            <p className="right-panel-ai-summary-label">3. 유리한 조건</p>
                                            <ul className="right-panel-checklist">
                                                {strengths.length > 0 ? (
                                                    strengths.map((item, index) => (
                                                        // key에 index를 섞는 이유: buildRiskChecklist가 buildRemodelingChecklist와
                                                        // 같은 문구를 그대로 재사용하는 항목이 있어(예: "노후·불량 기준까지 N년 부족")
                                                        // text만으로는 두 리스트를 합쳤을 때 키가 중복될 수 있다(2026-08-1x 발견).
                                                        <li key={`${index}-${item.text}`} className="right-panel-checklist-ok">
                                                            ✓ {item.text}
                                                        </li>
                                                    ))
                                                ) : (
                                                    <li>해당 없음</li>
                                                )}
                                            </ul>
                                            {/* 2026-08-17 추가 — 목록과 캡션을 시각적으로 구분하는 구분선(다른 카드들이
                                                이미 쓰는 right-panel-card-divider 재사용, 예: MarketAnalysisPage.tsx). */}
                                            <hr className="right-panel-card-divider" />
                                            {/* 2026-08-12 추가 — 용적률·증축 여력 항목이 사업성/수익성으로 오독되지 않게 명시. */}
                                            <p className="right-panel-field-note report-basis-caption">
                                                용적률·증축은 개발 여력 지표이며, 사업성이나 수익성을 의미하지 않습니다.
                                            </p>
                                        </div>
                                        <div className="report-summary-col">
                                            <p className="right-panel-ai-summary-label">4. 확인이 필요한 사항</p>
                                            <ul className="right-panel-checklist">
                                                {cautions.length > 0 ? (
                                                    cautions.map((item, index) => (
                                                        <li key={`${index}-${item.text}`} className="right-panel-checklist-warn">
                                                            △ {item.text}
                                                        </li>
                                                    ))
                                                ) : (
                                                    <li>해당 없음</li>
                                                )}
                                            </ul>
                                        </div>
                                        {/* 2026-08-17 삭제 후 재추가 — 문서 §확정분("헤더 최근 갱신과 중복")대로 한 번
                                            뺐다가, 사용자가 이 카드만 보고도 분석일자를 바로 확인하고 싶어해 다시
                                            추가(2026-08-17 재확정). 헤더 캡션과 값·포매터가 같아 중복이라는 사실
                                            자체는 맞지만, 이 카드 단독으로도 확인 가능해야 한다는 우선순위로 결론. */}
                                        <div className="report-summary-col">
                                            <p className="right-panel-ai-summary-label">5. 리포트 정보</p>
                                            <dl className="right-panel-fact-list">
                                                <div>
                                                    <dt>분석일자</dt>
                                                    <dd>{analysis?.updatedAt ? formatUpdatedAt(analysis.updatedAt) : "-"}</dd>
                                                </div>
                                                <div>
                                                    <dt>데이터 출처</dt>
                                                    <dd>건축물대장·실거래가·공시가격 등 공공데이터</dd>
                                                </div>
                                            </dl>
                                        </div>
                                    </div>
                                )}
                                {/* 2026-08-17 신규 — 섹션 공통 면책(05와 같은 위치·성격, docs/CONTENT_TAXONOMY.md
                                    §2 "E. 면책"). 원래 "평가" 카드 하단 캡션의 첫 문장이었으나 카드에서 캡션을
                                    전부 없애면서 섹션 슬롯으로 승격 — 문장 삭제 없음, 위치만 이동. "정의"이지
                                    "경고"가 아니라 ⚠이 아니라 ⓘ(GaugeBar.tsx의 기존 아이콘 세트 재사용, 새
                                    아이콘 세트 안 만듦). */}
                                <p className="report-summary-disclaimer">
                                    <span aria-hidden="true">ⓘ</span> 투자등급은 개발 여력·입지·리스크 지표를 종합한
                                    평가이며, 투자 수익을 보장하지 않습니다.
                                </p>
                            </div>

                            {/* 2. 기본 정보 */}
                            <div id="report-section-basic-info" className="report-section">
                                <SectionHeading number="02" title="기본 정보" />
                                <BasicInfoPage
                                    buildingId={selected.id}
                                    zoneName={analysis?.remodeling.basis.zoneName ?? null}
                                    floorAreaRatioLimit={analysis?.remodeling.basis.floorAreaRatioLimit ?? null}
                                    propertyType={selected.propertyType}
                                />
                            </div>

                            {/* 3. 입지 분석 */}
                            <div id="report-section-location" className="report-section">
                                <SectionHeading number="03" title="입지 분석" />
                                <LocationPage />
                            </div>

                            {/* 4. 시장 분석 — 구 "유사 사례"의 비교 거래 표 흡수(2026-08-1x) */}
                            <div id="report-section-market" className="report-section">
                                <SectionHeading number="04" title="시장 분석" />
                                <MarketAnalysisPage analysis={analysis} loading={analysisLoading} area={selected.area}
                                    pricePosition={report?.pricePosition ?? null}
                                />
                            </div>

                            {/* 5. 리모델링 분석 — 구 "사업성 분석"(BusinessAnalysisPage) 개명, 공사비 카드 흡수.
                                2026-08-10 재개명: 파일명이 화면명과 안 맞아 BusinessAnalysisPage.tsx → RemodelingAnalysisPage.tsx로
                                정정(guide/DIRECTORY_RESTRUCTURE.md §1.4). */}
                            <div id="report-section-remodeling" className="report-section">
                                <SectionHeading number="05" title="리모델링 분석" />
                                <RemodelingAnalysisPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    buildYear={selected.buildYear}
                                    propertyType={selected.propertyType}
                                    householdCount={selected.householdCount}
                                />
                            </div>

                            {/* 6. 사업성 분석 — 구 "수익 분석"(ProfitAnalysisPage) 내용 재정의, 공사비는 05로 이동·민감도분석 신규.
                                2026-08-10 재개명: ProfitAnalysisPage.tsx → BusinessAnalysisPage.tsx(위 05가 그 이름을 내주고
                                떠나 재사용 가능해짐, guide/DIRECTORY_RESTRUCTURE.md §1.4). */}
                            <div id="report-section-viability" className="report-section">
                                <SectionHeading number="06" title="사업성 분석" />
                                <BusinessAnalysisPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    householdCount={selected.householdCount}
                                    propertyType={selected.propertyType}
                                    totalBuildingArea={selected.totalBuildingArea}
                                />
                            </div>

                            {/* 7. 투자 종합 의견 — 2026-08-18 재정정: 07/08을 report-section-row(가로 2열)로 나란히
                                배치했던 걸 되돌린다(사용자 지적 — 08은 07 "아래"에 와야지 옆이 아니다). 나머지
                                01~06과 같은 세로 스택 방식으로 복귀, 섹션 내부 카드 배치(종합판단 1줄+확인사항·
                                종합의견 1줄)는 AIOpinionPage.tsx 안에서 자체 grid로 처리. */}
                            <div id="report-section-ai-opinion" className="report-section">
                                <SectionHeading number="07" title="투자 종합 의견" />
                                <AIOpinionPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    recommendation={recommendation}
                                    priceConfidenceLabel={priceConfidenceLabel}
                                    hasStrengths={strengths.length > 0}
                                    riskChecklist={riskChecklist}
                                />
                            </div>

                            {/* 8. 근거 및 참고자료 — 07 바로 아래(가로 배치 아님, 위 주석 참고). 카드 6개는 내용
                                크기에 맞춰 배치(표 있는 카드는 풀폭, 짧은 텍스트 카드 3개는 한 줄) — ReferencePage.tsx
                                자체 grid로 처리. */}
                            <div id="report-section-reference" className="report-section">
                                <SectionHeading number="08" title="근거 및 참고자료" />
                                <ReferencePage limitations={report?.limitations ?? null} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportPage;
