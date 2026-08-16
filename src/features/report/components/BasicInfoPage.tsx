import { useEffect, useState } from "react";
import { formatSeismicDesign, formatUseApprovalDate, getBuildingDetail, type BuildingDetail } from "../../property/api/buildingApi";
import { getBuildingSummary, type BuildingSummary } from "../../property/api/buildingSummaryApi";
import { ESTIMATED_AREA_TYPES } from "../../search/api/searchApi";
import SitePolygonDiagram, { SitePolygonMeta } from "../../property/components/SitePolygonDiagram";

interface BasicInfoPageProps {
    buildingId: string;
    // 2026-08-17 — "핵심 지표"에서 주소 행 제거(카드 헤더 위 리포트 헤더에 이미 주소가 표시돼 중복) — address prop 자체를 뺀다.
    zoneName: string | null; // analysis.remodeling.basis.zoneName(F-06) 재사용 — 새 필드 아님
    floorAreaRatioLimit: number | null; // analysis.remodeling.basis.floorAreaRatioLimit(F-06) 재사용 — 용적률 법정상한
    propertyType: string | null; // 세대수 필드의 "해당 없음"(비주거) vs "확인되지 않음"(주거·값 없음) 분기용
}

// FEATURE_10_AI_REPORT.md §2.1-b(2026-08-1x 재구성) — 레퍼런스(planning/rebuild/레포트.png)처럼 3단:
// 좌측 핵심 지표 / 중앙 대지 도면(자리만) / 우측 건축물대장 요약. F-05 RightPanel "건물정보" 카드와 같은
// GET /api/v1/properties/{buildingId} 재조회, 같은 null/0 처리 규칙(대지면적·건폐율·용적률·세대수는 0을
// "정보 없음"으로 취급) — F-05는 그대로 두고 F-10만 이 레이아웃으로 확장한다.
// "동수"(F-17 building-summary.mainBuildingCount, 단지 전체 주건축물 동수)와 "부속건축물"(이 건물 소속 별동,
// buildingApi.ts auxiliaryBuildingCount)은 둘 다 "N동"으로 표시되지만 다른 값 — 혼동 주의(2026-08-10, 구
// "단지 정보" 섹션이 MarketAnalysisPage.tsx에서 삭제되며 "동수" 필드가 이 카드로 이동, 같은 카드 안에 나란히
// 있어 라벨 구분이 더 중요해짐).
const BasicInfoPage = ({ buildingId, zoneName, floorAreaRatioLimit, propertyType }: BasicInfoPageProps) => {
    const [buildingDetail, setBuildingDetail] = useState<BuildingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    // 2026-08-10 — F-17 building-summary 호출이 MarketAnalysisPage.tsx "단지 정보"에서 여기로 이동(그 섹션
    // 삭제) — "동수"(mainBuildingCount) 하나만 쓴다. 공동주택이 아니면 summary 자체가 null/필드가 비어
    // "정보 없음"으로 자연 처리되므로 별도 조건부 렌더링(구 isCondoType류) 불필요.
    const [summary, setSummary] = useState<BuildingSummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getBuildingDetail(buildingId)
            .then((result) => {
                if (!cancelled) setBuildingDetail(result);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [buildingId]);

    useEffect(() => {
        let cancelled = false;
        getBuildingSummary(buildingId).then((result) => {
            if (!cancelled) setSummary(result);
        });
        return () => {
            cancelled = true;
        };
    }, [buildingId]);

    if (loading) {
        return (
            <section className="right-panel-card">
                <p className="right-panel-field-note">건물정보 조회 중...</p>
            </section>
        );
    }

    // 층수 — 지상/지하 분리 표시(§2.1-b). 지하는 undergroundFloors가 실제 0(지하 없음)일 때도 그대로 보여준다.
    const floorsText =
        buildingDetail?.groundFloors != null
            ? `지상 ${buildingDetail.groundFloors}층${buildingDetail.undergroundFloors != null ? ` · 지하 ${buildingDetail.undergroundFloors}층` : ""}`
            : "확인되지 않음";

    // 부속건축물 — 동수+면적 한 줄로. 0은 "없음"(실제 값), null은 "확인되지 않음"(데이터 자체 없음)으로 구분.
    const auxiliaryBuildingText =
        buildingDetail?.auxiliaryBuildingCount == null
            ? "확인되지 않음"
            : buildingDetail.auxiliaryBuildingCount === 0
              ? "없음"
              : `${buildingDetail.auxiliaryBuildingCount}동${buildingDetail.auxiliaryBuildingArea != null ? ` (${buildingDetail.auxiliaryBuildingArea}㎡)` : ""}`;

    // 세대수 — 2026-08-17 propertyType 분기 추가. 비주거 유형(아파트·연립다세대 외)은 세대 개념 자체가 없어
    // householdCount 값(0/null) 무관하게 항상 "해당 없음". 주거 유형인데 값이 없을 때만 "확인되지 않음".
    const isResidentialType = propertyType != null && ESTIMATED_AREA_TYPES.includes(propertyType);
    const householdCountText = isResidentialType
        ? buildingDetail?.householdCount
            ? `${buildingDetail.householdCount.toLocaleString()}세대`
            : "확인되지 않음"
        : "해당 없음";

    return (
        <div className="report-grid-3">
            {/* 좌측 — 핵심 지표. 2026-08-17: 주소 행 제거(리포트 헤더에 이미 노출돼 중복) — 표제부 지표만. */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">핵심 지표</h5>
                <dl className="right-panel-fact-list">
                    {/* 2026-08-17 표기 정정 — 원본 값을 그대로 꽂아 "2703㎡"(쉼표 없음)/"23658.32㎡"(소수점 그대로)로
                        나오던 것 → Math.round+toLocaleString(remodelingApi.ts의 buildable.text와 같은 표기 규칙). */}
                    <div>
                        <dt>대지면적</dt>
                        <dd>{buildingDetail?.siteArea ? `${Math.round(buildingDetail.siteArea).toLocaleString()}㎡` : "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>연면적</dt>
                        <dd>
                            {buildingDetail?.grossFloorArea != null
                                ? `${Math.round(buildingDetail.grossFloorArea).toLocaleString()}㎡`
                                : "확인되지 않음"}
                        </dd>
                    </div>
                    <div>
                        <dt>용도지역</dt>
                        <dd>{zoneName ?? "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>용도</dt>
                        <dd>{buildingDetail?.mainUsageNm ?? "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>층수</dt>
                        <dd>{floorsText}</dd>
                    </div>
                    <div>
                        <dt>건폐율</dt>
                        <dd>
                            {buildingDetail?.buildingCoverageRatio
                                ? `${buildingDetail.buildingCoverageRatio}% / ${buildingDetail.coverageRatioLimit != null ? `법정상한 ${buildingDetail.coverageRatioLimit}%` : "법정상한 확인되지 않음"}`
                                : "확인되지 않음"}
                        </dd>
                    </div>
                    <div>
                        <dt>용적률</dt>
                        <dd>
                            {buildingDetail?.floorAreaRatio
                                ? `${buildingDetail.floorAreaRatio}% / ${floorAreaRatioLimit != null ? `법정상한 ${floorAreaRatioLimit}%` : "법정상한 확인되지 않음"}`
                                : "확인되지 않음"}
                        </dd>
                    </div>
                    {/* 2026-08-17 — 세대수 propertyType 분기(위 householdCountText 참고): 비주거 유형은 "해당 없음". */}
                    <div>
                        <dt>세대수</dt>
                        <dd>{householdCountText}</dd>
                    </div>
                    <div>
                        <dt>주차대수</dt>
                        <dd>{buildingDetail?.parkingCount != null ? `${buildingDetail.parkingCount}대` : "확인되지 않음"}</dd>
                    </div>
                    {/* 2026-08-17 추가 후 같은 날 제거 — "법정상한은 완화 전 기준입니다..." 캡션. 이 화면은 판정
                        없이 사실만 나열하는 화면이라 별도 설명 없이도 오독 위험이 없다고 판단해 삭제(05
                        리모델링 분석의 같은 문구는 유지 — 거기는 이 값으로 실제 판정을 계산해서 다름). */}
                </dl>
            </section>

            {/* 중앙 — 대지·건축물 도면(sitePolygon/siteBoundaryPolygon 기반, FEATURE_05_PROPERTY_INFO.md §3.1,
                2026-08-09 siteBoundaryPolygon 배포로 겹쳐 그리기 확장) */}
            <section className="right-panel-card report-site-polygon-card">
                <h5 className="right-panel-card-title">대지·건축물 도면</h5>
                <div className="report-site-polygon-body">
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

            {/* 우측 — 건축물대장 요약 */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">건축물대장 요약</h5>
                <dl className="right-panel-fact-list">
                    <div>
                        <dt>구조</dt>
                        <dd>{buildingDetail?.structureNm ?? "확인되지 않음"}</dd>
                    </div>
                    {/* 2026-08-17 라벨 변경 — "동수"만으로는 부속건축물(아래)과 헷갈린다는 지적(파일 상단 주석
                        참고: 둘 다 "N동"으로 표시되지만 다른 값) — "단지 전체 동수"로 구분을 명확히. */}
                    <div>
                        <dt>단지 전체 동수</dt>
                        <dd>{summary?.mainBuildingCount != null ? `${summary.mainBuildingCount}동` : "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>지붕구조</dt>
                        <dd>{buildingDetail?.roofNm ?? "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>승강기 수</dt>
                        <dd>{buildingDetail?.elevatorCount != null ? `${buildingDetail.elevatorCount}대` : "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>사용승인일</dt>
                        <dd>{formatUseApprovalDate(buildingDetail?.useApprovalDate ?? null) ?? "확인되지 않음"}</dd>
                    </div>
                    <div>
                        <dt>내진설계</dt>
                        <dd>
                            {formatSeismicDesign(buildingDetail?.seismicDesignYn ?? null)}
                            {buildingDetail?.seismicCapacity ? ` · ${buildingDetail.seismicCapacity}` : ""}
                        </dd>
                    </div>
                    {/* 2026-08-17 라벨 변경 — 위 "단지 전체 동수"와 대비되게 "(별동)" 명시. */}
                    <div>
                        <dt>부속건축물(별동)</dt>
                        <dd>{auxiliaryBuildingText}</dd>
                    </div>
                    {/* 2026-08-17 추가 후 같은 날 제거 — "건축물대장 기재 사항 기준..." 출처 캡션. 카드 제목
                        ("건축물대장 요약")이 이미 출처를 말해주고 있어 별도 설명 없이도 오독 위험이 없다고
                        판단해 삭제. */}
                </dl>
            </section>
        </div>
    );
};

export default BasicInfoPage;
