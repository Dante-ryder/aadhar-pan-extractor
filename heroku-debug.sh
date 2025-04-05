#!/bin/bash

echo "===== HEROKU DEBUG SCRIPT ====="
echo "Running on: $(date)"

# Check Node.js and npm versions
echo "\n===== NODE & NPM VERSIONS ====="
node -v
npm -v

# Check environment variables
echo "\n===== ENVIRONMENT VARIABLES ====="
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"

# Check directory structure
echo "\n===== DIRECTORY STRUCTURE ====="
echo "Current directory: $(pwd)"
ls -la

# Check dist directory
echo "\n===== DIST DIRECTORY ====="
if [ -d "dist" ]; then
  echo "dist directory exists"
  ls -la dist
  
  # Check for index.html
  if [ -f "dist/index.html" ]; then
    echo "\nindex.html exists"
    head -n 10 dist/index.html
  else
    echo "\nERROR: index.html not found in dist directory"
  fi
else
  echo "ERROR: dist directory does not exist"
fi

# Check dependencies
echo "\n===== DEPENDENCY CHECK ====="
if [ -f "package.json" ]; then
  echo "package.json exists"
  grep -A 10 "dependencies" package.json
else
  echo "ERROR: package.json not found"
fi

# Check for ImageMagick
echo "\n===== IMAGEMAGICK CHECK ====="
if command -v convert &> /dev/null; then
  echo "ImageMagick is installed"
  convert -version | head -n 1
else
  echo "WARNING: ImageMagick not found"
fi

# Check server.js
echo "\n===== SERVER.JS CHECK ====="
if [ -f "src/server.js" ]; then
  echo "server.js exists"
  grep -n "app.listen" src/server.js
  grep -n "express.static" src/server.js
else
  echo "ERROR: src/server.js not found"
fi

# Check for logs
echo "\n===== RECENT LOGS ====="
if [ -d "/tmp/uploads" ]; then
  echo "/tmp/uploads directory exists"
  ls -la /tmp/uploads
else
  echo "INFO: /tmp/uploads directory does not exist yet"
fi

echo "\n===== DEBUG COMPLETE ====="
