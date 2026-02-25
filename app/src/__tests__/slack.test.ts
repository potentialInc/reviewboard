import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { sendSlackNotification } from '@/lib/slack';

const defaultMessage = {
  projectName: 'Test Project',
  screenName: 'Homepage',
  comment: 'Button is misaligned',
  author: 'admin',
  pinNumber: 1,
};

describe('sendSlackNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SLACK_BOT_TOKEN;
  });

  describe('null/empty channel', () => {
    it('should do nothing when channel is null', async () => {
      await sendSlackNotification(null, defaultMessage);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('webhook mode', () => {
    it('should POST to webhook URL when channel starts with https://hooks.slack.com/', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx';
      await sendSlackNotification(webhookUrl, defaultMessage);

      expect(mockFetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should include message details in webhook payload', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx';
      await sendSlackNotification(webhookUrl, defaultMessage);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toContain('Test Project');
      expect(body.text).toContain('Homepage');
      expect(body.blocks).toBeDefined();
      expect(body.blocks[0].text.text).toContain('#1');
      expect(body.blocks[0].text.text).toContain('Button is misaligned');
    });

    it('should handle webhook fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx';

      await sendSlackNotification(webhookUrl, defaultMessage);
      expect(consoleSpy).toHaveBeenCalledWith('Slack webhook failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should not call bot token API after webhook mode', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      mockFetch.mockResolvedValue({ ok: true });
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx';
      await sendSlackNotification(webhookUrl, defaultMessage);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(webhookUrl, expect.anything());
    });
  });

  describe('bot token mode', () => {
    it('should skip notification when SLACK_BOT_TOKEN is not set', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await sendSlackNotification('#general', defaultMessage);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('SLACK_BOT_TOKEN not set, skipping notification');
      warnSpy.mockRestore();
    });

    it('should POST to chat.postMessage with bot token', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendSlackNotification('#general', defaultMessage);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer xoxb-test-token',
          },
        })
      );
    });

    it('should include channel and blocks in bot token payload', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await sendSlackNotification('#feedback', defaultMessage);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.channel).toBe('#feedback');
      expect(body.text).toContain('Test Project');
      expect(body.blocks).toHaveLength(3);
    });

    it('should log error when Slack API returns ok: false', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: 'channel_not_found' }),
      });

      await sendSlackNotification('#nonexistent', defaultMessage);
      expect(consoleSpy).toHaveBeenCalledWith('Slack API error:', 'channel_not_found');
      consoleSpy.mockRestore();
    });

    it('should handle fetch exception gracefully', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      await sendSlackNotification('#general', defaultMessage);
      expect(consoleSpy).toHaveBeenCalledWith('Slack notification failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
