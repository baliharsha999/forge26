# JanSetu AI - Dev Runner Script
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting JanSetu AI Development Servers" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# Start Backend in Background Process
Write-Host "Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location d:\buildathon; `$env:PYTHONPATH='backend'; .\backend\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload" -PassThru

# Start Frontend in Background Process
Write-Host "Starting Vite Frontend on http://localhost:5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "Set-Location d:\buildathon\frontend; npm run dev" -PassThru

Write-Host "`n✅ JanSetu AI is live!" -ForegroundColor Green
Write-Host "👉 Frontend Web App: http://localhost:5173" -ForegroundColor Cyan
Write-Host "👉 Backend API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "👉 Live Public Health: http://localhost:8000/health`n" -ForegroundColor Cyan
