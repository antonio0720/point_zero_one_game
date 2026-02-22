#!/bin/bash

set -euo pipefail

# Define constants for archive names and expected counts
ARCHIVES=("logic_docs.zip" "mechanics.zip" "ml.zip")
EXPECTED_COUNTS=(100 50 10)

# Function to unpack and normalize a single archive
unpack_and_normalize() {
  local archive=$1
  local repo_dir=${2:-repo}
  local temp_dir=$(mktemp -d)
  
  # Unpack the archive into the temporary directory
  unzip -q "$archive" -d "$temp_dir"
  
  # Remove Mac OS X metadata and resource forks
  find "$temp_dir" -type d -name "__MACOSX" -exec rm -rf {} +
  find "$temp_dir" -type f -name ".DS_Store" -delete
  
  # Move the unpacked files into the repository directory
  mv "$temp_dir"/* "$repo_dir"
  
  # Clean up the temporary directory
  rm -rf "$temp_dir"
}

# Main function to unpack and normalize all archives
unpack_support_archives() {
  local repo_dir=${1:-repo}
  local manifest_file=${2:-manifest.json}
  
  # Create the repository directory if it doesn't exist
  mkdir -p "$repo_dir"
  
  # Unpack and normalize each archive
  for ((i=0; i<${#ARCHIVES[@]}; i++)); do
    unpack_and_normalize "${ARCHIVES[$i]}" "$repo_dir"
    
    # Verify the count of files in the repository directory
    local actual_count=$(find "$repo_dir" -type f | wc -l)
    if [ $actual_count -ne ${EXPECTED_COUNTS[$i]} ]; then
      echo "Error: Expected $expected_count files, but found $actual_count"
      exit 1
    fi
    
    # Emit the manifest file
    echo "{ \"${ARCHIVES[$i]}\": $(find "$repo_dir" -type f | wc -l) }" > "$manifest_file"
  done
  
  # Check if ML models are enabled and emit audit hash
  local ml_enabled=$(cat config.json | jq -r '.ml_enabled')
  if [ $ml_enabled == "true" ]; then
    local audit_hash=$(audit_hash "$repo_dir")
    echo "{ \"audit_hash\": \"$audit_hash\" }" >> "$manifest_file"
  fi
}

# Call the main function with default arguments
unpack_support_archives repo manifest.json

# Emit a success message
echo "Support archives unpacked and normalized successfully."
