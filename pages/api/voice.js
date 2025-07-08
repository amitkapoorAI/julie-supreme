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
      action: `/api/voice?attempt=${nextAttempt}`,
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

    // Log the attempt to Airtable
    await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: { CallSid, From, To, Digits: '', Attempt: attempt }
        })
      }
    );

    twiml.say('I didn\'t receive a valid code. I\'ve sent you an SMS to continue via text. Goodbye.');
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }

  // We have a valid Digits entry
  // Log the successful code to Airtable
  await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: { CallSid, From, To, Digits, Attempt: attempt }
      })
    }
  );

  twiml.say('Thank you! We’ve received your code and will be with you shortly.');
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
}
