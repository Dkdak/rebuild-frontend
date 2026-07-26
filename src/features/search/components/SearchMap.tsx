import KakaoMap from "../../../shared/components/map/KakaoMap";
import { useSearch } from "../context/SearchContext";

// F-04 소관: SearchContext의 검색 결과를 shared/components/map의 범용 KakaoMap에 props로 연결한다.
const SearchMap = () => {
    const { searchResults, mapCenter, selectedPropertyId, selectProperty } = useSearch();

    const markers = (searchResults?.items ?? []).map((item) => ({
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
