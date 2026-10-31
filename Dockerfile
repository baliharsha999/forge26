# ==============================================================================
# Production Dockerfile for Advanced Government Information RAG System (FastAPI)
# ==============================================================================

FROM python:3.11-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOST=0.0.0.0 \
    PORT=8000

# Set container working directory
WORKDIR /app

# Install minimal OS dependencies and curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to take advantage of Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Pre-cache SentenceTransformer and Cross-Encoder model weights to avoid runtime download delays
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'); \
    CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Copy application source code, database, and indexed vector data
COPY app/ app/
COPY data/ data/
COPY evals/ evals/
COPY main.py .
COPY db.py .
COPY scraper.py .
COPY agent.py .
COPY cli.py .
COPY schemes.db .

# Expose FastAPI port
EXPOSE 8000

# Health check to ensure API is responsive and vector stores are loaded
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FastAPI production server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
