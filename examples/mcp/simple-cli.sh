#!/usr/bin/env bash

# Simple command-line interface for Firefox chrome testing
# This script provides an easy-to-use interface for LLMs that prefer simple CLI tools

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER="$SCRIPT_DIR/../../src/mcp-server.js"

usage() {
    cat << EOF
Firefox Chrome Testing - Simple CLI

Usage: $0 <command> [arguments]

Commands:
    exec <script>              Execute JavaScript in Firefox chrome context
    screenshot [selector]      Take a screenshot (optional CSS selector)
    info                       Get Firefox information
    list-tabs                  List all open tabs
    help                       Show this help message

Examples:
    $0 exec "return Services.appinfo.version;"
    $0 screenshot
    $0 screenshot "#nav-bar"
    $0 info
    $0 list-tabs

Prerequisites:
    - Firefox must be running
    - Marionette must be enabled (about:config -> marionette.port = 2828)
    - Node.js 18+ must be installed

EOF
}

send_mcp_request() {
    local method="$1"
    local params="$2"
    
    local request=$(cat <<EOF
{"jsonrpc":"2.0","id":1,"method":"$method","params":$params}
EOF
)
    
    echo "$request" | node "$MCP_SERVER" 2>/dev/null | tail -n 1
}

call_tool() {
    local tool_name="$1"
    local tool_args="$2"
    
    local params=$(cat <<EOF
{"name":"$tool_name","arguments":$tool_args}
EOF
)
    
    send_mcp_request "tools/call" "$params"
}

# Parse command
COMMAND="${1:-help}"

case "$COMMAND" in
    exec)
        if [ -z "$2" ]; then
            echo "Error: Missing script argument"
            echo "Usage: $0 exec <script>"
            exit 1
        fi
        
        SCRIPT="$2"
        ARGS="${3:-[]}"
        
        TOOL_ARGS=$(cat <<EOF
{"script":"$SCRIPT","args":$ARGS}
EOF
)
        
        echo "Executing: $SCRIPT"
        RESULT=$(call_tool "execute_script" "$TOOL_ARGS")
        echo "$RESULT" | jq -r '.result.content[0].text' | jq '.'
        ;;
        
    screenshot)
        SELECTOR="${2:-}"
        
        if [ -n "$SELECTOR" ]; then
            TOOL_ARGS="{\"selector\":\"$SELECTOR\"}"
            echo "Taking screenshot of: $SELECTOR"
        else
            TOOL_ARGS="{}"
            echo "Taking full-screen screenshot"
        fi
        
        RESULT=$(call_tool "screenshot" "$TOOL_ARGS")
        echo "$RESULT" | jq -r '.result.content[0].text' | jq '.'
        ;;
        
    info)
        SCRIPT='const window = Services.wm.getMostRecentWindow("navigator:browser"); return { title: window.document.title, url: window.location.href, version: Services.appinfo.version, platform: Services.appinfo.OS };'
        
        TOOL_ARGS=$(cat <<EOF
{"script":"$SCRIPT","args":[]}
EOF
)
        
        echo "Getting Firefox information..."
        RESULT=$(call_tool "execute_script" "$TOOL_ARGS")
        echo "$RESULT" | jq -r '.result.content[0].text' | jq '.result'
        ;;
        
    list-tabs)
        SCRIPT='const window = Services.wm.getMostRecentWindow("navigator:browser"); const tabs = window.gBrowser.tabs; return Array.from(tabs).map(tab => ({ title: tab.linkedBrowser.contentTitle, url: tab.linkedBrowser.currentURI.spec, selected: tab.selected }));'
        
        TOOL_ARGS=$(cat <<EOF
{"script":"$SCRIPT","args":[]}
EOF
)
        
        echo "Listing open tabs..."
        RESULT=$(call_tool "execute_script" "$TOOL_ARGS")
        echo "$RESULT" | jq -r '.result.content[0].text' | jq '.result'
        ;;
        
    help|--help|-h)
        usage
        ;;
        
    *)
        echo "Error: Unknown command '$COMMAND'"
        echo ""
        usage
        exit 1
        ;;
esac
