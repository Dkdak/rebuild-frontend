import KakaoMap from "../../../shared/components/map/KakaoMap";
import { useSearch } from "../context/SearchContext";

// F-04 소관: SearchContext의 검색 결과를 shared/components/map의 범용 KakaoMap에 props로 연결한다.
const SearchMap = () => {
    const { searchResults, mapCenter, selectedPropertyId, selectProperty } = useSearch();

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
        <KakaoMap
            center={mapCenter}
            markers={markers}
            selectedId={selectedPropertyId}
            onMarkerClick={selectProperty}
        />
    );
};

export default SearchMap;
