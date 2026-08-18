// FEATURE_10_REFERENCE.md "08 근거 및 참고자료"(← 구 "참고 자료", 2026-08-17 전면 재설계, planning/rebuild/
// widgets/2026-08-17_opinion_reference_comparison.html 확정본) — 01=사실 / 07=그 사실을 근거로 한 판단 /
// 08=그 사실·판단이 어떻게 만들어졌는지의 방법론(부록). 6카드 전부 새 API·새 계산 없음 — 04/05/06 곳곳에
// 흩어진 산정식·데이터출처·신뢰도 기준을 한곳에 모아 검산 가능하게 하는 정적 색인이라, 매물마다 값이 달라지는
// 카드가 하나도 없다(props 없이 완전 정적 콘텐츠). 소스별 적재 완료일도 API로 조회하지 않고 프론트 정적
// 상수로 하드코딩(문서 §확정분 — 파이프라인 재실행 시 코드도 같이 갱신, 부대비용 캡션과 같은 패턴).
// 2026-08-18 재정정 — 표 3개를 각각 풀폭 1줄씩 쌓았더니 세로 공간을 너무 많이 먹는다는 지적(사용자가 공유한
// 참고 이미지 — 표 3개+텍스트 3개를 3열×2행으로 빽빽하게 배치) — 6카드를 전부 같은 3열 grid에 태우고, 표
// 셀은 nowrap 대신 줄바꿈 허용(report-reference-grid, ReportPage.css)으로 좁은 칸에서도 자연스럽게 접히게
// 한다. 다만 그 참고 이미지의 "투자등급(A~D) 산정 기준" 가중치표(개발여력40%·입지및수요25%…) 내용 자체는
// 채택하지 않는다 — 우리 F-09 실제 등급 산정 로직(ROI 구간 경계값)과 다른 모델이라 DOMAIN.md §4 위반(문서
// §확정분에 이미 결론남, 레이아웃만 참고).
// 2026-08-18 — CardSubHeading으로 카드 번호 부여(docs/FEATURE.md §8.24, product 전달).

import CardSubHeading from "../../../shared/components/CardSubHeading";

const DATA_SOURCES = [
    { item: "건축물 정보", source: "건축물대장", loadedAt: "2026-07-23" },
    { item: "실거래가", source: "국토교통부 실거래가 공개시스템", loadedAt: "2026-08-07(확보 2026-08-06)" },
    { item: "공시가격", source: "공동주택가격·개별주택가격 공공데이터", loadedAt: "2026-08-07~08(소스별 상이)" },
    { item: "토지이용·지역 정보", source: "토지이용계획정보", loadedAt: "2026-08-08" },
    { item: "인허가 정보", source: "건축인허가정보", loadedAt: "2026-08-08" },
];

// 전부 각 섹션(04/05/06) 캡션과 동일 공식의 복제 — 이 표가 "여기저기 흩어진 공식을 한곳에 모은 색인"이라는
// 역할임을 카드 상단에 명시(문서 §확정분). 부대비용은 06 CashFlowFormula.tsx 캡션과 같은 공식(2026-08-17
// 4.9%→5.5% 수정분 반영) — 주택 유형은 취득세 구간별 누진 요율이라 이 요약행엔 안 담고 "주택 외 기준"으로 명시.
const CALCULATION_BASIS = [
    { item: "현재 추정 시세", formula: "비교거래 ㎡당가 중앙값 × 연면적" },
    { item: "리모델링 후 추정 미래가치", formula: "비교거래 ㎡당가 중앙값 × 연면적" },
    { item: "공사비", formula: "연면적 × 기준단가 × 보정계수" },
    { item: "부대비용", formula: "현재가치 × 5.5%(취득세+지방교육세+농특세+중개보수, 주택 외 기준)" },
    { item: "ROI", formula: "예상차익 ÷ 총 투자금 × 100" },
];

// FEATURE_08_MARKET.md §2.3 5단계 표 재사용(값 복제 아니라 같은 표를 다시 그리는 것, 단일 출처는 여전히
// §2.3) — 산정 근거 문구는 04 MarketAnalysisPage.tsx "시세 산정 근거" 카드 범례와 동일 텍스트(재사용, 새로
// 안 만듦). "의미"는 그 신뢰도 단계에서 값을 얼마나 참고용으로 봐야 하는지에 대한 해석 한 줄(신규 서술,
// 숫자·판정 기준 아님 — DOMAIN.md §4 지어내지 않음 원칙에 안전).
const CONFIDENCE_LEVELS: { label: string; tone: "success" | "warning" | "neutral"; basis: string; meaning: string }[] = [
    { label: "실거래", tone: "success", basis: "해당 건물의 실제 최근 거래", meaning: "가장 신뢰할 수 있는 값 — 실제 거래 자체입니다." },
    { label: "높음", tone: "success", basis: "같은 법정동 비교(면적±10%·연식±5년)", meaning: "신뢰할 수 있는 추정값입니다." },
    { label: "중간", tone: "warning", basis: "같은 구 비교(면적±10%·연식±5년)", meaning: "참고용으로 활용 가능한 추정값입니다." },
    { label: "낮음", tone: "neutral", basis: "범위 확대(면적±20%·연식±10년)", meaning: "추정 범위가 넓어 참고용으로만 활용해야 합니다." },
    { label: "매우낮음", tone: "neutral", basis: "법정동·구 유형 평균(면적·연식 무관)", meaning: "추정 근거가 약해 실제 시세와 차이가 클 수 있습니다." },
];

// FEATURE_09_INVESTMENT.md §3.2/§3.3 등급 경계값 그대로 — 가중치 스코어링이 아니라 예상 ROI 구간 경계값
// 방식이고, 경계값은 backend V1 잠정치라 표 아래 캡션에 그대로 명시한다(새 숫자 지어내지 않음).
const INVESTMENT_GRADES = [
    { grade: "A", criteria: "예상 ROI 20% 이상" },
    { grade: "B", criteria: "예상 ROI 10% 이상 20% 미만" },
    { grade: "C", criteria: "예상 ROI 5% 이상 10% 미만" },
    { grade: "D", criteria: "예상 ROI 5% 미만, 또는 리모델링 추진 요건 미충족(F-06 게이트, verdict=NOT_POSSIBLE)" },
    { grade: "NA(정보부족)", criteria: "등급 산정에 필요한 핵심 데이터 부족 — ROI·등급 둘 다 산출 안 함" },
];

// 06 "계산 조건 및 제외 항목" 제외 항목의 상위집합(문서 §확정분) — 그 카드가 ROI 계산에서 뺀 항목만 다뤘다면
// 여기는 리모델링·투자 판단 전체에서 반영되지 않은 항목까지 넓힌 목록.
// 2026-08-18 재정정(planning/rebuild/widgets/2026-08-17_reference_limits_card_fix.html 확정본) — 10개
// 명사구 나열이 옆 "관련 법규 및 참고 링크" 카드(5줄)보다 훨씬 길어 두 카드 높이가 안 맞던 문제 — 뜻이
// 겹치는 항목끼리 묶어 5개 완결 문장으로 병합(① 현장상태 그대로, ② 등기부+임대차·명도, ③ 공사견적+설계비+
// 인허가비용(+향후시장가격 취지 흡수), ④ 설계·인허가 가능여부+규제해석·행정기관 최종판단, ⑤ 금융비용·
// 대출조건+세금+유지관리비 — 항목 손실 아니라 문장으로 재구성, 10개 항목 전부 5문장 안에 포함됨).
const LIMITATIONS = [
    "실제 건물의 현장 상태(구조·설비·마감·배관 등)는 반영되지 않았습니다.",
    "등기부 권리관계, 임대차·명도 조건은 분석 범위에 포함되지 않았습니다.",
    "실제 공사 견적·설계비·인허가 비용은 시장 상황에 따라 달라질 수 있습니다.",
    "인허가 승인 가능 여부, 규제 해석·완화 여부는 관할 행정기관 확인이 필요합니다.",
    "세금·금융비용·보유기간 중 유지관리비는 일부 또는 전부 반영되지 않았습니다.",
];

// 5개 전부 데이터 위험 없는 정적 공공기관 URL(로그인·데이터 입력 없는 순수 열람용, 문서 §확정분). 건축법/
// 주택법은 국가법령정보센터 법령명 검색 결과 URL(law.go.kr lsSc.do?query=, 실제 검색 API 파라미터 확인
// 완료) — 특정 조문 ID를 임의로 지어내지 않고 검색 결과 페이지로 안내한다.
const LAW_LINKS = [
    { label: "건축법", org: "국가법령정보센터", url: "https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=건축법" },
    { label: "주택법", org: "국가법령정보센터", url: "https://www.law.go.kr/lsSc.do?menuId=1&subMenuId=15&tabMenuId=81&query=주택법" },
    { label: "지구단위계획", org: "서울도시계획포털", url: "https://urban.seoul.go.kr" },
    { label: "토지이용계획확인원", org: "eum.go.kr", url: "https://www.eum.go.kr" },
    { label: "실거래가 공개시스템", org: "국토교통부", url: "https://rt.molit.go.kr" },
];

const ReferencePage = () => (
    <>
        <p className="report-opinion-subtitle">
            리포트 전체가 쓴 계산식·데이터 출처·신뢰도 기준을 한곳에 모아 투명하게 보여줍니다.
        </p>

        {/* 6카드 전부 같은 3열 grid(report-reference-grid, ReportPage.css) — 2026-08-18 재정정, 위 파일
            상단 주석 참고. */}
        <div className="report-reference-grid">
            <section className="right-panel-card">
                <CardSubHeading number={1} title="데이터 출처" />
                <div className="report-trade-table-wrap">
                    <table className="report-trade-table report-reference-table">
                        <thead>
                            <tr>
                                <th>항목</th>
                                <th>출처</th>
                                <th>적재 완료일</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DATA_SOURCES.map((row) => (
                                <tr key={row.item}>
                                    <th>{row.item}</th>
                                    <td>{row.source}</td>
                                    <td>{row.loadedAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="right-panel-card">
                <CardSubHeading number={2} title="산정 기준 및 계산 방식" />
                <p className="right-panel-field-note">각 공식의 상세 근거는 해당 섹션 카드에서도 확인할 수 있습니다.</p>
                <div className="report-trade-table-wrap">
                    <table className="report-trade-table report-reference-table">
                        <thead>
                            <tr>
                                <th>항목</th>
                                <th>산정 방식</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CALCULATION_BASIS.map((row) => (
                                <tr key={row.item}>
                                    <th>{row.item}</th>
                                    <td>{row.formula}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="right-panel-card">
                <CardSubHeading number={3} title="시세 신뢰도 기준" />
                <div className="report-trade-table-wrap">
                    <table className="report-trade-table report-reference-table">
                        <thead>
                            <tr>
                                <th>신뢰도</th>
                                <th>산정 근거</th>
                                <th>의미</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CONFIDENCE_LEVELS.map((row) => (
                                <tr key={row.label}>
                                    <th>
                                        <span className={`report-chip report-chip-${row.tone}`}>{row.label}</span>
                                    </th>
                                    <td>{row.basis}</td>
                                    <td>{row.meaning}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="right-panel-card">
                <CardSubHeading number={4} title="투자등급 해석" />
                <p className="report-opinion-paragraph">
                    투자등급은 개발 여력·입지·리스크 등을 종합한 검토 우선순위 평가이며, 미래 수익률을 의미하거나
                    투자 수익을 보장하지 않습니다. 특히 ROI가 높더라도 미래가치 신뢰도가 낮다면 그 ROI의 불확실성도
                    높다고 판단해야 합니다.
                </p>
                <div className="report-trade-table-wrap">
                    <table className="report-trade-table report-reference-table">
                        <thead>
                            <tr>
                                <th>등급</th>
                                <th>기준</th>
                            </tr>
                        </thead>
                        <tbody>
                            {INVESTMENT_GRADES.map((row) => (
                                <tr key={row.grade}>
                                    <th>{row.grade}</th>
                                    <td>{row.criteria}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="right-panel-field-note">
                    예상 ROI는 공사비 보수적(최대) 적용 기준입니다. 등급 경계값은 backend V1 잠정치로, 실측 사례가
                    쌓이면 조정될 수 있습니다.
                </p>
            </section>

            <section className="right-panel-card">
                <CardSubHeading number={5} title="분석의 한계" />
                <ul className="report-opinion-checklist report-opinion-checklist-unordered">
                    {LIMITATIONS.map((text) => (
                        <li key={text}>{text}</li>
                    ))}
                </ul>
                <p className="right-panel-field-note report-opinion-disclaimer">
                    중요한 투자 결정을 내리기 전에는 건축사·세무사·법무사·중개사 등 관련 전문가의 별도 확인이
                    필요합니다.
                </p>
            </section>

            <section className="right-panel-card">
                <CardSubHeading number={6} title="관련 법규 및 참고 링크" />
                <ul className="report-reference-link-list">
                    {LAW_LINKS.map((link) => (
                        <li key={link.label}>
                            <a href={link.url} target="_blank" rel="noreferrer">
                                {link.label}
                            </a>
                            <span className="report-reference-link-org">{link.org}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    </>
);

export default ReferencePage;
