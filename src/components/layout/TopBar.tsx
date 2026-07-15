import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LoginModal from "../auth/LoginModal";
import MobileNav from "./MobileNav";

interface TopBarProps {
    tabs: string[];
    activeTab: string;
    onTabSelect: (tab: string) => void;
}

const TopBar = ({ tabs, activeTab, onTabSelect }: TopBarProps) => {
    const { email, logout } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showMobileNav, setShowMobileNav] = useState(false);

    return (
        <header className="top-bar">
            <div className="top-bar-logo">ReValue</div>

            <nav className="top-bar-tabs">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        className={`top-bar-tab ${activeTab === tab ? "active" : ""}`}
                        onClick={() => onTabSelect(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </nav>

            <div className="top-bar-search">
                <input type="text" placeholder="주소, 지역으로 검색" disabled />
            </div>

            <button className="top-bar-icon-btn" aria-label="알림" disabled>🔔</button>

            <div className="top-bar-auth">
                {email ? (
                    <>
                        <span className="top-bar-user">{email}</span>
                        <button className="top-bar-login-btn" onClick={logout}>로그아웃</button>
                    </>
                ) : (
                    <button className="top-bar-login-btn" onClick={() => setShowLoginModal(true)}>로그인</button>
                )}
            </div>

            <button
                className="top-bar-hamburger"
                aria-label="메뉴 열기"
                onClick={() => setShowMobileNav(true)}
            >
                ☰
            </button>

            {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

            <MobileNav
                open={showMobileNav}
                onClose={() => setShowMobileNav(false)}
                tabs={tabs}
                activeTab={activeTab}
                onTabSelect={(tab) => {
                    onTabSelect(tab);
                    setShowMobileNav(false);
                }}
                email={email}
                onLogout={logout}
                onLoginClick={() => {
                    setShowMobileNav(false);
                    setShowLoginModal(true);
                }}
            />
        </header>
    );
};

export default TopBar;
