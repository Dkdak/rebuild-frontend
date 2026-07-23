import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
    deleteAccount as deleteAccountApi,
    fetchCurrentUser,
    loginUser,
    signupUser,
    updateNickname as updateNicknameApi,
} from "../features/auth/api/authApi";

const TOKEN_STORAGE_KEY = "revalue_token";

interface AuthContextValue {
    token: string | null;
    email: string | null;
    nickname: string | null;
    isRestoring: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, nickname: string, agreedToTerms: boolean) => Promise<void>;
    updateNickname: (nickname: string) => Promise<void>;
    deleteAccount: (password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [nickname, setNickname] = useState<string | null>(null);
    const [isRestoring, setIsRestoring] = useState(true);

    // 새로고침/재방문 시 localStorage에 저장된 토큰으로 세션을 복원한다 (F-02_AUTH.md §2.3).
    useEffect(() => {
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!storedToken) {
            setIsRestoring(false);
            return;
        }

        fetchCurrentUser(storedToken)
            .then((user) => {
                setToken(storedToken);
                setEmail(user.email);
                setNickname(user.nickname);
            })
            .catch(() => {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
            })
            .finally(() => setIsRestoring(false));
    }, []);

    const applySession = (nextToken: string, nextEmail: string, nextNickname: string) => {
        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        setToken(nextToken);
        setEmail(nextEmail);
        setNickname(nextNickname);
    };

    const clearSession = () => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setEmail(null);
        setNickname(null);
    };

    const login = async (inputEmail: string, password: string) => {
        const response = await loginUser(inputEmail, password);
        applySession(response.token, response.email, response.nickname);
    };

    const signup = async (inputEmail: string, password: string, inputNickname: string, agreedToTerms: boolean) => {
        const response = await signupUser(inputEmail, password, inputNickname, agreedToTerms);
        applySession(response.token, response.email, response.nickname);
    };

    // 성공 시 AuthContext의 nickname을 즉시 갱신 — TopBar 표시도 함께 갱신된다 (F-02_AUTH.md §4).
    const updateNickname = async (nextNickname: string) => {
        if (!token) {
            throw new Error("로그인이 필요합니다.");
        }
        const response = await updateNicknameApi(token, nextNickname);
        setNickname(response.nickname);
    };

    // 탈퇴 성공 시 로그아웃과 동일하게 로컬 세션을 정리한다 (F-02_AUTH.md §4).
    // 이메일은 서버가 JWT에서 추출하므로, 클라이언트는 토큰만 전달한다.
    const deleteAccount = async (password: string) => {
        if (!token) {
            throw new Error("로그인이 필요합니다.");
        }
        await deleteAccountApi(token, password);
        clearSession();
    };

    const logout = () => {
        clearSession();
    };

    return (
        <AuthContext.Provider
            value={{ token, email, nickname, isRestoring, login, signup, updateNickname, deleteAccount, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
