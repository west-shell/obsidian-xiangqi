import {
  registerGenFENModule,
  registerListModule,
  registerPGNViewModule,
  registerTreeModule,
} from "./module-system";

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

  /**
   * 注册事件监听
   * @example
   * eventBus.on('save', () => { ... })
   * eventBus.on<string>('message', (payload) => { ... })
   */
  on<T = unknown>(event: EventType, handler: Handler<T>): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
  }

  /**
   * 触发事件
   * @example
   * eventBus.emit('save')
   * eventBus.emit('message', 'Hello')
   */
  emit<T = unknown>(event: EventType, payload?: T): void {
    const set = this.handlers.get(event);
    if (!set) return;

    const hasPayload = arguments.length === 2;
    for (const handler of set) {
      try {
        const result = hasPayload ? handler(payload) : handler();
        // 如果是 Promise，自动处理错误
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

  /**
   * 移除事件监听
   */
  off<T = unknown>(event: EventType, handler: Handler<T>): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  /**
   * 只触发一次的事件监听
   */
  once<T = unknown>(event: EventType, handler: Handler<T>): void {
    const wrapper: Handler<T> = (payload?: T) => {
      this.off(event, wrapper);
      return handler(payload);
    };
    this.on(event, wrapper);
  }

  /**
   * 移除指定事件的所有监听
   */
  offAll(event: EventType): void {
    this.handlers.delete(event);
  }

  /**
   * 获取指定事件的监听器数量
   */
  listenerCount(event: EventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

// 注册模块
registerListModule("eventBus", EventBus);
registerGenFENModule("eventBus", EventBus);
registerPGNViewModule("eventBus", EventBus);
registerTreeModule("eventBus", EventBus);
