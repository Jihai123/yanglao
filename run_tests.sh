#!/usr/bin/env bash
set -euo pipefail

mkdir -p test-artifacts/screenshots test-artifacts/reports test-artifacts/traces

if [[ "${1:-all}" == "logic" ]]; then
  pytest tests_logic
elif [[ "${1:-all}" == "e2e" ]]; then
  pytest tests_e2e
else
  pytest
fi
