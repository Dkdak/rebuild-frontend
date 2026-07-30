import { useAuth } from "../../context/AuthContext";
import LoginModal from "../../../features/auth/components/LoginModal";
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

            {/* 로고~메뉴 사이 배너 슬롯 — 지금은 개발 서버 안내, 나중에 다른 배너로 교체될 수 있는 자리(비워두면 그냥 빈 공간). */}
            <div className="top-bar-banner-slot">
                <div className="dev-banner">
                    <div className="dev-banner-message">
                        <span className="dev-banner-tag">DEV</span>
                        <span className="dev-banner-text">
                            <strong>개발 중인 서비스입니다.</strong> 표시되는 정보는 테스트 데이터가 포함될 수 있으며, 실제 투자 판단에 사용하지 마세요.
                        </span>
                    </div>
                    <span className="dev-banner-badge">개발 서버</span>
                </div>
            </div>

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
