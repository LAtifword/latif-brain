"""
RAG v2 - Advanced Hybrid Search Engine
Combines BM25 lexical search with vector semantic search, re-ranking, and metadata filtering
"""

import logging
import math
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Single search result"""
    doc_id: str
    title: str
    content: str
    metadata: Dict[str, Any]
    relevance_score: float
    search_type: str  # "lexical", "semantic", or "hybrid"


class SimpleVectorizer:
    """Simple vectorizer for semantic search"""

    @staticmethod
    def simple_embed(text: str) -> List[float]:
        """Generate simple embedding"""
        # Character-level n-gram approach for semantic understanding
        text = text.lower()
        embedding = {}

        # Unigrams (single chars)
        for char in text:
            if char.isalnum():
                embedding[char] = embedding.get(char, 0) + 1

        # Bigrams
        for i in range(len(text) - 1):
            bigram = text[i:i+2]
            if all(c.isalnum() or c.isspace() for c in bigram):
                embedding[f"_bg_{bigram}"] = embedding.get(f"_bg_{bigram}", 0) + 1

        # Convert to vector
        vector_size = 256
        vector = [0.0] * vector_size

        for key, count in embedding.items():
            hash_val = hash(key) % vector_size
            vector[hash_val] += count

        # Normalize
        magnitude = sum(v ** 2 for v in vector) ** 0.5
        if magnitude > 0:
            vector = [v / magnitude for v in vector]

        return vector

    @staticmethod
    def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity"""
        if len(vec1) != len(vec2):
            return 0.0

        dot = sum(a * b for a, b in zip(vec1, vec2))
        mag1 = sum(a ** 2 for a in vec1) ** 0.5
        mag2 = sum(b ** 2 for b in vec2) ** 0.5

        if mag1 == 0 or mag2 == 0:
            return 0.0

        return dot / (mag1 * mag2)


class BM25Scorer:
    """BM25 algorithm implementation for lexical search"""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1  # Term frequency saturation
        self.b = b    # Field length normalization

    def tokenize(self, text: str) -> List[str]:
        """Simple tokenization"""
        text = text.lower()
        # Remove punctuation, split by whitespace
        import re
        tokens = re.findall(r'\b\w+\b', text)
        return tokens

    def calculate_score(
        self,
        query_tokens: List[str],
        doc_tokens: List[str],
        avg_doc_length: float,
        doc_frequency: Dict[str, int],
        total_docs: int
    ) -> float:
        """Calculate BM25 score"""
        score = 0.0
        doc_length = len(doc_tokens)

        for token in set(query_tokens):
            if token not in doc_tokens:
                continue

            # Term frequency
            term_freq = doc_tokens.count(token)

            # Inverse document frequency
            doc_freq = doc_frequency.get(token, 1)
            idf = math.log((total_docs - doc_freq + 0.5) / (doc_freq + 0.5) + 1)

            # BM25 formula
            numerator = idf * term_freq * (self.k1 + 1)
            denominator = term_freq + self.k1 * (1 - self.b + self.b * (doc_length / avg_doc_length))

            score += numerator / denominator

        return score


class HybridRAGv2:
    """Advanced hybrid RAG engine"""

    def __init__(self):
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.bm25 = BM25Scorer()
        self.vectorizer = SimpleVectorizer()
        self.doc_frequencies: Dict[str, int] = {}
        self.total_tokens = 0
        self.avg_doc_length = 0.0

    def add_document(
        self,
        doc_id: str,
        title: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Add document to index"""
        try:
            tokens = self.bm25.tokenize(content)

            # Update document frequencies
            for token in set(tokens):
                self.doc_frequencies[token] = self.doc_frequencies.get(token, 0) + 1

            # Update average doc length
            total_docs = len(self.documents) + 1
            self.total_tokens += len(tokens)
            self.avg_doc_length = self.total_tokens / total_docs

            # Store document
            self.documents[doc_id] = {
                "title": title,
                "content": content,
                "metadata": metadata or {},
                "tokens": tokens,
                "embedding": self.vectorizer.simple_embed(content)
            }

            logger.info(f"Added document: {doc_id} ({len(tokens)} tokens)")
            return True
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            return False

    def search(
        self,
        query: str,
        limit: int = 10,
        alpha: float = 0.5,
        metadata_filter: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Hybrid search combining BM25 and semantic search

        Args:
            query: Search query
            limit: Maximum results
            alpha: Weight for BM25 (1-alpha for semantic)
            metadata_filter: Filter by metadata
        """
        if not self.documents:
            return []

        query_tokens = self.bm25.tokenize(query)
        query_embedding = self.vectorizer.simple_embed(query)

        results = []

        # Score all documents
        for doc_id, doc in self.documents.items():
            # Check metadata filter
            if metadata_filter:
                doc_meta = doc.get("metadata", {})
                if not all(doc_meta.get(k) == v for k, v in metadata_filter.items()):
                    continue

            # BM25 score
            bm25_score = self.bm25.calculate_score(
                query_tokens,
                doc["tokens"],
                self.avg_doc_length,
                self.doc_frequencies,
                len(self.documents)
            )

            # Semantic (cosine) score
            semantic_score = self.vectorizer.cosine_similarity(
                query_embedding,
                doc["embedding"]
            )

            # Hybrid score
            hybrid_score = alpha * (bm25_score / max(1, self.bm25.calculate_score(
                query_tokens, query_tokens, self.avg_doc_length, self.doc_frequencies, len(self.documents)
            ) or 1)) + (1 - alpha) * semantic_score

            if hybrid_score > 0.01:  # Minimum relevance threshold
                results.append(SearchResult(
                    doc_id=doc_id,
                    title=doc["title"],
                    content=doc["content"],
                    metadata=doc["metadata"],
                    relevance_score=hybrid_score,
                    search_type="hybrid"
                ))

        # Sort by relevance and apply limit
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:limit]

    def search_by_metadata(
        self,
        filter_criteria: Dict[str, Any],
        limit: int = 10
    ) -> List[SearchResult]:
        """Search documents by metadata filter"""
        results = []

        for doc_id, doc in self.documents.items():
            doc_meta = doc.get("metadata", {})
            if all(doc_meta.get(k) == v for k, v in filter_criteria.items()):
                results.append(SearchResult(
                    doc_id=doc_id,
                    title=doc["title"],
                    content=doc["content"],
                    metadata=doc_meta,
                    relevance_score=1.0,
                    search_type="metadata"
                ))

        return results[:limit]

    def rerank_results(
        self,
        results: List[SearchResult],
        reranking_query: str,
        limit: int = 5
    ) -> List[SearchResult]:
        """Re-rank search results using semantic similarity"""
        if not results:
            return results

        query_embedding = self.vectorizer.simple_embed(reranking_query)

        for result in results:
            doc = self.documents.get(result.doc_id)
            if doc:
                similarity = self.vectorizer.cosine_similarity(
                    query_embedding,
                    doc["embedding"]
                )
                result.relevance_score = (result.relevance_score + similarity) / 2

        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results[:limit]

    def get_stats(self) -> Dict[str, Any]:
        """Get RAG engine statistics"""
        return {
            "total_documents": len(self.documents),
            "total_unique_tokens": len(self.doc_frequencies),
            "avg_doc_length": self.avg_doc_length,
            "total_tokens_indexed": self.total_tokens,
            "avg_token_frequency": (
                sum(self.doc_frequencies.values()) / len(self.doc_frequencies)
                if self.doc_frequencies else 0
            )
        }

    def delete_document(self, doc_id: str) -> bool:
        """Delete document from index"""
        if doc_id in self.documents:
            del self.documents[doc_id]
            logger.info(f"Deleted document: {doc_id}")
            return True
        return False


# Global instance
hybrid_rag = HybridRAGv2()
