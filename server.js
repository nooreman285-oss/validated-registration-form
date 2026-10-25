const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'data', 'registrations.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

const TRACKS = ['web', 'mobile', 'data', 'design'];
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ALLOWED_TYPES[file.mimetype] || ''}`),
  }),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      req.badFileType = true;
      return cb(null, false); // skip the file, report the error ourselves
    }
    cb(null, true);
  },
});

// Check real file signature, not just the mimetype the browser claims
function looksLikeImage(filePath) {
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
  return isJpg || isPng || isWebp;
}

function validate(body, file, badFileType) {
  const errors = {};
  const v = (k) => (typeof body[k] === 'string' ? body[k].trim() : '');

  // Full name
  const name = v('fullName');
  if (!name) errors.fullName = 'Enter your full name.';
  else if (!/^[A-Za-z][A-Za-z\s.'-]{1,59}$/.test(name))
    errors.fullName = 'Use 2–60 letters. Numbers and symbols are not allowed.';

  // Email
  const email = v('email').toLowerCase();
  if (!email) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    errors.email = 'Enter a valid email, like name@example.com.';

  // Phone (Pakistan mobile)
  const phone = v('phone').replace(/[\s-]/g, '');
  if (!phone) errors.phone = 'Enter your mobile number.';
  else if (!/^(\+92|0)3\d{9}$/.test(phone))
    errors.phone = 'Use a Pakistani mobile number, like 0300 1234567 or +92 300 1234567.';

  // Date of birth
  const dob = v('dob');
  if (!dob) errors.dob = 'Choose your date of birth.';
  else {
    const d = new Date(dob);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(d.getTime()))
      errors.dob = 'Enter a valid date.';
    else {
      const now = new Date();
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      if (d > now) errors.dob = 'Date of birth cannot be in the future.';
      else if (age < 16) errors.dob = 'You must be at least 16 to register.';
      else if (age > 100) errors.dob = 'Check the year. That date is more than 100 years ago.';
    }
  }

  // Track (select)
  const track = v('track');
  if (!track) errors.track = 'Choose a track.';
  else if (!TRACKS.includes(track)) errors.track = 'That track is not available. Choose one from the list.';

  // Motivation
  const why = v('motivation');
  if (!why) errors.motivation = 'Tell us why you want to join.';
  else if (why.length < 20) errors.motivation = `Write at least 20 characters (you have ${why.length}).`;
  else if (why.length > 300) errors.motivation = `Keep it under 300 characters (you have ${why.length}).`;

  // Photo
  if (badFileType) errors.photo = 'Upload a JPG, PNG or WebP image.';
  else if (!file) errors.photo = 'Upload a profile photo.';
  else if (!looksLikeImage(file.path)) errors.photo = 'That file is not a real image. Upload a JPG, PNG or WebP.';

  // Terms
  if (body.terms !== 'on') errors.terms = 'Accept the code of conduct to continue.';

  return { errors, clean: { fullName: name, email, phone, dob, track, motivation: why } };
}

function readAll() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return []; }
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    const discard = () => req.file && fs.unlink(req.file.path, () => {});

    if (err instanceof multer.MulterError) {
      discard();
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Photo must be 2 MB or smaller.'
        : 'Upload only one photo, using the field named "photo".';
      return res.status(422).json({ message: 'Fix the highlighted fields.', errors: { photo: msg } });
    }
    if (err) {
      discard();
      console.error(err);
      return res.status(500).json({ message: 'Something went wrong on our side. Try again.' });
    }

    const { errors, clean } = validate(req.body, req.file, req.badFileType);

    if (!errors.email && readAll().some((r) => r.email === clean.email))
      errors.email = 'This email is already registered.';

    if (Object.keys(errors).length) {
      discard();
      return res.status(422).json({ message: 'Fix the highlighted fields.', errors });
    }

    await new Promise((r) => setTimeout(r, 900)); // simulated work so the loading state is visible in demos

    const all = readAll();
    all.push({ id: Date.now(), ...clean, photo: req.file.filename, createdAt: new Date().toISOString() });
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2));

    res.status(201).json({ message: `You're registered, ${clean.fullName.split(' ')[0]}!` });
  });
});

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
