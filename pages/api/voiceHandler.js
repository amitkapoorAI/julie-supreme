import Twilio from 'twilio';
import { URLSearchParams } from 'url';

// Disable Next.js body parsing so we can read raw POST from Twilio
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // Parse the URL-encoded body
  const body = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(new URLSearchParams(data)));
    req.on('error', err => reject(err));
  });

  const CallSid = body.get('CallSid');
  const From    = body.get('From');
  const To      = body.get('To');
  const Digits  = body.get('Digits');
  const attempt = Number(req.nextUrl?.searchParams.get('attempt')) || 1;

  const twiml = new Twilio.twiml.VoiceResponse();

  // First and second DTMF gather attempts
  if (!Digits && attempt <= 2) {
    const nextAttempt = attempt + 1;
    const gather = twiml.gather({
      numDigits: 6,
      action: `/api/voiceHandler?attempt=${nextAttempt}`,
      method: 'POST',
      timeout: 5
    });
    gather.say(
      attempt === 1
        ? 'Welcome to Julie. Please enter your six-digit code now, followed by the pound sign.'
        : 'Sorry, I didn\'t catch that. Please enter your code now, followed by the pound sign.'
    );

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  // Fallback via SMS if no valid code after 2 tries
  if (!Digits) {
    const client = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      to:   From,
      from: To,
      body: 'Hi! Please reply with your code to continue.'
    });

    // Log the attempt to Google Sheets
    const sheetParams = new URLSearchParams({
      CallSid,
      From,
      To,
      Digits: '',
      attempt: attempt.toString()
    });
    await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sheetParams.toString()
    });

    twiml.say('I didn\'t receive a valid code. I\'ve sent you an SMS to continue via text. Goodbye.');
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  // We have a valid Digits entry
  // Log the successful code to Google Sheets
  const successParams = new URLSearchParams({
    CallSid,
    From,
    To,
    Digits,
    attempt: attempt.toString()
  });
  await fetch(process.env.GOOGLE_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: successParams.toString()
  });

  twiml.say('Thank you! We’ve received your code and will be with you shortly.');
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
}
