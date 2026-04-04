FROM node:22.22.0-bullseye

# Install runtime/build deps for canvas + ffmpeg + fonts
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Rebuild font cache AFTER install
RUN fc-cache -f -v

# (Optional sanity checks at build time)
RUN fc-match "Liberation Sans" && \
    fc-match "DejaVu Sans" && \
    fc-match "Noto Sans CJK JP" && \
    fc-match "Noto Color Emoji"

# Set /app directory as default working directory
WORKDIR /app/

# Install deps first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --verbose

# Copy application source
COPY . /app/

# Expose for HTTP and HTTPS
EXPOSE 80 443

# Start service
CMD ["npm", "start"]
