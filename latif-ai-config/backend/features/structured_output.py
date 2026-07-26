"""
Structured Output & Function Calling Framework
Enables JSON schema validation, function definitions, and structured responses
"""

import json
import logging
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class OutputFormat(str, Enum):
    """Supported output formats"""
    JSON = "json"
    TEXT = "text"
    MARKDOWN = "markdown"


@dataclass
class FunctionParameter:
    """Function parameter definition"""
    name: str
    type: str
    description: str
    required: bool = True
    enum: Optional[List[str]] = None
    default: Optional[Any] = None


@dataclass
class FunctionDefinition:
    """Function definition for structured calling"""
    name: str
    description: str
    parameters: List[FunctionParameter]
    handler: Optional[Callable] = None

    def to_schema(self) -> Dict[str, Any]:
        """Convert to OpenAI function schema"""
        properties = {}
        required = []

        for param in self.parameters:
            prop = {
                "type": param.type,
                "description": param.description
            }
            if param.enum:
                prop["enum"] = param.enum
            if param.default is not None:
                prop["default"] = param.default

            properties[param.name] = prop
            if param.required:
                required.append(param.name)

        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }


class JSONSchema:
    """JSON Schema validator and builder"""

    @staticmethod
    def create_schema(
        title: str,
        description: str,
        properties: Dict[str, Dict[str, Any]],
        required: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create JSON schema"""
        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "title": title,
            "description": description,
            "type": "object",
            "properties": properties,
        }
        if required:
            schema["required"] = required
        return schema

    @staticmethod
    def validate(data: Dict[str, Any], schema: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Validate JSON against schema"""
        try:
            import jsonschema
            jsonschema.validate(instance=data, schema=schema)
            return True, None
        except ImportError:
            logger.warning("jsonschema not installed, skipping validation")
            return True, None
        except Exception as e:
            return False, str(e)

    @staticmethod
    def extract_json(text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from text"""
        try:
            # Try direct JSON parse
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try to find JSON block
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(text[start:end+1])
            except json.JSONDecodeError:
                pass

        return None


class StructuredOutputManager:
    """Manages structured output generation and validation"""

    def __init__(self):
        self.functions: Dict[str, FunctionDefinition] = {}
        self.schemas: Dict[str, Dict[str, Any]] = {}

    def register_function(self, func_def: FunctionDefinition) -> None:
        """Register a function definition"""
        self.functions[func_def.name] = func_def
        logger.info(f"Registered function: {func_def.name}")

    def register_schema(self, name: str, schema: Dict[str, Any]) -> None:
        """Register a JSON schema"""
        self.schemas[name] = schema
        logger.info(f"Registered schema: {name}")

    def get_function_definitions(self) -> List[Dict[str, Any]]:
        """Get all function schemas for LLM"""
        return [func.to_schema() for func in self.functions.values()]

    async def call_function(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a registered function"""
        if name not in self.functions:
            return {"error": f"Function {name} not found"}

        func_def = self.functions[name]
        if not func_def.handler:
            return {"error": f"No handler for function {name}"}

        try:
            result = func_def.handler(**arguments)
            if hasattr(result, '__await__'):
                result = await result
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"Function call error: {e}")
            return {"error": str(e)}

    def create_structured_prompt(
        self,
        task: str,
        output_format: OutputFormat = OutputFormat.JSON,
        schema: Optional[Dict[str, Any]] = None,
        functions: Optional[List[str]] = None
    ) -> str:
        """Create a prompt for structured output"""
        prompt = f"{task}\n\n"

        if output_format == OutputFormat.JSON:
            prompt += "You MUST respond with valid JSON only, no other text.\n"
            if schema:
                prompt += f"Follow this schema:\n{json.dumps(schema, indent=2)}\n"

        if functions:
            prompt += "\nAvailable functions:\n"
            for func_name in functions:
                if func_name in self.functions:
                    func_def = self.functions[func_name]
                    schema = func_def.to_schema()
                    prompt += f"- {func_name}: {schema['description']}\n"

        return prompt

    async def process_structured_response(
        self,
        response: str,
        output_format: OutputFormat = OutputFormat.JSON,
        schema: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process and validate structured response"""
        if output_format == OutputFormat.JSON:
            data = JSONSchema.extract_json(response)
            if not data:
                return {"error": "Could not extract JSON from response"}

            if schema:
                is_valid, error = JSONSchema.validate(data, schema)
                if not is_valid:
                    return {"error": f"Schema validation failed: {error}", "data": data}

            return {"success": True, "data": data}

        return {"success": True, "data": response}


# Global manager instance
output_manager = StructuredOutputManager()


# Example structured outputs
def create_example_schemas():
    """Create example schemas for common use cases"""

    # Analysis schema
    analysis_schema = JSONSchema.create_schema(
        title="Analysis",
        description="Structured analysis response",
        properties={
            "topic": {"type": "string"},
            "key_points": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1}
        },
        required=["topic", "key_points", "summary", "confidence"]
    )

    # Search results schema
    search_schema = JSONSchema.create_schema(
        title="SearchResults",
        description="Search query results",
        properties={
            "query": {"type": "string"},
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "url": {"type": "string"},
                        "snippet": {"type": "string"},
                        "relevance": {"type": "number"}
                    }
                }
            },
            "total_results": {"type": "integer"}
        },
        required=["query", "results"]
    )

    # Action execution schema
    action_schema = JSONSchema.create_schema(
        title="Action",
        description="Structured action execution",
        properties={
            "action": {"type": "string"},
            "parameters": {"type": "object"},
            "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            "timeout": {"type": "integer"}
        },
        required=["action", "parameters"]
    )

    return {
        "analysis": analysis_schema,
        "search": search_schema,
        "action": action_schema
    }


# Register example schemas
for name, schema in create_example_schemas().items():
    output_manager.register_schema(name, schema)
