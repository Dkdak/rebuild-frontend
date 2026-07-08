import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:9192",
});

export interface TestPropertyResponse {
    id: number;
    name: string;
}

export const findAllProperties = async (): Promise<TestPropertyResponse[]> => {
    const response = await api.get<TestPropertyResponse[]>("/api/properties/findAll");
    return response.data;
};
