/**
 * Slack notification via Bot Token API (chat.postMessage)
 * Uses SLACK_BOT_TOKEN from env. The `channel` field can be a channel name or ID.
 * Falls back to Webhook URL if configured per-project.
 */
export async function sendSlackNotification(
  channel: string | null,
  message: {
    projectName: string;
    screenName: string;
    comment: string;
    author: string;
    pinNumber: number;
  }
) {
  if (!channel) return;

  const botToken = process.env.SLACK_BOT_TOKEN;

  // If channel looks like a webhook URL, use webhook mode
  if (channel.startsWith('https://hooks.slack.com/')) {
    try {
      await fetch(channel, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `New feedback on *${message.projectName}* > *${message.screenName}*`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*New Feedback* (#${message.pinNumber})\n*Project:* ${message.projectName}\n*Screen:* ${message.screenName}\n*By:* ${message.author}\n\n> ${message.comment}`,
              },
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Slack webhook failed:', error);
    }
    return;
  }

  // Bot Token mode (chat.postMessage)
  if (!botToken) {
    console.warn('SLACK_BOT_TOKEN not set, skipping notification');
    return;
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel,
        text: `New feedback on *${message.projectName}* > *${message.screenName}*`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `New Feedback #${message.pinNumber}` },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Project:*\n${message.projectName}` },
              { type: 'mrkdwn', text: `*Screen:*\n${message.screenName}` },
              { type: 'mrkdwn', text: `*By:*\n${message.author}` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `> ${message.comment}` },
          },
        ],
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Slack API error:', data.error);
    }
  } catch (error) {
    console.error('Slack notification failed:', error);
  }
}
