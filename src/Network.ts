// client/src/Network.ts
type MessageHandler = (msg: any) => void;

export class Network {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private url: string;
  private reconnectDelay = 1000;
  private lastSendTime = 0;
  private static readonly MIN_SEND_INTERVAL = 16; // ~60 msgs/sec max

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("Connected to server");
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const handlers = this.handlers.get(msg.type);
        if (handlers) {
          for (let i = 0; i < handlers.length; i++) {
            handlers[i](msg);
          }
        }
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      console.log(
        `Disconnected. Reconnecting in ${this.reconnectDelay}ms...`
      );
      setTimeout(
        () => this.connect(),
        this.reconnectDelay
      );
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        10000
      );
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // Rate-limited send for high-frequency messages (e.g., move)
  sendThrottled(msg: object): void {
    const now = performance.now();
    if (now - this.lastSendTime >= Network.MIN_SEND_INTERVAL) {
      this.lastSendTime = now;
      this.send(msg);
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
