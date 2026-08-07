// FEATURE_10_AI_REPORT.md §2.6: 전부 미구현 데이터 — 자리만 만들고 "준비 중"으로 채운다(§2.1 공통 원칙).
// 근거(사업기간·리스크·분담금)가 전부 없는 상태라 투자 의견 서술은 지금 채우면 근거 없는 서술이 되어 보류(§2.6 item 3).
const AIOpinionPage = () => (
    <>
        <section className="right-panel-card">
            <h5 className="right-panel-card-title">
                항목<span className="right-panel-estimate-tag">추정치 — 정식 산출 전</span>
            </h5>
            <dl className="right-panel-fact-list report-fact-grid">
                <div>
                    <dt>예상 사업기간</dt>
                    <dd>준비 중</dd>
                </div>
                <div>
                    <dt>사업 리스크</dt>
                    <dd>준비 중</dd>
                </div>
                <div>
                    <dt>예상 분담금</dt>
                    <dd>준비 중</dd>
                </div>
            </dl>
        </section>

        <section className="right-panel-card">
            <h5 className="right-panel-card-title">투자 의견 서술</h5>
            <p className="right-panel-field-note">준비 중</p>
        </section>
    </>
);

export default AIOpinionPage;
