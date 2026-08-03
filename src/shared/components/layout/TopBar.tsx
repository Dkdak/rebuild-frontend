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
    // `FEATURE_01_LAYOUT.md` §2.2(2026-08-04) — FilterDrawer 트리거가 리스트 헤더에서 TopBar로 이동. 모바일 전용, `지도` 탭에서만 노출.
    onOpenFilter: () => void;
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
    onOpenFilter,
}: TopBarProps) => {
    const { email, nickname, logout, isRestoring } = useAuth();

    return (
            <header className="top-bar">
                <div className="top-bar-logo">
                    ReValue
                    {/* 모바일 전용 — 로고 옆에 짧게 표시(§2.2). 데스크톱은 top-bar-banner-slot 쪽 태그를 그대로 씀. */}
                    <span className="top-bar-dev-tag">DEV</span>
                </div>

                {/* 로고~메뉴 사이 배너 슬롯(데스크톱 전용) — 지금은 개발 서버 안내, 나중에 다른 배너로 교체될 수 있는 자리(비워두면 그냥 빈 공간). 모바일은 아래 dev-notice로 대체돼 숨김. */}
                <div className="top-bar-banner-slot">
                    <div className="dev-banner">
                        <div className="dev-banner-message">
                            <span className="dev-banner-tag">DEV</span>
                            <span className="dev-banner-text">
                                <strong>개발 중인 서비스입니다.</strong> 표시되는 값은 잠정 산출 기준의 추정치이며, 실제 투자 판단에 사용하지 마세요.
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

                {/* 필터/햄버거는 같은 "액션 묶음"이라 둘 사이 간격만 더 좁게(0이 되진 않게). */}
                <div className="top-bar-mobile-actions">
                    {activeTab === "지도" && (
                        <button
                            className="top-bar-filter-btn"
                            aria-label="조건 검색"
                            onClick={onOpenFilter}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M1.5 2h13l-5 6.2v4.8l-3 1.5V8.2L1.5 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}

                    <button
                        className="top-bar-hamburger"
                        aria-label="메뉴 열기"
                        onClick={onOpenMobileNav}
                    >
                        ☰
                    </button>
                </div>

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
