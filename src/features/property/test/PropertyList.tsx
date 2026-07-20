import { useEffect, useState } from "react";
import { findAllProperties, type TestPropertyResponse } from "../api/propertyApi";
import HangulGame from "../../game/HangulGame"; // 👈 방금 만든 게임 컴포넌트 가져오기

function PropertyList() {
    const [properties, setProperties] = useState<TestPropertyResponse[]>([]);
    const [showGame, setShowGame] = useState<boolean>(false); // 👈 게임 화면 전환 상태 추가

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await findAllProperties();
            setProperties(data);
        } catch (error) {
            console.error(error);
        }
    };

    // 🚂 만약 게임이 켜진 상태라면 리스트 대신 게임 화면을 통째로 렌더링
    if (showGame) {
        return <HangulGame onBack={() => setShowGame(false)} />;
    }

    return (
        <div style={{ padding: "30px", fontFamily: "Arial, sans-serif", maxWidth: "800px", margin: "0 auto" }}>
            
            {/* 🌟 1. 대시보드 상단 웰컴 배너 구역 */}
            <div style={{ 
                backgroundColor: "#f4f6f9", 
                borderRadius: "12px", 
                padding: "24px", 
                textAlign: "center", 
                marginBottom: "30px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.05)"
            }}>
                <h1 style={{ color: "#333", margin: "0 0 10px 0", fontSize: "28px" }}>👋 Hello, Welcome Back!</h1>
                <p style={{ color: "#666", margin: "0 0 15px 0" }}>인프라 배포가 완료되었습니다. 등록된 자산 현황을 실시간으로 확인하세요.</p>
                
                {/* 🚂 버튼 클릭 시 안전하게 React 내부 상태를 변경해 게임으로 진입 */}
                <div style={{ marginBottom: "20px" }}>
                    <button 
                        onClick={() => setShowGame(true)} 
                        style={{
                            display: "inline-block",
                            padding: "8px 16px",
                            backgroundColor: "#ff7043",
                            color: "white",
                            border: "none",
                            borderRadius: "20px",
                            fontWeight: "bold",
                            fontSize: "13px",
                            boxShadow: "0 3px 0 #d84315",
                            cursor: "pointer"
                        }}
                    >
                        🚂 단어 기차 놀이터 가기
                    </button>
                </div>
                
                <img 
                    src="https://illustrations.popsy.co/amber/work-from-home.svg" 
                    alt="Welcome Illustration" 
                    style={{ width: "100%", maxWidth: "250px", height: "auto", display: "block", margin: "0 auto" }}
                />
            </div>

            {/* 📊 2. 본문 타이틀 및 테이블 구역 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <h2 style={{ margin: 0, color: "#2c3e50" }}>🏢 Property List</h2>
                <span style={{ fontSize: "14px", color: "#2ecc71", fontWeight: "bold" }}>● 시스템 정상 가동 중-Dev 테스트</span>
            </div>

            <table style={{ 
                width: "100%", 
                borderCollapse: "separate", 
                borderSpacing: "0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                borderRadius: "8px",
                overflow: "hidden"
            }}>
                <thead>
                    <tr style={{ backgroundColor: "#34495e", color: "#fff" }}>
                        <th style={{ padding: "12px 15px", textAlign: "left", width: "80px" }}>ID</th>
                        <th style={{ padding: "12px 15px", textAlign: "left" }}>Asset Name</th>
                    </tr>
                </thead>

                <tbody>
                    {properties.length === 0 ? (
                        <tr>
                            <td colSpan={2} style={{ padding: "30px", textAlign: "center", color: "#999" }}>
                                📭 표시할 데이터가 존재하지 않습니다.
                            </td>
                        </tr>
                    ) : (
                        properties.map((property, index) => (
                            <tr key={property.id} style={{ 
                                backgroundColor: index % 2 === 0 ? "#fff" : "#fdfdfd",
                                borderBottom: "1px solid #eee"
                            }}>
                                <td style={{ padding: "12px 15px", color: "#7f8c8d", fontWeight: "bold" }}>{property.id}</td>
                                <td style={{ padding: "12px 15px", color: "#334455" }}>{property.name}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

export default PropertyList;