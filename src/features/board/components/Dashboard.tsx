import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import DeleteAccountModal from "../../auth/components/DeleteAccountModal";
import "./Dashboard.css";

const Dashboard = () => {
    const { email } = useAuth();
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

    return (
        <div className="dashboard">
            <section className="dashboard-account">
                <h3 className="dashboard-account-title">계정 정보</h3>
                <p className="dashboard-account-email">{email}</p>
                <button
                    className="dashboard-delete-account-btn"
                    onClick={() => setShowDeleteAccountModal(true)}
                >
                    회원탈퇴
                </button>
            </section>

            {showDeleteAccountModal && (
                <DeleteAccountModal onClose={() => setShowDeleteAccountModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;
