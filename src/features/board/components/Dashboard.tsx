import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import DeleteAccountModal from "../../auth/components/DeleteAccountModal";
import EditNicknameForm from "../../auth/components/EditNicknameForm";
import "./Dashboard.css";

const Dashboard = () => {
    const { email, nickname } = useAuth();
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showEditNicknameForm, setShowEditNicknameForm] = useState(false);

    return (
        <div className="dashboard">
            <section className="dashboard-account">
                <h3 className="dashboard-account-title">계정 정보</h3>
                <p className="dashboard-account-nickname">{nickname}</p>
                <p className="dashboard-account-email">{email}</p>

                <div className="dashboard-account-actions">
                    <button
                        className="dashboard-edit-nickname-btn"
                        onClick={() => setShowEditNicknameForm(true)}
                    >
                        회원정보 수정
                    </button>
                    <button
                        className="dashboard-delete-account-btn"
                        onClick={() => setShowDeleteAccountModal(true)}
                    >
                        회원탈퇴
                    </button>
                </div>
            </section>

            {showEditNicknameForm && (
                <EditNicknameForm onClose={() => setShowEditNicknameForm(false)} />
            )}
            {showDeleteAccountModal && (
                <DeleteAccountModal onClose={() => setShowDeleteAccountModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;
