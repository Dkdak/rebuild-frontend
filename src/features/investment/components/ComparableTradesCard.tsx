import { CONFIDENCE_LABEL_SHORT, CONFIDENCE_PILL_TONE, type ComparableTrade, type ConfidenceLevel } from "../../market/api/marketApi";
import { formatManwon } from "../../search/api/searchApi";

// FEATURE_10_AI_REPORT.md §2.5(2026-08-10 신규 카드) — "비교 거래"(2026-08-17 "미래가치 산정 근거"로 개명,
// planning/rebuild/widgets/2026-08-17_business_analysis_confirmed_final.html 확정본 구조 개편). 새 API
// 불필요 — 이미 있는 market.postRemodelEstimatedPrice.comparableTrades를 재사용(§2.9 "유사 사례"가 흡수한
// 것과 같은 원본, MarketAnalysisPage.tsx TradeTable과 같은 데이터지만 이 카드는 별도로 최신순 5건만 보여준다).
// 2026-08-17 — 열을 4개(주소/거래가/거래일/면적)에서 3개(법정동/거래가/면적)로 축소, 표 하단 강조 배지
// 신규(확정본 그대로). "층"은 여전히 API에 없어(2026-08-10 실측 확인) 추가 안 함.
// 2026-08-17 같은 날 재정정("06 최종 확정 구조" §확정분) — (a) "거래일" 열을 다시 4개(법정동/거래가/거래일/
// 면적)로 복원 — 04 MarketAnalysisPage.tsx TradeTable과 열 구성 통일. (b) 결과박스에 계산식 2줄 추가 —
// perSqmPrice/area는 새 계산 아님, BusinessAnalysisPage.tsx가 이미 갖고 있던 futureValueUnitPrice/
// futureValueTargetArea(연면적+증축가능면적 — 04와 분모가 다름, 그쪽은 건물 자체 면적만) 그대로 전달.
interface ComparableTradesCardProps {
    comparableTrades: ComparableTrade[];
    comparableCount: number | null;
    // 2026-08-17 추가 — 표 하단 강조 배지("비교거래 기반 추정 미래가치 {금액} [신뢰도 배지]")용. 06 전체 공통
    // 규칙: A/B/C/D 등급이 아니라 confidenceLevel 원본 라벨(CONFIDENCE_LABEL_SHORT)만 사용.
    futureValue: number;
    confidenceLevel: ConfidenceLevel | null;
    perSqmPrice: number | null; // 미래가치 ㎡당가(BusinessAnalysisPage.tsx futureValueUnitPrice) — 계산식 2줄용
    area: number | null; // 대상면적(연면적+증축가능면적, futureValueTargetArea) — 계산식 2줄용
}

// 거래일 최신순 5건(MarketAnalysisPage.tsx TradeTable의 topFive와 같은 기준, 새 정렬 규칙 아님) — 정렬 기준
// 자체는 유지하되(최신 거래가 더 대표성 있음), 열 자체는 확정본대로 표시 안 함.
const recentFive = (trades: ComparableTrade[]): ComparableTrade[] =>
    [...trades].sort((a, b) => b.contractDate.localeCompare(a.contractDate)).slice(0, 5);

// MarketAnalysisPage.tsx의 동명 함수와 같은 규칙("YYYY-MM" → "YYYY년 M월") — 공용 모듈로 뽑지 않고 각 파일에
// 로컬로 둔 기존 관례(PropertyDetailContent.tsx도 같은 이름의 로컬 버전을 따로 둠) 그대로 따른다.
const formatContractMonth = (dateStr: string): string => {
    const [year, month] = dateStr.split("-");
    return year && month ? `${year}년 ${Number(month)}월` : dateStr;
};

const ComparableTradesCard = ({
    comparableTrades,
    comparableCount,
    futureValue,
    confidenceLevel,
    perSqmPrice,
    area,
}: ComparableTradesCardProps) => {
    if (comparableTrades.length === 0) {
        return <p className="right-panel-field-note">비교 가능한 유사 거래 없음</p>;
    }
    const trades = recentFive(comparableTrades);
    const tone = confidenceLevel != null && confidenceLevel !== "UNAVAILABLE" ? CONFIDENCE_PILL_TONE[confidenceLevel] : null;
    return (
        <>
            <p className="right-panel-card-subtitle">인근 유사 건물 최근 실거래 {trades.length}건</p>
            <div className="report-trade-table-wrap">
                <table className="report-trade-table">
                    <thead>
                        <tr>
                            <th>법정동</th>
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
                                <td>{formatContractMonth(trade.contractDate)}</td>
                                <td>{trade.area}㎡</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="right-panel-field-note report-basis-caption">전체 {comparableCount ?? trades.length}건 중 최근 {trades.length}건</p>
            {/* 2026-08-17 신규 — 표가 뒷받침하는 결론값을 표 바로 아래 강조 배지로(확정본 스타일: accent 박스,
                좌측 라벨/우측 값+신뢰도 칩). 2026-08-17 재구성 — 04 TradeTable과 같은 이유로 계산식 줄이 추가돼
                (report-comparable-value-badge)가 flex-direction:column — 라벨/값 한 줄은 -row 클래스로 감싼다. */}
            <div className="report-comparable-value-badge">
                <div className="report-comparable-value-badge-row">
                    <span>비교거래 기반 추정 미래가치</span>
                    <span className="report-comparable-value-badge-right">
                        <strong>{formatManwon(futureValue)}</strong>
                        {tone != null && confidenceLevel != null && (
                            <span className={`report-chip report-chip-${tone}`}>신뢰도 {CONFIDENCE_LABEL_SHORT[confidenceLevel]}</span>
                        )}
                    </span>
                </div>
                {comparableCount != null && (
                    <p className="report-comparable-value-badge-calc">추정 미래가치 = 비교거래 전체 {comparableCount}건의 ㎡당가 중앙값</p>
                )}
                {perSqmPrice != null && area != null && (
                    <p className="report-comparable-value-badge-calc">
                        {perSqmPrice.toLocaleString()}만원/㎡ × 연면적 {Math.round(area).toLocaleString()}㎡ ≈{" "}
                        <strong>미래가치 {formatManwon(futureValue)}</strong>
                    </p>
                )}
            </div>
            <p className="right-panel-field-note report-basis-caption">비교거래는 면적·용도·위치·거래시점을 고려해 선별합니다.</p>
        </>
    );
};

export default ComparableTradesCard;
