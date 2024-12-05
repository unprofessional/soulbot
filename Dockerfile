# FROM node:18.18-bullseye

# # Install the necessary Canvas/Cairo libs
# RUN apt-get update && apt-get install -y \
#     build-essential \
#     libcairo2-dev \
#     libpango1.0-dev \
#     libjpeg-dev \
#     libgif-dev \
#     librsvg2-dev

# # Install ffmpeg and ffprobe
# RUN apt-get update && apt-get install -y ffmpeg

# # Copy the Noto Color Emoji font into the image
# COPY fonts/truetype/noto/NotoColorEmoji.ttf /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf
# COPY fonts/truetype/noto/NotoSansMath-Regular.ttf /usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf
# COPY fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc /usr/share/fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc

# # set /app directory as default working directory
# WORKDIR /app/
# COPY . /app/

# # Run NPM ci (install)
# RUN npm ci --verbose

# # expose for HTTP and HTTPS
# EXPOSE 80 443

# # cmd to start service
# CMD ["npm", "start"]

FROM nvidia/cuda:11.8-runtime-bullseye

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Install build tools and dependencies for Canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    yasm \
    pkg-config \
    libass-dev \
    libfreetype6-dev \
    libgnutls28-dev \
    libmp3lame-dev \
    libtheora-dev \
    libvorbis-dev \
    libx264-dev \
    libx265-dev \
    libnuma-dev \
    nasm \
    git

# Install dependencies for FFmpeg and NVENC
RUN apt-get install -y \
    wget \
    software-properties-common \
    nvidia-cuda-toolkit

# Build FFmpeg with NVENC support
WORKDIR /ffmpeg
RUN git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
WORKDIR /ffmpeg/ffmpeg
RUN ./configure \
    --enable-nonfree \
    --enable-cuda \
    --enable-cuvid \
    --enable-nvenc \
    --enable-libnpp \
    --extra-cflags=-I/usr/local/cuda/include \
    --extra-ldflags=-L/usr/local/cuda/lib64 \
    --enable-gpl \
    --enable-libx264 \
    --enable-libx265 \
    --enable-libfreetype \
    --enable-libmp3lame \
    --enable-libvorbis \
    --enable-libtheora \
    --enable-libass
RUN make -j$(nproc) && make install

# Verify FFmpeg installation
RUN ffmpeg -codecs | grep nvenc

# Copy the Noto Color Emoji font into the image
COPY fonts/truetype/noto/NotoColorEmoji.ttf /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf
COPY fonts/truetype/noto/NotoSansMath-Regular.ttf /usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf
COPY fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc /usr/share/fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc

# Set /app directory as default working directory
WORKDIR /app/
COPY . /app/

# Install Node.js dependencies
RUN npm ci --verbose

# Expose for HTTP and HTTPS
EXPOSE 80 443

# CMD to start service
CMD ["npm", "start"]
