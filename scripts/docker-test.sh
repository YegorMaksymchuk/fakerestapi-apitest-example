#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../"
POSTMAN_DIR="${ROOT_DIR}/postman"
REPORT_DIR="${ROOT_DIR}/reports/newman"

mkdir -p "$REPORT_DIR"

NEWMAN_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --folder) NEWMAN_ARGS+=("--folder" "$2"); shift 2 ;;
    --bail)   NEWMAN_ARGS+=("--bail");        shift   ;;
    *)        NEWMAN_ARGS+=("$1");            shift   ;;
  esac
done

docker run --rm \
  -v "${POSTMAN_DIR}:/etc/newman" \
  -v "${REPORT_DIR}:/etc/newman/reports" \
  postman/newman:alpine \
  run FakeRESTAPI-Users.postman_collection.json \
  -e postman_environment.json \
  --reporters cli,junit \
  --reporter-junit-export reports/junit.xml \
  "${NEWMAN_ARGS[@]}"
