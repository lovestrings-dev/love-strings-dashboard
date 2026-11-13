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

ENTRYPOINT ["python", "/app/renderer.py"]
