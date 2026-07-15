export interface LoginResponse {
    token: string;
    email: string;
}

const MOCK_EMAIL = "test@test.com";
const MOCK_PASSWORD = "1234";

// TODO: 백엔드 /api/auth/login 준비되면 axios 호출로 교체 (docs/FEATURE.md FEATURE-001 참고)
export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
        return { token: "mock-jwt-token", email };
    }

    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
};
