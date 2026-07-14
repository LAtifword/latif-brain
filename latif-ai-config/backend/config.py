"""
Configuration
Settings for LATIF GX Enterprise Server
"""

import os
from typing import Optional

class Settings:
    """Application settings"""

    # Server
    SERVER_HOST: str = os.getenv("SERVER_HOST", "127.0.0.1")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # Ollama/llama.cpp
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "127.0.0.1")
    OLLAMA_PORT: int = int(os.getenv("OLLAMA_PORT", "11434"))
    LLAMA_CPP_HOST: str = os.getenv("LLAMA_CPP_HOST", "127.0.0.1")
    LLAMA_CPP_PORT: int = int(os.getenv("LLAMA_CPP_PORT", "8000"))

    # Model settings
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "llama2")
    MAX_TOKENS: int = int(os.getenv("MAX_TOKENS", "2048"))
    TEMPERATURE: float = float(os.getenv("TEMPERATURE", "0.7"))

    # Agent settings
    MAX_AGENTS: int = int(os.getenv("MAX_AGENTS", "5"))
    AGENT_TIMEOUT: int = int(os.getenv("AGENT_TIMEOUT", "300"))

    # Workflow settings
    MAX_WORKFLOW_STEPS: int = int(os.getenv("MAX_WORKFLOW_STEPS", "50"))
    WORKFLOW_TIMEOUT: int = int(os.getenv("WORKFLOW_TIMEOUT", "3600"))

    # RAG settings
    RAG_CHUNK_SIZE: int = int(os.getenv("RAG_CHUNK_SIZE", "500"))
    RAG_OVERLAP: int = int(os.getenv("RAG_OVERLAP", "50"))
    RAG_RELEVANCE_THRESHOLD: float = float(os.getenv("RAG_RELEVANCE_THRESHOLD", "0.3"))
    MAX_DOCUMENT_SIZE: int = int(os.getenv("MAX_DOCUMENT_SIZE", "10485760"))  # 10MB

    # Knowledge Graph settings
    MAX_ENTITIES: int = int(os.getenv("MAX_ENTITIES", "100000"))
    MAX_RELATIONSHIPS: int = int(os.getenv("MAX_RELATIONSHIPS", "500000"))

    # API settings
    API_RATE_LIMIT: int = int(os.getenv("API_RATE_LIMIT", "100"))
    API_TIMEOUT: int = int(os.getenv("API_TIMEOUT", "60"))

    # Database/Storage
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    CACHE_DIR: str = os.getenv("CACHE_DIR", "./cache")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    @classmethod
    def get_ollama_url(cls) -> str:
        """Get Ollama base URL"""
        return f"http://{cls.OLLAMA_HOST}:{cls.OLLAMA_PORT}"

    @classmethod
    def get_llama_cpp_url(cls) -> str:
        """Get llama.cpp base URL"""
        return f"http://{cls.LLAMA_CPP_HOST}:{cls.LLAMA_CPP_PORT}"

settings = Settings()
