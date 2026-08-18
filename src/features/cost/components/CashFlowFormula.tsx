// FEATURE_10_AI_REPORT.md §2.5, 2026-08-17 "06 사업성 분석" 구조 개편 — "현금흐름"(텍스트 산식 나열)을
// "투자금 흐름"(SVG 워터폴)으로 재도입. 좌표·색상·최소 높이 클램프는 planning/rebuild/widgets/
// 2026-08-17_business_analysis_confirmed_final.html 확정본을 그대로 역산 — 임의로 새로 그리지 않음.
// 이 컴포넌트는 한 번 세로 막대였다가("구 CashFlowWaterfall") "매도가가 다른 항목을 압도해 작은 막대가
// 트랙에 묻힌다"는 이유로 텍스트 나열로 교체됐던 이력이 있다 — 이번엔 최소 높이 클램프(MIN_BAR_HEIGHT)를
// 둬서 같은 문제가 재발하지 않게 한다.
// 막대 6개, 두 종류로 나뉜다: "절대" 막대(매입가/총투자금/미래가치, 0부터 그린다)와 "증분" 막대(부대비용/
// 공사비/예상차익, 앞 누적값 위에 떠 있다 — top은 항상 그 시점 누적 총액의 스케일 위치, height는 자기
// 값(또는 클램프된 최소값)만큼 아래로). 공사비/총투자금/차익은 원래 min~max 범위값이지만, 막대는 대표값
// (remodelCostBase 등)으로 그리고 범위는 막대 아래 작은 숫자로 별도 표기(확정본과 동일 — 매입가·미래가치는
// 점추정이라 범위 캡션 없음).
interface CashFlowFormulaProps {
    buyPrice: number; // 매입가(만원)
    acquisitionCost: number; // 부대비용(만원)
    cost: number; // 대표(적정) 공사비(만원) — remodelCostBase
    costMin: number; // 공사비 최소(만원, 범위 캡션용)
    costMax: number; // 공사비 최대(만원, 범위 캡션용)
    investMin: number; // 총 투자금 최소(만원, 범위 캡션용)
    investMax: number; // 총 투자금 최대(만원, 범위 캡션용)
    futureValue: number; // 미래가치(만원) — profitAnalysis.value
    gainMin: number; // 예상 차익 최소(만원, 범위 캡션용)
    gainMax: number; // 예상 차익 최대(만원, 범위 캡션용)
}

// SVG 좌표계 — 확정본 viewBox 그대로(420×236). 반응형은 <svg width="100%">가 처리(뷰박스 내부 좌표는 고정).
const VIEW_W = 420;
const VIEW_H = 236;
const BASELINE_Y = 182;
const TOP_MARGIN = 22; // 가장 큰 막대의 top 여백(그 위 값 라벨 자리)
const MAX_BAR_HEIGHT = BASELINE_Y - TOP_MARGIN; // 160
const BAR_W = 46;
const GAP = 16;
const STEP = BAR_W + GAP; // 62
const START_X = 24;
const MIN_BAR_HEIGHT = 8; // 최소 높이 클램프 — 부대비용처럼 작은 값도 막대가 완전히 안 사라지게(확정본 실측값).
const CORNER_R = 3;

// searchApi.ts formatCurrency와 같은 표기 규칙(억 소수1자리+천단위 쉼표, docs/CONTENT_TAXONOMY.md §2 "A. 값")
// — SVG <text>는 formatManwon처럼 "억"/"만원" 단위 분기가 필요 없어(전부 억 단위 칸이라 단위 텍스트를 이미
// 축에 별도 표기) 숫자만 반환하는 얇은 버전을 둔다.
const formatEok = (manwon: number): string =>
    (manwon / 10_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const CashFlowFormula = ({
    buyPrice,
    acquisitionCost,
    cost,
    costMin,
    costMax,
    investMin,
    investMax,
    futureValue,
    gainMin,
    gainMax,
}: CashFlowFormulaProps) => {
    const investTotal = buyPrice + acquisitionCost + cost;
    const gain = futureValue - investTotal;
    const gainLabel = gain >= 0 ? "예상 차익" : "예상 손실";
    // 2026-08-17 신규(planning/rebuild/widgets/2026-08-17_cashflow_card_formula_final.html 확정본) — SVG
    // 아래 계산식 캡션 3줄. 예상 차익/ROI는 새 계산 아님 — 위 gain/investTotal(막대와 같은 대표값) 재사용.
    const roi = investTotal > 0 ? (gain / investTotal) * 100 : 0;

    // 스케일 — "절대" 막대 3개(매입가/총투자금/미래가치) 중 최댓값이 트랙 전체 높이(MAX_BAR_HEIGHT)를 채운다.
    const scaleBase = Math.max(buyPrice, investTotal, futureValue, 1);
    const scale = MAX_BAR_HEIGHT / scaleBase;
    const barHeight = (value: number) => Math.max(value * scale, 0);
    const barTopFor = (value: number) => BASELINE_Y - barHeight(value);

    // 절대 막대 3개 — 0부터 그린다(높이 자체가 값의 스케일, 클램프 없음 — 0이 곧 "막대 없음"이 맞는 값이라서).
    const buyTop = barTopFor(buyPrice);
    const investTotalTop = barTopFor(investTotal);
    const futureValueTop = barTopFor(futureValue);

    // 증분 막대 2개(부대비용/공사비) — top은 그 시점 누적 총액 위치, height는 자기 값(클램프 적용)만큼.
    const afterAcquisitionTop = barTopFor(buyPrice + acquisitionCost);
    const acquisitionHeight = Math.max(barHeight(acquisitionCost), MIN_BAR_HEIGHT);
    const afterCostTop = barTopFor(buyPrice + acquisitionCost + cost);
    const costHeight = Math.max(barHeight(cost), MIN_BAR_HEIGHT);

    // 증분 막대(예상 차익) — 음수(손실)면 investTotal이 더 높은 지점, 양수(차익)면 futureValue가 더 높은
    // 지점에서 시작해 아래로 자기 값만큼(클램프 적용) 그린다 — 부호 무관하게 일반화한 공식.
    const gainTop = Math.min(investTotalTop, futureValueTop); // 더 높은(y가 작은) 쪽
    const gainHeight = Math.max(barHeight(Math.abs(gain)), MIN_BAR_HEIGHT);

    const x = (index: number) => START_X + index * STEP;

    return (
        <>
            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                width="100%"
                height={VIEW_H}
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="투자금 흐름 워터폴 차트"
            >
            <line x1={x(0) - 12} y1={BASELINE_Y} x2={x(5) + BAR_W + 12} y2={BASELINE_Y} stroke="var(--border)" strokeWidth={1} />

            {/* 매입가 → 부대비용 연결 가이드선(매입가 top 높이에서 부대비용 칸까지) */}
            <line x1={x(0) + BAR_W} y1={buyTop} x2={x(1)} y2={buyTop} stroke="var(--text-muted)" strokeWidth={0.8} strokeDasharray="3 2" />
            {/* 부대비용 → 공사비 */}
            <line
                x1={x(1) + BAR_W}
                y1={afterAcquisitionTop}
                x2={x(2)}
                y2={afterAcquisitionTop}
                stroke="var(--text-muted)"
                strokeWidth={0.8}
                strokeDasharray="3 2"
            />
            {/* 공사비 → 총투자금(같은 누적 총액 지점이라 총투자금 막대 top과 일치) */}
            <line
                x1={x(2) + BAR_W}
                y1={afterCostTop}
                x2={x(3)}
                y2={afterCostTop}
                stroke="var(--text-muted)"
                strokeWidth={0.8}
                strokeDasharray="3 2"
            />
            {/* 총투자금 → 예상차익(아래쪽 연결 기준선, 미래가치 칸은 건너뛴다) */}
            <line
                x1={x(3) + BAR_W}
                y1={investTotalTop}
                x2={x(5)}
                y2={investTotalTop}
                stroke="var(--text-muted)"
                strokeWidth={0.8}
                strokeDasharray="3 2"
            />
            {/* 미래가치 → 예상차익(위쪽 연결 기준선) */}
            <line
                x1={x(4) + BAR_W}
                y1={futureValueTop}
                x2={x(5)}
                y2={futureValueTop}
                stroke="var(--text-muted)"
                strokeWidth={0.8}
                strokeDasharray="3 2"
            />

            {/* 1. 매입가 */}
            <rect x={x(0)} y={buyTop} width={BAR_W} height={BASELINE_Y - buyTop} rx={CORNER_R} fill="#8FB4DA" />
            <text x={x(0) + BAR_W / 2} y={buyTop - 6} fontSize={11} fontWeight={700} fill="var(--text-h)" textAnchor="middle">
                {formatEok(buyPrice)}
            </text>
            <text x={x(0) + BAR_W / 2} y={198} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
                매입가
            </text>

            {/* 2. 부대비용(증분) */}
            <rect x={x(1)} y={afterAcquisitionTop} width={BAR_W} height={acquisitionHeight} rx={1.5} fill="#B3CBE4" />
            <text x={x(1) + BAR_W / 2} y={afterAcquisitionTop - 6} fontSize={11} fontWeight={700} fill="var(--text-h)" textAnchor="middle">
                +{formatEok(acquisitionCost)}
            </text>
            <text x={x(1) + BAR_W / 2} y={198} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
                부대비용
            </text>

            {/* 3. 공사비(증분) — 범위 캡션 있음(costMin~costMax) */}
            <rect x={x(2)} y={afterCostTop} width={BAR_W} height={costHeight} rx={1.5} fill="#D8BE7C" />
            <text x={x(2) + BAR_W / 2} y={afterCostTop - 6} fontSize={11} fontWeight={700} fill="var(--text-h)" textAnchor="middle">
                +{formatEok(cost)}
            </text>
            <text x={x(2) + BAR_W / 2} y={198} fontSize={11} fill="var(--text-muted)" textAnchor="middle">
                공사비
            </text>
            <text x={x(2) + BAR_W / 2} y={210} fontSize={9.5} fill="var(--text-muted)" textAnchor="middle">
                {formatEok(costMin)}~{formatEok(costMax)}
            </text>

            {/* 4. 총 투자금(절대) — 범위 캡션 있음(investMin~investMax) */}
            <rect x={x(3)} y={investTotalTop} width={BAR_W} height={BASELINE_Y - investTotalTop} rx={CORNER_R} fill="#4A7EB0" />
            <text x={x(3) + BAR_W / 2} y={investTotalTop - 6} fontSize={11.5} fontWeight={800} fill="var(--text-h)" textAnchor="middle">
                {formatEok(investTotal)}
            </text>
            <text x={x(3) + BAR_W / 2} y={198} fontSize={11} fontWeight={700} fill="var(--text-muted)" textAnchor="middle">
                총 투자금
            </text>
            <text x={x(3) + BAR_W / 2} y={210} fontSize={9.5} fill="var(--text-muted)" textAnchor="middle">
                {formatEok(investMin)}~{formatEok(investMax)}
            </text>

            {/* 5. 미래가치(절대) */}
            <rect x={x(4)} y={futureValueTop} width={BAR_W} height={BASELINE_Y - futureValueTop} rx={CORNER_R} fill="#6FA86F" />
            <text x={x(4) + BAR_W / 2} y={futureValueTop - 6} fontSize={11.5} fontWeight={800} fill="var(--text-h)" textAnchor="middle">
                {formatEok(futureValue)}
            </text>
            <text x={x(4) + BAR_W / 2} y={198} fontSize={11} fontWeight={700} fill="var(--text-muted)" textAnchor="middle">
                예상 미래가치
            </text>

            {/* 6. 예상 차익/손실(증분) — 범위 캡션 있음(gainMin~gainMax), 손실이면 톤을 danger 계열로. */}
            <rect x={x(5)} y={gainTop} width={BAR_W} height={gainHeight} rx={CORNER_R} fill={gain >= 0 ? "#9CC98A" : "#E5A3A3"} />
            <text
                x={x(5) + BAR_W / 2}
                y={gainTop - 6}
                fontSize={11.5}
                fontWeight={800}
                fill={gain >= 0 ? "#27500a" : "#854f0b"}
                textAnchor="middle"
            >
                {gain >= 0 ? "+" : "−"}
                {formatEok(Math.abs(gain))}
            </text>
            <text x={x(5) + BAR_W / 2} y={198} fontSize={11} fontWeight={700} fill={gain >= 0 ? "#27500a" : "#854f0b"} textAnchor="middle">
                {gainLabel}
            </text>
            <text x={x(5) + BAR_W / 2} y={210} fontSize={9.5} fill="var(--text-muted)" textAnchor="middle">
                {formatEok(gainMin)}~{formatEok(gainMax)}
            </text>

            <text x={x(0) - 12} y={228} fontSize={9.5} fill="var(--text-muted)">
                단위: 억원 · 막대는 기준값(부대비용·공사비는 최소높이 적용), 아래 숫자는 추정 범위
            </text>
            </svg>
            <hr className="right-panel-card-divider" />
            {/* 계산식 3줄. 2026-08-17 — 부대비용 줄에 "추정" 배지를 달았던 건 취득세율이 4.9%(단순화된 고정
                요율)로 근사되어 있던 "Open Item" 계산 버그 때문이었다(지방교육세0.4%+농특세0.2% 누락). 같은 날
                그 버그가 해결되며(calcAcquisitionCost, analysisApi.ts, 주택 외 분기 5.5%로 정정) 이 줄도 다른
                두 줄(예상 차익/ROI)과 같은 확정 로직이 됐다는 판단으로 배지를 제거 — 문구도 "4.9%(취득세4%+
                중개보수0.9%)"에서 "5.5%(취득세4%+지방교육세0.4%+농특세0.2%+중개보수0.9%)"로 갱신. */}
            {/* 2026-08-18 product 전달 — 이 5.5% 공식이 주택 외(상업업무용 등) 전용이라는 게 괄호 안에서 "개인
                1주택자·표준세율 기준"까지만 읽히고 주택 유형은 다른 공식(취득세 구간별 누진+중개보수만)이 쓰인다는
                사실이 캡션에 빠져 있었다 — 누락 문장 추가(주택 유형 자체 계산은 그대로, 이 캡션은 어차피 이
                섹션의 baseValue 대상인 "주택 외" 값만 설명하니 계산 로직 변경 없음). */}
            <p className="right-panel-field-note">
                부대비용 = 현재가치 × 5.5%(취득세4%+지방교육세0.4%+농특세0.2%+중개보수0.9%, 개인 1주택자·표준세율 기준.
                주택은 취득세·중개보수만 구간별 반영)
            </p>
            <p className="right-panel-field-note report-cashflow-calc-line">
                {gainLabel} = 예상 미래가치 − 총 투자금 = {formatEok(futureValue)}억 − {formatEok(investTotal)}억 ≈{" "}
                {gain >= 0 ? "" : "−"}
                {formatEok(Math.abs(gain))}억
            </p>
            <p className="right-panel-field-note report-cashflow-calc-line">
                예상 ROI = {gainLabel} ÷ 총 투자금 × 100 ≈ <strong>{roi.toFixed(1)}%</strong>
            </p>
        </>
    );
};

export default CashFlowFormula;
