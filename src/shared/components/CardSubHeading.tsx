import type { ReactNode } from "react";

// docs/FEATURE.md §8.24(product 전달, 2026-08-18) — 07/08(AIOpinionPage/ReferencePage)이 이미 쓰던
// "1. 데이터 출처" 인라인 패턴(right-panel-card-title 클래스 재사용)을 공유 컴포넌트로 추출, 01~06의 모든
// 카드 소제목에도 번호를 부여하는 데 재사용한다. children은 스펙 2-prop({number, title})에 없던 선택 확장 —
// "리모델링 후 추정"(01) 카드처럼 제목 옆에 신뢰도 칩이 붙는 경우를 위해 추가(칩 자체는 새 마크업 아님, 호출부가
// 그대로 넘겨줌). "예상 공사비"(05)처럼 right-panel-estimate-anchor로 제목+배지를 통째로 감싸야 하는 특수
// 케이스는 이 컴포넌트로 못 담아(구조가 아예 다름) 그 카드만 기존 마크업 그대로 두고 번호만 수동으로 붙였다.
interface CardSubHeadingProps {
    number: number;
    title: string;
    children?: ReactNode;
}

const CardSubHeading = ({ number, title, children }: CardSubHeadingProps) => (
    <p className="right-panel-card-title">
        {number}. {title}
        {children}
    </p>
);

export default CardSubHeading;
