import axios from "axios";

// 💡 빌드 환경에 주입된 VITE_API_URL을 사용하고, 없을 때만 로컬 주소(9192)를 기본값으로 씁니다.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9192";

export const api = axios.create({
    baseURL: BASE_URL,
});

export interface TestPropertyResponse {
    id: number;
    name: string;
}

export const findAllProperties = async (): Promise<TestPropertyResponse[]> => {
    const response = await api.get<TestPropertyResponse[]>("/api/properties/findAll");
    return response.data;
};
