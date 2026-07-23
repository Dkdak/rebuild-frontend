import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import "./LoginModal.css";

interface EditNicknameFormProps {
    onClose: () => void;
}

const EditNicknameForm = ({ onClose }: EditNicknameFormProps) => {
    const { nickname, updateNickname } = useAuth();
    const [value, setValue] = useState(nickname ?? "");
    const [errorMessage, setErrorMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        if (value.length < 2 || value.length > 20) {
            setErrorMessage("닉네임은 2~20자여야 합니다.");
            return;
        }

        setLoading(true);
        try {
            await updateNickname(value);
            onClose();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "닉네임 수정에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-modal-backdrop" onClick={onClose}>
            <div className="login-modal" onClick={(e) => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>회원정보 수정</h2>
                    <button className="login-modal-close" onClick={onClose} aria-label="닫기">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {errorMessage && <p className="login-modal-error">{errorMessage}</p>}
                    <label>
                        닉네임 (2~20자)
                        <input
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            minLength={2}
                            maxLength={20}
                            required
                        />
                    </label>
                    <button type="submit" className="login-modal-submit" disabled={loading}>
                        {loading ? "저장 중..." : "저장"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default EditNicknameForm;
