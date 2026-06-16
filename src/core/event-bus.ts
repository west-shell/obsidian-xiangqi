import {
  registerGenFENModule,
  registerPGNViewModule,
  registerTreeModule,
  registerXQModule,
} from './module-system';

type EventType = string | symbol;
type Payload = string | number | boolean | object;
type Handler = (payload?: Payload) => void;

export class EventBus {
  private handlers = new Map<EventType, Set<Handler>>();

  constructor(public host: object) {}

  static init(host: Record<string, any>): void {
    host.eventBus = new EventBus(host);
  }

  destroy(): void {
    this.handlers.clear();
  }

  on(event: EventType, handler: Handler) {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  emit(event: EventType, payload?: Payload) {
    const set = this.handlers.get(event);
    if (!set) return;
    const hasPayload = arguments.length === 2;
    for (const handler of set) {
      if (hasPayload) {
        handler(payload);
      } else {
        handler();
      }
    }
  }

  off(event: EventType, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
  }
}

registerXQModule('eventBus', EventBus);
registerGenFENModule('eventBus', EventBus);
registerPGNViewModule('eventBus', EventBus);
registerTreeModule('eventBus', EventBus);
