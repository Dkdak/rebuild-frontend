import type { DashboardDataStatus } from "../api/dashboardApi";
import { formatCount } from "../data/dashboardStats";

// 사이드 컬럼 — 데이터 기준일과 매칭 품질. "진행 중 개발행위 없음"은 인허가 허가일 시점 기준이라, 그 이후의
// 개발행위는 반영되지 않을 수 있다는 점을 기준일 카드에서 함께 밝힌다.
const toDate = (isoDateTime: string) => isoDateTime.slice(0, 10);

const toRatio = (matched: number, total: number) =>
    total > 0 ? `${((matched / total) * 100).toFixed(1)}%` : "—";

interface DataStatusPanelProps {
    dataStatus: DashboardDataStatus;
    undeterminedZone: number;
}

const DataStatusPanel = ({ dataStatus, undeterminedZone }: DataStatusPanelProps) => (
    <>
        <section className="dashboard-side-card">
            <p className="dashboard-side-title">데이터 기준일</p>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">실거래가</span>
                <span className="dashboard-side-value">{dataStatus.tradeLatestContractDate}</span>
            </div>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">건축인허가</span>
                <span className="dashboard-side-value">
                    {dataStatus.permitLatestDate}
                    <em> 허가일 기준</em>
                </span>
            </div>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">분석 재계산</span>
                <span className="dashboard-side-value">{toDate(dataStatus.lastBatchRun)}</span>
            </div>
            <p className="dashboard-note">
                후보 정의의 <b>"진행 중 개발행위 없음"은 인허가 허가일 {dataStatus.permitLatestDate} 시점 기준</b>
                입니다. 인허가는 지연이 있어 그 이후의 개발행위는 반영되지 않을 수 있습니다.
            </p>
        </section>

        <section className="dashboard-side-card">
            <p className="dashboard-side-title">데이터 상태</p>
            <div className="dashboard-warnbox">
                <b>증축 여력 미산출 {formatCount(undeterminedZone)}동</b>
                <br />
                토지이용계획에서 용도지역을 찾지 못한 건물입니다. 추진 요건은 통과해 후보에서 탈락하지 않고
                미산출 상태로 남습니다.
            </div>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">토지이용계획 매칭</span>
                <span className="dashboard-side-value">
                    {toRatio(dataStatus.matching.landuseMatched, dataStatus.matching.landuseTotal)}
                </span>
            </div>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">인허가 매칭</span>
                <span className="dashboard-side-value">
                    {toRatio(dataStatus.matching.permitMatched, dataStatus.matching.permitTotal)}
                </span>
            </div>
            <div className="dashboard-side-row">
                <span className="dashboard-side-key">실거래 건물 매칭</span>
                <span className="dashboard-side-value">
                    {toRatio(dataStatus.matching.tradeBuildingMatched, dataStatus.matching.tradeBuildingTotal)}
                </span>
            </div>
        </section>
    </>
);

export default DataStatusPanel;
