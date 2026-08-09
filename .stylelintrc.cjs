// 2026-08-10 — opacity로 텍스트를 흐리게 하는 패턴이 세 번째로 재발해(가장 최근: report-cashflow-flow-op/
// report-pdf-button/left-panel-address-clear/grade-badge-btn-empty) 문서(DOMAIN.md §7.4)로만 남겨두는 걸
// 그만두고 빌드 단계(prebuild → lint:css, package.json)에서 강제한다. --text-muted 같은 고정 토큰 대신
// opacity: 0/0.1~0.9로 흐림 효과를 주는 모든 곳을 declaration-property-value-disallowed-list로 막는다.
//
// 정당한 예외(로딩 스켈레톤 애니메이션, :disabled/:hover 버튼 상태 피드백)는 그 줄에
// `/* stylelint-disable-next-line declaration-property-value-disallowed-list -- 사유 */`로 개별 허용 —
// 리뷰어가 "이게 진짜 예외가 맞나" 매번 눈으로 보게 하는 게 목적(전면 규칙 완화가 아니라 줄 단위 예외).
//
// stylelint-config-standard의 나머지 규칙(rgba→rgb 표기, 미디어쿼리 range 표기, 주석 앞 빈 줄 등)은 이번
// opacity 강제화와 무관한 기존 코드베이스 전반의 스타일 이슈라 함께 켜면 100여 건이 한꺼번에 걸려 정작
// opacity 규칙이 묻힌다 — 이 세션에서는 끄고, 별도로 다룰지는 나중에 판단.
// no-duplicate-selectors도 같은 이유로 꺼뒀지만 layout.css:344 .left-panel-address-search 중복은 실제
// 버그성 이슈라 별도 처리 필요(spawn_task로 분리 플래그).
module.exports = {
    extends: "stylelint-config-standard",
    rules: {
        "declaration-property-value-disallowed-list": {
            opacity: ["/^0(\\.[0-9]+)?$/"],
        },

        "custom-property-pattern": null,
        "selector-class-pattern": null,
        "keyframes-name-pattern": null,
        "no-descending-specificity": null,

        "comment-empty-line-before": null,
        "color-function-alias-notation": null,
        "color-function-notation": null,
        "alpha-value-notation": null,
        "custom-property-empty-line-before": null,
        "value-keyword-case": null,
        "media-feature-range-notation": null,
        "at-rule-empty-line-before": null,
        "rule-empty-line-before": null,
        "property-no-vendor-prefix": null,
        "declaration-block-no-redundant-longhand-properties": null,
        "no-duplicate-selectors": null,
    },
};
