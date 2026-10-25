const form = document.getElementById('regForm');
const submitBtn = document.getElementById('submitBtn');
const label = submitBtn.querySelector('.label');
const skipClient = document.getElementById('skipClient');
const preview = document.getElementById('preview');
const count = document.getElementById('count');

const MAX_PHOTO = 2 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TRACKS = ['web', 'mobile', 'data', 'design'];

// Date of birth cannot be in the future
document.getElementById('dob').max = new Date().toISOString().split('T')[0];

// Each validator returns an error message, or '' when the value is fine
const validators = {
  fullName(f) {
    const v = f.fullName.value.trim();
    if (!v) return 'Enter your full name.';
    if (!/^[A-Za-z][A-Za-z\s.'-]{1,59}$/.test(v)) return 'Use 2–60 letters. Numbers and symbols are not allowed.';
    return '';
  },
  email(f) {
    const v = f.email.value.trim();
    if (!v) return 'Enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter a valid email, like name@example.com.';
    return '';
  },
  phone(f) {
    const v = f.phone.value.replace(/[\s-]/g, '');
    if (!v) return 'Enter your mobile number.';
    if (!/^(\+92|0)3\d{9}$/.test(v)) return 'Use a Pakistani mobile number, like 0300 1234567 or +92 300 1234567.';
    return '';
  },
  dob(f) {
    const v = f.dob.value;
    if (!v) return 'Choose your date of birth.';
    const d = new Date(v), now = new Date();
    if (Number.isNaN(d.getTime())) return 'Enter a valid date.';
    if (d > now) return 'Date of birth cannot be in the future.';
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    if (age < 16) return 'You must be at least 16 to register.';
    if (age > 100) return 'Check the year. That date is more than 100 years ago.';
    return '';
  },
  track(f) {
    if (!f.track.value) return 'Choose a track.';
    if (!TRACKS.includes(f.track.value)) return 'That track is not available. Choose one from the list.';
    return '';
  },
  motivation(f) {
    const len = f.motivation.value.trim().length;
    if (!len) return 'Tell us why you want to join.';
    if (len < 20) return `Write at least 20 characters (you have ${len}).`;
    if (len > 300) return `Keep it under 300 characters (you have ${len}).`;
    return '';
  },
  photo(f) {
    const file = f.photo.files[0];
    if (!file) return 'Upload a profile photo.';
    if (!PHOTO_TYPES.includes(file.type)) return 'Upload a JPG, PNG or WebP image.';
    if (file.size > MAX_PHOTO) return `Photo must be 2 MB or smaller (yours is ${(file.size / 1048576).toFixed(1)} MB).`;
    return '';
  },
  terms(f) {
    return f.terms.checked ? '' : 'Accept the code of conduct to continue.';
  },
};

function setError(name, message) {
  const wrap = form.querySelector(`[data-field="${name}"]`);
  const box = document.getElementById(`${name}-error`);
  const input = form.elements[name];
  box.textContent = message;
  wrap.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (message) input.setAttribute('aria-describedby', box.id); else input.removeAttribute('aria-describedby');
}

function validateField(name) {
  const msg = validators[name](form.elements);
  setError(name, msg);
  return !msg;
}

function validateAll() {
  let firstBad = null;
  for (const name of Object.keys(validators)) {
    if (!validateField(name) && !firstBad) firstBad = name;
  }
  return firstBad;
}

// Validate when leaving a field, then re-check live while the person fixes it
Object.keys(validators).forEach((name) => {
  const el = form.elements[name];
  const evt = el.type === 'file' || el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur';
  el.addEventListener(evt, () => validateField(name));
  el.addEventListener('input', () => {
    if (form.querySelector(`[data-field="${name}"]`).classList.contains('invalid')) validateField(name);
  });
});

form.elements.motivation.addEventListener('input', (e) => {
  count.textContent = `${e.target.value.length} / 300`;
});

form.elements.photo.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && PHOTO_TYPES.includes(file.type)) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  } else {
    preview.hidden = true;
  }
});

function toast(message, type) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('loading', on);
  label.textContent = on ? 'Submitting…' : 'Reserve my seat';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;

  if (!skipClient.checked) {
    const firstBad = validateAll();
    if (firstBad) {
      form.elements[firstBad].focus();
      toast('Fix the highlighted fields and try again.', 'error');
      return;
    }
  }

  setLoading(true);
  try {
    const res = await fetch('/api/register', { method: 'POST', body: new FormData(form) });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      toast(data.message || 'You are registered!', 'success');
      form.reset();
      preview.hidden = true;
      count.textContent = '0 / 300';
      Object.keys(validators).forEach((n) => setError(n, ''));
    } else if (res.status === 422 && data.errors) {
      // Server-side errors shown on the same fields as client-side ones
      Object.keys(validators).forEach((n) => setError(n, data.errors[n] || ''));
      const first = Object.keys(validators).find((n) => data.errors[n]);
      if (first) form.elements[first].focus();
      toast(data.message || 'The server rejected some fields.', 'error');
    } else {
      toast(data.message || 'Something went wrong. Try again.', 'error');
    }
  } catch {
    toast('Could not reach the server. Check your connection and try again.', 'error');
  } finally {
    setLoading(false);
  }
});
