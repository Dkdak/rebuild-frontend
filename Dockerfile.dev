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

# React 앱의 기본 포트는 3000, 하지만 사용자가 지정한 포트를 사용
EXPOSE 5173

# 앱 실행 명령어 ( npm run dev를 실행하여 Vite 개발 서버를 시작)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]