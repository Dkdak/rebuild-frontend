import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import "./LoginModal.css";

interface DeleteAccountModalProps {
    onClose: () => void;
}

const DeleteAccountModal = ({ onClose }: DeleteAccountModalProps) => {
    const { deleteAccount } = useAuth();
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setLoading(true);
        try {
            await deleteAccount(password);
            onClose();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "탈퇴에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-modal-backdrop" onClick={onClose}>
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>회원 탈퇴</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="닫기">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {errorMessage && <p className="login-modal-error">{errorMessage}</p>}
                    <p className="delete-account-warning">
                        탈퇴 시 계정 정보가 영구적으로 삭제되며 복구할 수 없습니다. 계속하려면 비밀번호를 입력하세요.
                    </p>
                    <label>
                        비밀번호
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>
                    <button
                        type="submit"
                        className="login-modal-submit login-modal-submit-danger"
                        disabled={loading}
                    >
                        {loading ? "탈퇴 처리 중..." : "탈퇴하기"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
