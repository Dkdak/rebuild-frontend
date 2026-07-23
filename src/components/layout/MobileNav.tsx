interface MobileNavProps {
    open: boolean;
    onClose: () => void;
    tabs: string[];
    activeTab: string;
    onTabSelect: (tab: string) => void;
    email: string | null;
    nickname: string | null;
    isRestoring: boolean;
    onLogout: () => void;
    onLoginClick: () => void;
}

const MobileNav = ({ open, onClose, tabs, activeTab, onTabSelect, email, nickname, isRestoring, onLogout, onLoginClick }: MobileNavProps) => {
    if (!open) return null;

    return (
        <div className="mobile-nav-backdrop" onClick={onClose}>
            <div className="mobile-nav-panel" onClick={(e) => e.stopPropagation()}>
                <div className="mobile-nav-header">
                    <span className="top-bar-logo">ReValue</span>
                    <button className="mobile-nav-close" onClick={onClose} aria-label="닫기">×</button>
                </div>

                <nav className="mobile-nav-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            className={`mobile-nav-tab ${activeTab === tab ? "active" : ""}`}
                            onClick={() => onTabSelect(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <label className="mobile-nav-search">
                    <input type="text" placeholder="주소, 지역으로 검색" disabled />
                </label>

                <button className="mobile-nav-row" disabled>
                    <span>🔔 알림</span>
                </button>

                {isRestoring ? (
                    <span className="top-bar-auth-skeleton" />
                ) : email ? (
                    <div className="mobile-nav-row mobile-nav-user">
                        <span>{nickname}</span>
                        <button className="top-bar-login-btn" onClick={onLogout}>로그아웃</button>
                    </div>
                ) : (
                    <button className="top-bar-login-btn mobile-nav-login-btn" onClick={onLoginClick}>
                        로그인
                    </button>
                )}
            </div>
        </div>
    );
};

export default MobileNav;
