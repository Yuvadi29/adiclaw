# AdiClaw Project Summary

## Overview
AdiClaw is an autonomous, sandboxed AI coding assistant designed for safety and control. It operates in three core modes:

1. **Agent Mode**: Autonomous tool execution with 40-step safety limits
2. **Plan Mode**: Structured step-by-step execution plans
3. **Ask Mode**: Read-only Q&A with optional markdown export

## Key Features
- Sandboxed agent architecture with in-memory staging
- Interactive diff review for all changes
- Human-in-the-loop approval process
- Web scraping/crawling capabilities
- Terminal-native UI with syntax highlighting

## Architecture
Built on Bun with TypeScript, Vercel AI SDK, and Firecrawl. Uses an append-only action tracker and staged approval workflow.

## Tech Stack
- **Runtime**: Bun (v1+)
- **AI**: Vercel AI SDK + OpenRouter
- **Web Tools**: Firecrawl
- **CLI Frameworks**: Commander.js, Clack Prompts
- **Styling**: Chalk, Figlet, Marked-terminal

## Security
All filesystem modifications require explicit user approval before being applied to disk.