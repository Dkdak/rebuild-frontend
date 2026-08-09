// FEATURE_05_PROPERTY_INFO.md §3.1 "sitePolygon"/"siteBoundaryPolygon" 프론트 렌더링 스펙 — 건물 외곽선
// (sitePolygon, "건축물 도면")과 대지 경계(siteBoundaryPolygon, "대지 도면", 2026-08-09 백엔드 배포)를 한
// SVG에 겹쳐 그린다. 좌표 변환/거리 계산 원칙은 기존 그대로: 등거리원통도법 근사로 로컬 평면(m) 좌표로 바꾸고,
// 각 변은 하버사인 거리로 길이(m) 라벨을 붙인다(건물 외곽선에만 — 대지 경계까지 붙이면 두 폴리곤이 겹치는
// 자리에서 라벨이 뒤섞여 안 읽힌다). 위도가 커지는 쪽이 북쪽이라 SVG는 y_svg = -y_local로 뒤집어야 화면에서
// 북쪽이 위로 온다. 두 필드는 독립적으로 매칭돼(building_gis_mapping과 별개 매칭 배치) 한쪽만 없을 수 있다.
interface SitePolygonDiagramProps {
    buildingGeojson: string | null; // sitePolygon
    siteGeojson: string | null; // siteBoundaryPolygon
}

interface LatLng {
    lat: number;
    lng: number;
}

interface LocalPoint {
    x: number;
    y: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const haversineMeters = (a: LatLng, b: LatLng): number => {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

// GeoJSON Polygon.coordinates[0] = 외곽선(첫 점=마지막 점으로 닫힘) — 닫는 점은 제거하고 꼭짓점만 남긴다.
// export하는 이유: F-05 RightPanel이 "도면(건물 외곽선/대지 경계 둘 중 하나라도) 있으면 카드로, 둘 다 없으면
// 카드 자체를 안 보여준다"를 판단하려면 렌더링 전에 유효성만 먼저 알아야 한다 — 파싱 로직을 중복 작성하지 않고 재사용.
export const parseRing = (geojson: string): LatLng[] | null => {
    try {
        const parsed = JSON.parse(geojson);
        const ring = parsed?.coordinates?.[0];
        if (!Array.isArray(ring) || ring.length < 4) return null;
        const points: LatLng[] = ring.map(([lng, lat]: [number, number]) => ({ lng, lat }));
        const first = points[0];
        const last = points[points.length - 1];
        const closed = first.lat === last.lat && first.lng === last.lng ? points.slice(0, -1) : points;
        return closed.length >= 3 ? closed : null;
    } catch {
        return null;
    }
};

const projectRing = (ring: LatLng[], lat0: number, lng0: number, cosLat0: number): LocalPoint[] =>
    ring.map((p) => ({
        x: (p.lng - lng0) * cosLat0 * 111320,
        y: -(p.lat - lat0) * 110540,
    }));

const ringPointsAttr = (local: LocalPoint[]): string => local.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

const SitePolygonDiagram = ({ buildingGeojson, siteGeojson }: SitePolygonDiagramProps) => {
    const buildingRing = buildingGeojson ? parseRing(buildingGeojson) : null;
    const siteRing = siteGeojson ? parseRing(siteGeojson) : null;

    if (buildingRing == null && siteRing == null) {
        return <p className="right-panel-field-note">도면 정보 없음</p>;
    }

    // 두 폴리곤을 같은 로컬 평면에 겹치려면 원점(lat0/lng0)을 공유해야 한다 — 존재하는 링을 모두 합쳐 평균.
    const allPoints = [...(buildingRing ?? []), ...(siteRing ?? [])];
    const lat0 = allPoints.reduce((sum, p) => sum + p.lat, 0) / allPoints.length;
    const lng0 = allPoints.reduce((sum, p) => sum + p.lng, 0) / allPoints.length;
    const cosLat0 = Math.cos(toRad(lat0));

    const buildingLocal = buildingRing ? projectRing(buildingRing, lat0, lng0, cosLat0) : null;
    const siteLocal = siteRing ? projectRing(siteRing, lat0, lng0, cosLat0) : null;

    // 대지 경계가 보통 건물 외곽선보다 넓다 — viewBox를 둘을 합친 범위로 잡아야 어느 한쪽도 잘리지 않는다.
    const combinedLocal = [...(buildingLocal ?? []), ...(siteLocal ?? [])];
    const minX = Math.min(...combinedLocal.map((p) => p.x));
    const maxX = Math.max(...combinedLocal.map((p) => p.x));
    const minY = Math.min(...combinedLocal.map((p) => p.y));
    const maxY = Math.max(...combinedLocal.map((p) => p.y));
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const pad = Math.max(width, height) * 0.18;

    const viewMinX = minX - pad;
    const viewMinY = minY - pad;
    const viewW = width + pad * 2;
    const viewH = height + pad * 2;
    const fontSize = viewW / 22;

    // 방위 표시(원형 나침반 로즈) — 우상단 고정. y_svg = -y_local로 이미 북쪽=위 정렬이라 회전 계산 없이 항상
    // 이 모양 그대로 위를 가리키면 된다. 크기·위치를 pad(=폴리곤 크기 비례) 기준으로 잡았더니 매물마다 렌더
    // 크기가 들쭉날쭉했다(2026-08-09 사용자 피드백, "리스트 누를때마다 크기가 다르다") — F-05 wrapper가 svg
    // 높이를 항상 240px로 고정하므로(.right-panel-site-polygon-body), viewBox 좌표는 결국 "px = 값/viewH*240"로
    // 환산된다. pad는 폴리곤이 가늘고 길수록(width≫height 등) viewH 대비 비율이 크게 흔들리는 반면, viewH
    // 자체를 기준으로 잡으면 그 비율이 항상 일정해 렌더 크기·위치가 매물과 무관하게 고정된다. 4방위 별
    // (N/E/S/W 긴 꼭짓점 + 대각선 짧은 꼭짓점) 8개 정점을 각도로 계산 — 원 밖 "N" 라벨은 항상 위쪽 고정.
    const northCircleR = viewH * 0.06;
    const northX = viewMinX + viewW - northCircleR * 1.5;
    // 원 위에 "N" 라벨 한 줄이 더 들어가야 하니 중심을 그만큼 더 아래로.
    const northCenterY = viewMinY + northCircleR * 1.3 + fontSize * 1.4;
    const starOuterR = northCircleR * 0.85;
    const starInnerR = starOuterR * 0.4;
    const starPoint = (angleDeg: number, r: number): string => {
        const rad = toRad(angleDeg);
        return `${(northX + r * Math.sin(rad)).toFixed(1)},${(northCenterY - r * Math.cos(rad)).toFixed(1)}`;
    };
    const northStarPoints = [0, 45, 90, 135, 180, 225, 270, 315]
        .map((angle, i) => starPoint(angle, i % 2 === 0 ? starOuterR : starInnerR))
        .join(" ");

    // 변 길이 라벨은 건물 외곽선에만 붙인다(대지 경계는 legend로만 구분 — 위 주석 참고).
    const edgeLabels =
        buildingRing && buildingLocal
            ? buildingRing.map((p, i) => {
                  const nextIndex = (i + 1) % buildingRing.length;
                  const distance = haversineMeters(p, buildingRing[nextIndex]);
                  return {
                      x: (buildingLocal[i].x + buildingLocal[nextIndex].x) / 2,
                      y: (buildingLocal[i].y + buildingLocal[nextIndex].y) / 2,
                      label: `${distance.toFixed(1)}m`,
                  };
              })
            : [];

    return (
        // width:100%/height:auto는 CSS로(인라인 대신 className) — 소비처(F-05 RightPanel)가 폭 좁은 사이드바에서
        // 세로로 너무 길어지지 않게 자기 wrapper에서 max-height를 걸 수 있어야 한다(2026-08-1x, "스크롤이 안
        // 생길정도 크기로"). 인라인 style은 특이도가 가장 높아 wrapper 쪽 CSS로 못 덮어써서 클래스로 옮김.
        <svg
            viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`}
            className="site-polygon-svg"
            role="img"
            aria-label={buildingRing && siteRing ? "대지 경계와 건축물 외곽선" : siteRing ? "대지 경계" : "건축물 외곽선"}
        >
            {/* 대지 경계를 먼저 그려 뒤에 깔고(점선, 채움 없음), 건물 외곽선을 그 위에 그린다(실선+채움) — 대지가
                건물을 감싸는 실제 관계와 같은 z-order. */}
            {siteLocal && (
                <polygon
                    points={ringPointsAttr(siteLocal)}
                    fill="none"
                    stroke="var(--text)"
                    strokeWidth={1}
                    strokeDasharray="4 2"
                    vectorEffect="non-scaling-stroke"
                />
            )}
            {buildingLocal && (
                <polygon
                    points={ringPointsAttr(buildingLocal)}
                    fill="var(--accent-bg)"
                    stroke="var(--accent)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
            )}
            {edgeLabels.map((edge, i) => (
                // eslint-disable-next-line react/no-array-index-key -- 변 순서가 곧 식별자, 재정렬되지 않는다.
                <text key={i} x={edge.x} y={edge.y} fontSize={fontSize} textAnchor="middle" fill="var(--text)">
                    {edge.label}
                </text>
            ))}
            {/* 방위 표시 — svg 전체에 이미 role="img"+aria-label이 있어 순수 장식으로 취급, 개별 aria 불필요. */}
            <g aria-hidden="true">
                <circle
                    cx={northX}
                    cy={northCenterY}
                    r={northCircleR}
                    fill="var(--bg)"
                    stroke="var(--text)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                />
                <polygon points={northStarPoints} fill="var(--text)" />
                <text x={northX} y={northCenterY - northCircleR - fontSize * 0.3} fontSize={fontSize} textAnchor="middle" fill="var(--text)">
                    N
                </text>
            </g>
        </svg>
    );
};

export default SitePolygonDiagram;

// 범례("건축물 도면"/"대지 도면" 라벨 분리) + 누락 안내 + 면책 문구. SVG는 wrapper(right-panel-site-polygon-body/
// report-site-polygon-body)가 고정 높이+flex 중앙정렬로 감싸고 있어(2026-08-1x, "스크롤이 안 생길정도 크기로")
// 그 안에 같이 넣으면 svg의 height:100% 기준(부모 height 필요)이 깨진다 — 그래서 SVG와 분리된 컴포넌트로 만들어
// 그 wrapper 바깥(아래)에 둔다(소비처 2곳: RightPanel.tsx/BasicInfoPage.tsx). 둘 다 없으면 위 SitePolygonDiagram이
// 이미 "도면 정보 없음"을 보여주므로 여기선 null(중복 안내 방지).
export const SitePolygonMeta = ({ buildingGeojson, siteGeojson }: SitePolygonDiagramProps) => {
    const buildingRing = buildingGeojson ? parseRing(buildingGeojson) : null;
    const siteRing = siteGeojson ? parseRing(siteGeojson) : null;

    if (buildingRing == null && siteRing == null) return null;

    // 2026-08-09(축소 요청) — 범례 줄+면책 문구 줄로 나뉘어 카드 높이가 늘어났다(F-05 사이드바가 이미 스크롤
    // 전제 높이라는 지적) — 한 줄(flex-wrap)로 합쳐 그만큼 줄인다. 있는 쪽은 스와치+라벨, 없는 쪽은 스와치 없이
    // 안내 문구만 — 어차피 한 줄 안에서 항목 단위로 구분되니 별도 문단(margin)이 필요 없다.
    return (
        <div className="site-polygon-meta">
            {buildingRing ? (
                <span className="site-polygon-legend-item">
                    <span className="site-polygon-legend-swatch site-polygon-legend-swatch-building" aria-hidden="true" />
                    건축물 도면
                </span>
            ) : (
                <span className="site-polygon-legend-item">건축물 도면 정보 없음</span>
            )}
            {siteRing ? (
                <span className="site-polygon-legend-item">
                    <span className="site-polygon-legend-swatch site-polygon-legend-swatch-site" aria-hidden="true" />
                    대지 도면
                </span>
            ) : (
                <span className="site-polygon-legend-item">대지 경계 정보 없음</span>
            )}
            <span className="site-polygon-legend-item">참고용, 법적 효력 없음</span>
        </div>
    );
};
