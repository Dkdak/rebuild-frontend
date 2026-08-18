// docs/FEATURE.md §8.24(product 전달, 2026-08-18) — 리포트(F-10) 01~08 섹션 최상단 "01 요약 정보" 같은
// 번호배지+타이틀을 ReportPage.tsx 한 파일 안에 8번 복붙하던 걸 공유 컴포넌트로 추출. 새 스타일 아님 —
// 기존 .report-section-heading 마크업(ReportPage.css)을 그대로 컴포넌트화한 것뿐. shared/components/
// 최상위에 두는 이유: 나중에 30_분석탭에서도 같은 패턴 재사용 예정(features/report/ 전용 아님).
interface SectionHeadingProps {
    number: string;
    title: string;
}

const SectionHeading = ({ number, title }: SectionHeadingProps) => (
    <div className="report-section-heading">
        <span className="report-section-heading-number">{number}</span>
        <h4 className="report-section-heading-title">{title}</h4>
    </div>
);

export default SectionHeading;
