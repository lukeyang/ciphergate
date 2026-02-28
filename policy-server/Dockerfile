FROM python:3.11-slim

WORKDIR /app

COPY policy-server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY policy-server/app ./app
COPY policy-server/keys ./keys

EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
