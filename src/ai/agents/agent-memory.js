/**
 * Agent Memory System - Persistent and episodic memory for agents
 * Phase 3: Multi-level memory hierarchy with consolidation
 */

/**
 * Episodic Memory - Individual experiences and events
 */
export class EpisodicMemory {
  constructor(maxSize = 1000) {
    this.episodes = [];
    this.maxSize = maxSize;
  }

  /**
   * Store an episode (experience)
   */
  store(episode) {
    this.episodes.push({
      id: this.generateId(),
      timestamp: Date.now(),
      content: episode.content,
      importance: episode.importance || 0.5,
      tags: episode.tags || [],
      context: episode.context || {}
    });

    // Maintain size limit
    if (this.episodes.length > this.maxSize) {
      this.prune();
    }
  }

  /**
   * Recall episodes by relevance
   */
  recall(query, limit = 10) {
    const queryTokens = new Set(query.toLowerCase().split(/\s+/));

    return this.episodes
      .map(episode => ({
        ...episode,
        relevance: this.computeRelevance(episode, queryTokens)
      }))
      .filter(ep => ep.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Compute relevance score
   */
  computeRelevance(episode, queryTokens) {
    let score = 0;

    // Content relevance
    const contentTokens = episode.content.toLowerCase().split(/\s+/);
    const matches = contentTokens.filter(t => queryTokens.has(t)).length;
    score += (matches / Math.max(queryTokens.size, 1)) * 0.6;

    // Tag relevance
    const tagMatches = episode.tags.filter(tag => queryTokens.has(tag.toLowerCase())).length;
    score += (tagMatches / Math.max(episode.tags.length, 1)) * 0.3;

    // Recency boost
    const ageMs = Date.now() - episode.timestamp;
    const recencyScore = Math.exp(-ageMs / (30 * 24 * 60 * 60 * 1000)); // 30 day decay
    score += recencyScore * 0.1;

    // Importance boost
    score *= 1 + episode.importance;

    return Math.min(1, score);
  }

  /**
   * Prune least important old episodes
   */
  prune() {
    const toRemove = Math.ceil(this.maxSize * 0.2);

    this.episodes.sort((a, b) => {
      const scoreA = a.importance * (1 / (Date.now() - a.timestamp + 1));
      const scoreB = b.importance * (1 / (Date.now() - b.timestamp + 1));
      return scoreA - scoreB;
    });

    this.episodes = this.episodes.slice(toRemove);
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all episodes
   */
  clear() {
    this.episodes = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalEpisodes: this.episodes.length,
      maxSize: this.maxSize,
      utilizationPercent: ((this.episodes.length / this.maxSize) * 100).toFixed(1),
      oldestEpisode: this.episodes[0]?.timestamp,
      newestEpisode: this.episodes[this.episodes.length - 1]?.timestamp
    };
  }
}

/**
 * Semantic Memory - Facts and knowledge
 */
export class SemanticMemory {
  constructor() {
    this.facts = new Map();
    this.concepts = new Map();
  }

  /**
   * Store a fact
   */
  storeFact(subject, relation, object_, metadata = {}) {
    const key = `${subject}:${relation}:${object_}`;

    this.facts.set(key, {
      subject,
      relation,
      object: object_,
      confidence: metadata.confidence || 1.0,
      source: metadata.source,
      timestamp: Date.now()
    });

    // Update concept networks
    this.updateConcepts(subject, relation, object_);
  }

  /**
   * Retrieve facts
   */
  retrieveFacts(subject = null, relation = null) {
    const results = [];

    this.facts.forEach((fact, _key) => {
      if (subject && fact.subject !== subject) return;
      if (relation && fact.relation !== relation) return;
      results.push(fact);
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Update concept network
   */
  updateConcepts(subject, relation, object_) {
    const updateConcept = (conceptName) => {
      if (!this.concepts.has(conceptName)) {
        this.concepts.set(conceptName, {
          name: conceptName,
          relations: new Set(),
          relatedConcepts: new Set(),
          frequency: 0
        });
      }

      const concept = this.concepts.get(conceptName);
      concept.relations.add(relation);
      concept.frequency++;
    };

    updateConcept(subject);
    updateConcept(object_);

    // Link concepts
    const subjConcept = this.concepts.get(subject);
    const objConcept = this.concepts.get(object_);
    if (subjConcept && objConcept) {
      subjConcept.relatedConcepts.add(object_);
      objConcept.relatedConcepts.add(subject);
    }
  }

  /**
   * Query related concepts
   */
  queryRelated(concept, depth = 1) {
    const related = new Set();
    const queue = [[concept, 0]];

    while (queue.length > 0) {
      const [current, currentDepth] = queue.shift();

      if (currentDepth > depth) continue;
      if (related.has(current)) continue;

      related.add(current);

      const conceptData = this.concepts.get(current);
      if (conceptData) {
        conceptData.relatedConcepts.forEach(related_ => {
          if (!related.has(related_)) {
            queue.push([related_, currentDepth + 1]);
          }
        });
      }
    }

    return Array.from(related);
  }

  /**
   * Clear all facts
   */
  clear() {
    this.facts.clear();
    this.concepts.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalFacts: this.facts.size,
      uniqueConcepts: this.concepts.size,
      averageConceptFrequency: this.concepts.size > 0
        ? Array.from(this.concepts.values()).reduce((sum, c) => sum + c.frequency, 0) /
          this.concepts.size
        : 0
    };
  }
}

/**
 * Procedural Memory - Skills and learned procedures
 */
export class ProceduralMemory {
  constructor() {
    this.procedures = new Map();
  }

  /**
   * Store a procedure/skill
   */
  storeSkill(skillName, procedure) {
    this.procedures.set(skillName, {
      name: skillName,
      steps: procedure.steps || [],
      prerequisites: procedure.prerequisites || [],
      successRate: 0,
      timesExecuted: 0,
      lastExecuted: null,
      difficulty: procedure.difficulty || 'medium'
    });
  }

  /**
   * Retrieve a skill
   */
  getSkill(skillName) {
    return this.procedures.get(skillName);
  }

  /**
   * Record skill execution
   */
  recordExecution(skillName, success) {
    const skill = this.procedures.get(skillName);
    if (!skill) return;

    skill.timesExecuted++;
    if (success) {
      skill.successRate = (skill.successRate * (skill.timesExecuted - 1) + 1) / skill.timesExecuted;
    } else {
      skill.successRate = (skill.successRate * (skill.timesExecuted - 1)) / skill.timesExecuted;
    }
    skill.lastExecuted = Date.now();
  }

  /**
   * Get skills ranked by proficiency
   */
  getRankedSkills() {
    return Array.from(this.procedures.values())
      .sort((a, b) => b.successRate - a.successRate)
      .map(skill => ({
        ...skill,
        proficiency: (skill.successRate * 100).toFixed(1) + '%'
      }));
  }

  /**
   * Clear all procedures
   */
  clear() {
    this.procedures.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSkills: this.procedures.size,
      averageSuccessRate:
        this.procedures.size > 0
          ? (Array.from(this.procedures.values()).reduce((sum, s) => sum + s.successRate, 0) /
            this.procedures.size *
            100).toFixed(1) + '%'
          : '0%',
      totalExecutions: Array.from(this.procedures.values()).reduce((sum, s) => sum + s.timesExecuted, 0)
    };
  }
}

/**
 * Unified Agent Memory - Combines all memory types
 */
export class AgentMemory {
  constructor(agentId) {
    this.agentId = agentId;
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.procedural = new ProceduralMemory();
    this.lastConsolidation = Date.now();
    this.consolidationInterval = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Consolidate memory (transfer episodic to semantic)
   */
  consolidate() {
    const timeSinceConsolidation = Date.now() - this.lastConsolidation;

    if (timeSinceConsolidation < this.consolidationInterval) {
      return; // Too soon to consolidate
    }

    // Extract high-importance episodes and convert to facts
    const importantEpisodes = this.episodic.episodes.filter(ep => ep.importance > 0.7);

    importantEpisodes.forEach(episode => {
      // Simple extraction: treat content as facts
      const tokens = episode.content.split(/\s+/);
      if (tokens.length >= 3) {
        // Store as simple triple
        this.semantic.storeFact(tokens[0], tokens[1], tokens.slice(2).join(' '), {
          source: 'episodic_consolidation',
          confidence: episode.importance
        });
      }
    });

    this.lastConsolidation = Date.now();
  }

  /**
   * Get all memory statistics
   */
  getStats() {
    return {
      agentId: this.agentId,
      episodic: this.episodic.getStats(),
      semantic: this.semantic.getStats(),
      procedural: this.procedural.getStats(),
      lastConsolidation: new Date(this.lastConsolidation).toISOString()
    };
  }

  /**
   * Clear all memory
   */
  clear() {
    this.episodic.clear();
    this.semantic.clear();
    this.procedural.clear();
  }
}
