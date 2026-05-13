@echo off
start "Dolphin Server" cmd /k "C:\path\to\llama-server.exe -m C:\path\to\Dolphin3.0-Llama3.2-3B-Q5_K_M.gguf --port 8080"
timeout /t 5
start "Ngrok Tunnel" cmd /k "ngrok http 8080"