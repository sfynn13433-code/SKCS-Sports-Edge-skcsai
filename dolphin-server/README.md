# Dolphin AI Server for SKCS EdgeMind

This directory contains the Docker configuration for deploying the Dolphin 3.0 Llama 3.2 3B model on Render as a web service.

## Overview

The Dolphin server provides AI-generated insights for football match predictions. When integrated with the SKCS backend, it replaces templated reports with unique, context-aware analysis for each match.

## Local Development

For local development, run the Dolphin server directly:

```bash
# Using llama.cpp (already running on your machine)
llama-server -m Dolphin3.0-Llama3.2-3B-Q5_K_M.gguf --host 127.0.0.1 --port 8080 -c 4096
```

The local server URL is: `http://localhost:8080`

## Production Deployment (Render)

### Prerequisites

1. A Render account
2. This repository connected to Render

### Deployment Steps

1. The `render.yaml` blueprint file in the root already defines the Dolphin service
2. Push these changes to GitHub
3. Render will automatically detect the new service and deploy it
4. The service will be available at: `https://dolphin-ai-server-<random>.onrender.com`

### Service Configuration

- **Plan**: Starter (2GB RAM minimum required)
- **Region**: Frankfurt (same as main app)
- **Health Check**: `/health`
- **Model**: Dolphin 3.0 Llama 3.2 3B (Q5_K_M quantization)
- **Context Size**: 4096 tokens
- **Max Tokens**: 512 per generation
- **Temperature**: 0.7

### Costs

- Render Starter plan: ~$7/month
- Includes 2GB RAM and 1 CPU
- Sufficient for the 3B parameter model

## How It Works

1. When a prediction is generated, `direct1x2Builder.js` checks if Dolphin is available
2. If available, it calls `aiProvider.generateInsight()` with match details
3. The AI generates a unique 4-stage analysis:
   - Stage 1: Baseline probability assessment
   - Stage 2: Context adjustments (form, league, etc.)
   - Stage 3: Reality check (weather, news, etc.)
   - Stage 4: Final decision with confidence
4. If AI fails or is unavailable, it falls back to templated reports

## Monitoring

Check the Render dashboard for:
- Service health
- Response times
- Error rates
- Resource usage

## Troubleshooting

### Service won't start
- Check that the model file downloads successfully during build
- Verify 2GB RAM is available
- Check Render logs for memory errors

### AI insights not appearing
- Verify `DOLPHIN_URL` env var is set in the main service
- Check that the Dolphin service health check passes
- Review backend logs for `isDolphinAvailable()` results

### Slow responses
- The 3B model on CPU takes 10-30 seconds per insight
- Consider upgrading to a higher Render plan for faster CPU
- Or switch to a smaller/faster model (Q4_K_M instead of Q5_K_M)
