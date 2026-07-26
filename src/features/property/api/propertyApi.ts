import { apiClient as api } from "../../../shared/api/apiClient";

export interface TestPropertyResponse {
    id: number;
    name: string;
}

export const findAllProperties = async (): Promise<TestPropertyResponse[]> => {
    const response = await api.get<TestPropertyResponse[]>("/api/properties/findAll");
    return response.data;
};
