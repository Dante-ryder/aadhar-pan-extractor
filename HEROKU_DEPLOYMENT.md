# Heroku Deployment Guide for Aadhar-PAN Extractor

This guide will help you deploy the Aadhar-PAN Extractor application to Heroku successfully.

## Prerequisites

1. Heroku CLI installed
2. Git installed
3. Node.js and npm installed

## Deployment Steps

### 1. Login to Heroku

```bash
heroku login
```

### 2. Create a Heroku App (if you haven't already)

```bash
heroku create aadhar-pan-extractor
```

### 3. Add Buildpacks

Add the Node.js buildpack (should be added automatically) and ImageMagick buildpack for PDF processing:

```bash
heroku buildpacks:add --index 1 https://github.com/DuckyTeam/heroku-buildpack-imagemagick
heroku buildpacks:add heroku/nodejs
```

### 4. Configure Environment Variables

```bash
heroku config:set NODE_ENV=production
```

### 5. Deploy the Application

```bash
git add .
git commit -m "Prepare for Heroku deployment"
git push heroku main
```

### 6. Run the Debug Script (if needed)

If you encounter any issues, run the debug script:

```bash
heroku run bash heroku-debug.sh
```

### 7. View Logs

```bash
heroku logs --tail
```

## Common Issues and Solutions

### H10 - App Crashed

If you see an H10 error, check the following:

1. **Missing Dependencies**: Ensure all dependencies are in package.json
2. **Build Issues**: Check if the Angular app built correctly
3. **File Paths**: Verify paths in server.js are correct
4. **Environment Variables**: Make sure all required environment variables are set

### R10 - Boot Timeout

If your app takes too long to start:

1. Optimize your application startup
2. Check for long-running operations in your initialization code

### H14 - No Web Dynos Running

Ensure your Procfile is correctly configured with:
```
web: node src/server.js
```

## Verifying Deployment

After successful deployment, your app should be available at:
```
https://aadhar-pan-extractor.herokuapp.com
```

Or at the custom domain Heroku assigned to your app.
