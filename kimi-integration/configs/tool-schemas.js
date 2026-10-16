/**
 * Tool Schemas - OpenAI-compatible function schemas for tool calling
 * These match Kimi K2's native tool-parsing logic
 */
export const TOOL_SCHEMAS = {
    /**
     * File operations
     */
    readFile: {
        type: 'function',
        function: {
            name: 'readFile',
            description: 'Read the contents of a file. Use this when you need to examine file contents.',
            parameters: {
                type: 'object',
                required: ['path'],
                properties: {
                    path: {
                        type: 'string',
                        description: 'Absolute or relative path to the file'
                    },
                    encoding: {
                        type: 'string',
                        description: 'File encoding (default: utf8)',
                        enum: ['utf8', 'base64', 'hex']
                    }
                }
            }
        }
    },

    writeFile: {
        type: 'function',
        function: {
            name: 'writeFile',
            description: 'Write content to a file. Use this to create or overwrite files.',
            parameters: {
                type: 'object',
                required: ['path', 'content'],
                properties: {
                    path: {
                        type: 'string',
                        description: 'Absolute or relative path to the file'
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write'
                    },
                    encoding: {
                        type: 'string',
                        description: 'File encoding (default: utf8)'
                    }
                }
            }
        }
    },

    listDirectory: {
        type: 'function',
        function: {
            name: 'listDirectory',
            description: 'List files and directories in a given path.',
            parameters: {
                type: 'object',
                required: ['path'],
                properties: {
                    path: {
                        type: 'string',
                        description: 'Directory path to list'
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'List recursively'
                    }
                }
            }
        }
    },

    executeCommand: {
        type: 'function',
        function: {
            name: 'executeCommand',
            description: 'Execute a shell command. Use with caution - warn about dangerous commands.',
            parameters: {
                type: 'object',
                required: ['command'],
                properties: {
                    command: {
                        type: 'string',
                        description: 'Shell command to execute'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory'
                    },
                    timeout: {
                        type: 'number',
                        description: 'Timeout in milliseconds'
                    }
                }
            }
        }
    },

    searchWeb: {
        type: 'function',
        function: {
            name: 'searchWeb',
            description: 'Search the web for information. Use when you need up-to-date data.',
            parameters: {
                type: 'object',
                required: ['query'],
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query'
                    },
                    numResults: {
                        type: 'number',
                        description: 'Number of results to return'
                    }
                }
            }
        }
    },

    getWeather: {
        type: 'function',
        function: {
            name: 'getWeather',
            description: 'Get current weather information for a location.',
            parameters: {
                type: 'object',
                required: ['city'],
                properties: {
                    city: {
                        type: 'string',
                        description: 'City name'
                    },
                    units: {
                        type: 'string',
                        description: 'Temperature units',
                        enum: ['metric', 'imperial']
                    }
                }
            }
        }
    },

    calculate: {
        type: 'function',
        function: {
            name: 'calculate',
            description: 'Perform mathematical calculations.',
            parameters: {
                type: 'object',
                required: ['expression'],
                properties: {
                    expression: {
                        type: 'string',
                        description: 'Mathematical expression to evaluate'
                    }
                }
            }
        }
    },

    memoryStore: {
        type: 'function',
        function: {
            name: 'memoryStore',
            description: 'Store information in memory for future reference.',
            parameters: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                    key: {
                        type: 'string',
                        description: 'Memory key'
                    },
                    value: {
                        type: 'string',
                        description: 'Information to store'
                    },
                    category: {
                        type: 'string',
                        description: 'Category for organization'
                    }
                }
            }
        }
    },

    memoryRetrieve: {
        type: 'function',
        function: {
            name: 'memoryRetrieve',
            description: 'Retrieve information from memory.',
            parameters: {
                type: 'object',
                required: ['key'],
                properties: {
                    key: {
                        type: 'string',
                        description: 'Memory key to retrieve'
                    }
                }
            }
        }
    }
};

/**
 * Get all tool schemas as an array (for OpenAI API)
 */
export function getAllTools() {
    return Object.values(TOOL_SCHEMAS);
}

/**
 * Get specific tool schema
 */
export function getTool(name) {
    return TOOL_SCHEMAS[name];
}

export default TOOL_SCHEMAS;
