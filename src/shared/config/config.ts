/**
 * 프로젝트 공통 설정
 */
export const Config = {
    // 빌드 환경에 주입된 VITE_API_URL을 사용하고, 없을 때만 로컬 주소(9192)를 기본값으로 씁니다.
    API_URL: import.meta.env.VITE_API_URL || "http://localhost:9192",

    KAKAO: {
        MAP_KEY: "ef19cd2f002901ba27ec3a02af47c450",
    },
} as const;
