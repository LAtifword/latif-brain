"""
Knowledge Graph
Manages entities, relationships, and semantic triples
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

class KnowledgeGraph:
    """Knowledge graph management"""

    def __init__(self):
        self.entities = {}
        self.relationships = []
        self.triples = []

    async def initialize(self):
        """Initialize knowledge graph"""
        logger.info("Initializing Knowledge Graph...")

    async def add_entity(
        self,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None
    ) -> str:
        """Add entity to knowledge graph"""

        entity_id = str(uuid.uuid4())
        entity = {
            "id": entity_id,
            "name": name,
            "type": entity_type,
            "description": description,
            "properties": properties or {},
            "created_at": datetime.now().isoformat(),
            "relations_count": 0
        }

        self.entities[entity_id] = entity
        logger.info(f"Added entity: {name} ({entity_type})")
        return entity_id

    async def add_relationship(
        self,
        source_id: str,
        target_id: str,
        relation_type: str,
        weight: float = 1.0
    ) -> bool:
        """Add relationship between entities"""

        if source_id not in self.entities or target_id not in self.entities:
            return False

        relationship = {
            "id": str(uuid.uuid4()),
            "source": source_id,
            "target": target_id,
            "type": relation_type,
            "weight": weight,
            "created_at": datetime.now().isoformat()
        }

        self.relationships.append(relationship)

        # Update entity relation counts
        self.entities[source_id]["relations_count"] += 1
        self.entities[target_id]["relations_count"] += 1

        logger.info(f"Added relationship: {relation_type}")
        return True

    async def add_triple(
        self,
        subject: str,
        predicate: str,
        obj: str
    ) -> bool:
        """Add RDF triple"""

        triple = {
            "id": str(uuid.uuid4()),
            "subject": subject,
            "predicate": predicate,
            "object": obj,
            "created_at": datetime.now().isoformat()
        }

        self.triples.append(triple)
        logger.info(f"Added triple: {subject} -[{predicate}]-> {obj}")
        return True

    async def get_stats(self) -> Dict[str, Any]:
        """Get knowledge graph statistics"""

        return {
            "entity_count": len(self.entities),
            "relationship_count": len(self.relationships),
            "triple_count": len(self.triples),
            "entity_types": list(set(e["type"] for e in self.entities.values())),
            "last_updated": datetime.now().isoformat()
        }

    async def get_entity(self, entity_id: str) -> Optional[Dict[str, Any]]:
        """Get entity details"""
        entity = self.entities.get(entity_id)

        if entity:
            # Get related entities
            related = [
                r for r in self.relationships
                if r["source"] == entity_id or r["target"] == entity_id
            ]
            entity["related_entities"] = related

        return entity

    async def get_recent_entities(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent entities"""

        entities = sorted(
            self.entities.values(),
            key=lambda e: e["created_at"],
            reverse=True
        )

        return entities[:limit]

    async def search(
        self,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search knowledge graph"""

        query_lower = query.lower()
        results = []

        # Search entities
        for entity in self.entities.values():
            if (query_lower in entity["name"].lower() or
                query_lower in (entity.get("description") or "").lower()):
                results.append({
                    "type": "entity",
                    "id": entity["id"],
                    "name": entity["name"],
                    "entity_type": entity["type"],
                    "score": 0.9
                })

        # Search triples
        for triple in self.triples:
            if query_lower in triple["subject"].lower() or query_lower in triple["object"].lower():
                results.append({
                    "type": "relationship",
                    "subject": triple["subject"],
                    "predicate": triple["predicate"],
                    "object": triple["object"],
                    "score": 0.7
                })

        # Sort by score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    async def get_entity_connections(self, entity_id: str, depth: int = 2) -> Dict[str, Any]:
        """Get entity connection graph"""

        if entity_id not in self.entities:
            return {}

        entity = self.entities[entity_id]
        connections = {
            "entity": entity,
            "direct_connections": [],
            "secondary_connections": []
        }

        # Direct connections
        for rel in self.relationships:
            if rel["source"] == entity_id:
                target = self.entities.get(rel["target"])
                connections["direct_connections"].append({
                    "entity": target,
                    "relation": rel["type"],
                    "weight": rel["weight"]
                })

        return connections
