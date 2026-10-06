import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectCockpit } from "./cockpit-link";
import { INITIAL_VIEW_STATE, type ViewState } from "./protocol";

/** Faux bus Broadcast : relaie les messages entre canaux de même nom (self: false). */
class FakeBus {
  channels = new Set<FakeChannel>();
  deliver(from: FakeChannel, event: string, payload: unknown) {
    for (const ch of this.channels) {
      if (ch !== from && ch.topic === from.topic && ch.joined) ch.handlers.get(event)?.({ payload });
    }
  }
}

class FakeChannel {
  handlers = new Map<string, (msg: { payload: unknown }) => void>();
  callback?: (status: string) => void;
  joined = false;
  constructor(
    public topic: string,
    private bus: FakeBus,
  ) {}
  on(_type: string, filter: { event: string }, fn: (msg: { payload: unknown }) => void) {
    this.handlers.set(filter.event, fn);
    return this;
  }
  subscribe(cb: (status: string) => void) {
    this.callback = cb;
    this.bus.channels.add(this);
    queueMicrotask(() => this.emit("SUBSCRIBED"));
    return this;
  }
  emit(status: string) {
    this.joined = status === "SUBSCRIBED";
    this.callback?.(status);
  }
  async send({ event, payload }: { event: string; payload: unknown }) {
    this.bus.deliver(this, event, payload);
    return "ok";
  }
  teardown() {}
}

function fakeClient(bus: FakeBus) {
  const realtime = {
    channels: [] as FakeChannel[],
    isConnected: () => true,
    connect: vi.fn(),
  };
  const client = {
    realtime,
    channel(name: string) {
      const topic = `realtime:${name}`;
      const existing = realtime.channels.find((c) => c.topic === topic);
      if (existing) return existing;
      const ch = new FakeChannel(topic, bus);
      realtime.channels.push(ch);
      return ch;
    },
    getChannels: () => realtime.channels,
    async removeChannel(ch: FakeChannel) {
      bus.channels.delete(ch);
      ch.joined = false;
      realtime.channels = realtime.channels.filter((c) => c !== ch);
      return "ok";
    },
  };
  return client as unknown as SupabaseClient & { realtime: typeof realtime };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const state = (seq: number, page = 1): ViewState => ({ ...INITIAL_VIEW_STATE, docId: "d", page, seq, ts: seq });

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("connectCockpit", () => {
  it("relaie les états de la remote vers le viewer", async () => {
    const bus = new FakeBus();
    const received: ViewState[] = [];
    const viewer = connectCockpit(fakeClient(bus), "cockpit:x", { onState: (s) => received.push(s) });
    const remote = connectCockpit(fakeClient(bus), "cockpit:x", {});
    await flush();

    remote.sendState(state(1, 3));
    expect(received).toEqual([{ ...state(1, 3), cursor: null }]);
    viewer.close();
    remote.close();
  });

  it("le viewer demande l'état à la connexion et la remote répond", async () => {
    const bus = new FakeBus();
    const received: ViewState[] = [];
    const remote = connectCockpit(fakeClient(bus), "cockpit:x", {
      onRequestState: () => remote.sendState(state(42, 7)),
    });
    await flush();
    const viewer = connectCockpit(fakeClient(bus), "cockpit:x", {
      onState: (s) => received.push(s),
      onConnected: () => viewer.requestState(),
    });
    await flush();

    expect(received.map((s) => s.page)).toEqual([7]);
    viewer.close();
    remote.close();
  });

  it("n'échange rien entre deux cockpits différents", async () => {
    const bus = new FakeBus();
    const received: ViewState[] = [];
    const viewer = connectCockpit(fakeClient(bus), "cockpit:a", { onState: (s) => received.push(s) });
    const remote = connectCockpit(fakeClient(bus), "cockpit:b", {});
    await flush();
    remote.sendState(state(1));
    expect(received).toEqual([]);
    viewer.close();
    remote.close();
  });

  it("envoie le dernier état en attente dès la connexion", async () => {
    const bus = new FakeBus();
    const received: ViewState[] = [];
    const viewer = connectCockpit(fakeClient(bus), "cockpit:x", { onState: (s) => received.push(s) });
    await flush();
    const remote = connectCockpit(fakeClient(bus), "cockpit:x", {});
    // pas encore connecté : seul le dernier état part
    remote.sendState(state(1, 1));
    remote.sendState(state(2, 2));
    await flush();
    expect(received.map((s) => s.seq)).toEqual([2]);
    viewer.close();
    remote.close();
  });

  it("ignore les messages invalides", async () => {
    const bus = new FakeBus();
    const received: ViewState[] = [];
    const client = fakeClient(bus);
    const viewer = connectCockpit(client, "cockpit:x", { onState: (s) => received.push(s) });
    await flush();
    const ch = client.realtime.channels[0];
    ch.handlers.get("state")?.({ payload: { page: "x" } });
    expect(received).toEqual([]);
    viewer.close();
  });

  it("recrée le canal après une fermeture inattendue et signale les statuts", async () => {
    vi.useFakeTimers();
    const bus = new FakeBus();
    const client = fakeClient(bus);
    const statuses: string[] = [];
    let connections = 0;
    const link = connectCockpit(client, "cockpit:x", {
      onStatus: (s) => statuses.push(s),
      onConnected: () => connections++,
    });
    await vi.advanceTimersByTimeAsync(0);
    const first = client.realtime.channels[0];
    expect(connections).toBe(1);

    // le serveur ferme le canal
    await client.removeChannel(first as never);
    first.emit("CLOSED");
    expect(statuses.at(-1)).toBe("disconnected");

    await vi.advanceTimersByTimeAsync(2_500);
    expect(connections).toBe(2);
    expect(client.realtime.channels).toHaveLength(1);
    expect(client.realtime.channels[0]).not.toBe(first);
    expect(statuses.at(-1)).toBe("connected");
    link.close();
  });

  it("une erreur passe en déconnecté, la reconnexion automatique repasse en connecté", async () => {
    const bus = new FakeBus();
    const client = fakeClient(bus);
    const statuses: string[] = [];
    const link = connectCockpit(client, "cockpit:x", { onStatus: (s) => statuses.push(s) });
    await flush();
    const ch = client.realtime.channels[0];
    ch.emit("CHANNEL_ERROR");
    ch.emit("SUBSCRIBED");
    expect(statuses).toEqual(["connected", "disconnected", "connected"]);
    link.close();
  });
});
