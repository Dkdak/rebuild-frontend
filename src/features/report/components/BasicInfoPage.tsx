import { useEffect, useState } from "react";
import { formatSeismicDesign, formatUseApprovalDate, getBuildingDetail, type BuildingDetail } from "../../search/api/buildingApi";
import SitePolygonDiagram from "./SitePolygonDiagram";

interface BasicInfoPageProps {
    buildingId: string;
    address: string;
    zoneName: string | null; // analysis.remodeling.basis.zoneName(F-06) 재사용 — 새 필드 아님
    floorAreaRatioLimit: number | null; // analysis.remodeling.basis.floorAreaRatioLimit(F-06) 재사용 — 용적률 법정상한
}

// FEATURE_10_AI_REPORT.md §2.1-b(2026-08-1x 재구성) — 레퍼런스(planning/rebuild/레포트.png)처럼 3단:
// 좌측 핵심 지표 / 중앙 대지 도면(자리만) / 우측 건축물대장 요약. F-05 RightPanel "건물정보" 카드와 같은
// GET /api/v1/properties/{buildingId} 재조회, 같은 null/0 처리 규칙(대지면적·건폐율·용적률·세대수는 0을
// "정보 없음"으로 취급) — F-05는 그대로 두고 F-10만 이 레이아웃으로 확장한다.
// "부속건축물"(이 건물 소속 별동)과 F-06 시장 분석의 "단지 정보"(F-17 단지 전체 집계)는 다른 값 — 라벨 구분 주의.
const BasicInfoPage = ({ buildingId, address, zoneName, floorAreaRatioLimit }: BasicInfoPageProps) => {
    const [buildingDetail, setBuildingDetail] = useState<BuildingDetail | null>(null);
    const [loading, setLoading] = useState(false);

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
            : "정보 준비 중";

    // 부속건축물 — 동수+면적 한 줄로. 0은 "없음"(실제 값), null은 "정보 없음"(데이터 자체 없음)으로 구분.
    const auxiliaryBuildingText =
        buildingDetail?.auxiliaryBuildingCount == null
            ? "정보 없음"
            : buildingDetail.auxiliaryBuildingCount === 0
              ? "없음"
              : `${buildingDetail.auxiliaryBuildingCount}동${buildingDetail.auxiliaryBuildingArea != null ? ` (${buildingDetail.auxiliaryBuildingArea}㎡)` : ""}`;

    return (
        <div className="report-grid-3">
            {/* 좌측 — 핵심 지표 */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">핵심 지표</h5>
                <dl className="right-panel-fact-list">
                    <div>
                        <dt>주소</dt>
                        <dd>{address}</dd>
                    </div>
                    <div>
                        <dt>대지면적</dt>
                        <dd>{buildingDetail?.siteArea ? `${buildingDetail.siteArea}㎡` : "정보 없음"}</dd>
                    </div>
                    <div>
                        <dt>연면적</dt>
                        <dd>{buildingDetail?.grossFloorArea != null ? `${buildingDetail.grossFloorArea}㎡` : "정보 준비 중"}</dd>
                    </div>
                    <div>
                        <dt>용도지역</dt>
                        <dd>{zoneName ?? "정보 없음"}</dd>
                    </div>
                    <div>
                        <dt>용도</dt>
                        <dd>{buildingDetail?.mainUsageNm ?? "정보 준비 중"}</dd>
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
                        <dt>세대수</dt>
                        <dd>{buildingDetail?.householdCount ? `${buildingDetail.householdCount.toLocaleString()}세대` : "정보 없음"}</dd>
                    </div>
                    <div>
                        <dt>주차대수</dt>
                        <dd>{buildingDetail?.parkingCount != null ? `${buildingDetail.parkingCount}대` : "정보 없음"}</dd>
                    </div>
                </dl>
            </section>

            {/* 중앙 — 대지 도면(gis_building.polygonGeojson 기반, FEATURE_05_PROPERTY_INFO.md §3.1) */}
            <section className="right-panel-card report-site-polygon-card">
                <h5 className="right-panel-card-title">대지 도면</h5>
                <div className="report-site-polygon-body">
                    <SitePolygonDiagram geojson={buildingDetail?.sitePolygon ?? null} />
                </div>
            </section>

            {/* 우측 — 건축물대장 요약 */}
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">건축물대장 요약</h5>
                <dl className="right-panel-fact-list">
                    <div>
                        <dt>구조</dt>
                        <dd>{buildingDetail?.structureNm ?? "정보 준비 중"}</dd>
                    </div>
                    <div>
                        <dt>지붕구조</dt>
                        <dd>{buildingDetail?.roofNm ?? "정보 없음"}</dd>
                    </div>
                    <div>
                        <dt>승강기 수</dt>
                        <dd>{buildingDetail?.elevatorCount != null ? `${buildingDetail.elevatorCount}대` : "정보 없음"}</dd>
                    </div>
                    <div>
                        <dt>사용승인일</dt>
                        <dd>{formatUseApprovalDate(buildingDetail?.useApprovalDate ?? null) ?? "정보 준비 중"}</dd>
                    </div>
                    <div>
                        <dt>내진설계</dt>
                        <dd>
                            {formatSeismicDesign(buildingDetail?.seismicDesignYn ?? null)}
                            {buildingDetail?.seismicCapacity ? ` · ${buildingDetail.seismicCapacity}` : ""}
                        </dd>
                    </div>
                    <div>
                        <dt>부속건축물</dt>
                        <dd>{auxiliaryBuildingText}</dd>
                    </div>
                </dl>
            </section>
        </div>
    );
};

export default BasicInfoPage;
