import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../../shared/context/AuthContext";
import { useSearch } from "../../search/context/SearchContext";
import type { SearchFilters } from "../../search/api/searchApi";
import DeleteAccountModal from "../../auth/components/DeleteAccountModal";
import EditNicknameForm from "../../auth/components/EditNicknameForm";
import CandidateSection from "./CandidateSection";
import DataStatusPanel from "./DataStatusPanel";
import DistributionSection from "./DistributionSection";
import {
    aggregateSelection,
    fetchDashboardStats,
    formatComputedAt,
    type DashboardDistrict,
    type DashboardStats,
    type NarrowingSelection,
} from "../api/dashboardApi";
import { NARROWING_FILTERS } from "../data/dashboardStats";
import FavoriteKpiSection from "../../favorites/components/FavoriteKpiSection";
import FavoriteListSection from "../../favorites/components/FavoriteListSection";
import { useFavoriteRows } from "../../favorites/hooks/useFavoriteRows";
import MeasurementProgressSection from "./MeasurementProgressSection";

import "./Dashboard.css";

// planning/rebuild/widgets/2026-08-17_dashboard_v3.html 확정본 구현.
// 집계 숫자는 전부 배치 스냅샷 API에서 온다 — 상수로 박아두면 배치를 돌려도 화면이 안 바뀌어 거짓을 말한다.
// 대시보드는 보고 끝나는 요약 화면이 아니라 지도 탭 탐색 진입점이다 — 자치구·등급·유형을 누르면 그 조건이
// 걸린 지도 화면으로 이동한다(F-01_LAYOUT.md §2.3-b의 탭 전환 패턴, SearchProvider 안이라 useSearch를 쓴다).
// 관심목록·실측 카드는 F-03/F-11 API 연동 전이라 자리와 안내만 둔다.
type StatsStatus = "loading" | "ready" | "empty" | "error";

// 좁히기 선택은 MainLayout이 들고 있다 — 탭을 옮기면 이 컴포넌트가 언마운트되는데, 지도에 갔다 돌아왔을 때
// 선택이 기본값으로 돌아가면 안 되기 때문(검색창 위치를 SearchContext로 올린 것과 같은 이유).
interface DashboardProps {
    onNavigateToMap: () => void;
    // F-03 §2.5-a — 관심목록 행은 리포트로, "실측 상태" 셀은 분석탭으로 간다(둘 다 그 매물을 선택한 채로).
    onOpenReport: () => void;
    onNavigateToAnalysis: (buildingId?: string, address?: string) => void;
    onRequestLogin: () => void;
    narrowing: NarrowingSelection;
    onNarrowingChange: (selection: NarrowingSelection) => void;
}

const Dashboard = ({
    onNavigateToMap,
    onOpenReport,
    onNavigateToAnalysis,
    onRequestLogin,
    narrowing,
    onNarrowingChange,
}: DashboardProps) => {
    const { nickname } = useAuth();
    // 관심목록 응답은 KPI 요약과 목록이 함께 쓴다 — 여기서 한 번 받아 내려준다.
    const favorites = useFavoriteRows();
    const { filters, updateFilters, runAddressSearch, runCandidateSearch } = useSearch();
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showEditNicknameForm, setShowEditNicknameForm] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [status, setStatus] = useState<StatsStatus>("loading");

    // 상태 전환은 응답이 온 뒤에만 한다 — 최초 상태가 이미 loading이라 여기서 다시 세팅할 필요가 없다
    // (재시도 버튼만 loading으로 되돌린다).
    const loadStats = useCallback(() => {
        fetchDashboardStats()
            .then((data) => {
                setStats(data);
                setStatus("ready");
            })
            .catch((error: unknown) => {
                // 404는 오류가 아니라 "배치가 아직 안 돈" 정상 상태다.
                setStatus(axios.isAxiosError(error) && error.response?.status === 404 ? "empty" : "error");
            });
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    // 선택한 조합의 집계 — 지역·분포·후보 건수가 전부 이 값을 따른다(조합이 바뀌면 지역 순위도 달라진다).
    const selected = stats ? aggregateSelection(stats.filters, narrowing) : null;
    const selectionLabel =
        NARROWING_FILTERS.filter((filter) => narrowing[filter.key])
            .map((filter) => filter.label)
            .join(" · ") || "좁히기 필터 미적용";

    const handleRetry = () => {
        setStatus("loading");
        loadStats();
    };

    const handleToggleNarrowing = (key: keyof NarrowingSelection, checked: boolean) => {
        const next = { ...narrowing, [key]: checked };
        // 용적률 여유는 용도지역 확인 없이는 성립하지 않는다 — 용도지역을 끄면 같이 꺼진다.
        if (key === "zoneConfirmed" && !checked) next.farSurplusPositive = false;
        onNarrowingChange(next);
    };

    // 지도로 넘길 때는 후보 정의(추진 요건)에 더해 지금 체크된 좁히기 조건만 켠다 — 화면에서 본 집단과 같은
    // 조건이어야 건수가 이어진다.
    const withCandidateConditions = (next: Partial<SearchFilters> = {}) => ({
        ...filters,
        ...next,
        candidateConditions: {
            remodelingCandidate: true,
            zoneConfirmed: narrowing.zoneConfirmed,
            farSurplusPositive: narrowing.farSurplusPositive,
            districtUnrestricted: narrowing.districtUnrestricted,
        },
    });

    // GU 후보는 bjdongCd 필드에 sigunguCd를 담아 보낸다(SearchContext §3.1의 DEFAULT_LOCATION_CANDIDATE와 동일 형태).
    const handleSelectDistrict = (district: DashboardDistrict) => {
        const nextFilters = withCandidateConditions();

        onNavigateToMap();
        updateFilters(nextFilters);
        runAddressSearch(
            {
                type: "GU",
                buildingId: null,
                bjdongCd: district.sigunguCd,
                displayText: district.sggName,
                lat: null,
                lng: null,
            },
            nextFilters,
        );
    };

    // 등급·유형은 위치가 조건에 없다 — 이전 검색의 위치를 물려받지 않고 서울 전체를 다시 조회한다.
    const handleSelectGrade = (grade: string) => {
        const nextFilters = withCandidateConditions();

        onNavigateToMap();
        updateFilters(nextFilters);
        runCandidateSearch(nextFilters, grade);
    };

    // 리포트는 선택된 매물을 SearchContext에서 읽는다 — 관심목록에서 바로 열려면 그 건물 한 건을 먼저
    // 조회해 선택 상태로 만든다(지도 검색의 BUILDING 후보와 같은 경로).
    const handleOpenReport = (buildingId: string, address: string) => {
        runAddressSearch({
            type: "BUILDING",
            buildingId,
            bjdongCd: null,
            displayText: address,
            lat: null,
            lng: null,
        });
        onOpenReport();
    };

    const handleSelectBuildingType = (propertyTypes: string[]) => {
        const nextFilters = withCandidateConditions({
            propertyTypeFilters: propertyTypes.map((type) => ({
                type,
                areaMin: null,
                areaMax: null,
                expanded: false,
            })),
        });

        onNavigateToMap();
        updateFilters(nextFilters);
        runCandidateSearch(nextFilters, null);
    };

    return (
        <div className="dashboard">
            <div className="dashboard-head">
                <h3 className="dashboard-title">1차 조건 통과 건물</h3>
                {stats && (
                    <span className="dashboard-updated">분석 재계산 {formatComputedAt(stats.computedAt)}</span>
                )}
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-main">
                    {/* 구성안 §9 정보 흐름 — 로그인 직후에는 서비스 전체 현황보다 내 파이프라인을 먼저 본다.
                        ① KPI 요약 ② 관심목록 ③ 실측 진행 현황 순으로 두고, 집계 영역은 그 아래에 온다. */}
                    {nickname ? (
                        <>
                            <FavoriteKpiSection rows={favorites.rows} onGoToMap={onNavigateToMap} />
                            <FavoriteListSection
                                rows={favorites.rows}
                                failed={favorites.failed}
                                onReload={favorites.reload}
                                onGoToMap={onNavigateToMap}
                                onGoToReport={handleOpenReport}
                                onGoToAnalysis={(buildingId, address) =>
                                    onNavigateToAnalysis(buildingId, address)
                                }
                            />
                            <MeasurementProgressSection onGoToAnalysis={onNavigateToAnalysis} />
                        </>
                    ) : (
                        <section className="dashboard-card dashboard-personal">
                            <p className="dashboard-side-title">내 관심 현황</p>
                            <button type="button" className="dashboard-login-prompt" onClick={onRequestLogin}>
                                로그인하면 관심목록과 실측 진행 현황을 여기에서 볼 수 있습니다.
                            </button>
                        </section>
                    )}

                    {status === "loading" && (
                        <section className="dashboard-card dashboard-state">
                            <p className="dashboard-state-text">집계 결과를 불러오는 중입니다…</p>
                        </section>
                    )}

                    {status === "empty" && (
                        <section className="dashboard-card dashboard-state">
                            <p className="dashboard-state-text">분석 배치가 아직 실행되지 않았습니다.</p>
                            <p className="dashboard-card-note">
                                배치가 한 번 실행되면 후보 집계와 분포가 여기에 표시됩니다.
                            </p>
                        </section>
                    )}

                    {status === "error" && (
                        <section className="dashboard-card dashboard-state">
                            <p className="dashboard-state-text">집계 결과를 불러오지 못했습니다.</p>
                            <button type="button" className="dashboard-retry-btn" onClick={handleRetry}>
                                다시 시도
                            </button>
                        </section>
                    )}

                    {status === "ready" && stats && selected && (
                        <>
                            <CandidateSection
                                funnel={stats.funnel}
                                filters={stats.filters}
                                selected={selected}
                                selectionLabel={selectionLabel}
                                selection={narrowing}
                                onToggleNarrowing={handleToggleNarrowing}
                                onSelectDistrict={handleSelectDistrict}
                            />
                            <DistributionSection
                                selected={selected}
                                selectionLabel={selectionLabel}
                                onSelectGrade={handleSelectGrade}
                                onSelectBuildingType={handleSelectBuildingType}
                            />
                        </>
                    )}

                    <p className="dashboard-foot">
                        ReValue는 공개 데이터를 기반으로 <b>투자 참고 정보</b>를 제공합니다. 사업 추진 가능성이나
                        투자 수익을 보장하지 않으며, 최종 판단과 책임은 이용자에게 있습니다.
                    </p>
                </div>

                <aside className="dashboard-side">
                    <section className="dashboard-side-card">
                        <p className="dashboard-side-title">계정 정보</p>
                        {nickname ? (
                            <>
                                <p className="dashboard-account-nickname">{nickname}</p>
                                <div className="dashboard-account-actions">
                                    <button
                                        className="dashboard-edit-nickname-btn"
                                        onClick={() => setShowEditNicknameForm(true)}
                                    >
                                        회원정보 수정
                                    </button>
                                    <button
                                        className="dashboard-delete-account-btn"
                                        onClick={() => setShowDeleteAccountModal(true)}
                                    >
                                        회원탈퇴
                                    </button>
                                </div>
                            </>
                        ) : (
                            <button type="button" className="dashboard-login-prompt" onClick={onRequestLogin}>
                                로그인하면 계정 정보와 회원정보 수정을 이용할 수 있습니다.
                            </button>
                        )}
                    </section>

                    {status === "ready" && stats && (
                        <DataStatusPanel
                            dataStatus={stats.dataStatus}
                            undeterminedZone={stats.funnel.undeterminedZone}
                        />
                    )}
                </aside>
            </div>

            {showEditNicknameForm && <EditNicknameForm onClose={() => setShowEditNicknameForm(false)} />}
            {showDeleteAccountModal && (
                <DeleteAccountModal onClose={() => setShowDeleteAccountModal(false)} />
            )}
        </div>
    );
};

export default Dashboard;
