from typing import Literal

from pydantic import BaseModel, Field

AgentCategory = Literal[
    "chat", "code", "design", "project", "audio", "video", "book", "music", "aircraft"
]
AgentStatus = Literal["online", "offline", "not_implemented"]


class AgentInfo(BaseModel):
    id: str
    name: str
    category: AgentCategory
    description: str
    icon: str
    implemented: bool
    status: AgentStatus
    capabilities: list[str] = Field(default_factory=list)


class SystemStats(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    gpu_available: bool
    process_count: int
    uptime_seconds: float
    timestamp: str


class ActivityItem(BaseModel):
    id: int
    agent_id: str
    action: str
    detail: str
    created_at: str


class ChatMessageIn(BaseModel):
    conversation_id: str | None = None
    content: str


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: Literal["system", "user", "assistant"]
    content: str
    created_at: str


class ConversationOut(BaseModel):
    id: str
    agent_id: str
    title: str
    created_at: str
    updated_at: str


class ModelFileInfo(BaseModel):
    id: str
    filename: str
    path: str
    size_bytes: int
    ram_estimate_mb: float
    added_at: str
    is_loaded: bool


class EngineStatus(BaseModel):
    engine_available: bool
    model_loaded: bool
    model_name: str | None
    backend: str
    detail: str


class PinSetIn(BaseModel):
    pin: str = Field(min_length=4, max_length=12)


class PinVerifyIn(BaseModel):
    pin: str


class AuthStatus(BaseModel):
    pin_configured: bool
