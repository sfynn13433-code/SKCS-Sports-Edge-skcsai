#!/bin/bash

# SKCS AI Sports Edge - Cloud Scheduler Deployment Script
# This script sets up reliable scheduling with SAST timezone and idempotency

set -e

# Configuration - Update these values for your environment
PROJECT_ID="${SKCS_GCP_PROJECT:-YOUR_GCP_PROJECT}"
REGION="${SKCS_SCHEDULER_REGION:-europe-west1}"
BACKEND_HOST="${SKCS_BACKEND_HOST:-https://YOUR_BACKEND_HOST}"
REFRESH_KEY="${SKCS_REFRESH_KEY:-YOUR_SECRET_REFRESH_KEY}"

# Validate required variables
if [[ "$PROJECT_ID" == "YOUR_GCP_PROJECT" || "$BACKEND_HOST" == "https://YOUR_BACKEND_HOST" || "$REFRESH_KEY" == "YOUR_SECRET_REFRESH_KEY" ]]; then
    echo "❌ ERROR: Please set environment variables before running this script:"
    echo "   - SKCS_GCP_PROJECT: Your Google Cloud project ID"
    echo "   - SKCS_BACKEND_HOST: Your backend URL (e.g., https://your-app.onrender.com)"
    echo "   - SKCS_REFRESH_KEY: Your secret refresh API key"
    echo ""
    echo "Example:"
    echo "export SKCS_GCP_PROJECT=my-skcs-project"
    echo "export SKCS_BACKEND_HOST=https://skcs-backend.onrender.com"
    echo "export SKCS_REFRESH_KEY=your-secret-key-here"
    exit 1
fi

echo "🚀 Deploying SKCS Cloud Scheduler jobs..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Backend: $BACKEND_HOST"
echo ""

# Set gcloud project
gcloud config set project "$PROJECT_ID"

# Create scheduler jobs with SAST timezone and proper retry settings
create_scheduler_job() {
    local job_name="$1"
    local schedule="$2"
    local description="$3"
    
    echo "Creating scheduler job: $job_name"
    
    gcloud scheduler jobs create http "$job_name" \
        --location="$REGION" \
        --schedule="$schedule" \
        --time-zone="Africa/Johannesburg" \
        --uri="$BACKEND_HOST/api/refresh-predictions" \
        --http-method=POST \
        --headers="x-api-key=$REFRESH_KEY,content-type=application/json" \
        --attempt-deadline="1800s" \
        --max-retry-attempts=1 \
        --description="$description" \
        --quiet || true
    
    echo "✅ Created: $job_name"
}

# Production schedule based on SAST
echo "📅 Creating production schedule (SAST timezone)..."
echo ""

# Morning refresh: 08:00 SAST
create_scheduler_job \
    "skcs-refresh-0800" \
    "0 8 * * *" \
    "Morning predictions refresh - 08:00 SAST"

# Midday refresh: 16:00 SAST  
create_scheduler_job \
    "skcs-refresh-1600" \
    "0 16 * * *" \
    "Midday predictions refresh - 16:00 SAST"

# Evening refresh: 20:00 SAST
create_scheduler_job \
    "skcs-refresh-2000" \
    "0 20 * * *" \
    "Evening predictions refresh - 20:00 SAST"

# Grading run: 04:00 SAST (grades yesterday's predictions)
create_scheduler_job \
    "skcs-grade-0400" \
    "0 4 * * *" \
    "Grade yesterday's predictions - 04:00 SAST"

echo ""
echo "🎯 Optional: Create OIDC-authenticated jobs (recommended for Cloud Run)"
echo "If your backend is on Cloud Run, consider using OIDC instead of API keys:"
echo ""

# OIDC version (commented out - uncomment when ready)
# SERVICE_ACCOUNT="scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
# 
# gcloud scheduler jobs create http skcs-refresh-0800-oidc \
#     --location="$REGION" \
#     --schedule="0 8 * * *" \
#     --time-zone="Africa/Johannesburg" \
#     --uri="$BACKEND_HOST/api/refresh-predictions" \
#     --http-method=POST \
#     --oidc-service-account-email="$SERVICE_ACCOUNT" \
#     --attempt-deadline="1800s" \
#     --max-retry-attempts=1 \
#     --description="Morning refresh with OIDC auth"

echo ""
echo "📋 Listing all scheduler jobs..."
gcloud scheduler jobs list --location="$REGION" --format="table(name,schedule,timeZone,description)"

echo ""
echo "✅ Cloud Scheduler deployment complete!"
echo ""
echo "🔍 Monitor your jobs:"
echo "   gcloud scheduler jobs list --location=$REGION"
echo "   gcloud scheduler jobs describe skcs-refresh-0800 --location=$REGION"
echo ""
echo "🧪 Test a job manually:"
echo "   gcloud scheduler jobs run skcs-refresh-0800 --location=$REGION"
echo ""
echo "⚠️  Important notes:"
echo "   - All jobs use Africa/Johannesburg timezone"
echo "   - Max retry attempts set to 1 to prevent cascading failures"
echo "   - 30-minute attempt deadline (1800s)"
echo "   - Backend includes idempotency to handle duplicate executions"
echo "   - Monitor logs for 'skipped duplicate run' messages"
