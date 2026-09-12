-- DropTable
-- VideoUpload was an orphaned Cloudinary-webhook artifact — never read by
-- any live code path (the webhook that wrote it, /api/webhooks/cloudinary,
-- was itself unreachable from the app). Dropped as part of the move off
-- Cloudinary to DigitalOcean Spaces.
DROP TABLE "VideoUpload";
