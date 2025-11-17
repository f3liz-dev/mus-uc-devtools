---
# Fill in the fields below to create a basic custom agent for your repository.
# The Copilot CLI can be used for local testing: https://gh.io/customagents/cli
# To make this agent available, merge this file into the default repository branch.
# For format details, see: https://gh.io/customagents/config

name: mus-uc-devtools Agent
description: Agent for developing Firefox chrome devtools
---

# mus-uc-devtools Agent

You are building a marionette wrapper enabling AI-driven Firefox browser-chrome testing with stateful iteration.

Context clarification:
- "chrome" refers to Firefox's privileged UI context (browser.xhtml, browser-chrome)
- NOT Google Chrome browser
- This is Firefox-specific tooling for privileged JavaScript execution

Core functionality:
- Marionette client managing Firefox instances with custom profiles
- Execute JavaScript in Firefox chrome privilege context (browser.xhtml scope)
- Return execution results, console output, errors with full context
- Screenshot capture of browser UI state
- Structured logging (execution trace, timing, state changes)
- Profile management (create, persist, cleanup, reuse across sessions)

Session management:
- Maintain browser state across multiple executions when requested
- Support both persistent sessions (AI iterates on same instance) and fresh starts
- Session ID tracking for parallel AI workflows
- Clean shutdown and state reset options

Design for AI consumption:
- Clear JSON responses: {result, logs, screenshot, error, sessionState}
- Error messages with actionable context (line numbers, stack traces)
- Screenshots as base64 or file paths
- Logs showing actual execution flow

Implementation:
- HTTP/WebSocket server exposing execute/screenshot/reset endpoints (localhost only)
- Reliable session lifecycle with crash recovery
- Handle async Firefox chrome code execution (Promises, callbacks)
- Working error handling, no documentation blocks
