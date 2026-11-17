FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# ffmpeg is the only system dependency. Cloud Run Jobs executes this image
# without exposing an HTTP endpoint.
RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY renderer.py ./
COPY tests ./tests
# Exercise actual FFmpeg alpha, stacking, timing and trim behavior before this
# image can be deployed. Synthetic fixtures never access Cloud Storage.
RUN FFMPEG_TEST_BINARY=/usr/bin/ffmpeg python -m unittest discover -s tests -v

ENTRYPOINT ["python", "/app/renderer.py"]
