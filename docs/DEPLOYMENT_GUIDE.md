# SKCS Deployment Guide

## 📊 Platform Overview

SKCS AI Sports Edge uses a multi-platform deployment strategy for optimal performance and reliability.

### **Frontend Deployments**

#### ✅ **GitHub Pages** (Primary Frontend)
- **Repository**: https://github.com/SKCS-Sports-Edge/skcsai
- **Status**: ✅ DEPLOYED
- **URL**: https://skcs-sports-edge.github.io
- **Features**: First-party Supabase bundle, CORS fixes
- **Auto-deploy**: Updates automatically on push to main branch

#### ✅ **Vercel** (Alternative Frontend)
- **Status**: ✅ DEPLOYED
- **URL**: https://www.skcs.co.za
- **Build ID**: HiL8hbi8XjNQujfiDvAYRDnGq38b
- **Deploy Time**: 13s
- **Output Directory**: public/
- **Auto-deploy**: Updates automatically on push to main branch

### **Backend Deployment**

#### ⏳ **Render** (Backend API)
- **Status**: 🔄 PENDING MANUAL DEPLOY
- **URL**: https://skcsai.onrender.com
- **Required Action**: Manual deploy via Render dashboard
- **Features**: Enhanced CORS, GitHub Pages origin allowed
- **Health Check**: `/api/health` endpoint

---

## 🔧 Deployment Instructions

### **Render Manual Deploy (Backend)**
1. Visit https://dashboard.render.com
2. Navigate to `skcsai` service
3. Click "Manual Deploy" → "Deploy Latest Commit"
4. Monitor logs for `[CORS DEBUG]` messages
5. Wait for deployment to complete (typically 2-3 minutes)

### **Frontend Deployments**
Both GitHub Pages and Vercel deploy automatically:
- **GitHub Pages**: Triggers on push to main branch
- **Vercel**: Triggers on push to main branch
- **Build Command**: `npm run build:supabase`
- **Output Directory**: `public/`

---

## ✅ Verification Steps

After deployment, verify all platforms are working:

### **1. Backend Health Check**
```bash
curl -I https://skcsai.onrender.com/api/health
# Expected: HTTP/1.1 200 OK
```

### **2. CORS Test**
```bash
curl -I https://skcsai.onrender.com/api/predictions
# Expected: HTTP/1.1 200 OK with CORS headers
```

### **3. Frontend Tests**
- **GitHub Pages**: Visit https://skcs-sports-edge.github.io
- **Vercel**: Visit https://www.skcs.co.za
- **Auth Test**: Check subscription.html for storage errors
- **API Test**: Verify predictions load from all sport tabs

---

## 🎯 Expected Results

After successful deployment:

### **Frontend**
- ✅ No CORS errors in browser console
- ✅ No "Tracking Prevention blocked access to storage" errors
- ✅ Predictions load successfully from all sport tabs
- ✅ Authentication persists across page refreshes

### **Backend**
- ✅ API endpoints respond correctly
- ✅ Database connections established
- ✅ Supabase integration working
- ✅ AI pipeline functional

---

## 🚨 Troubleshooting

### **Common Issues**

#### **CORS Errors**
- Check Render service CORS configuration
- Verify frontend URLs are in allowlist
- Monitor Render logs for `[CORS DEBUG]` messages

#### **Authentication Issues**
- Verify Supabase configuration
- Check environment variables on Render
- Ensure Supabase URL and keys are correct

#### **Build Failures**
- Check `package.json` dependencies
- Verify `npm run build:supabase` runs locally
- Review build logs on Vercel/GitHub Pages

### **Debug Commands**

```bash
# Check Render logs
# Via Render dashboard: skcsai service → Logs

# Test API locally
npm run dev
curl http://localhost:10000/api/health

# Verify Supabase connection
# Check environment variables in Render dashboard
```

---

## 📝 Important Notes

### **Deployment Triggers**
- **GitHub Pages**: Automatic on push to main
- **Vercel**: Automatic on push to main  
- **Render**: Manual deploy required (configurable)

### **Environment Variables**
Ensure these are configured on Render:
- `DATABASE_URL` - PostgreSQL connection
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `GROQ_API_KEY` - Groq AI API key

### **CORS Configuration**
- Frontend URLs must be in CORS allowlist
- GitHub Pages: `https://skcs-sports-edge.github.io`
- Vercel: `https://www.skcs.co.za`
- Local development: `http://localhost:10000`

---

## 🔄 Maintenance

### **Regular Tasks**
- Monitor Render service health
- Check deployment logs weekly
- Update dependencies monthly
- Backup database regularly

### **Performance Monitoring**
- Monitor API response times
- Check database query performance
- Track error rates in logs
- Monitor user experience metrics

---

## 📞 Support

For deployment issues:
- **Render Dashboard**: https://dashboard.render.com
- **Vercel Dashboard**: https://vercel.com/dashboard
- **GitHub Pages**: Repository settings → Pages
- **Logs**: Check platform-specific dashboards

---

**Last Updated**: Consolidated from deployment-status.md  
**Version**: 1.0  
**Status**: Active
