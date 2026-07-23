import { useEffect, useState } from "react";
import { findAllProperties, type TestPropertyResponse } from "../../features/property/api/propertyApi";
import { Config } from "../../config/config";

declare global {
    interface Window {
        kakao: any;
    }
}

const CenterMap = () => {
    const [properties, setProperties] = useState<TestPropertyResponse[]>([]);

    useEffect(() => {
        findAllProperties()
            .then(setProperties)
            .catch((error) => console.error(error));
    }, []);

    useEffect(() => {

        const script = document.createElement("script");

        script.async = true;
        script.src =
            `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${Config.KAKAO.MAP_KEY}&autoload=false`;

        document.head.appendChild(script);

        script.onload = () => {

            window.kakao.maps.load(() => {

                const container = document.getElementById("map");

                if (!container) return;

                const options = {
                    center: new window.kakao.maps.LatLng(
                        37.5665,
                        126.9780
                    ),
                    level: 5,
                };

                new window.kakao.maps.Map(container, options);

            });

        };

    }, []);

    return (
        <section className="center-panel">
            <div 
                id="map" 
                className="center-map-placeholder"
            />
            <div className="center-list-panel">
                <h4 className="center-list-title">투자 후보 리스트</h4>
                {properties.length === 0 ? (
                    <p className="center-list-empty">표시할 데이터가 없습니다.</p>
                ) : (
                    <ul className="center-list-items">
                        {properties.map((property) => (
                            <li key={property.id} className="center-list-item">
                                <span className="center-list-item-id">{property.id}</span>
                                <span className="center-list-item-name">{property.name}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
};



export default CenterMap;
