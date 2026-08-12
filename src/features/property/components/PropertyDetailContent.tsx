import { useEffect, useState } from "react";
import { useSearch } from "../../search/context/SearchContext";
import { formatCurrency, formatManwon, formatRecentTrade, GRADE_CLASS } from "../../search/api/searchApi";
import { formatUseApprovalDate, getBuildingDetail, type BuildingDetail } from "../api/buildingApi";
import {
    formatUpdatedAt,
    getPropertyAnalysis,
    getRecommendation,
    GRADE_LABEL,
    priceConfidenceFromLevel,
    priceConfidenceTone,
    type PropertyAnalysis,
} from "../../investment/api/analysisApi";
import SitePolygonDiagram, { parseRing, SitePolygonMeta } from "./SitePolygonDiagram";

const formatContractMonth = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const [year, month] = dateStr.split("-");
    return year && month ? `${year}년 ${Number(month)}월` : null;
};

interface PropertyDetailContentProps {
    // FEATURE_01_LAYOUT.md §2.3-b: "AI 투자 리포트 보기" 버튼 → activeTab을 "리포트"로 전환(매물 컨텍스트는 SearchContext가 유지).
    onOpenReport: () => void;
}

// FEATURE_05_PROPERTY_INFO.md §2.1(2026-08-1x 재정정 — 5개 그룹 → 3개 그룹): 개요/건물정보(+대지 도면)/시세만
// 남긴다 — 입지(지도와 중복)·리모델링 가능 여부(판정이라 해석 영역)는 F-10 리포트로 완전히 이동, 이 화면에서는
// "AI 투자 리포트 보기" 버튼으로만 접근한다(§2.1-c). 심층 분석(게이지·체크리스트·공사비·단지정보·AI투자리포트)도
// 여전히 F-10 소관 — 이 컴포넌트는 F-10으로 넘어가지 않는다.
// 2026-08-10 — guide/DIRECTORY_RESTRUCTURE.md §1: shared/components/layout/RightPanel.tsx(레이아웃 슬롯 껍데기)에서
// 실제 컨텐츠를 이 컴포넌트로 분리(F-05 소속이라 features/property/로 이동). RightPanel.tsx는 이제 이 컴포넌트를
// 배치만 하는 얇은 껍데기.
const PropertyDetailContent = ({ onOpenReport }: PropertyDetailContentProps) => {
    const { searchResults, selectedPropertyId } = useSearch();
    const selected = searchResults?.items.find((item) => item.id === selectedPropertyId) ?? null;

    // FEATURE_05_PROPERTY_INFO.md §2.1: remodeling/market/grade/roi 통합 조회 — GET /api/v1/properties/{buildingId}/analysis.
    // 이 화면에선 시세(최근실거래가/추정시세/공시가격/토지당가격) + 개요의 등급·ROI·추천여부 + 건물정보의 용도지역·
    // 용적률 법정상한(F-06 basis)까지 전부 이 응답으로 채운다 — verdict·게이지·체크리스트·공사비는 F-10으로 이동(§2.1-c).
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
    // 2026-08-10 — recentTrade 출처가 selected(목록 검색 PropertyItem, 백엔드가 이 필드를 제거)에서
    // buildingDetail(건물 단건 조회, 영향 없음)로 이동 — totalBuildingArea/propertyType은 그대로 selected 사용.
    const recentTradeFlags = formatRecentTrade(buildingDetail?.recentTrade ?? null, selected.totalBuildingArea, selected.propertyType);

    // §2.1 "건물정보" 신규 필드 — 층수 지상/지하 분리, 건폐율·용적률 법정상한 병기(F-10 BasicInfoPage.tsx와 동일 규칙
    // 재사용, 새 계산 없음). 용적률 법정상한(floorAreaRatioLimit)은 이 엔드포인트가 아니라 F-06 analysis.remodeling.basis에 있다.
    const floorAreaRatioLimit = analysis?.remodeling.basis.floorAreaRatioLimit ?? null;
    const zoneName = analysis?.remodeling.basis.zoneName ?? null;
    const floorsText =
        buildingDetail?.groundFloors != null
            ? `지상 ${buildingDetail.groundFloors}층${buildingDetail.undergroundFloors != null ? ` · 지하 ${buildingDetail.undergroundFloors}층` : ""}`
            : "정보 준비 중";
    // 개요 "유형 · 연식" 줄 — formatBuildYear는 경과년수("N년차")만 반환해 실제 준공연도가 안 보였다(2026-08-1x
    // 사용자 피드백). ResultList.tsx 카드는 3줄 안에 다 넣어야 해서 계속 "N년차"만 쓰고, RightPanel은 공간이
    // 있으니 "{연도}년(N년차)"로 확장 — formatBuildYear 자체는 안 바꾼다(다른 소비처에 영향 없게).
    const buildYearText =
        selected.buildYear != null ? `${selected.buildYear}년(${new Date().getFullYear() - selected.buildYear}년차)` : "준공년도 미확인";
    // ㎡→평 환산(1평=3.305785㎡, AreaRangeControl.tsx와 동일 상수) — 대지면적·연면적 옆에 괄호로 병기(2026-08-1x).
    const sqmToPyeong = (sqm: number): number => Math.round(sqm / 3.305785);
    // 시세 카드 "연면적당 가격" 캡션(2026-08-09 최종 확정) — estimatedPrice.value(만원) ÷ 연면적(selected.area, ㎡).
    // "토지당 가격"(만원/㎡)과 단위를 맞추기 위해 평 환산 없이 ㎡ 그대로 노출(이전엔 평 환산 후 "연면적 평당"으로
    // 표시했으나, 옆의 "토지당 가격"과 단위 기준이 달라 비교가 안 된다는 지적으로 정정).
    const estimatedPricePerSqm =
        analysis?.market.estimatedPrice.value != null && selected.area != null && selected.area > 0
            ? Math.round(analysis.market.estimatedPrice.value / selected.area)
            : null;
    // 추천여부(2026-08-09 재편) — grade 단독 매핑에서 grade×시세 신뢰도 매트릭스로 확장(analysisApi.ts
    // getRecommendation). 같은 priceConfidence를 ROI 옆 "추정치" 고정 문구 자리에도 재사용(신뢰도 등급이
    // 이미 정확히 있으니 근사 불필요, 2026-08-09 배지 정정 — postRemodelEstimatedPrice 자체가 null일 수 있어
    // (§3.7 "F-06 불가 판정" 등) analysis?. 뒤에 ?.를 하나 더 거친다(전달받은 diff의
    // analysis?.market.postRemodelEstimatedPrice.confidenceLevel은 이 케이스에서 TS가 "possibly null" 에러를
    // 낸다 — 동작은 동일하게 유지하고 안전하게만 수정).
    const priceConfidence =
        analysis?.market.postRemodelEstimatedPrice?.confidenceLevel != null
            ? priceConfidenceFromLevel(analysis.market.postRemodelEstimatedPrice.confidenceLevel)
            : null;
    const recommendation = analysis?.grade != null ? getRecommendation(analysis.grade, priceConfidence) : "-";
    // "시세" 옆 배지는 다른 소스(estimatedPrice, postRemodel 아님) — ROI 배지와 같은 이유로 "추정치" 고정 문구
    // 대신 신뢰도 등급 표시(2026-08-09).
    const estimatedPriceConfidence =
        analysis?.market.estimatedPrice.confidenceLevel != null
            ? priceConfidenceFromLevel(analysis.market.estimatedPrice.confidenceLevel)
            : null;
    // "사용승인일" 옆에도 경과년수 병기(2026-08-1x, 개요의 buildYearText와 같은 이유) — formatUseApprovalDate
    // 자체는 안 바꾼다(F-10 BasicInfoPage.tsx도 같은 함수를 쓰는데 그쪽엔 요청 없었음).
    const useApprovalDateText = (() => {
        const formatted = formatUseApprovalDate(buildingDetail?.useApprovalDate ?? null);
        if (formatted == null) return "정보 준비 중";
        const year = Number(buildingDetail?.useApprovalDate?.split("-")[0]);
        return Number.isFinite(year) ? `${formatted}(${new Date().getFullYear() - year}년차)` : formatted;
    })();

    return (
        <aside className="right-panel">
            {/* 1. 개요 — 주소+유형/준공연도 두 줄, 구분선 아래 3칸 미니 스탯밴드(투자등급/ROI/추천여부).
                데이터 완성도는 F-10 요약 정보 캡션으로 이동(이 카드엔 없음, §2.1-c). */}
            <section className="right-panel-card">
                <h4 className="right-panel-overview-address">{selected.address}</h4>
                <p className="right-panel-overview-meta">
                    {selected.propertyType ?? "유형 미확인"}
                    {" · "}
                    {buildYearText}
                </p>
                <hr className="right-panel-card-divider" />
                <div className="right-panel-mini-stat-band">
                    <div className="right-panel-mini-stat">
                        <p className="right-panel-mini-stat-label">투자등급</p>
                        <p className="right-panel-mini-stat-value">
                            {/* 2026-08-1x 버그 수정 — GRADE_CLASS[GRADE_LABEL[grade]] 이중 인디렉션이 6단계 시절엔
                                맞았지만(enum→라벨→클래스, 서로 다른 키 공간), 4단계+NA 재편 후 GRADE_CLASS는
                                grade 코드로 직접 키잉되도록 바뀌었다. A/B/C/D는 GRADE_LABEL이 항등이라 우연히
                                맞았지만 NA→"정보부족"은 GRADE_CLASS에 그 키가 없어 배지 색이 안 떴다(실측 확인) —
                                GRADE_CLASS[analysis.grade]로 직접 조회.
                                2026-08-09 — 등급 박스 전면 폐지(ResultList.tsx와 공통 grade-text 재사용) + 바로
                                오른쪽에 신뢰도 스티커(기존 right-panel-estimate-tag 크기 그대로) 병기. priceConfidence는
                                위에서 이미 계산해 둔 값(추천여부 매트릭스와 같은 출처, 재계산 안 함). */}
                            {analysis?.grade ? (
                                <span className="right-panel-estimate-anchor">
                                    <span className={`grade-text ${GRADE_CLASS[analysis.grade] ?? ""}`}>
                                        {GRADE_LABEL[analysis.grade]}
                                    </span>
                                    {priceConfidence != null && (
                                        <span
                                            className={`right-panel-estimate-tag right-panel-estimate-tag-${priceConfidenceTone(priceConfidence)}`}
                                        >
                                            신뢰도 {priceConfidence}
                                        </span>
                                    )}
                                </span>
                            ) : (
                                "-"
                            )}
                        </p>
                    </div>
                    <div className="right-panel-mini-stat">
                        <p className="right-panel-mini-stat-label">ROI</p>
                        {/* DOMAIN.md §7.4 게이트 — F-08 완료로 해제. grade/roi는 GET .../analysis의 실제 계산값.
                            2026-08-1x: 별도 캡션 줄이 매물마다 있다/없다로 왔다갔다 하면서 카드 전체 높이가
                            흔들렸는데(사용자 스크린샷 2건 비교). 2026-08-09: ROI 옆 개별 신뢰도 태그는 취소 —
                            "투자등급" 칸 아래 캡션 하나로 통합(추천여부가 참조하는 신뢰도와 중복 표시하지 않기
                            위함). */}
                        <p className="right-panel-mini-stat-value">
                            {/* roi==null이면 backend stage != FULL이라는 뜻(실측 확인, F-10과 동일 근거) — "산정
                                중"은 곧 채워질 것처럼 오해를 줘서 "산출 불가"로 정정(2026-08-1x). */}
                            {analysisLoading && analysis == null
                                ? "분석 중..."
                                : analysis?.roi != null
                                  ? `${Math.round(analysis.roi)}%`
                                  : "산출 불가"}
                        </p>
                    </div>
                    <div className="right-panel-mini-stat">
                        <p className="right-panel-mini-stat-label">추천여부</p>
                        <p className="right-panel-mini-stat-value">{recommendation}</p>
                    </div>
                </div>
                {/* 배치(주기적 재실행) 결과라 실시간 값이 아님을 알린다 — grade/roi/remodeling/market 전부 이 시각 기준. */}
                {analysis?.updatedAt && (
                    <p className="right-panel-market-cell-aux">최근 갱신: {formatUpdatedAt(analysis.updatedAt)}</p>
                )}
            </section>

            {/* 2. 건물정보 — key-value 표. 없는 필드는 지어내지 않고 "정보 준비 중"/"정보 없음". 대지면적/건폐율/
                용적률/세대수는 0을 "정보 없음"으로 취급(원본이 0으로 내려오는 오래된 건물이 있어 "0세대" 같은
                실값 오인 표시를 피함, 2026-08-08 확인). 2026-08-1x: 로딩 게이트를 "buildingDetailLoading"만이
                아니라 "buildingDetailLoading && buildingDetail == null"로 — 매물을 바꿀 때마다 이미 떠 있던
                표가 "조회 중..."으로 통째로 사라졌다 새로 나타나며 깜빡였다(사용자 피드백 "누를 때마다
                깜빡깜빡"). 최초 1회(데이터가 아직 없을 때)만 로딩 문구를 보여주고, 이후 매물 전환 시에는 이전
                매물 데이터를 그대로 보여주다가 새 데이터가 도착하면 조용히 갱신한다(깜빡임 없이). */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">건물정보</h5>
                {buildingDetailLoading && buildingDetail == null ? (
                    <p className="right-panel-field-note">건물정보 조회 중...</p>
                ) : (
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>용도지역</dt>
                            <dd>{zoneName ?? "정보 없음"}</dd>
                        </div>
                        <div>
                            <dt>대지면적</dt>
                            <dd>
                                {buildingDetail?.siteArea
                                    ? `${buildingDetail.siteArea}㎡ (${sqmToPyeong(buildingDetail.siteArea)}평)`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>연면적</dt>
                            <dd>
                                {buildingDetail?.grossFloorArea != null
                                    ? `${buildingDetail.grossFloorArea}㎡ (${sqmToPyeong(buildingDetail.grossFloorArea)}평)`
                                    : "정보 준비 중"}
                            </dd>
                        </div>
                        <div>
                            <dt>층수</dt>
                            <dd>{floorsText}</dd>
                        </div>
                        <div>
                            <dt>건폐율</dt>
                            <dd>
                                {buildingDetail?.buildingCoverageRatio
                                    ? `${buildingDetail.buildingCoverageRatio}% / ${buildingDetail.coverageRatioLimit != null ? `법정상한 ${buildingDetail.coverageRatioLimit}%` : "법정상한 정보 없음"}`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>용적률</dt>
                            <dd>
                                {buildingDetail?.floorAreaRatio
                                    ? `${buildingDetail.floorAreaRatio}% / ${floorAreaRatioLimit != null ? `법정상한 ${floorAreaRatioLimit}%` : "법정상한 정보 없음"}`
                                    : "정보 없음"}
                            </dd>
                        </div>
                        <div>
                            <dt>사용승인일</dt>
                            <dd>{useApprovalDateText}</dd>
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

            {/* 2-b. 대지·건축물 도면 — 둘 중 하나라도 있을 때만 별도 카드로(2026-08-1x 사용자 피드백 "너무 답답하다,
                도면을 아래로 내리고 있으면 카드로, 없으면 카드 자체를 출력하지 말자"). 건물정보와 좌우 2단이던 걸
                세로로 분리하고, SitePolygonDiagram의 파싱 결과가 둘 다 없으면(parseRing null) 섹션 자체를 렌더링
                하지 않는다 — F-10 BasicInfoPage는 3단 그리드 구조를 유지해야 해서 그쪽은 "정보 없음" placeholder를
                그대로 둔다(용도가 다름). 2026-08-09: siteBoundaryPolygon(대지 경계) 배포로 sitePolygon(건물
                외곽선)과 겹쳐 그리게 됨 — 둘은 독립 매칭이라 게이팅도 OR로 바꾼다. */}
            {((buildingDetail?.sitePolygon != null && parseRing(buildingDetail.sitePolygon) != null) ||
                (buildingDetail?.siteBoundaryPolygon != null && parseRing(buildingDetail.siteBoundaryPolygon) != null)) && (
                <section className="right-panel-card">
                    <h5 className="right-panel-card-title">대지·건축물 도면</h5>
                    <div className="right-panel-site-polygon-body">
                        <SitePolygonDiagram
                            buildingGeojson={buildingDetail?.sitePolygon ?? null}
                            siteGeojson={buildingDetail?.siteBoundaryPolygon ?? null}
                        />
                    </div>
                    <SitePolygonMeta
                        buildingGeojson={buildingDetail?.sitePolygon ?? null}
                        siteGeojson={buildingDetail?.siteBoundaryPolygon ?? null}
                    />
                </section>
            )}

            {/* 3. 시세 — FEATURE_08_MARKET.md §2.2 값 4개(최근실거래가/추정시세/공시가격/토지당가격), 2x2 그리드 대신
                건물정보와 같은 표(라벨 좌측·값 우측)로 통일(2026-08-1x, 빈 공간 많던 문제 해소). 값 자체는 동일.
                ㎡당가격·배율·신뢰도배지·비교거래건수(파생/심화 지표)는 F-10 "시장 분석"으로 이동. */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">시세</h5>
                {/* 건물정보와 같은 이유(2026-08-1x) — 최초 1회만 로딩 문구, 이후엔 이전 매물 값을 유지하다 조용히 갱신. */}
                {analysisLoading && analysis == null ? (
                    <p className="right-panel-field-note">시세 정보 조회 중...</p>
                ) : (
                    <>
                        {/* 2026-08-1x: 금액 표시 전역 통일 — formatManwon(만원 입력)이 이제 formatCurrency와 같은
                            규칙(1억 이상 소수 둘째자리 억, 미만 반올림 만원)을 쓰므로 여기도 그대로 재사용.
                            토지당 가격은 원 단위 그대로 내려오는 값이라 formatCurrency를 직접 호출(만원 변환은
                            formatCurrency 내부에서 처리) — ㎡당 단가라 억 단위로 뭉개지진 않지만(값이 작아
                            항상 만원 분기), 별도 규칙을 두지 않고 같은 공용 포맷터를 쓴다. */}
                        <dl className="right-panel-fact-list">
                            <div>
                                <dt>최근 실거래가</dt>
                                <dd>{buildingDetail?.recentTrade?.price != null ? formatManwon(buildingDetail.recentTrade.price) : "해당 없음"}</dd>
                            </div>
                            <div>
                                {/* "추정 시세" → "시세"로 축약 + ROI와 같은 인라인 스티커 배지(2026-08-1x, 라벨 자체에
                                    이미 "추정"이 안 보이니 값 옆 배지로 그 의미를 옮긴다). 2026-08-09: "추정치" 고정
                                    문구 대신 estimatedPriceConfidence 신뢰도 등급 표시로 교체(postRemodel과 다른
                                    소스 — estimatedPrice 자체의 confidenceLevel). */}
                                <dt>시세</dt>
                                <dd>
                                    <span className="right-panel-estimate-anchor">
                                        {analysis?.market.estimatedPrice.value != null
                                            ? formatManwon(analysis.market.estimatedPrice.value)
                                            : "추정 불가"}
                                        {analysis?.market.estimatedPrice.value != null && estimatedPriceConfidence != null && (
                                            <span
                                                className={`right-panel-estimate-tag right-panel-estimate-tag-${priceConfidenceTone(estimatedPriceConfidence)}`}
                                            >
                                                신뢰도 {estimatedPriceConfidence}
                                            </span>
                                        )}
                                    </span>
                                    {estimatedPricePerSqm != null && (
                                        <p className="right-panel-market-cell-aux">
                                            연면적당 가격 {estimatedPricePerSqm.toLocaleString()}만원/㎡
                                        </p>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>공시가격</dt>
                                <dd>{analysis?.market.officialPrice != null ? formatManwon(analysis.market.officialPrice) : "정보 없음"}</dd>
                            </div>
                            <div>
                                <dt>토지당 가격</dt>
                                <dd>
                                    {analysis?.market.landPrice != null
                                        ? `${formatCurrency(analysis.market.landPrice)}/㎡`
                                        : "정보 없음"}
                                </dd>
                            </div>
                        </dl>

                        {buildingDetail?.recentTrade?.price != null && (
                            <>
                                <hr className="right-panel-card-divider" />
                                {/* 2026-08-1x: 계약월과 착시경고를 한 줄로 합침 — 두 줄로 나뉘어 있으면 매물마다
                                    경고 유무에 따라 카드 높이가 오락가락해 스크롤이 "꾸겨졌다 펴지는" 느낌이 든다는
                                    사용자 피드백(전체 패널 스크롤 높이가 흔들리는 원인 중 하나). */}
                                {(formatContractMonth(buildingDetail.recentTrade.contractDate) || recentTradeFlags?.isPartial) && (
                                    <p className="right-panel-market-cell-aux">
                                        {formatContractMonth(buildingDetail.recentTrade.contractDate)}
                                        {formatContractMonth(buildingDetail.recentTrade.contractDate) && recentTradeFlags?.isPartial && " · "}
                                        {recentTradeFlags?.isPartial && (
                                            <span className="right-panel-selected-partial-trade-warning">
                                                ⚠ 건물 일부 거래(호실 단위 실거래가)
                                            </span>
                                        )}
                                    </p>
                                )}
                            </>
                        )}
                    </>
                )}
            </section>

            {/* FEATURE_01_LAYOUT.md §2.3-b: 3개 그룹 맨 아래(패널 하단) — 입지·리모델링가능여부가 빠지면서 이 버튼이
                그 둘을 보는 유일한 경로가 됐다(§2.1). 클릭 시 리포트 탭 전환+매물 컨텍스트 유지, 동작 변경 없음. */}
            <button type="button" className="right-panel-report-cta" onClick={onOpenReport}>
                AI 투자 리포트 보기
            </button>
        </aside>
    );
};

export default PropertyDetailContent;
