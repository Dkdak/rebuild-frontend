import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import CenterMap from "./CenterMap";
import RightPanel from "./RightPanel";
import FilterDrawer from "./FilterDrawer";
import DetailBottomSheet from "./DetailBottomSheet";
import HangulGame from "../../features/game/HangulGame";
import Dashboard from "../../features/board/components/Dashboard";
import "./layout.css";

// "단어 기차 놀이터"는 F-01_LAYOUT.md §2.3에 따라 정식 메뉴에서 제외한다.
const TABS = ["대시보드", "지도", "리스트", "분석 리포트", "관심목록"];
const DEFAULT_TAB = "지도";
// F-01_LAYOUT.md §4: 비로그인 상태에서 접근 시 로그인 모달로 유도해야 하는 탭.
const LOGIN_REQUIRED_TABS = ["대시보드", "관심목록"];

type OverlayType = "filter" | "detail" | "nav" | null;

const MainLayout = () => {
    const { email } = useAuth();
    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 로그아웃/회원탈퇴로 비로그인 상태가 되면, 로그인 필요 탭에 남아있지 않도록 기본 탭으로 되돌린다 (F-02_AUTH.md §4).
    useEffect(() => {
        if (!email && LOGIN_REQUIRED_TABS.includes(activeTab)) {
            setActiveTab(DEFAULT_TAB);
        }
    }, [email, activeTab]);

    const handleTabSelect = (tab: string) => {
        if (LOGIN_REQUIRED_TABS.includes(tab) && !email) {
            setActiveOverlay(null);
            setShowLoginModal(true);
            return;
        }
        setActiveTab(tab);
    };

    if (activeTab === "단어 기차 놀이터") {
        return <HangulGame onBack={() => setActiveTab(DEFAULT_TAB)} />;
    }

    return (
        <div className="app-layout">
            <TopBar
                tabs={TABS}
                activeTab={activeTab}
                onTabSelect={handleTabSelect}
                mobileNavOpen={activeOverlay === "nav"}
                onOpenMobileNav={() => setActiveOverlay("nav")}
                onCloseMobileNav={() => setActiveOverlay(null)}
                showLoginModal={showLoginModal}
                onOpenLoginModal={() => setShowLoginModal(true)}
                onCloseLoginModal={() => setShowLoginModal(false)}
            />
            {activeTab === "대시보드" ? (
                <Dashboard />
            ) : (
                <div className="app-layout-body">
                    <LeftPanel />
                    <CenterMap />
                    <RightPanel />

                    <button
                        className="mobile-filter-trigger"
                        onClick={() => setActiveOverlay("filter")}
                    >
                        조건 검색
                    </button>
                    <button
                        className="mobile-detail-trigger"
                        onClick={() => setActiveOverlay("detail")}
                    >
                        상세보기
                    </button>
                </div>
            )}

            <FilterDrawer open={activeOverlay === "filter"} onClose={() => setActiveOverlay(null)} />
            <DetailBottomSheet open={activeOverlay === "detail"} onClose={() => setActiveOverlay(null)} />
        </div>
    );
};

export default MainLayout;
