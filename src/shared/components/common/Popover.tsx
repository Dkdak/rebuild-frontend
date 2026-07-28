import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface PopoverProps {
    label: string;
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    children?: ReactNode;
    disabled?: boolean;
}

const PANEL_WIDTH = 300;
const VIEWPORT_MARGIN = 8;

// shared/components/common: 여러 feature가 공유하는 칩 트리거 + 드롭다운 패널(HELP5.md §2.2).
// 패널은 position:fixed로 뷰포트 기준 배치한다 — LeftPanel처럼 overflow-y:auto인 좁은
// 스크롤 컨테이너 안에서 트리거를 쓰면 absolute 패널이 컨테이너 경계에 잘려나가기 때문.
const Popover = ({ label, open, onToggle, onClose, children, disabled }: PopoverProps) => {
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
            const left = Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
            setPanelStyle({ position: "fixed", top: rect.bottom + 4, left: Math.max(left, VIEWPORT_MARGIN) });
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
    }, [open, onClose]);

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
