#!/bin/bash

set -euo pipefail

validate_ts() {
  local file="$1"
  tsc --noEmit "$file" &> /dev/null
}

validate_sh() {
  local file="$1"
  bash -n "$file" &> /dev/null
}

validate_md() {
  local file="$1"
  md-lint "$file" &> /dev/null
}

validate_outputs() {
  local results=()

  for file in $(find . -type f -name "*.ts"); do
    if ! validate_ts "$file"; then
      echo "FAIL: $file"
      return 1
    fi
  done

  for file in $(find . -type f -name "*.sh"); do
    if ! validate_sh "$file"; then
      echo "FAIL: $file"
      return 1
    fi
  done

  for file in $(find . -type f -name "*.md"); do
    if ! validate_md "$file"; then
      echo "FAIL: $file"
      return 1
    fi
  done

  echo "PASS"
}

validate_outputs
