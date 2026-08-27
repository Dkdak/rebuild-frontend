import type { PricePositionField } from "../../report/api/reportApi";

// FEATURE_19 §1.1(CASE 2 — 04 시장 내 가격 위치) — STEP 4 입력칸 바로 아래 띠. "내가 시장 어디쯤에서 사는가"는
// 숫자만으로 안 보인다. 분포(하위25%·중위·상위25%)는 서버가 준 값 그대로이고, 프론트는 그 세 값을 눈금 삼아
// 마커 위치만 그린다(위치 판정은 서버의 thisPropertyPercentile을 쓴다).
interface PricePositionBarProps {
    pricePosition: PricePositionField | null;
    // 입력 중인 호가(만원, 총액) — 없으면 마커를 그리지 않는다.
    myTotalManwon: number | null;
    // 리포트 추정 매입가(만원, 총액) — 없으면 마커 이름만 쓴다. 프론트가 값을 만들지 않는다.
    estimateTotalManwon: number | null;
    // 총액 축을 못 쓸 때(세대수 결측 등) ㎡당 축으로 돌아가기 위한 환산 — 대장 연면적으로 나눈 값.
    perSqm: (manwon: number | null) => number | null;
}

const formatEok = (manwon: number) => `${Number((manwon / 10000).toFixed(1))}억`;
const formatPerSqm = (manwon: number) => `${Math.round(manwon).toLocaleString()}만원/㎡`;

// 세 눈금 사이를 구간별로 이어 붙인 축 — 하위25%가 왼쪽 끝, 중위가 가운데, 상위25%가 오른쪽 끝이다.
const positionOf = (value: number, p25: number, median: number, p75: number) => {
    if (value <= p25) return 0;
    if (value >= p75) return 100;
    if (value <= median) return median > p25 ? ((value - p25) / (median - p25)) * 50 : 0;
    return p75 > median ? 50 + ((value - median) / (p75 - median)) * 50 : 50;
};

const PricePositionBar = ({
    pricePosition,
    myTotalManwon,
    estimateTotalManwon,
    perSqm,
}: PricePositionBarProps) => {
    const position = pricePosition?.value;
    if (!position) return null;

    // 총액 분포가 있으면 그 축을 쓴다 — 사용자가 넣는 값이 총액이라 환산 없이 같은 축에 선다.
    // 세대수가 없어 총액이 null이면 ㎡당 축으로 돌아간다(그때만 호가를 연면적으로 나눈다).
    const totalAxis = position.p25Total != null && position.medianTotal != null && position.p75Total != null;
    const p25 = totalAxis ? (position.p25Total as number) : position.p25;
    const median = totalAxis ? (position.medianTotal as number) : position.median;
    const p75 = totalAxis ? (position.p75Total as number) : position.p75;
    const format = totalAxis ? formatEok : formatPerSqm;
    const myValue = totalAxis ? myTotalManwon : perSqm(myTotalManwon);
    const estimateValue = totalAxis ? estimateTotalManwon : perSqm(estimateTotalManwon);
    // 폴백 여부는 서버 판정을 그대로 쓴다 — 대표 실거래가 아예 없는 경우까지 잡는다.
    const { thisPropertyPercentile, estimateFallback } = position;
    // 실측 매입가가 들어가면 서버가 그 값 기준으로 위치를 다시 매긴다 — 그때 이 마커가 "내 호가"다.
    const serverLeft = Math.min(100, Math.max(0, thisPropertyPercentile));
    const myLeft = myValue != null ? positionOf(myValue, p25, median, p75) : null;

    return (
        <div className="analysis-price-position">
            <div className="analysis-price-position-marks">
                {!estimateFallback && (
                    <span className="is-estimate" style={{ left: `${serverLeft}%` }}>
                        {pricePosition.measured ? "실측" : "추정"}
                        {estimateValue != null ? ` ${format(estimateValue)}` : ""}
                    </span>
                )}
                {myLeft != null && myValue != null && (
                    <span className="is-mine" style={{ left: `${myLeft}%` }}>
                        내 호가 {format(myValue)}
                    </span>
                )}
            </div>
            <div className="analysis-price-position-band">
                <i className="is-low" />
                <i className="is-mid" />
                <i className="is-high" />
                {!estimateFallback && <u className="is-estimate" style={{ left: `${serverLeft}%` }} />}
                {myLeft != null && <u className="is-mine" style={{ left: `${myLeft}%` }} />}
            </div>
            <div className="analysis-price-position-ticks">
                <span>하위25% {format(p25)}</span>
                <span>중위 {format(median)}</span>
                <span>상위25% {format(p75)}</span>
            </div>
        </div>
    );
};

export default PricePositionBar;
