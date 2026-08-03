@echo off
echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && .\venv\Scripts\activate && python manage.py runserver"

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Both servers have been started in new windows!
