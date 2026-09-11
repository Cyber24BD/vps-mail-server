FROM python:3.13-slim

# Install system dependencies needed for compiling extensions and network tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    dnsutils \
    iputils-ping \
    openssl \
    certbot \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install uv for fast, reliable package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency specifications
COPY pyproject.toml uv.lock* ./

# Install dependencies using uv into the system environment
RUN uv pip install --system -r pyproject.toml

# Copy backend source code
COPY . .

# Expose FastAPI application port
EXPOSE 8000

# Run FastAPI via uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
