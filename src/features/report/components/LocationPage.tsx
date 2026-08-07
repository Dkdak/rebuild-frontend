// F-05 RightPanel "입지" 카드와 동일 상태 — 역/초등학교/마트 등 도보거리 계산 UI가 프로젝트 전체에 아직
// 없어(F-05 §2.1 "거리 계산 UI 미착수") 지어내지 않고 "정보 준비 중"만 표시한다. 착수되면 두 화면 다 같이 채운다.
const LocationPage = () => (
    <section className="right-panel-card">
        <h5 className="right-panel-card-title">주요 편의시설 접근성</h5>
        <p className="right-panel-field-note">정보 준비 중</p>
    </section>
);

export default LocationPage;
