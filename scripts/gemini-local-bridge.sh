#!/usr/bin/env bash
# 1nsharma Zero-Cost Local MCP + Android Bridge (Cloudflare Tunnel + Streamable HTTP)
# Connects local Laptop tools, Ollama, n8n, and Android (scrcpy/ADB) to Gemini Developer Mode (+ Create new)

set -euo pipefail

PORT="${MCP_PORT:-8787}"
TOKEN="${MCP_BEARER_TOKEN:-$(openssl rand -hex 24)}"

echo "=== 1nsharma Local Super-Brain Bridge ==="
echo "1. Checking dependencies (node, cloudflared)..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Install Node 20+ first."
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared (zero-cost HTTPS tunnel)..."
  if command -v brew >/dev/null 2>&1; then
    brew install cloudflared
  elif command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
  else
    echo "Install cloudflared from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi
fi

echo ""
echo "2. Start your local Streamable HTTP MCP gateway on port ${PORT}:"
echo "   npx -y supergateway --stdio \"npx -y @modelcontextprotocol/server-filesystem $HOME\" --port ${PORT} --outputTransport streamableHttp"
echo ""
echo "3. Expose it via HTTPS for Gemini Developer Mode (gemini.google.com/devmode -> + Create new):"
echo "   cloudflared tunnel --url http://localhost:${PORT}"
echo ""
echo "Bearer Token (save in Gemini Additional settings if auth wrapper is enabled): ${TOKEN}"
