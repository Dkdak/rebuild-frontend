import {
    formatAreaDisplay,
    formatBuildYear,
    formatHouseholdCount,
    formatManwon,
    GRADE_CLASS,
    type PropertyItem,
} from "../api/searchApi";
import { PRICE_DISPLAY_TONE, resolvePriceDisplayLabel } from "../../market/api/marketApi";
import FavoriteButton from "../../favorites/components/FavoriteButton";

// F-04 매물 카드. 검색 결과와 관심목록(F-11 §2.1)이 같은 카드를 쓴다 — 관심목록 전용 카드를 따로 만들지 않는다.
// 데스크톱(2줄: 등급+유형+주소 / 면적·연식+시세+ROI)과 모바일(3줄: 등급+주소 / 유형+면적+년차 / 시세+ROI+상세보기)은
// 항목 묶음 자체가 달라(유형이 붙는 줄이 다름) 두 레이아웃을 각자 렌더링하고 breakpoint별로 하나만 보이게 한다.
interface PropertyCardProps {
    item: PropertyItem;
    selected: boolean;
    onSelect: () => void;
    // 모바일 전용 "상세보기" 버튼 — 상세 시트가 없는 화면(관심목록)에서는 넘기지 않는다.
    onOpenDetail?: () => void;
    // 카드 아래에 덧붙일 내용(관심목록의 등급 변화 배지 등).
    footer?: React.ReactNode;
}

const PropertyCard = ({ item, selected, onSelect, onOpenDetail, footer }: PropertyCardProps) => {
    const { main: areaMain, aux: areaAux } = formatAreaDisplay(item);
    const householdCountText = formatHouseholdCount(item.householdCount);
    const buildYearText = formatBuildYear(item.buildYear);
    const gradeClass = item.grade ? (GRADE_CLASS[item.grade] ?? "") : "";
    const gradeText = item.grade ?? "-";

    // 가격 표시는 estimatedPrice 기준(§2.1-h item 5/8) — 신뢰도 라벨은 배지와 아래 캡션이 같은 계산을 공유한다.
    const priceLabel =
        item.price == null && item.estimatedPrice.value != null
            ? resolvePriceDisplayLabel(item.estimatedPrice.confidenceLevel, false)
            : null;
    const auxLine = [areaAux, householdCountText].filter(Boolean).join(" · ");
    const priceNode =
        item.price != null ? (
            <span>{item.price}만원</span>
        ) : item.estimatedPrice.value != null ? (
            <span className="right-panel-estimate-anchor">
                시세 {formatManwon(item.estimatedPrice.value)}
                {priceLabel != null && (
                    <span className={`right-panel-estimate-tag right-panel-estimate-tag-${PRICE_DISPLAY_TONE[priceLabel]}`}>
                        신뢰도 {priceLabel}
                    </span>
                )}
            </span>
        ) : (
            <span>가격 정보 준비 중</span>
        );
    // roi==null이면 backend stage != FULL(F-05/F-10과 동일 근거) — "산정 중"은 곧 채워질 것처럼 오해를 줘서 "산출 불가".
    const roiNode = <span>ROI {item.roi != null ? `${Math.round(item.roi)}%` : "산출 불가"}</span>;

    return (
        <li
            className={`center-list-item ${selected ? "center-list-item-selected" : ""}`}
            onClick={onSelect}
        >
            <FavoriteButton buildingId={item.id} className="favorite-button-card" />
            <div className="center-list-item-row">
                <span className={`grade-text center-list-item-grade-leftmost ${gradeClass}`}>{gradeText}</span>
                <div className="center-list-item-content">
                    {/* 데스크톱 전용 2줄 */}
                    <div className="center-list-item-main center-list-item-desktop-line">
                        <span className="center-list-item-type">{item.propertyType}</span>
                        <span className="center-list-item-address">{item.address}</span>
                    </div>
                    <div className="center-list-item-meta center-list-item-desktop-line">
                        <span>
                            {areaMain}
                            {" · "}
                            {buildYearText}
                        </span>
                        {priceNode}
                        {roiNode}
                    </div>

                    {/* 모바일 전용 3줄 */}
                    <div className="center-list-item-mobile-line1">
                        <span className={`grade-text ${gradeClass}`}>{gradeText}</span>
                        <span className="center-list-item-address">{item.address}</span>
                    </div>
                    <div className="center-list-item-mobile-line2">
                        <span>{item.propertyType}</span>
                        <span>{areaMain}</span>
                        <span>{buildYearText}</span>
                    </div>
                    <div className="center-list-item-mobile-line3">
                        {priceNode}
                        {roiNode}
                        {onOpenDetail && (
                            <button
                                type="button"
                                className="center-list-item-detail-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect();
                                    onOpenDetail();
                                }}
                            >
                                상세보기
                            </button>
                        )}
                    </div>

                    {auxLine && <div className="center-list-item-area-aux">{auxLine}</div>}
                    {footer}
                </div>
            </div>
        </li>
    );
};

export default PropertyCard;
