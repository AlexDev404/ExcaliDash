#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Branch validation - only allow main branch
echo -e "${YELLOW}Validating branch...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
ALLOWED_BRANCH="main"

if [ "$CURRENT_BRANCH" != "$ALLOWED_BRANCH" ]; then
    echo -e "${RED}ERROR: This script can only be run on the '$ALLOWED_BRANCH' branch!${NC}"
    echo -e "${RED}Current branch: '$CURRENT_BRANCH'${NC}"
    echo -e "${YELLOW}Please switch to the '$ALLOWED_BRANCH' branch and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Branch validation passed - running on '$CURRENT_BRANCH' branch${NC}"
echo ""

# Configuration
DOCKER_USERNAME="zimengxiong"
IMAGE_NAME="excalidash"
VERSION=${1:-$(node -e "try { console.log(require('fs').readFileSync('VERSION', 'utf8').trim()) } catch { console.log('latest') }")}

echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}ExcaliDash Multi-Platform Docker Builder${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""

# Check if logged in to Docker Hub
echo -e "${YELLOW}Checking Docker Hub authentication...${NC}"
if ! docker info | grep -q "Username: $DOCKER_USERNAME"; then
    echo -e "${YELLOW}Not logged in. Please login to Docker Hub:${NC}"
    docker login
else
    echo -e "${GREEN}✓ Already logged in as $DOCKER_USERNAME${NC}"
fi

# Create buildx builder if it doesn't exist
echo -e "${YELLOW}Setting up buildx builder...${NC}"
if ! docker buildx inspect excalidash-builder > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating new buildx builder...${NC}"
    docker buildx create --name excalidash-builder --use --bootstrap
else
    echo -e "${GREEN}✓ Using existing buildx builder${NC}"
    docker buildx use excalidash-builder
fi

# Build and push backend image
echo ""
echo -e "${GREEN}Building and pushing backend image...${NC}"
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag $DOCKER_USERNAME/$IMAGE_NAME-backend:$VERSION \
    --tag $DOCKER_USERNAME/$IMAGE_NAME-backend:latest \
    --file backend/Dockerfile \
    --push \
    backend/

echo -e "${GREEN}✓ Backend image pushed successfully${NC}"

# Build and push frontend image
echo ""
echo -e "${GREEN}Building and pushing frontend image...${NC}"
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag $DOCKER_USERNAME/$IMAGE_NAME-frontend:$VERSION \
    --tag $DOCKER_USERNAME/$IMAGE_NAME-frontend:latest \
    --build-arg VITE_APP_VERSION=$VERSION \
    --file frontend/Dockerfile \
    --push \
    .

echo -e "${GREEN}✓ Frontend image pushed successfully${NC}"


echo ""
echo -e "${GREEN}===========================================${NC}"
echo -e "${GREEN}✓ All images published successfully!${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
