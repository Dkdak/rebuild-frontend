import { useEffect, useState } from "react";
import { useSearch } from "../context/SearchContext";

const NEIGHBOR_SPAN = 2;

type PageEntry = number | "ellipsis-left" | "ellipsis-right";

// 1페이지·마지막 페이지는 항상 표시, 현재 페이지 기준 앞뒤 2개씩 표시, 그 사이 공백은 "..."으로 생략(§2.1-f item 1).
const buildPageList = (current: number, total: number): PageEntry[] => {
    const pages = new Set<number>([1, total]);
    for (let p = current - NEIGHBOR_SPAN; p <= current + NEIGHBOR_SPAN; p++) {
        if (p >= 1 && p <= total) pages.add(p);
    }
    const sorted = Array.from(pages).sort((a, b) => a - b);

    const result: PageEntry[] = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) {
            result.push(i === 1 ? "ellipsis-left" : "ellipsis-right");
        }
        result.push(p);
    });
    return result;
};

// features/search: 페이지네이션 컨트롤 (F-04_SEARCH.md §2.1-f, planning/rebuild/페이지네이션.png "1. 추천 방식").
const Pagination = () => {
    const { searchResults, page, totalPages, hasNextPage, goToPage } = useSearch();
    const [pageInput, setPageInput] = useState(String(page));

    // 페이지 번호 클릭/이전·다음으로 바뀌면 직접입력 칸도 그 값으로 맞춘다.
    useEffect(() => {
        setPageInput(String(page));
    }, [page]);

    if (!searchResults) return null;

    const pageList = buildPageList(page, totalPages);

    // 1 미만 → 1, 전체페이지 초과 → 마지막 페이지로 보정. 정수가 아니면 무시(§2.1-f item 2).
    const commitPageInput = () => {
        const parsed = Number(pageInput);
        if (!Number.isInteger(parsed)) {
            setPageInput(String(page));
            return;
        }
        const corrected = Math.min(Math.max(parsed, 1), totalPages);
        goToPage(corrected);
    };

    return (
        <div className="pagination-bar">
            <button type="button" className="pagination-nav-btn" disabled={page === 1} onClick={() => goToPage(page - 1)}>
                ◀ 이전
            </button>

            <div className="pagination-pages">
                {pageList.map((entry) =>
                    typeof entry === "number" ? (
                        <button
                            key={entry}
                            type="button"
                            className={`pagination-page-btn ${entry === page ? "pagination-page-btn-active" : ""}`}
                            onClick={() => goToPage(entry)}
                        >
                            {entry}
                        </button>
                    ) : (
                        <span key={entry} className="pagination-ellipsis">
                            ...
                        </span>
                    )
                )}
            </div>

            {/* `FEATURE.md` §F-04 모바일 반응형 item 1 — 숫자 나열형+goto 입력창 대신 축약형("1 · 2605") 하나로 통합, CSS 미디어쿼리로 전환 */}
            <span className="pagination-compact">
                {page} · {totalPages}
            </span>

            <button type="button" className="pagination-nav-btn" disabled={!hasNextPage} onClick={() => goToPage(page + 1)}>
                다음 ▶
            </button>

            <div className="pagination-goto">
                페이지
                <input
                    type="text"
                    inputMode="numeric"
                    className="pagination-goto-input"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commitPageInput();
                    }}
                />
                / {totalPages}
                <button type="button" className="pagination-goto-btn" onClick={commitPageInput}>
                    이동
                </button>
            </div>
        </div>
    );
};

export default Pagination;
