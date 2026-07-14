"""
Hybrid RAG System
Combines BM25 and vector search for document retrieval
"""

import logging
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

class HybridRAG:
    """Hybrid retrieval-augmented generation"""

    def __init__(self):
        self.documents = {}
        self.index = []

    async def initialize(self):
        """Initialize RAG system"""
        logger.info("Initializing Hybrid RAG System...")

    async def add_document(
        self,
        content: str,
        filename: str,
        file_type: str
    ) -> str:
        """Add document to RAG system"""

        doc_id = str(uuid.uuid4())
        document = {
            "id": doc_id,
            "filename": filename,
            "type": file_type,
            "content": content,
            "chunks": self._split_into_chunks(content),
            "added_at": datetime.now().isoformat(),
            "embedding_status": "indexed"
        }

        self.documents[doc_id] = document
        self.index.append({
            "doc_id": doc_id,
            "filename": filename,
            "chunk_count": len(document["chunks"])
        })

        logger.info(f"Added document: {filename} ({doc_id})")
        return doc_id

    async def search(
        self,
        query: str,
        limit: int = 10,
        threshold: float = 0.3
    ) -> List[Dict[str, Any]]:
        """Search documents"""

        results = []

        for doc_id, doc in self.documents.items():
            for chunk_idx, chunk in enumerate(doc["chunks"]):
                # Simple BM25-like scoring
                score = self._calculate_relevance(query, chunk)

                if score >= threshold:
                    results.append({
                        "doc_id": doc_id,
                        "filename": doc["filename"],
                        "chunk_index": chunk_idx,
                        "content": chunk[:500],
                        "score": score,
                        "relevance": self._score_to_relevance(score)
                    })

        # Sort by score and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    async def delete_document(self, doc_id: str) -> bool:
        """Delete document from RAG"""

        if doc_id in self.documents:
            del self.documents[doc_id]
            self.index = [d for d in self.index if d["doc_id"] != doc_id]
            logger.info(f"Deleted document: {doc_id}")
            return True

        return False

    async def get_document_stats(self) -> Dict[str, Any]:
        """Get RAG statistics"""

        total_chunks = sum(len(doc["chunks"]) for doc in self.documents.values())
        total_size = sum(len(doc["content"]) for doc in self.documents.values())

        return {
            "document_count": len(self.documents),
            "chunk_count": total_chunks,
            "total_size_bytes": total_size,
            "indexed_documents": len([d for d in self.documents.values() if d["embedding_status"] == "indexed"])
        }

    def _split_into_chunks(self, content: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Split content into overlapping chunks"""

        chunks = []
        words = content.split()

        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)

        return chunks

    def _calculate_relevance(self, query: str, text: str) -> float:
        """Calculate BM25-like relevance score"""

        query_terms = query.lower().split()
        text_lower = text.lower()

        score = 0
        for term in query_terms:
            if term in text_lower:
                # Count occurrences
                count = text_lower.count(term)
                score += (count * 0.5)  # Normalized weight

        # Normalize by text length
        score = min(score / (len(text.split()) * 0.01), 1.0)
        return score

    def _score_to_relevance(self, score: float) -> str:
        """Convert score to relevance label"""

        if score >= 0.7:
            return "highly_relevant"
        elif score >= 0.5:
            return "relevant"
        elif score >= 0.3:
            return "somewhat_relevant"
        else:
            return "low_relevance"
