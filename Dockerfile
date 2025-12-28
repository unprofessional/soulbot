FROM node:18.18-bullseye

# Install the necessary Canvas/Cairo libs
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

# Install ffmpeg and ffprobe
RUN apt-get update && apt-get install -y ffmpeg

# Copy Noto fonts into the image
COPY fonts/truetype/noto/NotoColorEmoji.ttf \
     /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf

COPY fonts/truetype/noto/NotoSansMath-Regular.ttf \
     /usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf

COPY fonts/truetype/noto/NotoSansBamum-Regular.ttf \
     /usr/share/fonts/truetype/noto/NotoSansBamum-Regular.ttf

COPY fonts/truetype/noto/NotoSansEgyptianHieroglyphs-Regular.ttf \
     /usr/share/fonts/truetype/noto/NotoSansEgyptianHieroglyphs-Regular.ttf

COPY fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc \
     /usr/share/fonts/opentype/noto/NotoSansCJK-VF.ttf.ttc

RUN apt-get install -y fontconfig && fc-cache -f -v

# set /app directory as default working directory
WORKDIR /app/
COPY . /app/

# Run NPM ci (install)
RUN npm ci --verbose

# expose for HTTP and HTTPS
EXPOSE 80 443

# cmd to start service
CMD ["npm", "start"]
