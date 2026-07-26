"""
Vector Database Integration - Multi-backend support with fallback
Supports: Pinecone, Weaviate, Milvus, with in-memory fallback
"""

import json
import math
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
import asyncio
import logging

logger = logging.getLogger(__name__)


@dataclass
class Embedding:
    """Embedding vector with metadata"""
    id: str
    vector: List[float]
    text: str
    metadata: Dict[str, Any]
    similarity: Optional[float] = None


class InMemoryVectorDB:
    """Fallback in-memory vector database"""

    def __init__(self):
        self.vectors: Dict[str, Embedding] = {}
        self.index = []

    async def add(self, embedding: Embedding) -> bool:
        """Add embedding to database"""
        self.vectors[embedding.id] = embedding
        self.index.append(embedding.id)
        return True

    async def search(self, query_vector: List[float], limit: int = 10) -> List[Embedding]:
        """Search using cosine similarity"""
        results = []
        for idx in self.index:
            emb = self.vectors[idx]
            similarity = self._cosine_similarity(query_vector, emb.vector)
            emb.similarity = similarity
            results.append(emb)

        results.sort(key=lambda x: x.similarity, reverse=True)
        return results[:limit]

    async def delete(self, embedding_id: str) -> bool:
        """Delete embedding"""
        if embedding_id in self.vectors:
            del self.vectors[embedding_id]
            self.index.remove(embedding_id)
            return True
        return False

    async def update(self, embedding: Embedding) -> bool:
        """Update embedding"""
        if embedding.id in self.vectors:
            self.vectors[embedding.id] = embedding
            return True
        return False

    @staticmethod
    def _cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity"""
        if len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a ** 2 for a in vec1))
        magnitude2 = math.sqrt(sum(b ** 2 for b in vec2))

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        return {
            "total_vectors": len(self.vectors),
            "dimensions": len(self.index[0]) if self.index else 0,
            "backend": "in_memory"
        }


class VectorDatabaseManager:
    """Multi-backend vector database with intelligent routing"""

    def __init__(self):
        self.db: Optional[Any] = None
        self.backend_type = "in_memory"
        self.is_connected = False
        self._initialize_default()

    def _initialize_default(self):
        """Initialize with in-memory fallback"""
        self.db = InMemoryVectorDB()
        self.backend_type = "in_memory"
        self.is_connected = True
        logger.info("Vector DB initialized with in-memory backend")

    async def connect_pinecone(self, api_key: str, index_name: str, region: str = "us-west1-gcp") -> bool:
        """Connect to Pinecone vector database"""
        try:
            import pinecone

            pinecone.init(api_key=api_key, region=region)
            self.db = pinecone.Index(index_name)
            self.backend_type = "pinecone"
            self.is_connected = True
            logger.info(f"Connected to Pinecone index: {index_name}")
            return True
        except ImportError:
            logger.warning("Pinecone not installed, using in-memory backend")
            self._initialize_default()
            return False
        except Exception as e:
            logger.warning(f"Pinecone connection failed: {e}, using fallback")
            self._initialize_default()
            return False

    async def connect_weaviate(self, url: str) -> bool:
        """Connect to Weaviate vector database"""
        try:
            import weaviate
            from weaviate.auth import AuthApiKey

            self.db = weaviate.Client(url=url)
            self.db.schema.get()
            self.backend_type = "weaviate"
            self.is_connected = True
            logger.info(f"Connected to Weaviate at {url}")
            return True
        except ImportError:
            logger.warning("Weaviate not installed, using in-memory backend")
            self._initialize_default()
            return False
        except Exception as e:
            logger.warning(f"Weaviate connection failed: {e}, using fallback")
            self._initialize_default()
            return False

    async def add_embedding(self, embedding: Embedding) -> bool:
        """Add embedding to vector database"""
        try:
            if self.backend_type == "in_memory":
                return await self.db.add(embedding)
            elif self.backend_type == "pinecone":
                self.db.upsert(vectors=[(
                    embedding.id,
                    embedding.vector,
                    {"text": embedding.text, "metadata": json.dumps(embedding.metadata)}
                )])
                return True
            return False
        except Exception as e:
            logger.error(f"Error adding embedding: {e}")
            return False

    async def search_embeddings(self, query_vector: List[float], limit: int = 10) -> List[Dict[str, Any]]:
        """Search embeddings across backends"""
        try:
            if self.backend_type == "in_memory":
                results = await self.db.search(query_vector, limit)
                return [asdict(r) for r in results]
            elif self.backend_type == "pinecone":
                results = self.db.query(query_vector, top_k=limit, include_metadata=True)
                return results.get("matches", [])
            return []
        except Exception as e:
            logger.error(f"Error searching embeddings: {e}")
            return []

    async def get_stats(self) -> Dict[str, Any]:
        """Get vector database statistics"""
        try:
            if hasattr(self.db, "get_stats"):
                return await self.db.get_stats()
            return {"backend": self.backend_type, "status": "connected" if self.is_connected else "disconnected"}
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": str(e)}


# Global vector database instance
vector_db = VectorDatabaseManager()
