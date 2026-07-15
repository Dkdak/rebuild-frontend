import { useState, useEffect } from "react";

interface DatasetItem {
    w: string;
    e: string;
}

interface LetterItem {
    char: string;
    id: number;
    used: boolean;
}

const dataset: DatasetItem[] = [
    { w: "사과", e: "🍎" }, { w: "기차", e: "🚂" }, { w: "나비", e: "🦋" },
    { w: "버스", e: "🚌" }, { w: "사자", e: "🦁" }, { w: "오리", e: "🦆" },
    { w: "바나나", e: "🍌" }, { w: "수박", e: "🍉" }, { w: "포도", e: "🍇" },
    { w: "당근", e: "🥕" }, { w: "토끼", e: "🐰" }, { w: "우유", e: "🥛" },
    { w: "모자", e: "🎩" }, { w: "치즈", e: "🧀" }, { w: "딸기", e: "🍓" },
    { w: "자동차", e: "🚗" }, { w: "비행기", e: "✈️" }, { w: "자전거", e: "🚲" },
    { w: "소방차", e: "🚒" }, { w: "경찰차", e: "🚓" }, { w: "원숭이", e: "🐵" },
    { w: "강아지", e: "🐶" }, { w: "고양이", e: "🐱" }, { w: "호랑이", e: "🐯" },
    { w: "코끼리", e: "🐘" }, { w: "기린", e: "🦒" }, { w: "토마토", e: "🍅" },
    { w: "식빵", e: "🍞" }, { w: "우산", e: "☂️" }, { w: "선물", e: "🎁" },
    { w: "풍선", e: "🎈" }, { w: "구름", e: "☁️" }, { w: "바다", e: "🌊" },
    { w: "나무", e: "🌳" }, { w: "가위", e: "✂️" }, { w: "연필", e: "✏️" },
    { w: "가방", e: "🎒" }, { w: "로봇", e: "🤖" }, { w: "인형", e: "🧸" },
    { w: "치마", e: "👗" }, { w: "바지", e: "🩳" }, { w: "양말", e: "🧦" },
    { w: "신발", e: "👟" }, { w: "모기", e: "🦟" }, { w: "벌", e: "🐝" },
    { w: "달팽이", e: "🐌" }, { w: "고래", e: "🐳" }, { w: "문어", e: "🐙" },
    { w: "꽃게", e: "🦀" }, { w: "거북이", e: "🐢" }
];

interface HangulGameProps {
    onBack: () => void;
}

export default function HangulGame({ onBack }: HangulGameProps) {
    const [currentStage, setCurrentStage] = useState<number>(0);
    const [placedLetters, setPlacedLetters] = useState<(LetterItem | null)[]>([]);
    const [shuffledLetters, setShuffledLetters] = useState<LetterItem[]>([]);
    const [feedback, setFeedback] = useState<string>("글자 카드를 눌러 기차에 태워주세요! 🚂");
    const [feedbackColor, setFeedbackColor] = useState<string>("#424242");
    const [isCorrect, setIsCorrect] = useState<boolean>(false);

    const isGameOver = currentStage >= dataset.length;
    const currentData = !isGameOver ? dataset[currentStage] : null;
    const targetWord = currentData ? currentData.w : "";

    const speakWord = (text: string) => {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "ko-KR";
            utterance.rate = 0.9;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
        }
    };

    const playBeep = (type: "success" | "fail") => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            
            const audioCtx = new AudioContextClass();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (type === "success") {
                oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
                oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.25);
            } else if (type === "fail") {
                oscillator.frequency.setValueAtTime(220.00, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.2);
            }
        } catch (e) {
            console.log("Audio Error");
        }
    };

    useEffect(() => {
        if (isGameOver) {
            speakWord("와, 축하합니다! 모든 단어 기차를 완료했어요!");
            return;
        }

        if (targetWord) {
            setPlacedLetters(Array(targetWord.length).fill(null));
            setIsCorrect(false);
            setFeedback("글자 카드를 눌러 기차에 태워주세요! 🚂");
            setFeedbackColor("#424242");

            const letters: LetterItem[] = targetWord.split("").map((char, index) => ({
                char,
                id: index,
                used: false
            }));

            if (targetWord.length === 2) {
                const extras = ["가", "나", "다", "로", "민", "지", "수", "하"];
                const randomExtra = extras[Math.floor(Math.random() * extras.length)];
                letters.push({ char: randomExtra, id: 99, used: false });
            }
            letters.sort(() => Math.random() - 0.5);
            setShuffledLetters(letters);

            const timer = setTimeout(() => speakWord(targetWord), 100);
            return () => clearTimeout(timer);
        }
    }, [currentStage, targetWord, isGameOver]);

    const selectLetter = (item: LetterItem) => {
        if (isCorrect) return;
        const emptyIndex = placedLetters.indexOf(null);
        if (emptyIndex !== -1) {
            const newShuffled = shuffledLetters.map((l) => (l.id === item.id ? { ...l, used: true } : l));
            const newPlaced = [...placedLetters];
            newPlaced[emptyIndex] = item;

            setShuffledLetters(newShuffled);
            setPlacedLetters(newPlaced);
            checkAnswer(newPlaced);
        }
    };

    const removeLetter = (index: number) => {
        const item = placedLetters[index];
        if (item) {
            const newShuffled = shuffledLetters.map((l) => (l.id === item.id ? { ...l, used: false } : l));
            const newPlaced = [...placedLetters];
            newPlaced[index] = null;

            setShuffledLetters(newShuffled);
            setPlacedLetters(newPlaced);
            setIsCorrect(false);
            setFeedback("글자 카드를 선택해 주세요!");
            setFeedbackColor("#424242");
        }
    };

    const checkAnswer = (currentPlaced: (LetterItem | null)[]) => {
        if (currentPlaced.indexOf(null) === -1) {
            const currentWord = currentPlaced.map((item) => item?.char).join("");
            if (currentWord === targetWord) {
                setFeedback("🎉 정답입니다! 칙칙폭폭 기차가 출발해요! 💨");
                setFeedbackColor("#2e7d32");
                setIsCorrect(true);
                playBeep("success");
                speakWord(targetWord);
            } else {
                setFeedback("❌ 어라? 글자 순서가 다른 것 같아요. 다시 해봐요!");
                setFeedbackColor("#d32f2f");
                playBeep("fail");
            }
        }
    };

    const nextStage = () => setCurrentStage((prev) => prev + 1);
    const resetGame = () => setCurrentStage(0);

    return (
        <div style={{
            fontFamily: "'Malgun Gothic', sans-serif",
            backgroundColor: "#e3f2fd",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            margin: 0,
            textAlign: "center",
            overflow: "hidden",
            userSelect: "none",
            boxSizing: "border-box"
        }}>
            <div style={{
                backgroundColor: "white",
                padding: "25px",
                borderRadius: "25px",
                boxShadow: "0 12px 24px rgba(0,0,0,0.15)",
                width: "90%",
                maxWidth: "420px",
                position: "relative"
            }}>
                <button onClick={onBack} style={{ position: "absolute", top: "25px", left: "25px", border: "none", fontSize: "14px", fontWeight: "bold", color: "#555", background: "#eee", padding: "6px 12px", borderRadius: "12px", boxShadow: "0 3px 0 #ccc", cursor: "pointer" }}>🏠 홈으로</button>
                
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "10px", minHeight: "35px" }}>
                    {!isGameOver && (
                        <>
                            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1565c0", backgroundColor: "#e3f2fd", padding: "5px 15px", borderRadius: "20px", marginRight: "auto", marginLeft: "70px" }}>
                                [{currentStage + 1}/50]
                            </div>
                            <button onClick={() => speakWord(targetWord)} style={{ background: "#ffb74d", border: "none", borderRadius: "12px", padding: "6px 12px", fontSize: "14px", fontWeight: "bold", color: "white", cursor: "pointer", boxShadow: "0 3px 0 #f57c00" }}>🔊 다시듣기</button>
                        </>
                    )}
                </div>

                {isGameOver ? (
                    <div>
                        <div style={{ fontSize: "80px", margin: "15px 0", marginTop: "25px" }}>👑</div>
                        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#2e7d32", margin: "15px 0" }}>와~! 50단계 모든 단어 기차를 정복했어요!</div>
                        <button onClick={resetGame} style={{ background: "#2196f3", color: "white", border: "none", borderRadius: "15px", padding: "12px 30px", fontSize: "20px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 5px 0 #0b7dda" }}>처음부터 다시하기 🔄</button>
                    </div>
                ) : (
                    <>
                        {/* 💡 이모지 크기를 시원시원하게 80px로 원상복구했습니다 */}
                        <div style={{ fontSize: "80px", lineHeight: 1, margin: "15px 0", marginTop: "25px" }}>{currentData?.e}</div>

                        <div style={{ background: "repeating-linear-gradient(90deg, #795548, #795548 10px, #bb8f8f 10px, #bb8f8f 20px)", height: "8px", width: "100%", marginTop: "75px", marginBottom: "30px", position: "relative", borderRadius: "4px" }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: "15px", position: "absolute", width: "100%", top: "-45px", left: 0 }}>
                                {placedLetters.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => item && removeLetter(idx)}
                                        style={{
                                            width: "65px", height: "55px",
                                            backgroundColor: item ? "#ff7043" : "#eceff1",
                                            border: item ? "3px solid #d84315" : "3px dashed #b0bec5",
                                            borderRadius: "8px", display: "flex", justifyContent: "center", alignItems: "center",
                                            fontSize: "24px", fontWeight: "bold", color: item ? "white" : "#b0bec5",
                                            cursor: "pointer", boxShadow: item ? "inset 0 -5px 0 rgba(0,0,0,0.2)" : "none"
                                        }}
                                    >
                                        {item ? item.char : "?"}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ fontSize: "18px", fontWeight: "bold", height: "25px", margin: "15px 0", color: feedbackColor }}>{feedback}</div>

                        <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "20px", minHeight: "70px", alignItems: "center" }}>
                            {shuffledLetters.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => !item.used && selectLetter(item)}
                                    style={{
                                        width: "60px", height: "60px",
                                        backgroundColor: "#fffbcf", border: "3px solid #fbc02d", borderRadius: "12px",
                                        display: "flex", justifyContent: "center", alignItems: "center",
                                        fontSize: "26px", fontWeight: "bold", color: "#c49000", cursor: "pointer",
                                        boxShadow: "0 5px 0 #fbc02d", visibility: item.used ? "hidden" : "visible"
                                    }}
                                >
                                    {item.char}
                                </div>
                            ))}
                        </div>

                        {isCorrect && (
                            <button onClick={nextStage} style={{ background: "#4caf50", color: "white", border: "none", borderRadius: "15px", padding: "12px 30px", fontSize: "20px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 5px 0 #2e7d32", marginTop: "15px" }}>다음 기차 출발! ▶</button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}