const { Router } = require('express');
const multer = require('multer');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');
const { bucket } = require('../config/firebase');
const crypto = require('crypto');
const path = require('path');

const router = Router();
router.use(authenticate, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post('/', upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploaded = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname);
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `challenges/${crypto.randomBytes(6).toString('hex')}_${safeName}`;

      const blob = bucket.file(storagePath);
      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: { originalName: file.originalname },
        },
      });

      await blob.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

      uploaded.push({
        name: file.originalname,
        url: publicUrl,
        size: file.size,
      });
    }

    res.json({ files: uploaded });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
