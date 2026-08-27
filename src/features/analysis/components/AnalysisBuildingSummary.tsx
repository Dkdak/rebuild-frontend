import { formatArea } from "../api/analysisMock";
import type { BuildingDetail } from "../../property/api/buildingApi";

// DOMAIN.md §7.6 — 분석탭 상단 건물 요약. 편집하는 동안 중앙에 "어느 건물인지"가 없으면
// 좌측 목록을 다시 봐야 한다. 층수를 함께 두는 이유는 연면적 두 값의 차이(지하·주차 제외)를
// 캡션 없이 설명하기 때문이다.
interface AnalysisBuildingSummaryProps {
    address: string;
    detail: BuildingDetail | null;
}

const yearOf = (useApprovalDate: string | null) => {
    const year = Number(useApprovalDate?.slice(0, 4));
    return Number.isFinite(year) && year > 0 ? year : null;
};

const AnalysisBuildingSummary = ({ address, detail }: AnalysisBuildingSummaryProps) => {
    const builtYear = yearOf(detail?.useApprovalDate ?? null);
    const age = builtYear != null ? new Date().getFullYear() - builtYear : null;

    const specs = [
        detail?.mainUsageNm,
        detail?.groundFloors != null ? `지상 ${detail.groundFloors}층` : null,
        detail?.undergroundFloors ? `지하 ${detail.undergroundFloors}층` : null,
        builtYear != null ? `${builtYear}년${age != null ? `(${age}년차)` : ""}` : null,
        detail?.structureNm,
    ].filter(Boolean);

    // 대장 연면적과 용적률 산정 연면적이 같으면 지하·주차 제외분이 없다는 뜻이다 — 같은 값을 두 번 쓰지 않는다.
    const gross = detail?.grossFloorArea ?? null;
    const zoning = detail?.farComputationGfa ?? null;
    const areas = [
        detail?.siteArea != null ? `대지 ${formatArea(detail.siteArea)}㎡` : null,
        gross != null
            ? `연면적 ${formatArea(gross)}㎡${
                  zoning != null && Math.abs(zoning - gross) >= 0.01 ? ` (용적률 산정 ${formatArea(zoning)}㎡)` : ""
              }`
            : null,
    ].filter(Boolean);

    return (
        <section className="analysis-building">
            <h2>{address}</h2>
            {specs.length > 0 && <p className="analysis-building-specs">{specs.join(" · ")}</p>}
            {areas.length > 0 && <p className="analysis-building-areas">{areas.join(" · ")}</p>}
        </section>
    );
};

export default AnalysisBuildingSummary;
