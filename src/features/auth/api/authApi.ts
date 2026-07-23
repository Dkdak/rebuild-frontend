import axios from "axios";

// 빌드 환경에 주입된 VITE_API_URL을 사용하고, 없을 때만 로컬 주소(9192)를 기본값으로 씁니다.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9192";

const api = axios.create({
    baseURL: BASE_URL,
});

export interface LoginResponse {
    token: string;
    email: string;
    nickname: string;
}

export interface CurrentUserResponse {
    email: string;
    nickname: string;
}

export interface NicknameResponse {
    nickname: string;
}

interface ErrorResponseBody {
    message: string;
}

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as ErrorResponseBody | undefined;
        if (data?.message) {
            return data.message;
        }
    }
    return fallback;
};

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>("/api/v1/auth/login", { email, password });
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, "로그인에 실패했습니다."));
    }
};

export const signupUser = async (
    email: string,
    password: string,
    nickname: string,
    agreedToTerms: boolean
): Promise<LoginResponse> => {
    try {
        const response = await api.post<LoginResponse>("/api/v1/auth/signup", {
            email,
            password,
            nickname,
            agreedToTerms,
        });
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, "회원가입에 실패했습니다."));
    }
};

// 세션 복원(새로고침)용 — Authorization 헤더로 토큰 유효성 확인
export const fetchCurrentUser = async (token: string): Promise<CurrentUserResponse> => {
    try {
        const response = await api.get<CurrentUserResponse>("/api/v1/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
        });
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, "유효하지 않은 세션입니다."));
    }
};

// 닉네임 수정 — 이메일/비밀번호는 이 API로 변경 불가
export const updateNickname = async (token: string, nickname: string): Promise<NicknameResponse> => {
    try {
        const response = await api.patch<NicknameResponse>(
            "/api/v1/auth/me",
            { nickname },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, "닉네임 수정에 실패했습니다."));
    }
};

// 회원탈퇴 — 이메일은 서버가 토큰에서 추출하므로 비밀번호만 body로 전달
export const deleteAccount = async (token: string, password: string): Promise<void> => {
    try {
        await api.delete("/api/v1/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
            data: { password },
        });
    } catch (error) {
        throw new Error(extractErrorMessage(error, "탈퇴에 실패했습니다."));
    }
};
