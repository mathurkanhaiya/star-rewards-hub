import { describe, expect, it } from 'vitest';
import { getTaskProfileImage } from '@/lib/taskProfile';

describe('getTaskProfileImage', () => {
  it('uses an explicitly configured image URL first', () => {
    expect(getTaskProfileImage({ icon: 'https://cdn.example.com/avatar.png', link: 'https://t.me/example' }))
      .toBe('https://cdn.example.com/avatar.png');
  });

  it('derives a public Telegram profile image from the task link', () => {
    expect(getTaskProfileImage({ icon: '📢', link: 'https://t.me/Adsrewartsbot' }))
      .toBe('https://t.me/i/userpic/320/Adsrewartsbot.jpg');
  });

  it('supports Telegram preview links', () => {
    expect(getTaskProfileImage({ icon: null, link: 'https://t.me/s/public_channel/42' }))
      .toBe('https://t.me/i/userpic/320/public_channel.jpg');
  });

  it('requires an explicit image for private invite links', () => {
    expect(getTaskProfileImage({ icon: null, link: 'https://t.me/+privateInvite' })).toBeNull();
  });
});
