import "./common/common.css";

// DOMAIN.md §7.5 — 값 단위 상태 표시. 리포트·대시보드·관심목록·분석탭이 같이 쓴다(화면별로 따로 만들지 않는다).
// "이 화면은 추정입니다"처럼 뭉뚱그리지 않고 값마다 붙인다.
// "확인중"·"편집 중"은 배지가 아니다 — 전자는 판단 근거 메모에 적는 내용이고, 후자는 화면 모드다.
// 재확인 판정(의존 변경·유효기간 경과)은 서버가 내려준다 — 프론트에서 날짜를 계산하지 않는다.
export type ValueStatus = "ESTIMATED" | "MEASURED" | "RECHECK";

const LABEL: Record<ValueStatus, string> = {
    ESTIMATED: "추정",
    MEASURED: "실측",
    RECHECK: "재확인",
};

const TONE: Record<ValueStatus, string> = {
    ESTIMATED: "is-estimated",
    MEASURED: "is-measured",
    RECHECK: "is-recheck",
};

interface ValueBadgeProps {
    status: ValueStatus;
    // 실측 입력일·재확인 사유처럼 배지 옆에 붙는 짧은 부기(예: "2026-06-11", "매입가 42일").
    note?: string;
}

const ValueBadge = ({ status, note }: ValueBadgeProps) => (
    <span className={`value-badge ${TONE[status]}`}>
        {LABEL[status]}
        {note && <em>{note}</em>}
    </span>
);

export default ValueBadge;
