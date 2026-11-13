FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
COPY legacy/UICALC.cbl /legacy/UICALC.cbl
COPY modern/calculator.py /modern/calculator.py
RUN npm run build

FROM python:3.12-slim-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends gnucobol3 patch \
    && ln -sf "$(command -v cobc || command -v cobc3)" /usr/local/bin/cobc \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=web /web/dist ./frontend/dist
RUN sh oracle/build.sh
ENV NECRO_HOSTED=1
EXPOSE 8000
CMD ["uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8000"]
