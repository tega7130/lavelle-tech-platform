# Cloudinary Direct Upload Setup Guide

This guide explains how to set up Cloudinary direct uploads for video content on Lavelle Tech Platform.

## 🎯 Overview

The hybrid approach allows:
- ✅ Candidates upload videos directly to Cloudinary (no size limits)
- ✅ Backend validates permissions before allowing uploads
- ✅ Cloudinary webhook notifies backend of successful uploads
- ✅ Database tracks all video uploads
- ✅ No Vercel request size limits

## 🚀 Step 1: Cloudinary Account Setup

### Create/Configure Cloudinary Account

1. Go to https://cloudinary.com
2. Sign in or create account
3. Go to **Dashboard** → **Settings** → **Upload**
4. Note your **Cloud Name** (visible in dashboard)

### Create Upload Preset

1. Go to **Settings** → **Upload**
2. Scroll to **Upload presets**
3. Click **Add upload preset**
4. Configure:
   - **Name:** `lavelle_videos`
   - **Mode:** Unsigned (for direct upload)
   - **Allowed resource types:** Video
   - **Max file size:** 500 MB
   - **Folder:** `/lavelle/videos`
   - **Auto-tag:** `lavelle`, `video`
5. Save the preset

### Get API Credentials

1. Go to **Account** (top right)
2. **Account Settings**
3. Under **API Keys** section:
   - Copy **Cloud Name**
   - Copy **API Key**
   - Copy **API Secret**

## 📋 Step 2: Configure Environment Variables

### Development (.env.local)

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your-cloud-name"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="lavelle_videos"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Production (.env.production.local)

Same as above, with production Cloudinary account credentials.

## 🔑 Step 3: Setup Webhook

### Create Notification URL

1. In Cloudinary **Settings** → **Notifications**
2. Click **Add notification**
3. Configure:
   - **URL:** `https://your-domain.com/api/webhooks/cloudinary`
   - **Events:** Video Upload (Success)
   - **Request body template:** Use default
   - **Sign requests:** Yes
   - **Signature version:** sha256
4. Save notification

### Verify Webhook

Test webhook delivery:
1. Go back to **Notifications**
2. Click the webhook you created
3. **Test notifications** → **Video Upload**
4. Check your application logs for the webhook

## 🗄️ Step 4: Database Migration

Run Prisma migration to create VideoUpload table:

```bash
npm run db:migrate
```

This creates the `VideoUpload` table to track all video uploads.

## 🧪 Step 5: Test the Implementation

### Test Token Generation

```bash
curl -X POST http://localhost:3000/api/cloudinary/generate-token \
  -H "Content-Type: application/json" \
  -c cookies.txt
```

Should return:
```json
{
  "cloudName": "your-cloud-name",
  "uploadPreset": "lavelle_videos",
  "timestamp": 1234567890,
  "signature": "abcd1234...",
  "apiKey": "123456789",
  "success": true
}
```

### Test Upload Component

1. Start dev server: `npm run dev`
2. Log in as a candidate
3. Complete your profile
4. Use the CloudinaryDirectUpload component
5. Upload a small test video
6. Check database: `SELECT * FROM VideoUpload ORDER BY createdAt DESC;`

## 📁 Usage in Your Application

### Import Component

```typescript
import { CloudinaryDirectUpload } from "@/components/cloudinary-direct-upload";

export function VideoUploadPage() {
  return (
    <CloudinaryDirectUpload
      onSuccess={(result) => {
        console.log("Video uploaded:", result.info?.secure_url);
        // Update UI, redirect, etc.
      }}
      onError={(error) => {
        console.error("Upload failed:", error.message);
      }}
      maxFileSize={500} // MB
    />
  );
}
```

### Database Query

Track uploads:
```sql
SELECT 
  vu.id,
  c.email,
  vu.url,
  vu.fileSize,
  vu.status,
  vu.createdAt
FROM VideoUpload vu
JOIN Candidate c ON vu.candidateId = c.id
ORDER BY vu.createdAt DESC
LIMIT 10;
```

## 🔒 Security Features

### What's Secure

✅ **Signed Upload Tokens** — Backend generates time-limited signed tokens
✅ **Permission Validation** — Only candidates with completed profiles can upload
✅ **Webhook Signature Verification** — All webhooks validated
✅ **Database Tracking** — All uploads logged with candidate ID
✅ **Upload Preset Restrictions** — Cloudinary limits to video files only
✅ **API Secret Protection** — Never exposed to client

### Best Practices

1. **Rotate API Secret** — Regularly rotate in Cloudinary settings
2. **Monitor Uploads** — Track VideoUpload table for anomalies
3. **Set Quotas** — Implement per-candidate upload limits in database
4. **Validate URLs** — Before using uploaded video URLs, verify they exist

## 📊 Monitoring

### Check Upload Status

```bash
# Recent uploads
psql -U postgres -d lavelle_db \
  -c "SELECT cloudinaryId, url, status FROM VideoUpload ORDER BY createdAt DESC LIMIT 10;"

# Failed uploads
psql -U postgres -d lavelle_db \
  -c "SELECT * FROM VideoUpload WHERE status = 'FAILED';"

# Upload volume
psql -U postgres -d lavelle_db \
  -c "SELECT DATE(createdAt), COUNT(*) FROM VideoUpload GROUP BY DATE(createdAt);"
```

### Check Webhook Logs

In Cloudinary **Settings** → **Notifications**:
- Click webhook
- View **Recent Deliveries**
- Check response codes (should be 200)

## 🐛 Troubleshooting

### "Unauthorized" on token generation

- Verify candidate is logged in
- Verify profile is completed: `SELECT completedAt FROM CandidateProfile WHERE candidateId = '...'`

### Upload fails silently

- Check browser console for errors
- Verify upload preset exists in Cloudinary
- Check CORS settings in Cloudinary

### Webhook not receiving events

- Verify webhook URL is accessible from internet
- Check API secret matches in both places
- Test webhook in Cloudinary dashboard

### Videos appear but URL is broken

- Verify Cloudinary API secret is correct
- Check video resource type in Cloudinary dashboard
- Confirm video completed processing (check cloudinary.com directly)

## 📚 Reference

- **Cloudinary Docs:** https://cloudinary.com/documentation
- **Next Cloudinary:** https://next.cloudinary.dev
- **Upload API:** https://cloudinary.com/documentation/upload_widget_reference

## 🔄 Migration Path

If you have existing uploads via Vercel:

1. Create script to migrate old uploads to VideoUpload table
2. Update any hardcoded URLs to use Cloudinary URLs
3. Test old videos still work
4. Remove old upload endpoint after verification

---

**Setup complete!** Direct video uploads are now active. 🎬
