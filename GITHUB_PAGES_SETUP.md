# GitHub Pages Setup Guide

This project is configured to automatically deploy to GitHub Pages using GitHub Actions.

## 🚀 How It Works

1. **Automatic Deployment**: When you push to the `main` or `master` branch, GitHub Actions will:
   - Build the frontend
   - Deploy it to GitHub Pages
   - Make it available at `https://jmitchell26-netizen.github.io/Traffic-Flow-Sim/`

## 📋 Setup Steps

### 1. Enable GitHub Pages in Repository Settings

1. Go to your repository on GitHub: `https://github.com/jmitchell26-netizen/Traffic-Flow-Sim`
2. Click **Settings** → **Pages**
3. Under **Source**, select:
   - **Source**: `GitHub Actions`
4. Save the settings

### 2. Push Your Changes

The workflow will automatically run when you push to `main`:

```bash
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main
```

### 3. Check Deployment Status

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You'll see the "Deploy to GitHub Pages" workflow running
4. Once it completes, your site will be live!

## 🌐 Access Your Site

After deployment, your site will be available at:
**https://jmitchell26-netizen.github.io/Traffic-Flow-Sim/**

## ⚠️ Important Notes

### Backend API Limitation

**The frontend on GitHub Pages cannot connect to your local backend.**

For a fully functional demo, you have a few options:

1. **Deploy Backend Separately** (Recommended)
   - Deploy backend to services like:
     - Railway: https://railway.app
     - Render: https://render.com
     - Fly.io: https://fly.io
     - Heroku: https://heroku.com
   - Update `VITE_API_URL` environment variable to point to your deployed backend
   - Rebuild and redeploy frontend

2. **Use Demo Mode** (Future Enhancement)
   - Add a demo mode that uses mock data
   - Works without backend connection

3. **Local Development Only**
   - GitHub Pages site shows UI but API calls will fail
   - Good for showcasing the UI/UX

### Environment Variables

If you deploy the backend separately, update the workflow to set the API URL:

```yaml
- name: Build frontend
  working-directory: ./frontend
  run: npm run build
  env:
    VITE_BASE_PATH: /Traffic-Flow-Sim/
    VITE_API_URL: https://your-backend-url.com/api
```

## 🔧 Manual Deployment

If you want to deploy manually:

```bash
cd frontend
npm install
npm run build
# Then copy dist/ contents to gh-pages branch
```

## 📝 Workflow Details

The workflow (`.github/workflows/deploy.yml`) does:
1. ✅ Checks out your code
2. ✅ Sets up Node.js 18
3. ✅ Installs dependencies
4. ✅ Builds the frontend
5. ✅ Deploys to GitHub Pages

## 🐛 Troubleshooting

### Site not updating?
- Check the **Actions** tab for workflow errors
- Make sure GitHub Pages is set to use **GitHub Actions** as source
- Wait a few minutes for deployment to complete

### 404 errors?
- Make sure `base` path in `vite.config.ts` matches your repository name
- Check that all routes are using relative paths

### API errors?
- Remember: GitHub Pages is static hosting, backend won't work
- Deploy backend separately or use demo mode

## 🎉 Next Steps

1. Enable GitHub Pages in settings
2. Push to main branch
3. Wait for deployment
4. Share your live demo!

