import type { ReactNode } from "react";
import { formatManwon } from "../../search/api/searchApi";
import { displayGainRange, GAIN_LABEL, gainSign } from "../../investment/api/analysisApi";

// FEATURE_10_AI_REPORT.md §2.5 — 매입가+부대비용+공사비=총투자금, 매도가-총투자금=예상차익을 산식 그대로 나열한다.
// 2026-08-1x: 세로 막대 비교(구 CashFlowWaterfall)는 매도가(수십억)가 공사비·예상차익(한 자릿수 억)을
// 압도해 공유 축에서 작은 막대가 트랙에 묻히고, 범위 막대(공사비)는 시작점 라벨이 없어 뭘 보는지 알 수
// 없었다(사용자 피드백 "해석을 못하겠는데, 눈에 띄지도 않고...") — 그래프 비교가 안 맞는 데이터라 판단해
// 산식을 그대로 읽는 흐름으로 교체.
// 2026-08-10 — "부대비용"(취득세+중개보수) 단계 추가, 각 행 앞에 아이콘(●) 리스트 마커. investMin/investMax는
// 이제 컴포넌트 내부에서 다시 더하지 않고 analysisApi.ts buildProfitAnalysis가 계산한 값을 그대로 받는다 —
// 부대비용이 formula에 반영된 뒤로 buyPrice+cost만으로 재계산하면 총투자금이 실제 값보다 부대비용만큼
// 작게 나와 예상차익(같은 profitAnalysis.gainMin/Max)과 안 맞을 수 있어서(단일 소스 원칙).
interface CashFlowFormulaProps {
    buyPrice: number; // 매입가(만원)
    acquisitionCost: number; // 부대비용(만원)
    costMin: number; // 공사비 최소(만원)
    costMax: number; // 공사비 최대(만원)
    investMin: number; // 총 투자금 최소(만원) — buildProfitAnalysis 계산값 그대로
    investMax: number; // 총 투자금 최대(만원)
    sellPrice: number; // 매도가 = 리모델링 후 예상 시세(만원)
    gainMin: number; // 예상 차익 최소(만원)
    gainMax: number; // 예상 차익 최대(만원)
}

// 2026-08-10 — 불릿(●) 아이콘 제거(§2.5 문서 확정). label만 남아 report-cashflow-flow-row-left 그룹핑
// (justify-content:space-between이 [좌: 라벨] vs [우: 값] 2단을 유지하는 용도)은 그대로 필요.
const FlowRow = ({ className = "", label, value }: { className?: string; label: string; value: ReactNode }) => (
    <div className={`report-cashflow-flow-row ${className}`.trim()}>
        <span className="report-cashflow-flow-row-left">
            <span className="report-cashflow-flow-label">{label}</span>
        </span>
        <span className="report-cashflow-flow-value">{value}</span>
    </div>
);

const CashFlowFormula = ({
    buyPrice,
    acquisitionCost,
    costMin,
    costMax,
    investMin,
    investMax,
    sellPrice,
    gainMin,
    gainMax,
}: CashFlowFormulaProps) => {
    // 2026-08-17 — positive/negative/neutral 3분기 자체는 그대로(CSS 톤 클래스용), analysisApi.ts의 공유
    // gainSign()으로 옮기고 라벨·부호 표시까지 같은 판정을 재사용(중복 정의 금지).
    const sign = gainSign(gainMin, gainMax);
    const [gainLo, gainHi] = displayGainRange(gainMin, gainMax, sign);

    return (
        <div className="report-cashflow-flow">
            <FlowRow label="매입가" value={formatManwon(buyPrice)} />
            <div className="report-cashflow-flow-op" aria-hidden="true">
                +
            </div>
            <FlowRow label="부대비용" value={formatManwon(acquisitionCost)} />
            <div className="report-cashflow-flow-op" aria-hidden="true">
                +
            </div>
            <FlowRow label="공사비" value={`${formatManwon(costMin)} ~ ${formatManwon(costMax)}`} />
            <div className="report-cashflow-flow-op" aria-hidden="true">
                =
            </div>
            <FlowRow
                className="report-cashflow-flow-row-total"
                label="총 투자금"
                value={`${formatManwon(investMin)} ~ ${formatManwon(investMax)}`}
            />

            <div className="report-cashflow-flow-divider" />

            <FlowRow label="매도가" value={formatManwon(sellPrice)} />
            <div className="report-cashflow-flow-op" aria-hidden="true">
                −
            </div>
            <FlowRow label="총 투자금" value={`${formatManwon(investMin)} ~ ${formatManwon(investMax)}`} />
            <div className="report-cashflow-flow-op" aria-hidden="true">
                =
            </div>
            <FlowRow
                className={`report-cashflow-flow-row-result report-cashflow-flow-${sign}`}
                label={GAIN_LABEL[sign]}
                value={`${formatManwon(gainLo)} ~ ${formatManwon(gainHi)}`}
            />
        </div>
    );
};

export default CashFlowFormula;
