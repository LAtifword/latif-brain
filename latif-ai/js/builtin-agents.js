/* ════════════════════════════════════════════════════════════════
   LATIF AI — Built-in Agents (Planner, Researcher, Executor, etc.)
   ════════════════════════════════════════════════════════════════
   Pre-configured agents for common AI tasks: planning, research,
   execution, criticism, and memory consolidation.

   LATIF v5.2.0+
   ════════════════════════════════════════════════════════════════ */
"use strict";

/**
 * PLANNER AGENT
 * Breaks complex goals into actionable steps.
 */
class PlannerAgent extends Agent {
  constructor() {
    super({
      id: "agent_planner",
      name: "Planner",
      role: "planner",
      description: "Break down complex goals into actionable steps and manage task sequences",
      systemPrompt: `You are the Planner Agent. Your job is to:
1. Break complex user goals into clear, actionable steps
2. Identify dependencies between steps
3. Estimate effort and priority
4. Create execution plans that other agents can follow

Always respond with a structured plan:
[PLAN]
Step 1: [action] (depends on: none, effort: low)
Step 2: [action] (depends on: step 1, effort: medium)
...
[/PLAN]`,
    });
  }

  async reason(message) {
    const contextPrompt = this.buildContextPrompt(message);
    const response = await this.callModel(contextPrompt);

    // Extract plan
    const planMatch = response.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/);
    const plan = planMatch ? planMatch[1].trim().split("\n") : [];

    // Save plan as memory
    if (plan.length > 0) {
      await this.saveMemory(`Plan for "${message.task}": ${plan.length} steps`);
    }

    return {
      type: "plan",
      content: response,
      plan: plan,
    };
  }
}

/**
 * RESEARCHER AGENT
 * Searches knowledge base and external sources for information.
 */
class ResearcherAgent extends Agent {
  constructor() {
    super({
      id: "agent_researcher",
      name: "Researcher",
      role: "researcher",
      description: "Search knowledge base, retrieve relevant context, and synthesize findings",
      systemPrompt: `You are the Researcher Agent. Your job is to:
1. Search the knowledge base for relevant information
2. Retrieve and summarize findings
3. Identify information gaps and alternative perspectives
4. Synthesize information into coherent summaries

For searches, use: [SEARCH: "query terms"]
Format results as:
[FINDINGS]
Key finding 1: ...
Key finding 2: ...
[/FINDINGS]`,
    });
  }

  async reason(message) {
    const contextPrompt = this.buildContextPrompt(message);
    const response = await this.callModel(contextPrompt);

    // Extract findings
    const findingsMatch = response.match(/\[FINDINGS\]([\s\S]*?)\[\/FINDINGS\]/);
    const findings = findingsMatch ? findingsMatch[1].trim().split("\n") : [];

    // Save findings as memory
    if (findings.length > 0) {
      await this.saveMemory(`Research on "${message.task}": ${findings.length} findings`);
    }

    return {
      type: "research",
      content: response,
      findings: findings,
    };
  }
}

/**
 * EXECUTOR AGENT
 * Performs actions, runs tools, and executes plans.
 */
class ExecutorAgent extends Agent {
  constructor() {
    super({
      id: "agent_executor",
      name: "Executor",
      role: "executor",
      description: "Execute plans, run tools, and perform concrete actions",
      systemPrompt: `You are the Executor Agent. Your job is to:
1. Execute tasks step by step
2. Call tools and handle results
3. Handle errors gracefully
4. Report progress and completion

For tool calls, use: [TOOL_CALL: tool_name(param1="value1", param2="value2")]
For status updates, use: [ACTION: "description"] [STATUS: "completed|failed|in_progress"]`,
    });
  }

  async reason(message) {
    const contextPrompt = this.buildContextPrompt(message);
    const response = await this.callModel(contextPrompt);

    // Extract actions
    const actionMatches = response.matchAll(/\[ACTION: "(.*?)"\]\s*\[STATUS: "(.*?)"\]/g);
    const actions = Array.from(actionMatches).map((m) => ({
      description: m[1],
      status: m[2],
    }));

    // Save execution record
    if (actions.length > 0) {
      await this.saveMemory(`Executed "${message.task}": ${actions.length} actions`);
    }

    return {
      type: "execution",
      content: response,
      actions: actions,
    };
  }
}

/**
 * CRITIC AGENT
 * Reviews outputs and suggests improvements.
 */
class CriticAgent extends Agent {
  constructor() {
    super({
      id: "agent_critic",
      name: "Critic",
      role: "critic",
      description: "Review outputs, validate correctness, and suggest improvements",
      systemPrompt: `You are the Critic Agent. Your job is to:
1. Review outputs from other agents
2. Check for accuracy, completeness, and clarity
3. Identify gaps or issues
4. Suggest specific improvements

Format your review as:
[REVIEW]
Strengths: ...
Issues: ...
Suggestions: ...
Overall quality: 1-10
[/REVIEW]`,
    });
  }

  async reason(message) {
    const contextPrompt = this.buildContextPrompt(message);
    const response = await this.callModel(contextPrompt);

    // Extract review metrics
    const reviewMatch = response.match(/Overall quality: (\d+)/);
    const quality = reviewMatch ? parseInt(reviewMatch[1]) : 5;

    return {
      type: "review",
      content: response,
      quality: quality,
      approved: quality >= 7,
    };
  }
}

/**
 * MEMORY AGENT
 * Consolidates learnings and manages long-term memory.
 */
class MemoryAgent extends Agent {
  constructor() {
    super({
      id: "agent_memory",
      name: "Memory",
      role: "memory",
      description: "Consolidate learnings, extract facts, and maintain long-term memory",
      systemPrompt: `You are the Memory Agent. Your job is to:
1. Extract key facts and learnings from conversations
2. Consolidate related information
3. Remove redundant or outdated entries
4. Maintain an evolving knowledge base

Extract facts in format:
[FACTS]
- [type: entity|relationship|concept] name: description
- [type: entity|relationship|concept] name: description
[/FACTS]`,
    });
  }

  async reason(message) {
    const contextPrompt = this.buildContextPrompt(message);
    const response = await this.callModel(contextPrompt);

    // Extract facts
    const factsMatch = response.match(/\[FACTS\]([\s\S]*?)\[\/FACTS\]/);
    const facts = factsMatch
      ? factsMatch[1]
          .trim()
          .split("\n")
          .filter((f) => f.startsWith("-"))
      : [];

    // Save facts as memories
    for (const fact of facts) {
      const cleanFact = fact.replace(/^-\s*/, "").trim();
      if (cleanFact) {
        await this.saveMemory(cleanFact);
      }
    }

    return {
      type: "consolidation",
      content: response,
      factsExtracted: facts.length,
    };
  }
}

// Initialize and register all built-in agents
async function initializeBuiltInAgents() {
  const agents = [
    new PlannerAgent(),
    new ResearcherAgent(),
    new ExecutorAgent(),
    new CriticAgent(),
    new MemoryAgent(),
  ];

  for (const agent of agents) {
    GlobalAgentRegistry.register(agent);
    await agent.init();
  }

  console.log(`✓ Initialized ${agents.length} built-in agents`);
  return agents;
}

// Export
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PlannerAgent,
    ResearcherAgent,
    ExecutorAgent,
    CriticAgent,
    MemoryAgent,
    initializeBuiltInAgents,
  };
}
