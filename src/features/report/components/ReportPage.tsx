import { useEffect, useState } from "react";
import { useSearch } from "../../search/context/SearchContext";
import { GRADE_CLASS } from "../../search/api/searchApi";
import { buildRemodelingChecklist, remodelingChecklistItems } from "../../search/api/remodelingApi";
import {
    formatUpdatedAt,
    getPropertyAnalysis,
    GRADE_LABEL,
    type PropertyAnalysis,
} from "../../search/api/analysisApi";
import "./ReportPage.css";

// FEATURE_10_AI_REPORT.md §2.1: 좌측 네비 8개 항목 중 "요약 페이지"만 레이아웃 설계 완료. 나머지는 F-05에서
// 이동해 올 콘텐츠는 확정됐지만(§2.1-a) 페이지 레이아웃 자체는 미설계(§5.1 Open Item) — 클릭 비활성, 자리만.
const NAV_ITEMS = ["요약 페이지", "사업성 분석", "수익 분석", "시장 분석", "AI 투자 의견", "종합 평가", "리스크 분석", "유사 사례"];

interface ReportPageProps {
    onBackToMap: () => void;
}

// FEATURE_10_AI_REPORT.md §2.2 "요약 페이지 구성(위→아래 고정 순서)": 헤더 → 투자점수+보조지표 2칸 →
// 핵심 요약(F-06 체크리스트 재사용) → PDF 다운로드(비활성) → 상세 분석 바로가기 3카드("준비 중").
const ReportPage = ({ onBackToMap }: ReportPageProps) => {
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;

    // FEATURE_05_PROPERTY_INFO.md §2.1: RightPanel과 동일하게 GET .../analysis 하나로 remodeling/grade/roi 조회
    // (기존엔 getRemodelingAnalysis 별도 호출 + selected.grade/roi 리스트 캐시 재사용이었음, 2026-08-1x).
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

    return (
        <div className="report-page">
            <div className="report-layout">
                <nav className="report-nav">
                    {NAV_ITEMS.map((item, index) => (
                        <button
                            key={item}
                            type="button"
                            className={`report-nav-item ${index === 0 ? "report-nav-item-active" : "report-nav-item-disabled"}`}
                            disabled={index !== 0}
                        >
                            {item}
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
                            {/* 1. 헤더 */}
                            <div className="report-header">
                                <h3 className="report-header-address">{selected.address}</h3>
                                {analysis?.grade && (
                                    <span className={`grade-badge ${GRADE_CLASS[GRADE_LABEL[analysis.grade]] ?? ""}`}>
                                        {GRADE_LABEL[analysis.grade]}
                                    </span>
                                )}
                            </div>
                            {/* 배치(주기적 재실행) 결과라 실시간 값이 아님을 알린다 — RightPanel과 동일 문구/기준. */}
                            {analysis?.updatedAt && (
                                <p className="right-panel-market-cell-aux">최근 갱신: {formatUpdatedAt(analysis.updatedAt)}</p>
                            )}

                            {/* 2. 투자 점수 + 보조지표 2칸 */}
                            <div className="report-score-row">
                                <div className="report-score-circle">
                                    <span>준비 중</span>
                                </div>
                                <div className="report-metric-box">
                                    <p className="report-metric-label">예상 ROI</p>
                                    <p className="report-metric-value">
                                        {analysisLoading ? "분석 중..." : analysis?.roi != null ? `${analysis.roi}%` : "산정 중"}
                                        {!analysisLoading && analysis?.roi != null && (
                                            <span className="right-panel-estimate-tag">추정치</span>
                                        )}
                                    </p>
                                </div>
                                <div className="report-metric-box">
                                    <p className="report-metric-label">사업성 평가</p>
                                    <p className="report-metric-value report-metric-muted">준비 중</p>
                                </div>
                            </div>

                            {/* 3. 핵심 요약 — F-06 체크리스트 재사용(같은 데이터, 재계산 안 함) */}
                            <section className="report-summary">
                                <h4 className="report-section-title">핵심 요약</h4>
                                {analysisLoading ? (
                                    <p className="right-panel-field-note">조회 중...</p>
                                ) : analysis?.remodeling == null ? (
                                    <p className="right-panel-field-note">정보 없음</p>
                                ) : (
                                    (() => {
                                        const items = remodelingChecklistItems(buildRemodelingChecklist(analysis.remodeling.basis));
                                        const strengths = items.filter((item) => item.ok);
                                        const cautions = items.filter((item) => !item.ok);
                                        return (
                                            <>
                                                <p className="right-panel-ai-summary-label">장점</p>
                                                <ul className="right-panel-checklist">
                                                    {strengths.length > 0 ? (
                                                        strengths.map((item) => (
                                                            <li key={item.text} className="right-panel-checklist-ok">
                                                                ✓ {item.text}
                                                            </li>
                                                        ))
                                                    ) : (
                                                        <li>해당 없음</li>
                                                    )}
                                                </ul>
                                                <p className="right-panel-ai-summary-label">주의사항</p>
                                                <ul className="right-panel-checklist">
                                                    {cautions.length > 0 ? (
                                                        cautions.map((item) => (
                                                            <li key={item.text} className="right-panel-checklist-warn">
                                                                △ {item.text}
                                                            </li>
                                                        ))
                                                    ) : (
                                                        <li>해당 없음</li>
                                                    )}
                                                </ul>
                                            </>
                                        );
                                    })()
                                )}
                            </section>

                            {/* 4. PDF 다운로드 — F-09 완료 전까지 비활성 */}
                            <button type="button" className="report-pdf-button" disabled>
                                PDF 다운로드 (F-09 완료 후 제공)
                            </button>

                            {/* 5. 상세 분석 바로가기 3카드 — 대상 페이지 미설계라 전부 "준비 중", 클릭 비활성 */}
                            <div className="report-shortcut-grid">
                                {["사업성 분석", "수익 분석", "리스크 분석"].map((label) => (
                                    <div key={label} className="report-shortcut-card">
                                        <p>{label}</p>
                                        <p className="right-panel-field-note">준비 중</p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportPage;
