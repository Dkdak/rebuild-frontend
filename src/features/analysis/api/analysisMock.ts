import type { ValueStatus } from "../../../shared/components/ValueBadge";

// FEATURE_19_PERSONALIZED_ANALYSIS.md §2 — 분석탭의 "값이 아닌 것". 단계 제목·설명·참고표처럼 배치가
// 만들지 않는 표시 규칙만 남긴다. 실측값·항목 상태·재계산 결과·진행도·이력은 measurementApi.ts가 서버에서
// 받아온다. 참고표는 아직 별도 API를 확인하지 못해 시안 값을 유지한다.
// 화면을 열면 전 항목이 리포트 추정치로 채워진 상태다 — 빈 양식이 아니라 "추정 → 실측으로 바꾸는" 화면이다.
export type DriverKey = "extensionArea" | "purchasePrice" | "constructionCost" | "futureValue";

// 참고표 한 행. 연식을 낮출수록 표본이 줄어드는 대가를 함께 드러낸다(비교거래 건수).
// 완화 단계는 4행이 같은 값으로 와야 한다 — 행마다 다르면 "연식 차이"가 아니라 "지역 범위 차이"가 섞여
// 비교가 성립하지 않는다(다르게 오면 backend 버그).
// 참고표는 두 종류이고 근거가 달라 열 구성이 다르다(§2.2-c).
// COST(공사비)는 국세청 고시 단가 × 면적이라 표본이라는 개념 자체가 없다 — 비교거래·완화 단계를 붙이면
// 틀린 정보가 나간다. MARKET(미래가치)만 실거래 조회라 표본 건수·완화 단계·표본 부족 처리가 있다.
// 참고표는 세 종류다. COST(국세청 고시 단가) / MARKET(실거래 조회) / CAPACITY(증축 여력 산출 근거).
// CAPACITY는 비교거래·완화 단계·표본 부족이 없고, 대신 각 행이 어디서 온 값인지(출처)를 함께 보여준다 —
// 절반이 STEP 1에서 오기 때문에, STEP 1을 고쳤을 때 왜 여기에 재확인이 붙는지 설명이 필요 없어진다.
export type ReferenceKind = "COST" | "MARKET" | "CAPACITY";

export interface ReferenceRow {
    label: string;
    value: number;
    unitPrice: string;
    // CAPACITY 전용 — 표시용 값 문자열과 출처. 값이 없는 행(대기)은 pickable=false로 둔다.
    display?: string;
    source?: string;
    pickable?: boolean;
    // MARKET 전용 — COST 행에는 없다.
    tradeCount?: number;
    // 완화 단계 — 기존 응답의 estimatedPrice.confidenceLevel을 그대로 쓴다. 4행이 전부 같은 값이어야 한다
    // (다르면 단계 통일 실패이고, "연식 차이"가 아니라 "지역 범위 차이"가 섞인 표가 된다).
    confidenceLevel?: string;
    // 표본 부족 판정은 서버가 내려준다 — 하한이 잠정치라 프론트에서 같은 판정을 또 두면 갈라진다
    // (재확인 판정을 서버로 몰아둔 것과 같은 이유). 값 자체는 그대로 내려오고, 화면이 표시를 막는다.
    insufficientSample?: boolean;
    desc: string;
}

// 편집은 보기 모드의 값 자리에서 그대로 열린다(§2.2-b) — 아래에 별도 폼을 만들지 않는다.
// editKey가 있으면 그 행의 값 칸이 입력 컨트롤로 바뀐다(STEP 1은 항목마다, STEP 2~5는 ROI 구성값 한 줄).
export interface StepField {
    editKey?: string;
    // 이 값일 때만 행 자체를 보여준다(지구단위계획 명칭 ← "있음").
    visibleWhen?: { key: string; value: string };
    // 한 항목인데 컨트롤이 여럿인 행(안전진단 = 상태 + 등급 + 진단일).
    editKeys?: string[];
    label: string;
    hint: string;
    value: string;
    effect: string;
}

// 서류가 있는 항목은 유효기간을 "입력 시각"이 아니라 그 서류의 날짜부터 잰다(§3.1-a) — 한 달 전 견적서를
// 오늘 입력해도 90일이 새로 시작되면 안 된다. 선택 입력이고, 비우면 입력 시각을 앵커로 쓴다.
// 경과일·재확인 판정은 서버가 내려준다(어느 앵커를 썼는지도 응답에 담긴다) — 프론트에서 계산하지 않는다.
export interface DocumentDateField {
    label: string;
    validDays: number;
}

export interface AnalysisStepData {
    stepNo: number;
    title: string;
    who: string;
    decides: string;
    status: ValueStatus;
    statusNote: string;
    source: string;
    fields: StepField[];
    // 이 단계가 바꾸는 값 — 단계 안에서 입력 바로 아래 붙는다(입력과 결과를 좌우로 나누지 않는다).
    resultsLabel?: string;
    results: { label: string; value: string; unit: string; desc: string }[];
    // 이 단계에서 편집하는 ROI 구성값(있는 단계만).
    driver?: { key: DriverKey; label: string; unit: string };
    // 숫자 하나로 안 끝나는 단계(STEP 1 규제)는 항목별 입력칸을 그대로 나열한다 — key는 저장 API 필드명.
    // 공공데이터에 값이 있는 항목은 자유 입력이 아니라 선택·자동 산출로 받는다(§2.2-e) — 표기가 흔들리면
    // 용적률 상한 매칭이 깨진다("제2종일반주거" / "2종일반주거지역" / "2종주거"가 전부 같은 값).
    editableFields?: {
        key: string;
        label: string;
        type: "text" | "number" | "select" | "readonly" | "segment";
        options?: string[];
        note?: string;
        // 이 값일 때만 입력을 여는 의존 조건(용적률 상한 ← 지구단위계획 "있음").
        enabledWhen?: { key: string; value: string };
        // 숫자 입력 뒤에 붙는 단위(m 등)와, "확인했으나 해당 없음"을 표시하는 체크 라벨.
        unit?: string;
        noneLabel?: string;
    }[];
    documentDate?: DocumentDateField;
    referenceKind?: ReferenceKind;
    // 참고표 아래 고정 경고(STEP 2) — 그 숫자가 무엇을 안 본 값인지 먼저 말한다.
    referenceNote?: string;
    reference?: ReferenceRow[];
    referenceRange?: { min: number; max: number };
}

// 리포트 추정 기준값 — 상단 밴드의 "리포트 기준 대비" 비교 대상.
// zoning_limit 테이블의 zone_name 16종과 1:1로 일치하는 목록(backend 확인, 2026-08-23). 매칭이 정확히
// 일치라서 표기가 하나라도 다르면 용적률 상한 파생이 안 된다 — 자유 입력을 막는 이유가 이것이다.
// 목록에 없는 값(개발제한구역·미지정 등)은 파생 자체가 안 되므로(farLimitPct=null), 기존 값이 그런 경우엔
// 사용자가 값을 잃지 않도록 화면에서 그 값을 목록에 임시로 넣어 유지한다.
export const ZONE_OPTIONS = [
    "제1종전용주거지역",
    "제2종전용주거지역",
    "제1종일반주거지역",
    "제2종일반주거지역",
    "제3종일반주거지역",
    "준주거지역",
    "중심상업지역",
    "일반상업지역",
    "근린상업지역",
    "유통상업지역",
    "전용공업지역",
    "일반공업지역",
    "준공업지역",
    "보전녹지지역",
    "생산녹지지역",
    "자연녹지지역",
];

// 안전진단은 상태에 따라 등급이 있을 수도, 없을 수도 있다 — 결과를 받았을 때만 등급을 넣는다.
export const SAFETY_STATUS_OPTIONS = ["미신청", "신청함", "결과 받음"];
export const SAFETY_GRADE_OPTIONS = ["A", "B", "C", "D", "E"];

export const STEPS: AnalysisStepData[] = [
    {
        stepNo: 1,
        title: "규제 확인",
        who: "구청 · 시",
        decides: "증축 상한과 허용 방식을 정합니다 · 바뀌면 STEP 2·3·5가 재확인 대상이 됩니다",
        status: "ESTIMATED",
        statusNote: "",
        source: "구청 회신 기준",
        // 값은 서버에서 온다(fieldValuesOf) — 여기서는 라벨·설명·영향 문구만 정의하고, 편집은 이 행의 값
        // 자리에서 열린다(editKey).
        fields: [
            { editKey: "zoneName", label: "용도지역", hint: "구청 확인 · 목록에서 선택", value: "", effect: "리포트와 동일" },
            {
                editKey: "farLimitPct",
                label: "용적률 상한",
                hint: "용도지역에서 자동 산출",
                value: "",
                effect: "읽기 전용",
            },
            { editKey: "heightLimit", label: "높이제한", hint: "구청 확인 — 숫자(m)", value: "", effect: "상한에 영향 없음" },
            {
                editKey: "districtPlanExists",
                label: "지구단위계획",
                hint: "있음/없음",
                value: "",
                effect: "확인함 — 해당 없음",
            },
            {
                editKey: "districtPlan",
                label: "지구단위계획 명칭·내용",
                hint: "있음일 때만",
                value: "",
                effect: "",
                // "있음"을 고르기 전에는 아예 보이지 않는다 — 비어 있는 칸이 남아 있으면 뭘 해야 하는지 헷갈린다.
                visibleWhen: { key: "districtPlanExists", value: "있음" },
            },
            // 상태·등급·진단일은 한 항목이다 — 한 행 안에서 같이 받는다(입력 시각도 항목 단위다).
            {
                editKeys: ["safetyStatus", "safetyGrade", "__docdate"],
                label: "안전진단",
                hint: "구청 신청 — 허가의 선행 조건",
                value: "",
                effect: "허가의 선행 조건",
            },
        ],
        // 증축 가능 상한은 막대 캡션이 이미 말한다 — 같은 값을 카드로 또 두면 다른 값인지 다시 보게 된다.
        // 이 단계의 결과값은 증축 가능 상한 하나다 — 막대 옆에 크게 두고, 근거는 막대 양 끝 값의 뺄셈으로 쓴다.
        results: [{ label: "증축 가능 상한", value: "—", unit: "", desc: "" }],
        editableFields: [
            {
                key: "zoneName",
                label: "용도지역",
                type: "select",
                options: ZONE_OPTIONS,
                note: "용적률 상한은 서울시 조례에서 자동 산출됩니다",
            },
            // "미확인"과 "확인했으나 해당 없음"은 다른 상태다 — 전자는 재확인 대상, 후자는 확정이다.
            // 비워두면 미확인, "제한 없음"을 체크하면 확인 결과 제한이 없다는 뜻이다.
            { key: "heightLimit", label: "높이제한", type: "number", unit: "m", noneLabel: "제한 없음" },
            { key: "districtPlanExists", label: "지구단위계획", type: "segment", options: ["없음", "있음"] },
            {
                key: "districtPlan",
                label: "지구단위계획 명칭·내용",
                type: "text",
                enabledWhen: { key: "districtPlanExists", value: "있음" },
            },
            {
                key: "farLimitPct",
                label: "용적률 상한(%)",
                type: "number",
                unit: "%",
                // 평소에는 용도지역에서 서버가 파생시킨다 — 따로 받으면 "제2종일반주거 + 400%" 같은 조합이
                // 들어온다. 지구단위계획이 "있음"일 때만 조례와 달라질 수 있어 입력을 열고, 그때만 값을
                // 실어 보낸다(backend가 그 값을 오버라이드로 인정한다).
                // 조건은 문장이 아니라 활성/비활성으로 표현한다 — 사용자가 스스로 판단하게 두지 않는다.
                note: "지구단위계획을 '있음'으로 바꾸면 직접 입력이 열립니다",
                enabledWhen: { key: "districtPlanExists", value: "있음" },
            },
            { key: "safetyStatus", label: "안전진단 상태", type: "segment", options: SAFETY_STATUS_OPTIONS },
            {
                key: "safetyGrade",
                label: "안전진단 등급",
                type: "select",
                options: SAFETY_GRADE_OPTIONS,
                enabledWhen: { key: "safetyStatus", value: "결과 받음" },
                note: "진단일 기준 유효 180일(서비스 기준) · 비우면 입력일 기준",
            },
        ],
        documentDate: {
            label: "진단일",
            validDays: 180,
        },
    },
    {
        stepNo: 2,
        title: "건축사 사전검토",
        who: "건축사",
        decides: "실제 증축 면적을 정합니다 · 일조·주차·건축선이 반영됩니다",
        status: "ESTIMATED",
        statusNote: "",
        source: "건축사 사전검토 회신 기준",
        fields: [
            {
                editKey: "__driver",
                label: "실제 증축 가능 연면적",
                hint: "건축사 검토서 기준",
                value: "",
                effect: "일조·주차·건축선이 반영된 값입니다",
            },
            { editKey: "__docdate", label: "검토서 작성일", hint: "선택 — 유효 180일", value: "", effect: "" },
            {
                editKey: "__reason",
                label: "감소 사유",
                hint: "기록 — 계산 반영 안 함",
                value: "",
                effect: "기록용",
            },
        ],
        // 이 단계는 두 곳을 동시에 바꾼다 — 공사비 대상 면적과 미래가치 조회 기준 면적.
        resultsLabel: "이 단계가 바꾸는 값 — 두 곳이 동시에 바뀝니다",
        // 연면적이 두 종류다(§2.2-f) — 용적률 판정·증축 여력은 산정 면적, 공사비·미래가치는 대장 연면적.
        // 어느 쪽인지 라벨로 구분한다. 지하 주차장도 공사 대상이고, 유사거래는 실제 건물 크기로 조회한다.
        results: [
            {
                label: "증축 후 연면적 (산정 기준)",
                value: "—",
                unit: "㎡",
                desc: "용적률 상한 확인용 — 산정 연면적 + 증축분",
            },
            {
                label: "증축 후 연면적 (대장 기준)",
                value: "—",
                unit: "㎡",
                desc: "공사비·미래가치가 쓰는 실제 건물 크기",
            },
        ],
        referenceKind: "CAPACITY",
        referenceNote:
            "이 값은 용적률만 본 값입니다. 일조·주차·건축선이 반영돼 있지 않아 건축사 검토에서 줄어드는 것이 정상입니다.",
        driver: { key: "extensionArea", label: "실제 증축 가능 연면적", unit: "㎡" },
        documentDate: {
            label: "검토서 작성일",
            validDays: 180,
        },
    },
    {
        stepNo: 3,
        title: "공사비 견적",
        who: "시공사 (건축사 동석)",
        decides: "증축 면적(STEP 2)에 걸립니다 · 면적이 바뀌면 재확인 표시가 붙습니다",
        status: "ESTIMATED",
        statusNote: "",
        source: "시공사 견적서 기준",
        fields: [
            {
                editKey: "__driver",
                label: "공사 견적 총액",
                hint: "시공사 견적서 기준",
                value: "",
                effect: "현장 상태가 곧 견적의 근거입니다",
            },
            { editKey: "__docdate", label: "견적서 발행일", hint: "선택 — 유효 90일", value: "", effect: "" },
            {
                editKey: "__reason",
                label: "견적 근거",
                hint: "현장 상태·특이사항",
                value: "",
                effect: "기록용",
            },
        ],
        results: [{ label: "공사 관련 합계", value: "—", unit: "억", desc: "설계·인허가 비용 포함" }],
        driver: { key: "constructionCost", label: "공사 견적 총액", unit: "억" },
        documentDate: {
            label: "견적서 발행일",
            validDays: 90,
        },
        referenceKind: "COST",
        reference: [
            { label: "리포트 최소(추정)", value: 9.0, unitPrice: "290 / 959만", desc: "국세청고시 단가" },
            { label: "리포트 중간", value: 10.2, unitPrice: "330 / 1,091만", desc: "국세청고시 단가" },
            { label: "리포트 최대(보수적)", value: 11.6, unitPrice: "375 / 1,240만", desc: "국세청고시 단가" },
        ],
        referenceRange: { min: 9.2, max: 12.6 },
    },
    {
        stepNo: 4,
        title: "매입 조건 + 권리관계",
        who: "부동산 · 매도인",
        decides: "총 투입을 확정합니다 · 등기부 권리관계·명도 조건이 여기 걸립니다",
        status: "ESTIMATED",
        statusNote: "",
        source: "부동산 호가 · 등기부 확인 기준",
        fields: [
            {
                editKey: "__driver",
                label: "매입가(호가 기준)",
                hint: "부동산 확인가",
                value: "",
                effect: "총 투입을 확정합니다",
            },
            { label: "권리관계 · 명도", hint: "등기부·임대차", value: "미확인", effect: "매입 조건에 걸립니다" },
            // 다주택·법인 취득세는 조정대상지역 여부에 따라 8%/12%가 갈리는데 그 적용 규칙이 검증되지 않았다
            // (LAW-003 보강 대기) — 세율을 추정해 쓰지 않는다. 입력·저장은 받되 계산에는 넣지 않는다.
            {
                label: "취득 주체",
                hint: "세율 근거 확인 전 — LAW-003 보강 대기",
                value: "미입력",
                effect: "기록 — 계산 반영 안 함 · 개인 1주택 기준으로 계산 중",
            },
        ],
        results: [{ label: "총 투입", value: "—", unit: "억", desc: "매입가 + 공사비 + 부대비용" }],
        driver: { key: "purchasePrice", label: "매입가", unit: "억" },
    },
    {
        stepNo: 5,
        title: "미래가치",
        who: "본인 · 공인중개",
        decides: "ROI의 부호가 갈리는 지점입니다 · 끝까지 가정이 남습니다",
        status: "ESTIMATED",
        statusNote: "",
        source: "연식별 참고표 기준",
        fields: [
            {
                editKey: "__driver",
                label: "리모델링 후 예상 가치",
                hint: "참고표에서 고른 뒤 조정",
                value: "",
                effect: "ROI의 부호가 갈리는 값입니다",
            },
            {
                editKey: "__reason",
                label: "판단 근거",
                hint: "어느 연식대를 왜 골랐는지",
                value: "",
                effect: "기록용",
            },
        ],
        results: [{ label: "미래가치", value: "—", unit: "억", desc: "리모델링 후 예상 가치" }],
        driver: { key: "futureValue", label: "리모델링 후 예상 가치", unit: "억" },
        referenceKind: "MARKET",
        reference: [
            {
                label: "보정없음(42년)",
                value: 45.1,
                unitPrice: "291만",
                tradeCount: 76,
                confidenceLevel: "같은 동",
                insufficientSample: false,
                desc: "현재 연식 그대로",
            },
            {
                label: "−10년 (32년)",
                value: 49.6,
                unitPrice: "320만",
                tradeCount: 49,
                confidenceLevel: "같은 동",
                insufficientSample: false,
                desc: "리모델링 후 32년 상당",
            },
            {
                label: "−15년 (27년)",
                value: 54.4,
                unitPrice: "351만",
                tradeCount: 15,
                confidenceLevel: "같은 동",
                insufficientSample: false,
                desc: "리모델링 후 27년 상당",
            },
            {
                label: "−20년 (22년)",
                value: 58.6,
                unitPrice: "378만",
                tradeCount: 6,
                confidenceLevel: "같은 동",
                insufficientSample: true,
                desc: "리모델링 후 22년 상당",
            },
        ],
        referenceRange: { min: 45.1, max: 58.6 },
    },
];

// 단계별 항목 키(backend MeasurementItem enum 이름 그대로) — 서버가 준 항목 상태를 단계 배지로 묶을 때 쓴다.
export const STEP_ITEM_KEYS: Record<number, string[]> = {
    1: ["ZONING", "HEIGHT_LIMIT", "SAFETY"],
    2: ["EXPANDABLE_AREA", "REDUCTION_REASON"],
    3: ["ESTIMATE", "ESTIMATE_BASIS", "DESIGN_PERMIT_FEE"],
    4: ["PURCHASE_PRICE", "ACQUISITION_ENTITY", "REGISTRY_RIGHTS", "LEASE_VACANCY"],
    5: ["FUTURE_VALUE", "FUTURE_VALUE_BASIS"],
};

// 항목 키(서버 enum)를 화면 문구로 — 이력·"다음 입력 항목"에 EXPANDABLE_AREA가 그대로 노출되면 안 된다.
export const ITEM_LABEL: Record<string, string> = {
    ZONING: "용도지역·용적률",
    HEIGHT_LIMIT: "높이제한",
    SAFETY: "안전진단",
    EXPANDABLE_AREA: "증축 면적",
    REDUCTION_REASON: "감소 사유",
    ESTIMATE: "공사 견적",
    ESTIMATE_BASIS: "견적 근거",
    DESIGN_PERMIT_FEE: "설계·인허가비",
    PURCHASE_PRICE: "매입가",
    ACQUISITION_ENTITY: "취득 주체",
    REGISTRY_RIGHTS: "권리관계",
    LEASE_VACANCY: "임대차·명도",
    FUTURE_VALUE: "미래가치",
    FUTURE_VALUE_BASIS: "미래가치 근거",
};

// 면적은 소수 둘째자리까지 보여준다 — 정수로 반올림하면 화면 숫자로 검산이 안 맞는다
// (108 ÷ 96 = 112.5% ≠ 화면 112.57%). 뒤가 0이면 생략한다.
export const formatArea = (value: number | null | undefined) =>
    value == null || Number.isNaN(value)
        ? "—"
        : Number(value.toFixed(2)).toLocaleString("ko-KR", { maximumFractionDigits: 2 });

// 용적률도 같은 이유로 소수 둘째자리 — 108.07 ÷ 96 = 112.57%가 화면에서 그대로 맞아야 한다.
export const formatPercent = (value: number | null | undefined) =>
    value == null || Number.isNaN(value) ? "—" : `${Number(value.toFixed(2))}`;
