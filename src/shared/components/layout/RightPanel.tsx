import PropertyDetailContent from "../../../features/property/components/PropertyDetailContent";

interface RightPanelProps {
    onOpenReport: () => void;
}

// 2026-08-10 — guide/DIRECTORY_RESTRUCTURE.md §1 "핵심 원칙": 패널은 레이아웃 슬롯일 뿐, 실제 컨텐츠는
// features/property/components/PropertyDetailContent.tsx(F-05)로 옮겼다. 이 파일은 배치만 하는 얇은 껍데기 —
// 로직·JSX 변경은 그쪽에서.
const RightPanel = ({ onOpenReport }: RightPanelProps) => {
    return <PropertyDetailContent onOpenReport={onOpenReport} />;
};

export default RightPanel;
