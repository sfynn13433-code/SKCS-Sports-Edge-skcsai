@echo off
echo Starting SKCS EdgeMind Quant Engine...
echo.

:: 1. Start the Dolphin 3B Server
:: We force '-c 2048' to keep RAM usage low on your CPU
start "Dolphin Server" cmd /k ""C:\Users\skcsa\models\llama-b8575-bin-win-cpu-x64\llama-server.exe" -m "C:\Users\skcsa\models\Dolphin3.0-Llama3.2-3B-Q5_K_M.gguf" -c 2048 --port 8080"

:: 2. Wait 10 seconds for the model to load and the server to wake up
echo Waiting for AI to initialize...
timeout /t 10

:: 3. Start the Ngrok Tunnel
:: Using your permanent static URL so Render never loses the connection
start "Ngrok Tunnel" cmd /k "ngrok http --url=darkening-nursery-stiffness.ngrok-free.dev 8080"

echo.
echo =======================================================
echo AI STATUS: Starting (Check the Dolphin window)
echo TUNNEL STATUS: Starting (Check the Ngrok window)
echo =======================================================
echo You can minimize these windows now. Keep them running!