import { useEffect, useState } from "react";
import { useSearch } from "../../search/context/SearchContext";
import { formatEok, GRADE_CLASS } from "../../search/api/searchApi";
import { buildRemodelingChecklist, remodelingChecklistItems } from "../../search/api/remodelingApi";
import {
    buildProfitAnalysis,
    buildRiskChecklist,
    formatUpdatedAt,
    getPropertyAnalysis,
    GRADE_LABEL,
    RECOMMENDATION_LABEL,
    type PropertyAnalysis,
} from "../../search/api/analysisApi";
import BasicInfoPage from "./BasicInfoPage";
import LocationPage from "./LocationPage";
import MarketAnalysisPage from "./MarketAnalysisPage";
import BusinessAnalysisPage from "./BusinessAnalysisPage";
import ProfitAnalysisPage from "./ProfitAnalysisPage";
import FutureValuePage from "./FutureValuePage";
import AIOpinionPage from "./AIOpinionPage";
import ReferencePage from "./ReferencePage";
import "./ReportPage.css";

// FEATURE_10_AI_REPORT.md §2.1(2026-08-1x 카테고리 재편, planning/rebuild/레포트.png 재대조): F-05 RightPanel과
// 같은 원칙 — 9개 섹션을 한 페이지에 전부 스크롤로 쌓고, 좌측 네비는 탭 전환이 아니라 그 섹션으로 스크롤
// 이동하는 앵커다. 번호는 각 섹션 본문의 report-section-heading-number(01~09)와 동일한 값.
// 구 "종합 평가"(데이터 완성도)는 레퍼런스에 대응 개념이 없어 폐지, 구 "리스크 분석"은 요약 섹션 주의사항으로,
// 구 "유사 사례"는 시장 분석의 비교 거래 표로 흡수 — 10개→9개.
const NAV_ITEMS: { label: string; number: string; sectionId: string }[] = [
    { label: "요약 정보", number: "01", sectionId: "report-section-summary" },
    { label: "기본 정보", number: "02", sectionId: "report-section-basic-info" },
    { label: "입지 분석", number: "03", sectionId: "report-section-location" },
    { label: "시장 분석", number: "04", sectionId: "report-section-market" },
    { label: "리모델링 분석", number: "05", sectionId: "report-section-remodeling" },
    { label: "사업성 분석", number: "06", sectionId: "report-section-viability" },
    { label: "미래 가치 예측", number: "07", sectionId: "report-section-future-value" },
    { label: "투자 종합 의견", number: "08", sectionId: "report-section-ai-opinion" },
    { label: "참고 자료", number: "09", sectionId: "report-section-reference" },
];

const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

interface ReportPageProps {
    onBackToMap: () => void;
}

// FEATURE_10_AI_REPORT.md §2.2 "요약 섹션 구성(위→아래 고정 순서)": 헤더 → 통계 5칸 → 핵심 요약(장점/주의사항,
// 주의사항엔 구 "리스크 분석" 5항목도 흡수).
const ReportPage = ({ onBackToMap }: ReportPageProps) => {
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;

    // FEATURE_05_PROPERTY_INFO.md §2.1: RightPanel과 동일하게 GET .../analysis 하나로 remodeling/grade/roi/cost/market 조회.
    // §2.1 공통규칙 — 좌측 네비가 가리키는 모든 섹션이 이 응답 하나를 재사용(섹션 전환 시 재호출 없음), "시장 분석"의
    // 단지 정보만 예외(MarketAnalysisPage 내부에서 F-17 별도 호출), 기본 정보도 예외(BasicInfoPage 내부에서 건축물대장 별도 호출).
    const [analysis, setAnalysis] = useState<PropertyAnalysis | null>(null);
    const [analysisLoading, setAnalysisLoading] = useState(false);

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

    // 핵심 요약(장점/주의사항) — 장점은 F-06 체크리스트, 주의사항은 F-06 체크리스트 + 구 "리스크 분석" 5항목을
    // 합친다(2026-08-1x 카테고리 재편 — 판정 로직은 그대로, buildRiskChecklist를 여기로 옮겨왔을 뿐).
    const remodelingChecklist = analysis?.remodeling ? buildRemodelingChecklist(analysis.remodeling.basis) : null;
    const remodelingItems = remodelingChecklist ? remodelingChecklistItems(remodelingChecklist) : [];
    const riskCautions = analysis ? buildRiskChecklist(analysis).filter((item) => !item.ok) : [];
    const strengths = remodelingItems.filter((item) => item.ok);
    const cautions = [...remodelingItems.filter((item) => !item.ok), ...riskCautions];

    // 요약 통계 밴드의 예상차익/미래가치 — "사업성 분석" 섹션과 같은 계산(analysisApi.ts의 buildProfitAnalysis, 재계산 안 함).
    const profitAnalysis = analysis ? buildProfitAnalysis(analysis, selected?.householdCount ?? null, selected?.propertyType ?? null) : null;

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
                            {/* 헤더 — 스크롤 최상단 공통(주소+등급배지+최근 갱신). PDF 다운로드는 콘텐츠 흐름이 아니라
                                상단 고정 위치의 작은 버튼(F-09 완료 후 제공될 기능이라 지금은 눈에 덜 띄는 자리). */}
                            <div className="report-header">
                                <div>
                                    <h3 className="report-header-address">{selected.address}</h3>
                                </div>
                                <div className="report-header-actions">
                                    {analysis?.grade && (
                                        <span className={`grade-badge ${GRADE_CLASS[GRADE_LABEL[analysis.grade]] ?? ""}`}>
                                            {GRADE_LABEL[analysis.grade]}
                                        </span>
                                    )}
                                    <button type="button" className="report-pdf-button" disabled title="F-09 완료 후 제공">
                                        PDF 다운로드
                                    </button>
                                </div>
                            </div>
                            {/* 배치(주기적 재실행) 결과라 실시간 값이 아님을 알린다 — RightPanel과 동일 문구/기준. */}
                            {analysis?.updatedAt && (
                                <p className="right-panel-market-cell-aux">
                                    최근 갱신: {formatUpdatedAt(analysis.updatedAt)} · 핵심 데이터 {dataCompletenessCount}/4 확보
                                </p>
                            )}

                            {/* 1. 요약 섹션 — 등급/예상차익/미래가치/ROI/추천여부 통계 5칸(레퍼런스 상단 밴드 참고) */}
                            <div id="report-section-summary">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">01</span>
                                    <h4 className="report-section-heading-title">요약 정보</h4>
                                </div>
                                <div className="report-stat-band">
                                    <div className="report-stat">
                                        <p className="report-stat-label">투자등급</p>
                                        <p className="report-stat-value">{analysis?.grade ? GRADE_LABEL[analysis.grade] : "-"}</p>
                                        <p className="report-stat-caption">
                                            {analysisLoading ? "분석 중..." : analysis == null ? "정보 없음" : " "}
                                        </p>
                                    </div>
                                    <div className="report-stat">
                                        <p className="report-stat-label">예상차익</p>
                                        <p className="report-stat-value">
                                            {profitAnalysis
                                                ? `${formatEok(profitAnalysis.gainMin)} ~ ${formatEok(profitAnalysis.gainMax)}`
                                                : "산출 불가"}
                                        </p>
                                        <p className="report-stat-caption">{profitAnalysis ? "추정치" : " "}</p>
                                    </div>
                                    <div className="report-stat">
                                        <p className="report-stat-label">미래가치</p>
                                        <p className="report-stat-value">{profitAnalysis ? formatEok(profitAnalysis.value) : "산출 불가"}</p>
                                        <p className="report-stat-caption">{profitAnalysis ? "추정치" : " "}</p>
                                    </div>
                                    <div className="report-stat">
                                        <p className="report-stat-label">ROI</p>
                                        <p className="report-stat-value">
                                            {analysisLoading ? "분석 중..." : analysis?.roi != null ? `${analysis.roi}%` : "산정 중"}
                                        </p>
                                        <p className="report-stat-caption">{!analysisLoading && analysis?.roi != null ? "추정치" : " "}</p>
                                    </div>
                                    <div className="report-stat">
                                        <p className="report-stat-label">추천여부</p>
                                        <p className="report-stat-value">{analysis?.grade ? RECOMMENDATION_LABEL[analysis.grade] : "-"}</p>
                                        <p className="report-stat-caption"> </p>
                                    </div>
                                </div>

                                {/* 핵심 요약 — 장점(F-06)/주의사항(F-06+구 리스크 분석) 2단 */}
                                {analysisLoading ? (
                                    <p className="right-panel-field-note">조회 중...</p>
                                ) : analysis?.remodeling == null ? (
                                    <p className="right-panel-field-note">정보 없음</p>
                                ) : (
                                    <div className="report-summary-grid">
                                        <div className="report-summary-col">
                                            <p className="right-panel-ai-summary-label">장점</p>
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
                                        </div>
                                        <div className="report-summary-col">
                                            <p className="right-panel-ai-summary-label">주의사항</p>
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
                                    </div>
                                )}
                            </div>

                            {/* 2. 기본 정보 */}
                            <div id="report-section-basic-info" className="report-section">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">02</span>
                                    <h4 className="report-section-heading-title">기본 정보</h4>
                                </div>
                                <BasicInfoPage
                                    buildingId={selected.id}
                                    address={selected.address}
                                    zoneName={analysis?.remodeling.basis.zoneName ?? null}
                                    floorAreaRatioLimit={analysis?.remodeling.basis.floorAreaRatioLimit ?? null}
                                />
                            </div>

                            {/* 3. 입지 분석 */}
                            <div id="report-section-location" className="report-section">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">03</span>
                                    <h4 className="report-section-heading-title">입지 분석</h4>
                                </div>
                                <LocationPage />
                            </div>

                            {/* 4. 시장 분석 — 구 "유사 사례"의 비교 거래 표 흡수(2026-08-1x) */}
                            <div id="report-section-market" className="report-section">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">04</span>
                                    <h4 className="report-section-heading-title">시장 분석</h4>
                                </div>
                                <MarketAnalysisPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    buildingId={selected.id}
                                    propertyType={selected.propertyType}
                                    area={selected.area}
                                />
                            </div>

                            {/* 5. 리모델링 분석 — 구 "사업성 분석"(BusinessAnalysisPage) 개명, 공사비 카드 흡수 */}
                            <div id="report-section-remodeling" className="report-section">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">05</span>
                                    <h4 className="report-section-heading-title">리모델링 분석</h4>
                                </div>
                                <BusinessAnalysisPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    buildYear={selected.buildYear}
                                    propertyType={selected.propertyType}
                                    householdCount={selected.householdCount}
                                />
                            </div>

                            {/* 6. 사업성 분석 — 구 "수익 분석"(ProfitAnalysisPage) 내용 재정의, 공사비는 05로 이동·민감도분석 신규 */}
                            <div id="report-section-viability" className="report-section">
                                <div className="report-section-heading">
                                    <span className="report-section-heading-number">06</span>
                                    <h4 className="report-section-heading-title">사업성 분석</h4>
                                </div>
                                <ProfitAnalysisPage
                                    analysis={analysis}
                                    loading={analysisLoading}
                                    householdCount={selected.householdCount}
                                    propertyType={selected.propertyType}
                                />
                            </div>

                            {/* 7~9. 미래 가치 예측 / 투자 종합 의견 / 참고 자료 — 각 섹션 내용이 짧아 세로로 쌓으면
                                빈 공간이 많이 남는다(사용자 피드백, planning/rebuild/레포트.png 레퍼런스처럼 3열
                                가로 배치로 정정, 2026-08-1x). 앵커 스크롤 대상 id는 각자 그대로 유지 — 좌측 네비
                                클릭 시 이 3개 중 하나로만 스크롤돼도 report-section-row 전체가 눈에 들어온다. */}
                            <div className="report-section-row">
                                <div id="report-section-future-value" className="report-section">
                                    <div className="report-section-heading">
                                        <span className="report-section-heading-number">07</span>
                                        <h4 className="report-section-heading-title">미래 가치 예측</h4>
                                    </div>
                                    <FutureValuePage analysis={analysis} loading={analysisLoading} />
                                </div>

                                <div id="report-section-ai-opinion" className="report-section">
                                    <div className="report-section-heading">
                                        <span className="report-section-heading-number">08</span>
                                        <h4 className="report-section-heading-title">투자 종합 의견</h4>
                                    </div>
                                    <AIOpinionPage />
                                </div>

                                <div id="report-section-reference" className="report-section">
                                    <div className="report-section-heading">
                                        <span className="report-section-heading-number">09</span>
                                        <h4 className="report-section-heading-title">참고 자료</h4>
                                    </div>
                                    <ReferencePage />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportPage;
