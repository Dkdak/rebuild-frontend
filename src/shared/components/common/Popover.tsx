import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface PopoverProps {
    label: string;
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    children?: ReactNode;
    disabled?: boolean;
    // 기본 300px — 사용승인일처럼 3열 프리셋 그리드라 넓은 폭이 필요 없는 패널은 좁게 지정(2026-08-1x).
    width?: number;
}

const DEFAULT_PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 8;

// shared/components/common: 여러 feature가 공유하는 칩 트리거 + 드롭다운 패널(HELP5.md §2.2).
// 패널은 position:fixed로 뷰포트 기준 배치한다 — LeftPanel처럼 overflow-y:auto인 좁은
// 스크롤 컨테이너 안에서 트리거를 쓰면 absolute 패널이 컨테이너 경계에 잘려나가기 때문.
const Popover = ({ label, open, onToggle, onClose, children, disabled, width = DEFAULT_PANEL_WIDTH }: PopoverProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

    useEffect(() => {
        if (!open) {
            setPanelStyle(null);
            return;
        }

        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const left = Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN);

            // 트리거가 뷰포트 하단에 가까우면(LeftPanel 마지막 필터줄, 예: "사용승인일") 아래로 열 공간이
            // 모자라 패널 하단(프리셋 버튼·조건삭제)이 화면 밖으로 밀려 클릭이 안 되는 문제가 있었다(사용자
            // 스크린샷 2026-08-1x, "기간 버튼도 다 안보이고 누르지도 못하겠는데"). 아래 공간이 부족하고 위
            // 공간이 더 넓으면 위로 열고, 어느 쪽이든 실제 가용 공간을 max-height로 못박아 내용이 넘치면
            // 패널 자체 스크롤로 흡수한다(잘려서 안 보이는 대신 패널 안에서 스크롤해서라도 닿을 수 있게).
            const MIN_SPACE_BELOW = 240;
            const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
            const spaceAbove = rect.top - VIEWPORT_MARGIN;
            const openUpward = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
            const maxHeight = Math.max((openUpward ? spaceAbove : spaceBelow) - 4, 120);

            setPanelStyle({
                position: "fixed",
                left: Math.max(left, VIEWPORT_MARGIN),
                width,
                maxHeight,
                overflowY: "auto",
                ...(openUpward ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            });
        };

        updatePosition();

        const handleClickOutside = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        // capture:true — LeftPanel 내부 스크롤(overflow-y:auto)처럼 bubble되지 않는 scroll 이벤트도 잡는다.
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open, onClose, width]);

    return (
        <div className="popover-root" ref={rootRef}>
            <button
                ref={triggerRef}
                type="button"
                className={`popover-trigger ${open ? "popover-trigger-open" : ""}`}
                onClick={onToggle}
                disabled={disabled}
            >
                <span>{label}</span>
                <span className="popover-trigger-caret">▾</span>
            </button>
            {open && panelStyle && (
                <div className="popover-panel" style={panelStyle}>
                    {children}
                </div>
            )}
        </div>
    );
};

export default Popover;
