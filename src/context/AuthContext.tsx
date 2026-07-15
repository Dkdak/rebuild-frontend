import { createContext, useContext, useState, type ReactNode } from "react";
import { loginUser } from "../api/authApi";

interface AuthContextValue {
    token: string | null;
    email: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);

    const login = async (inputEmail: string, password: string) => {
        const response = await loginUser(inputEmail, password);
        setToken(response.token);
        setEmail(response.email);
    };

    const logout = () => {
        setToken(null);
        setEmail(null);
    };

    return (
        <AuthContext.Provider value={{ token, email, login, logout }}>
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
