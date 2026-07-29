/**
 * Send a test email through Resend and print exactly what the API said, so
 * "the email never arrived" can be split into:
 *
 *   - we never sent it              → key/config error shown here
 *   - Resend refused it             → the API error name + message shown here
 *   - Resend accepted it (email id) → it left our infrastructure; anything after
 *                                     that is the receiving provider's filtering,
 *                                     and the id can be looked up in the Resend
 *                                     dashboard for the real delivery event
 *
 * Usage (from the backend/ directory):
 *   node src/scripts/send_test_email.js someone@example.com
 */
import dotenv from 'dotenv';
import config from '../config/env.js';
import { verifyEmailTransport, sendNotificationEmail } from '../services/emailService.js';

dotenv.config();

const to = process.argv[2];
if (!to) {
  console.error('Usage: node src/scripts/send_test_email.js <recipient@example.com>');
  process.exit(1);
}

const run = async () => {
  // Never print the key itself — only enough to confirm which one is loaded.
  const key = config.resend.apiKey || '';
  console.log('Provider  : Resend');
  console.log('API key   :', key ? `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)` : '(not set)');
  console.log('From      :', config.resend.from);
  console.log('Reply-to  :', config.resend.replyTo);
  console.log('To        :', to);
  console.log('');

  if (!config.resend.configured) {
    console.error('✘ Resend is not configured (RESEND_API_KEY missing in .env).');
    process.exit(1);
  }

  const ok = await verifyEmailTransport();
  if (!ok) {
    console.error('');
    console.error('✘ The API key was not accepted. Fix RESEND_API_KEY before testing delivery.');
    process.exit(1);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const started = Date.now();

  const result = await sendNotificationEmail({
    to,
    subject: 'Tirvona email delivery test',
    heading: 'Email delivery test',
    intro: 'this is a Tirvona delivery test. If you can read this, transactional email is working.',
    bodyHtml: `<p style="margin:0;font-size:14px;line-height:1.7;">Sample reference code: <strong>${code}</strong></p>`,
    text: `This is a Tirvona delivery test. Sample code: ${code}. If you can read this, delivery is working.`,
  });

  console.log('');
  console.log('sent      :', result.sent);
  console.log('messageId :', result.messageId || '(none)');
  console.log('error     :', result.error || '(none)');
  console.log('took      :', ((Date.now() - started) / 1000).toFixed(1) + 's');
  console.log('');

  if (result.sent) {
    console.log('✔ Resend ACCEPTED this message.');
    console.log('  If it is not in the inbox, check Spam/Promotions — it was not lost in transit.');
    console.log(`  Look up id ${result.messageId} at https://resend.com/emails for the delivery event.`);
  } else {
    console.log('✘ The message was NOT accepted. See `error` above.');
    console.log('  A "domain is not verified" error means EMAIL_FROM_EMAIL is on a domain you have');
    console.log('  not verified in Resend. Use onboarding@resend.dev to test before verifying one.');
    process.exit(1);
  }
};

run();
