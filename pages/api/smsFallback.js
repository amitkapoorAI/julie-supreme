export default function handler(req, res) {
  res.setHeader("Content-Type", "text/xml");

  const twiml = \`
    <Response>
      <Message>
        Hi! This is Julie. We missed your code during the call. How can I help you by SMS? Just reply here 😄
      </Message>
    </Response>
  \`;

  res.status(200).send(twiml.trim());
}