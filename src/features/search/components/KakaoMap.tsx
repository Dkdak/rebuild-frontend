import { useEffect, useRef } from "react";
import { Config } from "../../../shared/config/config";

declare global {
    interface Window {
        kakao: any;
    }
}

// 모듈 스코프 싱글턴 — KakaoMap이 여러 번 리마운트돼도 SDK 스크립트는 한 번만 로드한다.
let kakaoMapsLoadPromise: Promise<void> | null = null;

const loadKakaoMaps = (): Promise<void> => {
    if (window.kakao?.maps) {
        return Promise.resolve();
    }
    if (kakaoMapsLoadPromise) {
        return kakaoMapsLoadPromise;
    }

    kakaoMapsLoadPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector<HTMLScriptElement>(
            'script[data-kakao-maps-sdk="true"]'
        );
        if (existingScript) {
            existingScript.addEventListener("load", () => window.kakao.maps.load(() => resolve()));
            existingScript.addEventListener("error", () => reject(new Error("카카오맵 SDK 로드 실패")));
            return;
        }

        const script = document.createElement("script");
        script.async = true;
        script.dataset.kakaoMapsSdk = "true";
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${Config.KAKAO.MAP_KEY}&autoload=false`;
        script.onload = () => window.kakao.maps.load(() => resolve());
        script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
        document.head.appendChild(script);
    });

    return kakaoMapsLoadPromise;
};

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

export interface KakaoMapMarker {
    id: string;
    lat: number;
    lng: number;
    label?: string;
}

export interface KakaoMapCenter {
    lat: number;
    lng: number;
}

interface KakaoMapProps {
    center?: KakaoMapCenter | null;
    markers?: KakaoMapMarker[];
    selectedId?: string | null;
    onMarkerClick?: (id: string) => void;
}

// shared/components/map: 여러 feature가 공유하는 범용 카카오맵 컴포넌트 (HELP5.md §2.4).
// 특정 도메인 상태(SearchContext 등)에 의존하지 않고, 마커/선택 상태는 props로만 받는다.
const KakaoMap = ({ center, markers = [], selectedId, onMarkerClick }: KakaoMapProps) => {
    const mapRef = useRef<any>(null);
    const markersRef = useRef<{ id: string; marker: any }[]>([]);
    const infoWindowRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;

        loadKakaoMaps()
            .then(() => {
                if (cancelled) return;

                const container = document.getElementById("map");
                if (!container) return;

                const initialCenter = new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
                mapRef.current = new window.kakao.maps.Map(container, { center: initialCenter, level: 5 });
                infoWindowRef.current = new window.kakao.maps.InfoWindow({ removable: true });
            })
            .catch((error) => console.error(error));

        return () => {
            cancelled = true;
        };
    }, []);

    // center prop은 마커가 없을 때만 적용한다 — 마커가 있으면 아래 effect가 범위를 자동으로 맞춘다.
    useEffect(() => {
        if (!mapRef.current || !center || markers.length > 0) return;
        mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
    }, [center, markers.length]);

    // markers 변경 시 기존 마커를 지우고 새 마커로 교체한다.
    // 마커 개수에 따라 지도 범위를 자동으로 맞춘다(fit bounds) — 결과가 좁은 지역에 몰려 있어도 항상 보이도록.
    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach(({ marker }) => marker.setMap(null));
        markersRef.current = [];

        markers.forEach((item) => {
            const position = new window.kakao.maps.LatLng(item.lat, item.lng);
            const marker = new window.kakao.maps.Marker({ position, map: mapRef.current });

            if (onMarkerClick) {
                window.kakao.maps.event.addListener(marker, "click", () => onMarkerClick(item.id));
            }

            markersRef.current.push({ id: item.id, marker });
        });

        if (markers.length === 1) {
            mapRef.current.setCenter(new window.kakao.maps.LatLng(markers[0].lat, markers[0].lng));
            mapRef.current.setLevel(3);
        } else if (markers.length > 1) {
            const bounds = new window.kakao.maps.LatLngBounds();
            markers.forEach((item) => bounds.extend(new window.kakao.maps.LatLng(item.lat, item.lng)));
            mapRef.current.setBounds(bounds);
        }
    }, [markers, onMarkerClick]);

    // selectedId에 해당하는 마커 위에 label을 담은 InfoWindow를 띄운다.
    useEffect(() => {
        if (!mapRef.current || !infoWindowRef.current) return;

        const found = markersRef.current.find((m) => m.id === selectedId);
        if (!found) {
            infoWindowRef.current.close();
            return;
        }

        const item = markers.find((m) => m.id === selectedId);
        infoWindowRef.current.setContent(
            `<div style="padding:6px 10px;font-size:12px;">${item?.label ?? ""}</div>`
        );
        infoWindowRef.current.open(mapRef.current, found.marker);
    }, [selectedId, markers]);

    return <div id="map" className="center-map-placeholder" />;
};

export default KakaoMap;
