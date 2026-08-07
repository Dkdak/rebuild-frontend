import { formatEok } from "../../search/api/searchApi";
import type { PropertyAnalysis } from "../../search/api/analysisApi";

interface FutureValuePageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
}

// FEATURE_10_AI_REPORT.md §2.6 "미래 가치 예측" — 보수적/기준/낙관적 3-way, 전부 market.postRemodelEstimatedPrice
// 하나에서 나온다(2026-08-1x 정정 — estimatedPrice의 conservativeValue/optimisticValue는 "현재가" 시나리오라 다른
// 개념. 세대 기반 유형은 두 값이 같지만, 비세대기반 유형은 완화 단계가 달라 실제로 다른 숫자가 나올 수 있다,
// FEATURE_08_MARKET.md §3.9). comparableTrades 2건 미만이면 보수/낙관 범위가 불안정하다고 보고 기준값만 단일 노출.
// 2026-08-1x: 3칸 독립 카드(각각 큰 숫자만)에서 "건물정보"류 단일 카드 + right-panel-fact-list(라벨-값 한 줄)로
// 통일(사용자 피드백 — 스타일을 F-05/F-10 다른 카드들과 맞춰달라는 요청).
const FutureValuePage = ({ analysis, loading }: FutureValuePageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { market } = analysis;
    const postRemodel = market.postRemodelEstimatedPrice;
    const baseValue = postRemodel?.value ?? null;

    if (baseValue == null || postRemodel == null) {
        return (
            <section className="right-panel-card">
                <h5 className="right-panel-card-title">가치 시나리오</h5>
                <p className="right-panel-field-note">산출 불가</p>
            </section>
        );
    }

    const { conservativeValue, optimisticValue, comparableTrades } = postRemodel;
    const showThreeWay = comparableTrades.length >= 2 && conservativeValue != null && optimisticValue != null;

    return (
        <section className="right-panel-card">
            <h5 className="right-panel-card-title">
                가치 시나리오<span className="right-panel-estimate-tag">추정치 — 실측 견적 아님</span>
            </h5>
            {showThreeWay ? (
                <dl className="right-panel-fact-list">
                    <div>
                        <dt>보수적</dt>
                        <dd>{formatEok(conservativeValue)}</dd>
                    </div>
                    <div>
                        <dt>기준</dt>
                        <dd>{formatEok(baseValue)}</dd>
                    </div>
                    <div>
                        <dt>낙관적</dt>
                        <dd>{formatEok(optimisticValue)}</dd>
                    </div>
                </dl>
            ) : (
                <>
                    <dl className="right-panel-fact-list">
                        <div>
                            <dt>기준</dt>
                            <dd>{formatEok(baseValue)}</dd>
                        </div>
                    </dl>
                    <p className="right-panel-market-cell-aux">비교 거래가 적어 보수적·낙관적 범위는 생략(기준값만 표시)</p>
                </>
            )}
        </section>
    );
};

export default FutureValuePage;
