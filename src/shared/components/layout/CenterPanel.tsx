import CenterPanelContent from "../../../features/search/components/CenterPanelContent";

interface CenterPanelProps {
    onOpenDetail: () => void;
}

// 2026-08-10 — guide/DIRECTORY_RESTRUCTURE.md §1 "핵심 원칙": 패널은 레이아웃 슬롯일 뿐, 실제 컨텐츠는
// features/search/components/CenterPanelContent.tsx(F-04)로 옮겼다. 이 파일은 배치만 하는 얇은 껍데기.
const CenterPanel = ({ onOpenDetail }: CenterPanelProps) => {
    return <CenterPanelContent onOpenDetail={onOpenDetail} />;
};

export default CenterPanel;
