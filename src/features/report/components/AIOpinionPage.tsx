import { getLiquidity } from "../../market/api/marketApi";
import type { PriceDisplayLabel } from "../../market/api/marketApi";
import {
    GRADE_LABEL,
    RECOMMENDATION_TONE,
    type InvestmentGrade,
    type PropertyAnalysis,
    type RiskChecklist,
} from "../../investment/api/analysisApi";
import CardSubHeading from "../../../shared/components/CardSubHeading";

// FEATURE_10_OPINION.md "07 투자 종합 의견" — 2026-08-17 전면 재설계(2차 재정정, planning/rebuild/widgets/
// 2026-08-17_opinion_reference_comparison.html 확정본). 새 데이터 없음: 3카드 중 첫 카드의 등급·검토우선순위
// 배지만 01/F-09(analysisApi.ts getRecommendation, §3.3 투자등급×시세신뢰도 매트릭스)가 이미 계산한 값을
// 재사용 — 나머지(AI 서술 문단·확인사항·종합 의견)는 그 사실들을 근거로 한 신규 해석/서술이다.
// 01과 07의 역할 구분(문서 §확정분): 01=사실 나열, 07=그 사실을 근거로 한 판단(해석·행동·결론) — 01의
// 현재가·미래가치·ROI·유리한조건·확인사항 리스트는 여기서 다시 보여주지 않는다(숫자 재사용 아님, ReportPage.tsx가
// 이미 계산해 둔 recommendation/priceConfidenceLabel/hasStrengths/riskChecklist 4개 파생값만 근거로 받는다).
interface AIOpinionPageProps {
    analysis: PropertyAnalysis | null;
    loading: boolean;
    recommendation: string; // 검토 우선순위 — ReportPage.tsx의 getRecommendation() 결과 재사용(재계산 안 함)
    priceConfidenceLabel: PriceDisplayLabel | null; // 미래가치 신뢰도 라벨 — ReportPage.tsx에서 이미 계산, 재사용
    hasStrengths: boolean; // 01 "유리한 조건" 존재 여부 — ReportPage.tsx의 strengths 배열 재사용
    riskChecklist: RiskChecklist | null; // 지구/구역 규제 여부(districtRisk) 판단용 — ReportPage.tsx에서 이미 계산
}

// 종합 판단 카드 문단1 — 등급별 개발여력·노후도 평가 어투(레퍼런스 "A등급 · 추가 확인" 예시 문단이 템플릿).
const GRADE_OPINION_INTRO: Record<InvestmentGrade, string> = {
    A: "개발 여력과 노후도 측면에서는 투자 검토 가치가 높은 것으로 평가됩니다.",
    B: "개발 여력과 노후도 측면에서는 투자 검토 가치가 있는 것으로 평가됩니다.",
    C: "개발 여력·노후도 측면에서 투자 검토 우선순위는 중간 수준으로 평가됩니다.",
    D: "개발 여력·노후도 측면에서 투자 검토 우선순위가 낮은 것으로 평가됩니다.",
    NA: "개발 여력 판단에 필요한 데이터가 부족해 투자등급을 산정하지 못했습니다.",
};

// 확인사항 카드 — 레퍼런스 6항목 그대로 채택(문서 §확정분), 1번(지구단위계획)만 지구/구역 지정이 있는
// 매물에서만 노출(riskChecklist.districtRisk.ok===false). <ol>이 배열 길이에 맞춰 자동 재넘버링하므로
// 1번이 빠지면 나머지가 자연스럽게 1번부터 다시 매겨진다(별도 처리 불필요).
const buildChecklistItems = (hasDistrictRegulation: boolean): string[] => [
    ...(hasDistrictRegulation ? ["지구단위계획·높이제한 등 규제 세부내용 확인"] : []),
    "건축사 사전검토를 통한 실제 증축 가능 연면적·설계 조건 확인",
    "리모델링 실제 공사비 견적 확인(공사비는 시장 단가 기반 추정)",
    "인근 유사 규모·용도 건물의 최근 거래사례 추가 검증",
    "취득·보유·매각 세금 및 금융비용을 반영한 ROI 재계산",
    "임대수요·공실률·임대수익 및 실제 매각 가능성 추가 검토",
];

// 종합 의견 카드 — 검토우선순위(getRecommendation 출력값 5종) → 완결 문장. "추가 확인" 항목은 레퍼런스 예시
// 문단 그대로, 나머지 4종은 같은 어투로 새로 작성(문서 §확정분 "2번은 근거를 종합한 해석, 4번은 그 결론만").
const CONCLUSION_TEXT: Record<string, { lead: string; detail: string }> = {
    "적극 검토": {
        lead: '이 매물은 "적극 검토" 단계입니다.',
        detail: "투자등급·시세 신뢰도 모두 양호해 적극적으로 검토를 진행할 만합니다. 다만 아래 확인사항을 거쳐 세부 조건을 검증한 뒤 최종 결정하시길 권장합니다.",
    },
    검토: {
        lead: '이 매물은 "검토" 단계입니다.',
        detail: "투자 검토를 진행할 만한 단계입니다. 아래 확인사항을 통해 세부 조건을 검증한 뒤 결정하시길 권장합니다.",
    },
    "추가 확인": {
        lead: '이 매물은 "추가 확인" 단계입니다.',
        detail: "규제·비용 변수의 불확실성이 해소되기 전까지는 투자 확정보다 단계적 검토를 권장합니다.",
    },
    보류: {
        lead: '이 매물은 "보류" 단계입니다.',
        detail: "현재 데이터 기준으로는 투자 확정을 보류하고, 등급·시세 근거가 보강된 이후 재검토하시길 권장합니다.",
    },
    "판단 불가": {
        lead: '이 매물은 "판단 불가" 단계입니다.',
        detail: "투자등급 또는 시세 신뢰도 산정에 필요한 데이터가 부족해 현재로서는 판단하기 어렵습니다. 추가 데이터 확보 후 재조회를 권장합니다.",
    },
};

const AIOpinionPage = ({ analysis, loading, recommendation, priceConfidenceLabel, hasStrengths, riskChecklist }: AIOpinionPageProps) => {
    if (loading) {
        return <p className="right-panel-field-note">조회 중...</p>;
    }
    if (analysis == null) {
        return <p className="right-panel-field-note">정보 없음</p>;
    }

    const { grade, market } = analysis;
    const hasDistrictRegulation = riskChecklist != null && !riskChecklist.districtRisk.ok;
    const tradeActivity = market.tradeActivity;
    const liquidity = tradeActivity != null ? getLiquidity(tradeActivity.recent1yCount) : null;

    // 종합 판단 문단1 — 등급 템플릿 + 유리한 조건(strengths) 존재 여부. NA는 등급 자체가 없어 강점 문구를 안 붙인다.
    const strengthsClause = hasStrengths ? "확인된 긍정 요인도 있습니다." : "다만 뚜렷한 긍정 요인은 확인되지 않았습니다.";
    const paragraph1 = grade === "NA" ? GRADE_OPINION_INTRO.NA : `${GRADE_OPINION_INTRO[grade]} ${strengthsClause}`;

    // 문단2 — "왜 이 등급인데 바로 투자 확정이 아닌지"(문서 §확정분 핵심 초점). NA는 등급 근거 자체가 없어 생략.
    const confidenceText = priceConfidenceLabel ?? "산출 불가";
    const districtClause = hasDistrictRegulation ? "지구·구역 규제가 확인되고, " : "";
    const liquidityClause = tradeActivity != null ? `(최근 1년 거래 ${tradeActivity.recent1yCount}건, 시장 유동성 ${liquidity})` : "";
    const paragraph2 =
        grade === "NA"
            ? null
            : `이 등급을 뒷받침하는 현재 시세·미래가치는 비교거래 기반 추정값이며, ${districtClause}미래가치 신뢰도는 ${confidenceText}입니다${liquidityClause}. ${GRADE_LABEL[grade]}등급이라는 결과만으로 바로 투자를 확정하기보다, 그 근거가 되는 규제·비용·시장가격을 먼저 확인할 필요가 있습니다.`;

    const conclusion = CONCLUSION_TEXT[recommendation] ?? CONCLUSION_TEXT["판단 불가"];
    const checklistItems = buildChecklistItems(hasDistrictRegulation);

    return (
        <>
            <p className="report-opinion-subtitle">
                매수·매도를 직접 권고하는 투자자문이 아니라, 데이터 기반 검토 우선순위를 제시합니다.
            </p>

            <section className="right-panel-card">
                {/* 2026-08-18 product 전달(docs/FEATURE.md §8.24) — CardSubHeading으로 번호 부여(07은 그동안
                    번호 없이 플레인 제목이었음, 이번에 처음 부여). */}
                <CardSubHeading number={1} title="종합 판단" />
                <div className="report-opinion-grade-row">
                    <span className={`report-opinion-grade grade-color-${grade}`}>{GRADE_LABEL[grade]}</span>
                    <span className={`report-chip report-chip-${RECOMMENDATION_TONE[recommendation] ?? "neutral"}`}>{recommendation}</span>
                </div>
                <p className="report-opinion-paragraph">{paragraph1}</p>
                {paragraph2 != null && <p className="report-opinion-paragraph">{paragraph2}</p>}
            </section>

            {/* 2026-08-18 — 종합 판단(위)은 풀폭 1줄, 확인사항·종합 의견은 그 아래 한 줄에 나란히(사용자 지적
                — 3카드를 세로로 쌓으면 좁은 카드 3개가 계속 이어져 늘어져 보인다는 것, report-opinion-secondary-row,
                ReportPage.css). */}
            <div className="report-opinion-secondary-row">
                <section className="right-panel-card">
                    <CardSubHeading number={2} title="확인사항" />
                    <ol className="report-opinion-checklist">
                        {checklistItems.map((text) => (
                            <li key={text}>{text}</li>
                        ))}
                    </ol>
                </section>

                <section className="right-panel-card">
                    <CardSubHeading number={3} title="종합 의견" />
                    <p className="report-opinion-paragraph">
                        <strong>{conclusion.lead}</strong> {conclusion.detail}
                    </p>
                    <p className="right-panel-field-note report-opinion-disclaimer">
                        본 의견은 공공데이터 기반 분석 결과에 대한 참고 의견이며, 투자 권유가 아닙니다.
                    </p>
                </section>
            </div>
        </>
    );
};

export default AIOpinionPage;
