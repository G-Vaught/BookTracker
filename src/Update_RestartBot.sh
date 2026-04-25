#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e 

echo "?? Starting deployment process..."

# 1. Update Git Code
# Note: Ensure you have configured git (keys/tokens) or this will fail on 'fetch'
echo "?? Pulling latest changes from origin..."
git pull origin master

# Optional: Check if git pull was successful before continuing
if [ $? -ne 0 ]; then
    echo "? Git pull failed. Aborting deployment."
    exit 1
fi

echo "? Git update successful."

# 2. Restart PM2 Process
echo "?? Restarting 'booktracker' service via PM2..."
pm2 restart booktracker

if [ $? -eq 0 ]; then
    echo "? PM2 restart successful."
else
    echo "? PM2 restart failed or process not found."
fi

echo "?? Deployment finished successfully."
