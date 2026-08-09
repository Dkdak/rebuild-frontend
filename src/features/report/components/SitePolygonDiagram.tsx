// FEATURE_05_PROPERTY_INFO.md §3.1 "sitePolygon" 프론트 렌더링 스펙 그대로 구현.
// gis_building.polygonGeojson(WGS84 lat/lng)을 등거리원통도법 근사로 로컬 평면(m) 좌표로 바꿔 SVG 폴리곤을 그리고,
// 각 변은 실제 좌표로 하버사인 거리를 계산해 길이(m) 라벨을 붙인다. 위도가 커지는 쪽이 북쪽이라 SVG는
// y_svg = -y_local로 뒤집어야 화면에서 북쪽이 위로 온다.
interface SitePolygonDiagramProps {
    geojson: string | null;
}

interface LatLng {
    lat: number;
    lng: number;
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
// export하는 이유: F-05 RightPanel이 "건축물 도면 있으면 카드로, 없으면 카드 자체를 안 보여준다"(2026-08-1x
// 사용자 피드백)를 판단하려면 렌더링 전에 유효성만 먼저 알아야 한다 — 파싱 로직을 중복 작성하지 않고 재사용.
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

const SitePolygonDiagram = ({ geojson }: SitePolygonDiagramProps) => {
    const ring = geojson ? parseRing(geojson) : null;

    if (ring == null) {
        return <p className="right-panel-field-note">건축물 도면 정보 없음</p>;
    }

    const lat0 = ring.reduce((sum, p) => sum + p.lat, 0) / ring.length;
    const lng0 = ring.reduce((sum, p) => sum + p.lng, 0) / ring.length;
    const cosLat0 = Math.cos(toRad(lat0));

    const local = ring.map((p) => ({
        x: (p.lng - lng0) * cosLat0 * 111320,
        y: -(p.lat - lat0) * 110540,
    }));

    const minX = Math.min(...local.map((p) => p.x));
    const maxX = Math.max(...local.map((p) => p.x));
    const minY = Math.min(...local.map((p) => p.y));
    const maxY = Math.max(...local.map((p) => p.y));
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const pad = Math.max(width, height) * 0.18;

    const viewMinX = minX - pad;
    const viewMinY = minY - pad;
    const viewW = width + pad * 2;
    const viewH = height + pad * 2;
    const fontSize = viewW / 22;

    const pointsAttr = local.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    const edgeLabels = ring.map((p, i) => {
        const nextIndex = (i + 1) % ring.length;
        const distance = haversineMeters(p, ring[nextIndex]);
        return {
            x: (local[i].x + local[nextIndex].x) / 2,
            y: (local[i].y + local[nextIndex].y) / 2,
            label: `${distance.toFixed(1)}m`,
        };
    });

    return (
        // width:100%/height:auto는 CSS로(인라인 대신 className) — 소비처(F-05 RightPanel)가 폭 좁은 사이드바에서
        // 세로로 너무 길어지지 않게 자기 wrapper에서 max-height를 걸 수 있어야 한다(2026-08-1x, "스크롤이 안
        // 생길정도 크기로"). 인라인 style은 특이도가 가장 높아 wrapper 쪽 CSS로 못 덮어써서 클래스로 옮김.
        <svg viewBox={`${viewMinX} ${viewMinY} ${viewW} ${viewH}`} className="site-polygon-svg" role="img" aria-label="건축물 도면">
            <polygon points={pointsAttr} fill="var(--accent-bg)" stroke="var(--accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {edgeLabels.map((edge, i) => (
                // eslint-disable-next-line react/no-array-index-key -- 변 순서가 곧 식별자, 재정렬되지 않는다.
                <text key={i} x={edge.x} y={edge.y} fontSize={fontSize} textAnchor="middle" fill="var(--text)">
                    {edge.label}
                </text>
            ))}
        </svg>
    );
};

export default SitePolygonDiagram;
