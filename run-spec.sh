#!/bin/bash
# run-spec.sh — Execute a spec file with pi (qwen3.5-64k via Ollama)
# Usage: ./run-spec.sh specs/my-task.md [--interactive]

set -e

SPEC_FILE="${1:?Usage: $0 <spec-file> [--interactive]}"
INTERACTIVE="${2:-}"

if [ ! -f "$SPEC_FILE" ]; then
  echo "Error: spec file '$SPEC_FILE' not found" >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SPEC_PATH="/app/$(realpath --relative-to="$PROJECT_DIR" "$SPEC_FILE")"

PI_CMD="pi --model ollama/qwen3.5-64k:latest"

if [ -z "$INTERACTIVE" ]; then
  PI_CMD="$PI_CMD --print"
fi

PI_CMD="$PI_CMD @${SPEC_PATH}"

echo "==> Running spec: $SPEC_FILE"
echo "==> Mode: $([ -z "$INTERACTIVE" ] && echo 'non-interactive (--print)' || echo 'interactive')"
echo ""

docker run ${INTERACTIVE:+-it} \
  --network host \
  -v "${PROJECT_DIR}:/app" \
  -w /app \
  --rm \
  pi-agent \
  sh -c "$PI_CMD"
