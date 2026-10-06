"use client";

import { newStrokeId } from "@/lib/annotations/model";

/**
 * Liaison directe remote ↔ viewer sur le réseau local (WebRTC DataChannel).
 *
 * La signalisation passe par le canal Realtime du cockpit (événement
 * « rtc ») ; ensuite les états vont directement d'un appareil à l'autre,
 * sans aller-retour vers le cloud (quelques ms sur le même wifi). Si la
 * connexion directe est impossible (wifi invité, 4G, pare-feu), rien ne
 * change : le canal Realtime continue de tout transporter.
 *
 * - le viewer s'annonce (« hello ») à chaque connexion et sur demande ;
 * - la remote répond par une offre WebRTC, le viewer par une réponse ;
 * - canal non ordonné sans retransmission : seul le dernier état compte.
 */

export type RtcSignal =
  | { kind: "ping"; from: string }
  | { kind: "hello"; from: string }
  | { kind: "offer" | "answer"; from: string; to: string; sdp: string }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

const isPeerId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);

/** Valide un message de signalisation (canal public : jamais de confiance). */
export function parseRtcSignal(value: unknown): RtcSignal | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  if (!isPeerId(m.from)) return null;
  switch (m.kind) {
    case "ping":
    case "hello":
      return { kind: m.kind, from: m.from };
    case "offer":
    case "answer":
      if (!isPeerId(m.to) || typeof m.sdp !== "string" || m.sdp.length > 20_000) return null;
      return { kind: m.kind, from: m.from, to: m.to, sdp: m.sdp };
    case "ice": {
      if (!isPeerId(m.to) || !m.candidate || typeof m.candidate !== "object") return null;
      const c = m.candidate as Record<string, unknown>;
      if (typeof c.candidate !== "string" || c.candidate.length > 1_000) return null;
      const candidate: RTCIceCandidateInit = { candidate: c.candidate };
      if (typeof c.sdpMid === "string" && c.sdpMid.length <= 64) candidate.sdpMid = c.sdpMid;
      if (typeof c.sdpMLineIndex === "number" && Number.isInteger(c.sdpMLineIndex)) {
        candidate.sdpMLineIndex = c.sdpMLineIndex;
      }
      return { kind: "ice", from: m.from, to: m.to, candidate };
    }
    default:
      return null;
  }
}

/** STUN public : utile quand les appareils ne se voient que via la box. */
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
/** Abandon d'une tentative de connexion directe restée sans réponse. */
const CONNECT_TIMEOUT_MS = 10_000;
/** Nombre max de connexions directes simultanées (viewers / remotes). */
const MAX_PEERS = 4;

interface Peer {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export interface DirectLinkOptions {
  role: "remote" | "viewer";
  /** Envoie un message de signalisation sur le canal Realtime */
  signal: (message: RtcSignal) => void;
  /** Viewer : message reçu par la liaison directe (déjà décodé, à valider) */
  onMessage?: (data: unknown) => void;
  /** Une liaison directe s'ouvre ou se ferme */
  onActiveChange?: (active: boolean) => void;
}

export class DirectLink {
  readonly id = newStrokeId();
  private peers = new Map<string, Peer>();
  private closed = false;
  private wasActive = false;

  constructor(private options: DirectLinkOptions) {}

  /** WebRTC disponible dans ce navigateur ? */
  static get supported(): boolean {
    return typeof RTCPeerConnection !== "undefined";
  }

  get active(): boolean {
    for (const p of this.peers.values()) if (p.channel?.readyState === "open") return true;
    return false;
  }

  /** À appeler à chaque (re)connexion au canal Realtime. */
  announce() {
    if (this.closed || !DirectLink.supported) return;
    if (this.options.role === "viewer") this.options.signal({ kind: "hello", from: this.id });
    else this.options.signal({ kind: "ping", from: this.id });
  }

  /** Remote : envoie un message à tous les viewers reliés directement. */
  send(data: unknown): boolean {
    let sent = false;
    const text = JSON.stringify(data);
    for (const p of this.peers.values()) {
      if (p.channel?.readyState === "open") {
        try {
          p.channel.send(text);
          sent = true;
        } catch {
          // canal en cours de fermeture : le Realtime prend le relais
        }
      }
    }
    return sent;
  }

  /** Message de signalisation reçu sur le canal Realtime. */
  async handle(signal: RtcSignal) {
    if (this.closed || !DirectLink.supported || signal.from === this.id) return;
    const { role } = this.options;
    try {
      if (signal.kind === "ping") {
        if (role === "viewer") this.options.signal({ kind: "hello", from: this.id });
      } else if (signal.kind === "hello") {
        if (role === "remote") await this.offerTo(signal.from);
      } else if (signal.to !== this.id) {
        return;
      } else if (signal.kind === "offer" && role === "viewer") {
        await this.answer(signal.from, signal.sdp);
      } else if (signal.kind === "answer" && role === "remote") {
        await this.peers.get(signal.from)?.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
      } else if (signal.kind === "ice") {
        await this.peers.get(signal.from)?.pc.addIceCandidate(signal.candidate);
      }
    } catch {
      // négociation ratée : on reste sur le canal Realtime
      if ("from" in signal) this.drop(signal.from);
    }
  }

  close() {
    this.closed = true;
    for (const id of [...this.peers.keys()]) this.drop(id);
  }

  // --- Détails ----------------------------------------------------------

  private newPeer(peerId: string): RTCPeerConnection | null {
    if (this.peers.has(peerId)) this.drop(peerId);
    if (this.peers.size >= MAX_PEERS) return null;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = { pc, channel: null, timer: undefined };
    this.peers.set(peerId, peer);
    peer.timer = setTimeout(() => {
      if (peer.channel?.readyState !== "open") this.drop(peerId);
    }, CONNECT_TIMEOUT_MS);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.options.signal({ kind: "ice", from: this.id, to: peerId, candidate: e.candidate.toJSON() });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.drop(peerId);
    };
    return pc;
  }

  private attach(peerId: string, channel: RTCDataChannel) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.channel = channel;
    channel.onopen = () => {
      clearTimeout(peer.timer);
      this.updateActive();
    };
    channel.onclose = () => this.drop(peerId);
    channel.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > 64_000) return;
      try {
        this.options.onMessage?.(JSON.parse(e.data));
      } catch {
        // message illisible : ignoré
      }
    };
  }

  private async offerTo(viewerId: string) {
    const existing = this.peers.get(viewerId);
    if (existing?.channel?.readyState === "open") return;
    const pc = this.newPeer(viewerId);
    if (!pc) return;
    const channel = pc.createDataChannel("state", { ordered: false, maxRetransmits: 0 });
    this.attach(viewerId, channel);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.options.signal({ kind: "offer", from: this.id, to: viewerId, sdp: offer.sdp ?? "" });
  }

  private async answer(remoteId: string, sdp: string) {
    const pc = this.newPeer(remoteId);
    if (!pc) return;
    pc.ondatachannel = (e) => this.attach(remoteId, e.channel);
    await pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.options.signal({ kind: "answer", from: this.id, to: remoteId, sdp: answer.sdp ?? "" });
  }

  private drop(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    this.peers.delete(peerId);
    clearTimeout(peer.timer);
    peer.channel?.close();
    peer.pc.close();
    this.updateActive();
  }

  private updateActive() {
    const active = this.active;
    if (active !== this.wasActive) {
      this.wasActive = active;
      this.options.onActiveChange?.(active);
    }
  }
}
