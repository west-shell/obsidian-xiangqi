type EventType = string | symbol;
type Handler<T = any> = (payload?: T) => void;
import { registerXQModule, registerGenFENModule } from './module-system';

export class EventBus {
    private handlers = new Map<EventType, Set<Handler<any>>>();

    constructor(public host: object) { }

    static init(host: Record<string, any>): void {
        host.eventBus = new EventBus(host);
    }

    destroy(): void {
        this.handlers.clear();
    }

    on<T = any>(event: EventType, handler: Handler<T>) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler as Handler<any>);
    }

    emit(event: EventType, payload?: any) {
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

    off<T = any>(event: EventType, handler: Handler<T>) {
        this.handlers.get(event)?.delete(handler);
    }
}

registerXQModule('eventBus', EventBus);
registerGenFENModule('eventBus', EventBus);
