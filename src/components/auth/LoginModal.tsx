import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import "./LoginModal.css";

const LoginModal = ({ onClose }: { onClose: () => void }) => {
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
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

    return (
        <div className="login-modal-backdrop" onClick={onClose}>
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>로그인</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="닫기">×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    {errorMessage && <p className="login-modal-error">{errorMessage}</p>}
                    <label>
                        이메일
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="test@test.com"
                            required
                        />
                    </label>
                    <label>
                        비밀번호
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="1234"
                            required
                        />
                    </label>
                    <button type="submit" className="login-modal-submit" disabled={loading}>
                        {loading ? "로그인 중..." : "로그인"}
                    </button>
                    <p className="login-modal-hint">테스트 계정: test@test.com / 1234 (목업 응답)</p>
                </form>
            </div>
        </div>
    );
};

export default LoginModal;
