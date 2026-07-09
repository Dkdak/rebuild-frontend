# Node.js 이미지를 사용
FROM node:22.14.0-alpine

# 작업 디렉토리를 /app으로 설정
WORKDIR /app

# package.json 및 package-lock.json 파일을 작업 디렉토리로 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 프로젝트의 모든 파일을 작업 디렉토리로 복사
COPY . .

# 깃허브 액션에서 넘겨준 변수를 도커 빌드 환경 내부로 전달
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# 5. 운영용(Production) 정적 파일 빌드 진행 (dist 폴더 생성)
RUN npm run build

# 6. 정적 파일을 서빙해 줄 가벼운 패키지(serve) 설치
RUN npm install -g serve

# 7. 포트 오픈 (기존 유지)
EXPOSE 5173

# 8. 개발 서버(dev) 대신, 빌드된 결과물(dist)을 프로덕션 모드로 실행
CMD ["serve", "-s", "dist", "-l", "5173"]