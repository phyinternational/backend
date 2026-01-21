# Raajsi Backend

Small notes to help with local development and email setup.

## Local server



- Start a local server that uses the exported `app` (index.js):

```powershell
node local-server.js
```

This is useful because `index.js` is exported for Vercel; local-server provides a simple launcher.

## Email service (Nodemailer)

This project uses Gmail SMTP via Nodemailer for transactional emails. Configure the following environment variables in your `.env` or in the Vercel project settings:

- `Gmail` - the Gmail address used to send emails (e.g., ecolove23@gmail.com)
- `Gmailpass` - an App Password generated from your Google account (requires 2FA)

Important: Do not commit your `.env` or secrets to source control.

### Test email setup locally

Set `Gmail` and `Gmailpass` in `.env`, then run a Node one-liner to instantiate the service (this will not send an email):

```powershell
node -e "require('./services/email.service')"
```

To actually send a test email, you can create a small script that calls the service methods.
