import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import "./LoginModal.css";

type Mode = "login" | "signup";

const LoginModal = ({ onClose }: { onClose: () => void }) => {
    const { login, signup } = useAuth();
    const [mode, setMode] = useState<Mode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const switchMode = (nextMode: Mode) => {
        setMode(nextMode);
        setErrorMessage("");
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setLoading(true);
        try {
            await login(email, password);
            onClose();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "로그인에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleSignupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        if (password.length < 8) {
            setErrorMessage("비밀번호는 8자 이상이어야 합니다.");
            return;
        }
        if (password !== passwordConfirm) {
            setErrorMessage("비밀번호가 일치하지 않습니다.");
            return;
        }

        setLoading(true);
        try {
            await signup(email, password, agreedToTerms);
            onClose();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "회원가입에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-modal-backdrop" onClick={onClose}>
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>{mode === "login" ? "로그인" : "회원가입"}</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="닫기">×</button>
                </div>

                <div className="login-modal-tabs">
                    <button
                        type="button"
                        className={`login-modal-tab ${mode === "login" ? "active" : ""}`}
                        onClick={() => switchMode("login")}
                    >
                        로그인
                    </button>
                    <button
                        type="button"
                        className={`login-modal-tab ${mode === "signup" ? "active" : ""}`}
                        onClick={() => switchMode("signup")}
                    >
                        회원가입
                    </button>
                </div>

                {mode === "login" ? (
                    <form onSubmit={handleLoginSubmit}>
                        {errorMessage && <p className="login-modal-error">{errorMessage}</p>}
                        <label>
                            이메일
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            비밀번호
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </label>
                        <button type="submit" className="login-modal-submit" disabled={loading}>
                            {loading ? "로그인 중..." : "로그인"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSignupSubmit}>
                        {errorMessage && <p className="login-modal-error">{errorMessage}</p>}
                        <label>
                            이메일
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            비밀번호 (8자 이상)
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={8}
                                required
                            />
                        </label>
                        <label>
                            비밀번호 확인
                            <input
                                type="password"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                required
                            />
                        </label>
                        <label className="login-modal-checkbox">
                            <input
                                type="checkbox"
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                            />
                            <span>서비스 이용약관 및 개인정보처리방침에 동의합니다.</span>
                        </label>
                        <button
                            type="submit"
                            className="login-modal-submit"
                            disabled={loading || !agreedToTerms}
                        >
                            {loading ? "가입 중..." : "회원가입"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginModal;
