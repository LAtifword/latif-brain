import { PluginManager } from './plugin-manager.js';

/**
 * SkillRegistry - Manages LATIF-NI skills with Kimi-style capabilities
 * Skills = high-level capabilities built on plugins + prompts
 */
export class SkillRegistry {
    constructor(config = {}) {
        this.pluginManager = new PluginManager(config);
        this.skills = new Map();
        this.builtinSkills = this._createBuiltinSkills();
    }

    async init() {
        await this.pluginManager.loadAll();

        // Register built-in skills
        for (const [name, skill] of this.builtinSkills) {
            this.register(name, skill);
        }
    }

    /**
     * Register a skill
     */
    register(name, skill) {
        this.skills.set(name, {
            name,
            description: skill.description,
            systemPrompt: skill.systemPrompt,
            tools: skill.tools || [],
            handler: skill.handler || null,
            ...skill
        });
    }

    /**
     * Get skill by name
     */
    get(name) {
        return this.skills.get(name);
    }

    /**
     * Get all available skills
     */
    list() {
        return Array.from(this.skills.values()).map(s => ({
            name: s.name,
            description: s.description,
            hasTools: (s.tools?.length || 0) > 0
        }));
    }

    /**
     * Execute a skill with context
     */
    async execute(skillName, context = {}, adapter) {
        const skill = this.get(skillName);
        if (!skill) {
            throw new Error(`Skill "${skillName}" not found`);
        }

        const messages = [
            { role: 'system', content: skill.systemPrompt },
            { role: 'user', content: context.query || context.message || '' }
        ];

        const tools = [...(skill.tools || []), ...this.pluginManager.getTools()];
        const toolMap = this.pluginManager.getToolMap();

        if (tools.length > 0 && adapter) {
            return adapter.chatWithTools(messages, tools, toolMap, { stream: context.stream });
        }

        return adapter.chat(messages, { stream: context.stream });
    }

    _createBuiltinSkills() {
        const skills = new Map();

        skills.set('coder', {
            name: 'coder',
            description: 'Expert software engineering assistant',
            systemPrompt: `You are LATIF Coder, an expert software engineer.
Write clean, efficient, well-documented code.
Always explain your reasoning step by step.
Prefer modern JavaScript/Node.js patterns.
When writing code, include comments and error handling.`,
            tools: []
        });

        skills.set('researcher', {
            name: 'researcher',
            description: 'Thorough research and analysis assistant',
            systemPrompt: `You are LATIF Researcher.
You are thorough, analytical, and prioritize accuracy.
Break down complex topics into clear explanations.
When uncertain, say so rather than hallucinate.`,
            tools: []
        });

        skills.set('planner', {
            name: 'planner',
            description: 'Task planning and project management',
            systemPrompt: `You are LATIF Planner.
Break down complex tasks into clear, actionable steps.
Identify dependencies and suggest execution order.
Be concise but thorough in your planning.`,
            tools: []
        });

        skills.set('terminal', {
            name: 'terminal',
            description: 'Terminal/command-line assistant for Termux',
            systemPrompt: `You are LATIF Terminal, a Termux/Android command-line expert.
You help with shell commands, package management, and system administration.
Always warn about dangerous commands.
Prefer safe, non-destructive operations.`,
            tools: []
        });

        skills.set('default', {
            name: 'default',
            description: 'General-purpose LATIF assistant',
            systemPrompt: `You are LATIF, a powerful local AI assistant created by Mohamed Latif.
You are helpful, precise, and optimized for local execution on Android/Termux.
Think step by step when needed.
Respond in the same language as the user (Arabic or English).`,
            tools: []
        });

        return skills;
    }
}

export default SkillRegistry;
