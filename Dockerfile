# Stage 1: Install dependencies
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json tsconfig.base.json tsconfig.json biome.json bunfig.toml ./
COPY packages/chronocrystal/package.json packages/chronocrystal/package.json
RUN bun install --frozen-lockfile

COPY packages/chronocrystal packages/chronocrystal

# Stage 2: Runtime
FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install simplex-chat CLI binary from GitHub releases
RUN curl -L -o /usr/local/bin/simplex-chat \
    "https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86_64" \
    && chmod +x /usr/local/bin/simplex-chat

# Install Bun runtime
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app
COPY --from=build /app /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Data volume for simplex-chat database
VOLUME /data

ENV SIMPLEX_WS_URL=ws://localhost:5225
ENV DATA_DIR=/data

CMD ["/entrypoint.sh"]