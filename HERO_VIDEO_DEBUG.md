# Hero Video Disappearance - Root Cause Analysis & Fix

## Problem
Hero videos uploaded via Telegram bot are being automatically deleted from the database after a period of time.

## Root Cause
The issue is in [backend/routes/settings.js](backend/routes/settings.js) in the `normalizeHeroVideos()` function (lines 8-24).

### What's Happening:
1. **Upload Process** (bot.js:4776):
   - Videos are uploaded to: `backend/uploads/`
   - URL stored in DB as: `/uploads/filename.mp4`

2. **Retrieval Process** (settings.js:41):
   - Every time settings are retrieved, `normalizeHeroVideos()` is called
   - It checks if each video file exists on the filesystem
   - **Path calculation was WRONG** - causing files to not be found
   - Video is filtered out silently
   - **Database is immediately saved** without the video
   - Video is permanently deleted from DB

### The Bug:
```javascript
// OLD (INCORRECT):
const relativePath = video.url.replace(/^[/\\]+/, '');  // → "uploads/filename.mp4"
const filePath = path.join(__dirname, '..', relativePath);
// Path construction was not clear, causing validation to fail
```

## Solution Implemented ✅

### 1. **Fixed Path Calculation** (settings.js:8-31)
- Now correctly constructs the path to `backend/uploads/`
- Better error logging to show the exact paths being checked
- Distinguishes between file-not-found and other issues

### 2. **Improved GET Endpoint** (settings.js:33-81)
- Better warning messages when videos are missing
- Shows which videos were removed
- Only auto-saves if there are remaining videos (prevents losing all videos on path issues)
- Logs errors instead of silently deleting

### 3. **Added Diagnostic Endpoint** (NEW)
- **Endpoint**: `GET /api/settings/diagnose/hero-videos` (admin only)
- Checks filesystem vs. database consistency
- Identifies orphaned files (on disk but not in DB)
- Identifies missing videos (in DB but not on disk)
- Provides actionable recommendations

## How to Diagnose the Issue

### Step 1: Call the diagnostic endpoint
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/settings/diagnose/hero-videos
```

### Step 2: Check the response
The response will tell you:
- If `backend/uploads/` directory exists
- How many videos are in the database
- How many video files are on disk
- Which videos are missing from the filesystem
- Which files are orphaned on disk

### Example response:
```json
{
  "success": true,
  "data": {
    "uploadsDirectory": "backend/uploads",
    "uploadsDirExists": true,
    "storedVideosCount": 3,
    "filesOnDiskCount": 2,
    "orphanedFilesCount": 0,
    "videos": [
      {
        "url": "/uploads/hero_1234567890_123456.mp4",
        "caption": "Hero video 1",
        "uploadedAt": "2024-01-15T10:30:00.000Z",
        "fileExists": true
      },
      {
        "url": "/uploads/hero_1234567891_654321.mp4",
        "caption": "Hero video 2",
        "uploadedAt": "2024-01-15T11:00:00.000Z",
        "fileExists": false  // ⚠️ Missing!
      }
    ],
    "issues": {
      "missingFromDisk": 1,
      "orphanedOnDisk": 0,
      "hasIssues": true
    },
    "recommendations": [
      {
        "issue": "1 stored videos are missing from filesystem",
        "severity": "HIGH",
        "videos": ["/uploads/hero_1234567891_654321.mp4"],
        "fix": "Either restore the video files or remove these entries from database"
      }
    ]
  }
}
```

## Preventive Measures

### 1. Ensure `backend/uploads/` exists and is writable
```bash
mkdir -p backend/uploads
chmod 755 backend/uploads
```

### 2. Monitor disk space
- Hero videos can be large (up to 100MB each)
- Ensure you have sufficient free disk space

### 3. Regular backups
- Backup the `backend/uploads/` directory regularly
- Consider storing videos in cloud storage (S3, Azure Blob, etc.)

### 4. Check permissions
- Ensure the Node.js process has read/write permissions to `backend/uploads/`
- Check file ownership: `ls -la backend/uploads/`

## How to Clean Up (if needed)

### Remove missing videos from database:
If diagnostic shows missing videos that you don't want to re-upload:

1. Note the video URLs from the diagnostic output
2. Call the update endpoint with the corrected video list:
```bash
curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "heroVideos": [
      {
        "url": "/uploads/hero_existing_video.mp4",
        "caption": "Working video"
      }
    ]
  }' \
  http://localhost:5000/api/settings
```

### Delete orphaned files (to free disk space):
Manually delete files in `backend/uploads/` that are not in the database (shown in diagnostic output).

## Changes Made to Code

### File: [backend/routes/settings.js](backend/routes/settings.js)

**Function: `normalizeHeroVideos()`** (Lines 8-31)
- Fixed path calculation to correctly point to `backend/uploads/`
- Added detailed console logging for debugging
- Shows exact filesystem paths being checked

**Function: GET `/`** (Lines 33-81)
- Improved error logging
- Prevents auto-save if all videos become missing (indicates a system issue)
- Shows detailed warnings when videos are removed

**New Function: `GET /diagnose/hero-videos`**
- Diagnostic endpoint to check system health
- Compares database vs. filesystem
- Provides actionable recommendations



