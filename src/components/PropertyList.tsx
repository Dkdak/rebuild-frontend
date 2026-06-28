import { useEffect, useState } from "react";
import { findAllProperties, type TestPropertyResponse } from "../api/propertyApi";

function PropertyList() {

    const [properties, setProperties] = useState<TestPropertyResponse[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await findAllProperties();
            setProperties(data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h2>Property List</h2>

            <table border={1}>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                    </tr>
                </thead>

                <tbody>
                    {properties.map((property) => (
                        <tr key={property.id}>
                            <td>{property.id}</td>
                            <td>{property.name}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

        </div>
    );
}

export default PropertyList;