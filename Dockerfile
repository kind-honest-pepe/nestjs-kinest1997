# Base image for arm64 architecture
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Prisma 생성 단계 추가
# RUN npx prisma generate

# TypeScript 컴파일
RUN npm run build

EXPOSE 3080 8000

# 프로덕션 모드로 NestJS 애플리케이션 실행
CMD ["npm", "run", "start"]