import { useEffect, useState } from "react";
import { useSearch } from "../../../features/search/context/SearchContext";
import {
    formatBuildYear,
    formatManwon,
    formatRecentTrade,
    GRADE_CLASS,
} from "../../../features/search/api/searchApi";
import { buildRemodelingChecklist, buildVerdictReason, VERDICT_LABEL } from "../../../features/search/api/remodelingApi";
import { formatUseApprovalDate, getBuildingDetail, type BuildingDetail } from "../../../features/search/api/buildingApi";
import {
    formatUpdatedAt,
    getPropertyAnalysis,
    GRADE_LABEL,
    type PropertyAnalysis,
} from "../../../features/search/api/analysisApi";

const formatContractMonth = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const [year, month] = dateStr.split("-");
    return year && month ? `${year}년 ${Number(month)}월` : null;
};

interface RightPanelProps {
    // FEATURE_01_LAYOUT.md §2.3-b: "AI 투자 리포트 보기" 버튼 → activeTab을 "리포트"로 전환(매물 컨텍스트는 SearchContext가 유지).
    onOpenReport: () => void;
}

// FEATURE_05_PROPERTY_INFO.md §2.1(2026-08-08 갱신 — 5개 그룹, 객관적 사실만): 개요/건물정보/입지/시세/리모델링 가능 여부.
// 심층 분석(게이지·체크리스트·공사비·단지정보·AI투자리포트)은 F-10 리포트 화면으로 이동(§2.1-c) — 이 컴포넌트는 F-10으로 넘어가지 않는다.
const RightPanel = ({ onOpenReport }: RightPanelProps) => {
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;

    // FEATURE_05_PROPERTY_INFO.md §2.1: remodeling/market/grade/roi 통합 조회 — GET /api/v1/properties/{buildingId}/analysis.
    // 이 화면에선 시세(최근실거래가/공시가격/추정시세) + 리모델링 verdict/사유 + 개요의 등급·예상 ROI까지 전부 이 응답으로 채운다
    // — 토지당가격·㎡당가격·배율·신뢰도배지·비교거래건수, 게이지·체크리스트 상세, 공사비는 F-10으로 이동(§2.1-c).
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

    // FEATURE_05_PROPERTY_INFO.md §2.1 "건물정보" 카드 — GET /api/v1/properties/{buildingId}. 리스트 검색 캐시(PropertyItem)를
    // 재사용하지 않고 매물 선택 시 별도 재조회한다(2026-08-08, 사용자 확인).
    const [buildingDetail, setBuildingDetail] = useState<BuildingDetail | null>(null);
    const [buildingDetailLoading, setBuildingDetailLoading] = useState(false);

    useEffect(() => {
        if (!selected) {
            setBuildingDetail(null);
            return;
        }
        let cancelled = false;
        setBuildingDetailLoading(true);
        getBuildingDetail(selected.id)
            .then((result) => {
                if (!cancelled) setBuildingDetail(result);
            })
            .finally(() => {
                if (!cancelled) setBuildingDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selected?.id]);

    if (!selected) {
        return (
            <aside className="right-panel">
                <p className="right-panel-empty">선택된 매물이 없습니다.</p>
            </aside>
        );
    }

    // isPartial(DOMAIN.md §5.1 "건물 일부 거래" 착시 경고)만 재사용 — 표시 문구 자체는 F-08 §2.2 형식으로 조립.
    const recentTradeFlags = formatRecentTrade(selected.recentTrade, selected.totalBuildingArea, selected.propertyType);

    const remodelingVerdictReason = analysis?.remodeling
        ? buildVerdictReason(analysis.remodeling.verdict, buildRemodelingChecklist(analysis.remodeling.basis))
        : null;

    return (
        <aside className="right-panel">
            {/* 1. 개요 — 주소+유형/준공연도, 우측 등급배지 — 구분선 — 예상 ROI("추정치" 태그) */}
            <section className="right-panel-card">
                <div className="right-panel-card-header">
                    <div>
                        <h4 className="right-panel-overview-address">{selected.address}</h4>
                        <p className="right-panel-overview-meta">
                            {selected.propertyType ?? "유형 미확인"}
                            {" · "}
                            {formatBuildYear(selected.buildYear)}
                        </p>
                    </div>
                    {analysis?.grade && (
                        <span
                            className={`grade-badge right-panel-grade-badge ${GRADE_CLASS[GRADE_LABEL[analysis.grade]] ?? ""}`}
                        >
                            {GRADE_LABEL[analysis.grade]}
                        </span>
                    )}
                </div>
                <hr className="right-panel-card-divider" />
                {/* DOMAIN.md §7.4 게이트 — F-08 완료로 해제. grade/roi는 GET .../analysis의 실제 계산값(더 이상 investment_result
                    스파이크 아님) — "추정치" 태그는 ROI 자체가 본질적으로 예측값이라는 의미로 유지("추정치" 태그로 구분). */}
                <p className="right-panel-field-note">
                    예상 ROI: {analysisLoading ? "분석 중..." : analysis?.roi != null ? `${analysis.roi}%` : "산정 중"}
                    {!analysisLoading && analysis?.roi != null && <span className="right-panel-estimate-tag">추정치</span>}
                </p>
                {/* 배치(주기적 재실행) 결과라 실시간 값이 아님을 알린다 — grade/roi/remodeling/market 전부 이 시각 기준(2026-08-1x). */}
                {analysis?.updatedAt && (
                    <p className="right-panel-market-cell-aux">최근 갱신: {formatUpdatedAt(analysis.updatedAt)}</p>
                )}
            </section>

            {/* 2. 건물정보 — GET /api/v1/properties/{buildingId} 상세 재조회 결과. 없는 필드는 지어내지 않고 "정보 준비 중"
                (대지면적/건폐율/용적률은 원본 데이터 자체가 없는 경우가 41~44%로 정상 — 사용자 확인, 2026-08-08).
                대지면적/건폐율/용적률/세대수는 백엔드가 값 없음을 null 대신 0으로 내려보내는 경우가 있어(오래된 건물),
                0을 "정보 없음"으로 취급 — "0세대"처럼 실제 값(0)으로 오인될 표시를 피한다(사용자 확인, 2026-08-08). */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">건물정보</h5>
                {buildingDetailLoading ? (
                    <p className="right-panel-field-note">건물정보 조회 중...</p>
                ) : (
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>대지면적</dt>
                            <dd>{buildingDetail?.siteArea ? `${buildingDetail.siteArea}㎡` : "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>연면적</dt>
                            <dd>{buildingDetail?.grossFloorArea != null ? `${buildingDetail.grossFloorArea}㎡` : "정보 준비 중"}</dd>
                        </div>
                        <div>
                            <dt>층수</dt>
                            <dd>{buildingDetail?.groundFloors != null ? `${buildingDetail.groundFloors}층` : "정보 준비 중"}</dd>
                        </div>
                        <div>
                            <dt>건폐율</dt>
                            <dd>{buildingDetail?.buildingCoverageRatio ? `${buildingDetail.buildingCoverageRatio}%` : "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>용적률</dt>
                            <dd>{buildingDetail?.floorAreaRatio ? `${buildingDetail.floorAreaRatio}%` : "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>세대수</dt>
                            <dd>{buildingDetail?.householdCount ? `${buildingDetail.householdCount.toLocaleString()}세대` : "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>사용승인일</dt>
                            <dd>{formatUseApprovalDate(buildingDetail?.useApprovalDate ?? null) ?? "정보 준비 중"}</dd>
                        </div>
                        <div>
                            <dt>구조</dt>
                            <dd>{buildingDetail?.structureNm ?? "정보 준비 중"}</dd>
                        </div>
                        <div>
                            <dt>용도</dt>
                            <dd>{buildingDetail?.mainUsageNm ?? "정보 준비 중"}</dd>
                        </div>
                    </dl>
                )}
            </section>

            {/* 3. 입지 — 거리 계산 UI 미착수, mock 승인 안 됨 */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">입지</h5>
                <p className="right-panel-field-note">정보 준비 중</p>
            </section>

            {/* 4. 시세 — FEATURE_08_MARKET.md §2.2 값 4개(최근실거래가/추정시세/공시가격/토지당가격) 2x2 그리드.
                ㎡당가격·배율·신뢰도배지·비교거래건수(파생/심화 지표)는 F-10 "시장 분석"으로 이동(FEATURE_10_AI_REPORT.md §2.1-a). */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">시세</h5>
                {analysisLoading ? (
                    <p className="right-panel-field-note">시세 정보 조회 중...</p>
                ) : (
                    <>
                        <div className="right-panel-market-grid">
                            <div className="right-panel-market-cell">
                                <p className="right-panel-market-cell-label">최근 실거래가</p>
                                <p
                                    className={`right-panel-market-cell-value ${selected.recentTrade?.price == null ? "right-panel-market-cell-muted" : ""}`}
                                >
                                    {selected.recentTrade?.price != null ? formatManwon(selected.recentTrade.price) : "해당 없음"}
                                </p>
                            </div>

                            <div className="right-panel-market-cell">
                                <p className="right-panel-market-cell-label">추정 시세</p>
                                <p
                                    className={`right-panel-market-cell-value ${analysis?.market.estimatedPrice.value == null ? "right-panel-market-cell-muted" : ""}`}
                                >
                                    {analysis?.market.estimatedPrice.value != null
                                        ? formatManwon(analysis.market.estimatedPrice.value)
                                        : "추정 불가"}
                                </p>
                            </div>

                            <div className="right-panel-market-cell">
                                <p className="right-panel-market-cell-label">공시가격</p>
                                <p
                                    className={`right-panel-market-cell-value ${analysis?.market.officialPrice == null ? "right-panel-market-cell-muted" : ""}`}
                                >
                                    {analysis?.market.officialPrice != null ? formatManwon(analysis.market.officialPrice) : "정보 없음"}
                                </p>
                            </div>

                            <div className="right-panel-market-cell">
                                <p className="right-panel-market-cell-label">토지당 가격</p>
                                <p
                                    className={`right-panel-market-cell-value ${analysis?.market.landPrice == null ? "right-panel-market-cell-muted" : ""}`}
                                >
                                    {analysis?.market.landPrice != null
                                        ? `${analysis.market.landPrice.toLocaleString()}원/㎡`
                                        : "정보 없음"}
                                </p>
                            </div>
                        </div>

                        {selected.recentTrade?.price != null && (
                            <>
                                <hr className="right-panel-card-divider" />
                                {formatContractMonth(selected.recentTrade.contractDate) && (
                                    <p className="right-panel-market-cell-aux">
                                        {formatContractMonth(selected.recentTrade.contractDate)}
                                    </p>
                                )}
                                {recentTradeFlags?.isPartial && (
                                    <p className="right-panel-selected-partial-trade-warning">
                                        ⚠ 건물 일부 거래(호실 단위 실거래가)
                                    </p>
                                )}
                            </>
                        )}
                    </>
                )}
            </section>

            {/* 5. 리모델링 가능 여부 — verdict 배지+판정 사유 한 줄만(FEATURE_06_REMODELING.md §2.1 문구 그대로 재사용) */}
            <section className="right-panel-card">
                <div className="right-panel-card-header">
                    <h5 className="right-panel-card-title">리모델링 가능 여부</h5>
                    {analysis?.remodeling && (
                        <span
                            className={`right-panel-verdict-badge right-panel-verdict-${analysis.remodeling.verdict.toLowerCase().replace("_", "-")}`}
                        >
                            {VERDICT_LABEL[analysis.remodeling.verdict]}
                        </span>
                    )}
                </div>
                {remodelingVerdictReason && (
                    <>
                        <hr className="right-panel-card-divider" />
                        <p className="right-panel-verdict-reason">{remodelingVerdictReason}</p>
                    </>
                )}
                {analysisLoading ? (
                    <p className="right-panel-field-note">리모델링 가능성 조회 중...</p>
                ) : analysis?.remodeling == null ? (
                    <p className="right-panel-field-note">정보 없음</p>
                ) : null}
            </section>

            {/* FEATURE_01_LAYOUT.md §2.3-b: 5개 그룹 맨 아래(패널 하단) — 클릭 시 리포트 탭 전환+매물 컨텍스트 유지 */}
            <button type="button" className="right-panel-report-cta" onClick={onOpenReport}>
                AI 투자 리포트 보기
            </button>
        </aside>
    );
};

export default RightPanel;
