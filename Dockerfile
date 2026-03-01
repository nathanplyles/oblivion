FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg

RUN pip3 install -U yt-dlp --break-system-packages --root-user-action=ignore

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

EXPOSE 8080

CMD ["pnpm", "start"]
