#!/bin/bash
cd backend && python app.py &
BACKEND_PID=$!
cd frontend && npm run dev
wait $BACKEND_PID
