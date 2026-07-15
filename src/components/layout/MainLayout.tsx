import { useState } from "react";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import CenterMap from "./CenterMap";
import RightPanel from "./RightPanel";
import FilterDrawer from "./FilterDrawer";
import DetailBottomSheet from "./DetailBottomSheet";
import HangulGame from "../HangulGame";
import "./layout.css";

const TABS = ["대시보드", "지도", "리스트", "분석 리포트", "관심목록", "단어 기차 놀이터"];
const DEFAULT_TAB = "지도";

const MainLayout = () => {
    const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
    const [showFilterDrawer, setShowFilterDrawer] = useState(false);
    const [showDetailSheet, setShowDetailSheet] = useState(false);

    if (activeTab === "단어 기차 놀이터") {
        return <HangulGame onBack={() => setActiveTab(DEFAULT_TAB)} />;
    }

    return (
        <div className="app-layout">
            <TopBar tabs={TABS} activeTab={activeTab} onTabSelect={setActiveTab} />
            <div className="app-layout-body">
                <LeftPanel />
                <CenterMap />
                <RightPanel />

                <button
                    className="mobile-filter-trigger"
                    onClick={() => setShowFilterDrawer(true)}
                >
                    조건 검색
                </button>
                <button
                    className="mobile-detail-trigger"
                    onClick={() => setShowDetailSheet(true)}
                >
                    상세보기
                </button>
            </div>

            <FilterDrawer open={showFilterDrawer} onClose={() => setShowFilterDrawer(false)} />
            <DetailBottomSheet open={showDetailSheet} onClose={() => setShowDetailSheet(false)} />
        </div>
    );
};

export default MainLayout;
