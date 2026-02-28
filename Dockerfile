FROM node:18-alpine

WORKDIR /app

# Install python, pip, curl, unzip for yt-dlp and deno
RUN apk add --no-cache python3 py3-pip curl unzip

# Install deno (JS runtime for yt-dlp)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="${DENO_INSTALL}/bin:${PATH}"

# Install yt-dlp
RUN pip3 install yt-dlp --break-system-packages

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

EXPOSE 8080

CMD ["pnpm", "start"]
