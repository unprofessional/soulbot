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
    && rm -rf /var/lib/apt/lists/*

# Ensure font dirs exist (for custom fonts like Noto)
RUN mkdir -p /usr/share/fonts/truetype/noto /usr/share/fonts/opentype/noto

# Copy Noto fonts (optional but retained from your setup)
COPY fonts/truetype/noto/ /usr/share/fonts/truetype/noto/
COPY fonts/opentype/noto/ /usr/share/fonts/opentype/noto/

# Rebuild font cache AFTER all fonts are installed/copied
RUN fc-cache -f -v

# (Optional but recommended) Verify resolution at build-time
RUN fc-match Arial && fc-match "Arial:weight=bold"

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
