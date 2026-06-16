J.O.M Bank — Local Demo

Run locally:

```bash
npm install
npm start
```

Endpoints:
- `POST /api/register` — register (returns `otpRequired`)
- `POST /api/login` — login (triggers OTP)
- `POST /api/verify-otp` — verify OTP (returns token if active)
- `POST /api/resend-otp` — resend OTP (60s cooldown)
- `POST /api/forgot-pin` — request OTP for PIN reset
- `POST /api/reset-pin` — reset PIN with OTP

Note: This is a demo server. OTPs are printed to server console.
