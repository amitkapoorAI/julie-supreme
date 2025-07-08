export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml');

  const twiml = \`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Polly.Matthew-Neural" language="en-US">
        Amit Kapoor. This call will be recorded, monitored, and analyzed for compliance, security, and to improve our systems including anytime the call is placed on hold.
        To learn more, review the privacy statement by visiting thekapoorfamily.com.
        Please enter the code. If no code was provided to you, please let me know how I can help you.
      </Say>
      <Gather input="speech dtmf" timeout="5" numDigits="6" action="/api/smsFallback" method="POST">
        <Say>Please say or enter your code now.</Say>
      </Gather>
      <Say>I didn’t receive anything. I’ll text you shortly.</Say>
      <Redirect method="POST">/api/smsFallback</Redirect>
    </Response>
  \`;

  res.status(200).send(twiml.trim());
}