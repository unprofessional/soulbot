FROM node:22.22.0-bullseye

# Install runtime/build deps for canvas + ffmpeg, then clean apt cache
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Ensure font dirs exist
RUN mkdir -p /usr/share/fonts/truetype/noto /usr/share/fonts/opentype/noto

# Copy all Noto fonts into the image (no more piecemeal COPY)
COPY fonts/truetype/noto/ /usr/share/fonts/truetype/noto/
COPY fonts/opentype/noto/ /usr/share/fonts/opentype/noto/

# Rebuild font cache
RUN fc-cache -f -v

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
