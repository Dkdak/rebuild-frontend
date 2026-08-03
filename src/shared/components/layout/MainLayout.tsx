import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import FilterDrawer from "./FilterDrawer";
import DetailBottomSheet from "./DetailBottomSheet";
import HangulGame from "../../../features/game/HangulGame";
import Dashboard from "../../../features/board/components/Dashboard";
import ComingSoon from "./ComingSoon";
import ReportPage from "../../../features/report/components/ReportPage";
import { SearchProvider } from "../../../features/search/context/SearchContext";
import "./layout.css";

// F-01_LAYOUT.md §2.3(2026-07-24 확정): Top 메뉴는 4개(지도/대시보드/분석/리포트)다.
// "리스트"는 지도 탭 내부(CenterPanel)로, "관심목록"은 대시보드 탭 내부(F-03)로 흡수됐다.
// "분석"은 §2.3-a에 따라 준비중 placeholder(ComingSoon). "리포트"는 §2.3-b(2026-08-08) — 요약 페이지 레이아웃
// 설계 완료로 ComingSoon 대신 ReportPage 렌더링, F-05 RightPanel "AI 투자 리포트 보기" 버튼이 주 진입 경로.
// "단어 기차 놀이터"는 정식 메뉴에서 제외한다.
const TABS = ["지도", "대시보드", "분석", "리포트"];
const DEFAULT_TAB = "지도";
// F-01_LAYOUT.md §4: 비로그인 상태에서 접근 시 로그인 모달로 유도해야 하는 탭. 분석/리포트는 게이트 없음(§2.3-a).
const LOGIN_REQUIRED_TABS = ["대시보드"];
const PLACEHOLDER_TABS = ["분석"];

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

    // FEATURE_01_LAYOUT.md §2.3-b: "AI 투자 리포트 보기" 버튼 → 탭 전환(SearchContext가 위에서 감싸고 있어 selectedPropertyId는 그대로 유지).
    const handleOpenReport = () => {
        setActiveOverlay(null);
        setActiveTab("리포트");
    };

    if (activeTab === "단어 기차 놀이터") {
        return <HangulGame onBack={() => setActiveTab(DEFAULT_TAB)} />;
    }

    return (
        <SearchProvider>
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
                onOpenFilter={() => setActiveOverlay("filter")}
            />
            {activeTab === "대시보드" ? (
                <Dashboard />
            ) : activeTab === "리포트" ? (
                <ReportPage onBackToMap={() => setActiveTab(DEFAULT_TAB)} />
            ) : PLACEHOLDER_TABS.includes(activeTab) ? (
                <ComingSoon />
            ) : (
                <div className="app-layout-body">
                    <LeftPanel />
                    <CenterPanel onOpenDetail={() => setActiveOverlay("detail")} />
                    <RightPanel onOpenReport={handleOpenReport} />
                </div>
            )}

            <FilterDrawer open={activeOverlay === "filter"} onClose={() => setActiveOverlay(null)} />
            <DetailBottomSheet
                open={activeOverlay === "detail"}
                onClose={() => setActiveOverlay(null)}
                onOpenReport={handleOpenReport}
            />
        </div>
        </SearchProvider>
    );
};

export default MainLayout;
