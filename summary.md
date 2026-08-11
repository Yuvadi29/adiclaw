# Project Summary: adiclaw 🏛️

This document provides a high-level architectural and structural summary of the `adiclaw` project codebase, serving as a single source of truth for its current scope and organization.

## 📄 Codebase Overview
*   **Total Files Indexed:** 86
*   **Primary Technologies/Extensions:** The core logic is written in TypeScript (`.ts`), supported by markdown files (`.md`) for documentation/knowledge, and JSON (`.json`) for configuration.
    *   TypeScript (`.ts`): 78 files (Core Logic)
    *   Markdown (`.md`): 4 files (Documentation/Knowledge Base)
    *   JSON (`.json`): 3 files (Configuration Data)

## ⚙️ Architectural Breakdown (Key Modules & Entry Points)
The project appears to be highly modular, separating concerns into dedicated directories:

1.  **`/index.ts`:** The primary entry point for the application.
2.  **`/memory/index.ts`:** Handles long-term memory operations, likely incorporating personal knowledge retrieval and storage mechanisms (e.g., `search_memory`, `save_memory`). *Focus on personalized context.*
3.  **`/modes/cli.ts`:** Manages different operational modes or command-line interfaces, suggesting versatility in how the application is run.
4.  **`/workspace/index.ts`:** Likely manages the interaction with the file system and project structure (the workspace). *Focus on local context.*
5.  **`/mcp/index.ts`:** *(Module Code Platform / Management Component?)* This module suggests dedicated functionality for core business processes or complex interactions within the application's workflow.
6.  **`/ai/index.ts`:** The primary integration point for AI capabilities, handling interaction with external models and internal knowledge synthesis.
7.  **`/commands/index.ts`:** Structures the various available commands, ensuring a clear command hierarchy and execution flow.

## ✨ Conclusion
The `adiclaw` project is structured as a sophisticated, multi-faceted platform utilizing TypeScript for its core logic. Its architecture emphasizes modularity, with distinct components dedicated to knowledge management (`memory`), operational context (`workspace`, `modes`), AI integration (`ai`), and standardized command execution (`commands`). This structure allows for highly specialized functionality while maintaining a cohesive whole.