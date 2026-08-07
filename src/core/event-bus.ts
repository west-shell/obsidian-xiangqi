import { registerPGNViewModule, registerTreeModule } from "./module-system";

type EventType = string | symbol;
type Handler<T = unknown> = (payload?: T) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<EventType, Set<Handler>>();

  constructor(public host: object) {}

  static init(host: Record<string, unknown>): void {
    host.eventBus = new EventBus(host);
  }

  destroy(): void {
    this.handlers.clear();
  }

  on<T = unknown>(event: EventType, handler: Handler<T>): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
  }

  emit<T = unknown>(event: EventType, payload?: T): void {
    const set = this.handlers.get(event);
    if (!set) return;

    const hasPayload = arguments.length === 2;
    for (const handler of set) {
      try {
        const result = hasPayload ? handler(payload) : handler();
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(
              `Error in event handler for "${String(event)}":`,
              error,
            );
          });
        }
      } catch (error) {
        console.error(`Error in event handler for "${String(event)}":`, error);
      }
    }
  }

  off<T = unknown>(event: EventType, handler: Handler<T>): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  once<T = unknown>(event: EventType, handler: Handler<T>): void {
    const wrapper: Handler<T> = (payload?: T) => {
      this.off(event, wrapper);
      return handler(payload);
    };
    this.on(event, wrapper);
  }

  offAll(event: EventType): void {
    this.handlers.delete(event);
  }

  listenerCount(event: EventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

registerPGNViewModule("eventBus", EventBus);
registerTreeModule("eventBus", EventBus);
