import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { subscribeToWorkspace } from './realtime';

type Handler = () => void;

/** Records the channel config and lets a test fire change events at the handler. */
function makeClient() {
  let channelName = '';
  let onConfig: unknown = null;
  let handler: Handler = () => {};
  let subscribed = false;
  const removed: unknown[] = [];

  const channel = {
    on(_event: string, config: unknown, cb: Handler) {
      onConfig = config;
      handler = cb;
      return channel;
    },
    subscribe() {
      subscribed = true;
      return channel;
    },
  };

  const client = {
    channel(name: string) {
      channelName = name;
      return channel;
    },
    removeChannel(ch: unknown) {
      removed.push(ch);
      return Promise.resolve('ok');
    },
  } as unknown as SupabaseClient;

  return {
    client,
    channel,
    fire: () => handler(),
    get channelName() {
      return channelName;
    },
    get onConfig() {
      return onConfig;
    },
    get subscribed() {
      return subscribed;
    },
    get removed() {
      return removed;
    },
  };
}

describe('subscribeToWorkspace', () => {
  it('subscribes to UPDATEs on workspaces filtered by owner', () => {
    const m = makeClient();
    subscribeToWorkspace(m.client, 'user-1', () => {});

    expect(m.channelName).toBe('workspaces:user-1');
    expect(m.subscribed).toBe(true);
    expect(m.onConfig).toMatchObject({
      event: 'UPDATE',
      schema: 'public',
      table: 'workspaces',
      filter: 'owner_user_id=eq.user-1',
    });
  });

  it('invokes onSignal on each change event', () => {
    const m = makeClient();
    const onSignal = vi.fn();
    subscribeToWorkspace(m.client, 'user-1', onSignal);

    m.fire();
    m.fire();

    expect(onSignal).toHaveBeenCalledTimes(2);
  });

  it('removes the channel on unsubscribe', () => {
    const m = makeClient();
    const unsubscribe = subscribeToWorkspace(m.client, 'user-1', () => {});

    unsubscribe();

    expect(m.removed).toEqual([m.channel]);
  });
});
