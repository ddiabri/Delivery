#!/bin/bash

# Food Delivery API - Startup Script

echo "Starting Food Delivery API..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "Please edit .env file with your database credentials before running again."
    exit 1
fi

# Start the server
echo "Starting server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
