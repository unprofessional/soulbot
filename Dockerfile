FROM node:22.22.2-bookworm AS build

# Build deps for native modules like canvas.
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@11.8.0

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --verbose

# Copy application source.
COPY . /app/

# Keep the runtime image smaller and lower-risk by dropping devDependencies.
RUN npm prune --omit=dev


FROM node:22.22.2-bookworm-slim

# Runtime-only shared libs for canvas, fonts, and ffmpeg.
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    fontconfig \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@11.8.0

# Rebuild font cache after font installation.
RUN fc-cache -f -v

# Sanity checks at build time.
RUN fc-match "Liberation Sans" && \
    fc-match "DejaVu Sans" && \
    fc-match "Noto Sans CJK JP" && \
    fc-match "Noto Color Emoji"

WORKDIR /app

# Copy the pruned app and node_modules from the build stage.
COPY --from=build /app /app

EXPOSE 80 443

CMD ["npm", "start"]
