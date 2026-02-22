#!/usr/bin/env bash

set -euo pipefail
IFS=','

# Import build guide
curl -s https://example.com/build-guide.md | md2man > docs/build_guide.1.md

# Import backend tree
curl -s https://example.com/backend_tree.json > docs/backend_tree.json

# Import frontend tree
curl -s https://example.com/frontend_tree.yaml > docs/frontend_tree.yaml

# Import mechanics/ml specs
curl -s https://example.com/mechanics_ml_specs.md | md2man > docs/mechanics_ml_specs.1.md

# Normalize and import into repo docs/
cd docs && make normalize && git add . && git commit -m "Import build guide, backend/frontend trees, and mechanics/ml specs" && git push origin main

echo "Imported build guide, backend/frontend trees, and mechanics/ml specs into repo docs/"
