import { useAuth } from "../../context/AuthContext";
import LoginModal from "../../features/auth/components/LoginModal";
import MobileNav from "./MobileNav";

interface TopBarProps {
    tabs: string[];
    activeTab: string;
    onTabSelect: (tab: string) => void;
    mobileNavOpen: boolean;
    onOpenMobileNav: () => void;
    onCloseMobileNav: () => void;
    showLoginModal: boolean;
    onOpenLoginModal: () => void;
    onCloseLoginModal: () => void;
}

const TopBar = ({
    tabs,
    activeTab,
    onTabSelect,
    mobileNavOpen,
    onOpenMobileNav,
    onCloseMobileNav,
    showLoginModal,
    onOpenLoginModal,
    onCloseLoginModal,
}: TopBarProps) => {
    const { email, nickname, logout, isRestoring } = useAuth();

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
                {isRestoring ? (
                    <span className="top-bar-auth-skeleton" />
                ) : email ? (
                    <>
                        <span className="top-bar-user">{nickname}</span>
                        <button className="top-bar-login-btn" onClick={logout}>로그아웃</button>
                    </>
                ) : (
                    <button className="top-bar-login-btn" onClick={onOpenLoginModal}>로그인</button>
                )}
            </div>

            <button
                className="top-bar-hamburger"
                aria-label="메뉴 열기"
                onClick={onOpenMobileNav}
            >
                ☰
            </button>

            {showLoginModal && <LoginModal onClose={onCloseLoginModal} />}

            <MobileNav
                open={mobileNavOpen}
                onClose={onCloseMobileNav}
                tabs={tabs}
                activeTab={activeTab}
                onTabSelect={(tab) => {
                    onTabSelect(tab);
                    onCloseMobileNav();
                }}
                email={email}
                nickname={nickname}
                isRestoring={isRestoring}
                onLogout={logout}
                onLoginClick={() => {
                    onCloseMobileNav();
                    onOpenLoginModal();
                }}
            />
        </header>
    );
};

export default TopBar;
