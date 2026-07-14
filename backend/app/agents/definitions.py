from dataclasses import dataclass, field


@dataclass(frozen=True)
class AgentDefinition:
    id: str
    name: str
    category: str
    description: str
    icon: str
    implemented: bool
    capabilities: list[str] = field(default_factory=list)


# Metadata for every agent shown on the AgentOS dashboard. Only "chat" has a
# real inference implementation today (see chat_agent.py) — the rest are
# registered with implemented=False so the API and UI can report their true
# state instead of faking activity for agents that don't exist yet.
AGENT_DEFINITIONS: list[AgentDefinition] = [
    AgentDefinition(
        id="chat",
        name="Chat Agent",
        category="chat",
        description="General local assistant with conversation memory.",
        icon="chat_bubble",
        implemented=True,
        capabilities=["conversation_memory", "streaming_inference", "file_context"],
    ),
    AgentDefinition(
        id="code",
        name="Code Agent",
        category="code",
        description="Generate, refactor, debug and review code.",
        icon="code",
        implemented=False,
        capabilities=["generate", "refactor", "debug", "review", "test_execution"],
    ),
    AgentDefinition(
        id="design",
        name="Design Agent",
        category="design",
        description="Generate UI, Flutter widgets and design systems.",
        icon="palette",
        implemented=False,
        capabilities=["ui_generation", "theme_creation", "component_generation"],
    ),
    AgentDefinition(
        id="project",
        name="Project Agent",
        category="project",
        description="Task management, planning and roadmaps.",
        icon="assignment",
        implemented=False,
        capabilities=["task_manager", "planning", "roadmaps"],
    ),
    AgentDefinition(
        id="audio",
        name="Audio Agent",
        category="audio",
        description="Speech-to-text, transcription and voice processing.",
        icon="mic",
        implemented=False,
        capabilities=["transcription", "speaker_detection", "noise_removal"],
    ),
    AgentDefinition(
        id="video",
        name="Video Agent",
        category="video",
        description="AI video generation and editing pipeline.",
        icon="movie",
        implemented=False,
        capabilities=["storyboard", "scene_planning", "subtitle_generation"],
    ),
    AgentDefinition(
        id="book",
        name="Book Agent",
        category="book",
        description="Long-form writing, editing and documentation.",
        icon="menu_book",
        implemented=False,
        capabilities=["long_form_writing", "editing", "outline_generation"],
    ),
    AgentDefinition(
        id="music",
        name="Music Agent",
        category="music",
        description="Lyrics, composition and MIDI generation.",
        icon="music_note",
        implemented=False,
        capabilities=["lyrics", "composition", "midi_generation"],
    ),
    AgentDefinition(
        id="aircraft",
        name="Aircraft Agent",
        category="aircraft",
        description="Flight calculations and aviation engineering reference.",
        icon="flight",
        implemented=False,
        capabilities=["flight_calculations", "maintenance_reference"],
    ),
]

AGENT_DEFINITIONS_BY_ID = {a.id: a for a in AGENT_DEFINITIONS}
