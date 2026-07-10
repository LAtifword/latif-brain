/**
 * Built-in Agents (Phase 3)
 * Five core agents: Planner, Researcher, Executor, Critic, Memory
 */

import { Agent } from './base-agent.js';

/**
 * Planner Agent - Breaks goals into sub-tasks
 */
export class PlannerAgent extends Agent {
  constructor() {
    super(
      'Planner',
      'Breaks complex goals into manageable sub-tasks',
      ['planning', 'decomposition', 'goal-setting']
    );
    this.maxIterations = 5;
  }

  async executeAction(action) {
    // Parse goal
    const goal = action;
    const subtasks = this.decompose(goal);

    return {
      goal: goal,
      subtasks: subtasks,
      priority: this.prioritize(subtasks),
      dependencies: this.identifyDependencies(subtasks),
      estimatedDuration: subtasks.length * 5, // minutes
      status: 'planned'
    };
  }

  decompose(goal) {
    // Simple decomposition: split on keywords
    const keywords = ['then', 'after', 'before', 'while', 'first', 'next', 'finally'];
    let subtasks = [goal];

    keywords.forEach(keyword => {
      if (goal.toLowerCase().includes(keyword)) {
        subtasks = goal.split(new RegExp(keyword, 'i')).filter(s => s.trim());
      }
    });

    return subtasks.map((task, idx) => ({
      id: idx + 1,
      task: task.trim(),
      priority: idx === 0 ? 'high' : 'medium',
      status: 'pending'
    }));
  }

  prioritize(subtasks) {
    // Sort by priority
    return subtasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }

  identifyDependencies(subtasks) {
    // Sequential dependencies
    const deps = {};
    subtasks.forEach((task, idx) => {
      if (idx > 0) {
        deps[task.id] = [subtasks[idx - 1].id];
      }
    });
    return deps;
  }
}

/**
 * Researcher Agent - Searches for information
 */
export class ResearcherAgent extends Agent {
  constructor() {
    super(
      'Researcher',
      'Searches knowledge base and retrieves relevant information',
      ['search', 'retrieval', 'analysis', 'knowledge-discovery']
    );
  }

  async executeAction(action) {
    const query = action;
    const results = await this.search(query);
    const analyzed = this.analyzeResults(results);

    return {
      query: query,
      resultsFound: results.length,
      relevantResults: analyzed.relevant,
      sources: analyzed.sources,
      confidence: analyzed.avgConfidence,
      summary: analyzed.summary,
      status: 'completed'
    };
  }

  async search(query) {
    // Simulated search (in production: call hybrid-search)
    return [
      { content: `Result for: ${query}`, relevance: 0.9, source: 'knowledge-base' },
      { content: `Additional info on: ${query}`, relevance: 0.7, source: 'documents' },
      { content: `Related: ${query}`, relevance: 0.6, source: 'cache' }
    ];
  }

  analyzeResults(results) {
    const relevant = results.filter(r => r.relevance > 0.6);
    const avgConfidence = results.length > 0
      ? (results.reduce((sum, r) => sum + r.relevance, 0) / results.length * 100).toFixed(1)
      : 0;

    const sources = [...new Set(results.map(r => r.source))];
    const summary = relevant.map(r => r.content).join(' | ');

    return { relevant, sources, avgConfidence, summary };
  }
}

/**
 * Executor Agent - Performs actions and tool execution
 */
export class ExecutorAgent extends Agent {
  constructor() {
    super(
      'Executor',
      'Executes tasks using available tools and systems',
      ['execution', 'tool-use', 'action', 'integration']
    );
    this.maxIterations = 20;
  }

  async executeAction(action) {
    // Parse action
    const { toolName, params } = this.parseAction(action);

    try {
      // Execute tool
      let result;
      if (this.tools.has(toolName)) {
        result = await this.executeTool(toolName, params);
      } else {
        result = await this.fallbackExecution(action);
      }

      return {
        action: action,
        tool: toolName,
        params: params,
        result: result,
        status: 'executed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        action: action,
        error: error.message,
        status: 'failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  parseAction(action) {
    // Simple parsing: extract tool name and parameters
    const match = action.match(/(\w+)\s*:\s*(.*)/);
    if (match) {
      return {
        toolName: match[1].toLowerCase(),
        params: match[2]
      };
    }
    return {
      toolName: 'execute',
      params: action
    };
  }

  async fallbackExecution(action) {
    // Fallback: return action as-is
    return {
      action: action,
      executed: true
    };
  }
}

/**
 * Critic Agent - Validates and critiques outputs
 */
export class CriticAgent extends Agent {
  constructor() {
    super(
      'Critic',
      'Validates outputs and suggests improvements',
      ['validation', 'quality-assurance', 'improvement', 'feedback']
    );
  }

  async executeAction(action) {
    const { content, criteria } = this.parseContent(action);
    const critique = this.critique(content, criteria);
    const suggestions = this.generateSuggestions(critique);

    return {
      originalContent: content,
      critique: critique,
      score: critique.overallScore,
      suggestions: suggestions,
      isApproved: critique.overallScore > 0.7,
      status: 'reviewed'
    };
  }

  parseContent(action) {
    // Extract content and optional criteria
    return {
      content: action,
      criteria: ['accuracy', 'clarity', 'completeness', 'relevance']
    };
  }

  critique(content, criteria) {
    const scores = {};
    let totalScore = 0;

    criteria.forEach(criterion => {
      const score = this.scoreCriterion(content, criterion);
      scores[criterion] = score;
      totalScore += score;
    });

    return {
      scores: scores,
      overallScore: totalScore / criteria.length,
      issues: this.identifyIssues(content, scores),
      strengths: this.identifyStrengths(content, scores)
    };
  }

  scoreCriterion(content, criterion) {
    // Heuristic scoring
    const contentLength = content.length;
    if (criterion === 'completeness') {
      return Math.min(1, contentLength / 500);
    } else if (criterion === 'clarity') {
      return contentLength > 50 && contentLength < 5000 ? 0.8 : 0.6;
    }
    return 0.7;
  }

  identifyIssues(content, scores) {
    const issues = [];
    Object.entries(scores).forEach(([criterion, score]) => {
      if (score < 0.5) {
        issues.push(`Low ${criterion}: ${(score * 100).toFixed(0)}%`);
      }
    });
    return issues;
  }

  identifyStrengths(content, scores) {
    const strengths = [];
    Object.entries(scores).forEach(([criterion, score]) => {
      if (score > 0.8) {
        strengths.push(`Strong ${criterion}: ${(score * 100).toFixed(0)}%`);
      }
    });
    return strengths;
  }

  generateSuggestions(critique) {
    return critique.issues.map((issue, idx) => ({
      priority: idx === 0 ? 'high' : 'medium',
      issue: issue,
      suggestion: `Improve ${issue.split(':')[0].toLowerCase()}`
    }));
  }
}

/**
 * Memory Agent - Manages knowledge and learning
 */
export class MemoryAgent extends Agent {
  constructor() {
    super(
      'Memory',
      'Consolidates learnings and manages knowledge',
      ['memory', 'learning', 'knowledge-consolidation', 'retention']
    );
    this.knowledgeBase = new Map();
  }

  async executeAction(action) {
    const { type, content } = this.parseMemoryAction(action);

    switch (type) {
    case 'store':
      return this.storeKnowledge(content);
    case 'retrieve':
      return this.retrieveKnowledge(content);
    case 'consolidate':
      return this.consolidateKnowledge();
    case 'forget':
      return this.forgetKnowledge(content);
    default:
      return { status: 'unknown-action' };
    }
  }

  parseMemoryAction(action) {
    const match = action.match(/(\w+)\s*:\s*(.*)/);
    if (match) {
      return {
        type: match[1].toLowerCase(),
        content: match[2]
      };
    }
    return { type: 'store', content: action };
  }

  storeKnowledge(content) {
    const key = Buffer.from(content).toString('base64').substring(0, 32);
    this.knowledgeBase.set(key, {
      content: content,
      stored: new Date().toISOString(),
      accessCount: 0,
      relevance: 1.0
    });

    return {
      action: 'store',
      stored: true,
      knowledgeKey: key,
      totalKnowledge: this.knowledgeBase.size
    };
  }

  retrieveKnowledge(query) {
    const results = [];
    this.knowledgeBase.forEach((knowledge, key) => {
      if (knowledge.content.toLowerCase().includes(query.toLowerCase())) {
        knowledge.accessCount++;
        results.push({
          key: key,
          content: knowledge.content,
          relevance: knowledge.relevance,
          accessed: knowledge.accessCount
        });
      }
    });

    return {
      action: 'retrieve',
      query: query,
      results: results,
      found: results.length
    };
  }

  consolidateKnowledge() {
    const consolidated = [];
    const knowledgeArray = Array.from(this.knowledgeBase.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10);

    knowledgeArray.forEach(([key, knowledge]) => {
      consolidated.push({
        key: key,
        content: knowledge.content,
        frequency: knowledge.accessCount
      });
    });

    return {
      action: 'consolidate',
      consolidated: consolidated,
      totalConsolidated: consolidated.length,
      knowledgeSize: this.knowledgeBase.size
    };
  }

  forgetKnowledge(query) {
    let removed = 0;
    this.knowledgeBase.forEach((knowledge, key) => {
      if (knowledge.content.toLowerCase().includes(query.toLowerCase())) {
        this.knowledgeBase.delete(key);
        removed++;
      }
    });

    return {
      action: 'forget',
      removed: removed,
      remaining: this.knowledgeBase.size
    };
  }
}

// Export agent instances
export const PlannerAgentInstance = new PlannerAgent();
export const ResearcherAgentInstance = new ResearcherAgent();
export const ExecutorAgentInstance = new ExecutorAgent();
export const CriticAgentInstance = new CriticAgent();
export const MemoryAgentInstance = new MemoryAgent();
