import { type ComparableTrade } from "../../market/api/marketApi";
import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5(2026-08-10 신규 카드) — "비교 거래". 새 API 불필요 — 이미 있는
// market.postRemodelEstimatedPrice.comparableTrades를 재사용(§2.9 "유사 사례"가 흡수한 것과 같은 원본,
// MarketAnalysisPage.tsx TradeTable과 같은 데이터지만 이 카드는 별도로 최신순 5건만 보여준다).
// 2026-08-10 — 스펙엔 "층"도 5번째 열로 있었지만 ComparableTrade(marketApi.ts)에도 실제 API 응답에도
// floor 필드 자체가 없다(실측 확인, 2026-08-10 curl로 재확인) — 지어내지 않고 4열(주소/거래가/거래일/면적)만
// 렌더링, 백엔드에 필드 추가 요청 별도 진행.
interface ComparableTradesCardProps {
    comparableTrades: ComparableTrade[];
    comparableCount: number | null;
}

const formatContractDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split("-");
    return year && month && day ? `${year}년 ${Number(month)}월 ${Number(day)}일` : dateStr;
};

// 거래일 최신순 5건(MarketAnalysisPage.tsx TradeTable의 topFive와 같은 기준, 새 정렬 규칙 아님).
const recentFive = (trades: ComparableTrade[]): ComparableTrade[] =>
    [...trades].sort((a, b) => b.contractDate.localeCompare(a.contractDate)).slice(0, 5);

const ComparableTradesCard = ({ comparableTrades, comparableCount }: ComparableTradesCardProps) => {
    if (comparableTrades.length === 0) {
        return <p className="right-panel-field-note">비교 가능한 유사 거래 없음</p>;
    }
    const trades = recentFive(comparableTrades);
    return (
        <>
            <div className="report-trade-table-wrap">
                <table className="report-trade-table">
                    <thead>
                        <tr>
                            <th>주소(법정동)</th>
                            <th>거래가</th>
                            <th>거래일</th>
                            <th>면적</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trades.map((trade, index) => (
                            // eslint-disable-next-line react/no-array-index-key -- 동일 동/면적/가격 거래가 같은 날 여러 건일 수 있어 index를 섞는다.
                            <tr key={`${trade.dong}-${trade.contractDate}-${index}`}>
                                <td>{trade.dong}</td>
                                <td>{formatManwon(trade.price)}</td>
                                <td>{formatContractDate(trade.contractDate)}</td>
                                <td>{trade.area}㎡</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="right-panel-field-note report-basis-caption">
                전체 {comparableCount ?? trades.length}건 중 최근 {trades.length}건
            </p>
        </>
    );
};

export default ComparableTradesCard;
