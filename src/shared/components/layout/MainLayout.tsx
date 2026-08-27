import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import FilterDrawer from "../../../features/search/components/FilterDrawer";
import DetailBottomSheet from "../../../features/property/components/DetailBottomSheet";
import HangulGame from "../../../features/game/HangulGame";
import Dashboard from "../../../features/board/components/Dashboard";
import { ALL_NARROWING_ON, type NarrowingSelection } from "../../../features/board/api/dashboardApi";
import { FavoritesProvider } from "../../../features/favorites/context/FavoritesContext";
import AnalysisPage from "../../../features/analysis/components/AnalysisPage";
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
// F-01_LAYOUT.md §4: 비로그인 상태에서 접근 시 로그인 모달로 유도해야 하는 탭. 지도만 비로그인 진입 가능하다.
// 개발 서버에서는 게이트를 열어 둔다 — backend가 local 프로파일에서 인증을 우회해(LocalDevAuthFilter,
// dev@local.test) API는 토큰 없이 열리는데 화면만 막혀 있으면 만든 걸 확인할 수 없다.
// import.meta.env.DEV는 vite build(운영)에서 false라 배포 번들에는 게이트가 그대로 남는다.
const LOGIN_REQUIRED_TABS = import.meta.env.DEV ? [] : ["대시보드", "리포트", "분석"];

type OverlayType = "filter" | "detail" | "nav" | null;

const MainLayout = () => {
    const { email } = useAuth();
    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
    const [showLoginModal, setShowLoginModal] = useState(false);
    // 대시보드 좁히기 선택 — 탭을 옮기면 Dashboard가 언마운트되므로 선택 상태는 여기서 들고 있는다.
    const [dashboardNarrowing, setDashboardNarrowing] = useState<NarrowingSelection>(ALL_NARROWING_ON);
    // 분석탭에서 열 매물 — 대시보드·리포트에서 특정 매물을 눌러 들어오면 그 대상이 선택된 채로 열린다.
    // 아직 실측을 시작하지 않은 매물이면 목록에 없으므로 주소도 같이 들고 간다(목록에서 이름을 못 찾는다).
    const [analysisTarget, setAnalysisTarget] = useState<{ id: string; address: string } | null>(null);

    // 로그아웃/회원탈퇴로 비로그인 상태가 되면, 로그인 필요 탭에 남아있지 않도록 기본 탭으로 되돌린다 (F-02_AUTH.md §4).
    useEffect(() => {
        if (!email && LOGIN_REQUIRED_TABS.includes(activeTab)) {
            setActiveTab(DEFAULT_TAB);
        }
    }, [email, activeTab]);

    // 로그인 필요 탭은 어떤 경로로 열든 같은 게이트를 지난다 — 탭 클릭이든 RightPanel 버튼이든 비로그인이면 로그인 모달.
    const openTab = (tab: string) => {
        setActiveOverlay(null);
        if (LOGIN_REQUIRED_TABS.includes(tab) && !email) {
            setShowLoginModal(true);
            return;
        }
        setActiveTab(tab);
    };

    const handleTabSelect = (tab: string) => openTab(tab);

    // FEATURE_01_LAYOUT.md §2.3-b: "AI 투자 리포트 보기" 버튼 → 탭 전환(SearchContext가 위에서 감싸고 있어 selectedPropertyId는 그대로 유지).
    const handleOpenReport = () => openTab("리포트");

    if (activeTab === "단어 기차 놀이터") {
        return <HangulGame onBack={() => setActiveTab(DEFAULT_TAB)} />;
    }

    return (
        <SearchProvider>
        <FavoritesProvider onRequireLogin={() => setShowLoginModal(true)}>
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
                <Dashboard
                    onNavigateToMap={() => setActiveTab(DEFAULT_TAB)}
                    onOpenReport={() => openTab("리포트")}
                    onNavigateToAnalysis={(buildingId, address) => {
                        setAnalysisTarget(buildingId ? { id: buildingId, address: address ?? "" } : null);
                        openTab("분석");
                    }}
                    onRequestLogin={() => setShowLoginModal(true)}
                    narrowing={dashboardNarrowing}
                    onNarrowingChange={setDashboardNarrowing}
                />
            ) : activeTab === "리포트" ? (
                <ReportPage
                    onBackToMap={() => setActiveTab(DEFAULT_TAB)}
                    onGoToAnalysis={(buildingId, address) => {
                        setAnalysisTarget({ id: buildingId, address });
                        openTab("분석");
                    }}
                />
            ) : activeTab === "분석" ? (
                // F-19 분석탭 — 관심목록에서 추가하는 진입점은 대시보드(관심목록 섹션)로 보낸다.
                <AnalysisPage
                    initialTarget={analysisTarget}
                    onGoToFavorites={() => setActiveTab("대시보드")}
                />
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
        </FavoritesProvider>
        </SearchProvider>
    );
};

export default MainLayout;
