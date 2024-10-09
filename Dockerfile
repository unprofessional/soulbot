FROM node:18.18-bullseye

# Install ffmpeg and ffprobe
RUN apt-get update && apt-get install -y ffmpeg

# Copy the Noto Color Emoji font into the image
COPY fonts/NotoColorEmoji.ttf /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf

# set /app directory as default working directory
WORKDIR /app/
COPY . /app/

# Run NPM ci (install)
RUN npm ci --verbose

# expose for HTTP and HTTPS
EXPOSE 80 443

# cmd to start service
CMD ["npm", "start"]
