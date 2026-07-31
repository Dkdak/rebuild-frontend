import { useState } from "react";
import KakaoMap from "../../../shared/components/map/KakaoMap";
import { useSearch } from "../context/SearchContext";

// F-04 소관: SearchContext의 검색 결과를 shared/components/map의 범용 KakaoMap에 props로 연결한다.
const SearchMap = () => {
    const { searchResults, mapCenter, selectedPropertyId, selectProperty } = useSearch();
    // 모바일 전용 알림 — 지도 위 플로팅 오버레이(§2.2 2026-08-05 재작업, TopBar에서 이동). 새로고침하면 다시 보임.
    const [noticeDismissed, setNoticeDismissed] = useState(false);

    // 좌표가 없는 매물(건축물대장에 위치 매핑이 안 된 건)은 지도에 표시할 수 없으므로 제외한다.
    const markers = (searchResults?.items ?? [])
        .filter((item): item is typeof item & { lat: number; lng: number } => item.lat != null && item.lng != null)
        .map((item) => ({
            id: item.id,
            lat: item.lat,
            lng: item.lng,
            label: item.address,
        }));

    return (
        <div className="search-map-wrapper">
            <KakaoMap
                center={mapCenter}
                markers={markers}
                selectedId={selectedPropertyId}
                onMarkerClick={selectProperty}
            />

            {/* `FEATURE_01_LAYOUT.md` §2.2(2026-08-05) — 헤더를 건드리지 않도록 지도 최상단 레이어에 플로팅 오버레이로 배치. 닫으면 지도 영역을 온전히 확보. */}
            {!noticeDismissed && (
                <div className="dev-notice">
                    <span className="dev-notice-icon" aria-hidden="true">ⓘ</span>
                    <span className="dev-notice-text">테스트 데이터 포함. 투자 판단 주의</span>
                    <button
                        type="button"
                        className="dev-notice-close"
                        aria-label="안내 닫기"
                        onClick={() => setNoticeDismissed(true)}
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
};

export default SearchMap;
