import { useEffect, useState } from "react";
import { findAllProperties, type TestPropertyResponse } from "../../api/propertyApi";

const CenterMap = () => {
    const [properties, setProperties] = useState<TestPropertyResponse[]>([]);

    useEffect(() => {
        findAllProperties()
            .then(setProperties)
            .catch((error) => console.error(error));
    }, []);

    return (
        <section className="center-panel">
            <div className="placeholder-box center-map-placeholder">
                <span>지도 영역 (Google/Kakao Map — 추후 구현)</span>
            </div>
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
