FROM node:18.18-bullseye

# Install the necessary Canvas/Cairo libs + fontconfig
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig

# Install ffmpeg and ffprobe
RUN apt-get update && apt-get install -y ffmpeg

# Ensure font dirs exist
RUN mkdir -p /usr/share/fonts/truetype/noto /usr/share/fonts/opentype/noto

# Copy all Noto fonts into the image (no more piecemeal COPY)
COPY fonts/truetype/noto/ /usr/share/fonts/truetype/noto/
COPY fonts/opentype/noto/ /usr/share/fonts/opentype/noto/

# Rebuild font cache
RUN fc-cache -f -v

# set /app directory as default working directory
WORKDIR /app/
COPY . /app/

# Run NPM ci (install)
RUN npm ci --verbose

# expose for HTTP and HTTPS
EXPOSE 80 443

# cmd to start service
CMD ["npm", "start"]
