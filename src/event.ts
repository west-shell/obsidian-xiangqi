export class EventEmitter {
    private listeners: Record<string, Function[]> = {};

    on(event: string, callback: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event: string, ...args: any[]) {
        (this.listeners[event] || []).forEach(fn => fn(...args));
    }
   
    off(event: string, callback: Function) {
        this.listeners[event] = (this.listeners[event] || []).filter(fn => fn !== callback);
    }
}

// 使用
const emitter = new EventEmitter();
emitter.on('click', (x: number) => console.log(x));
emitter.emit('click', 123); // 输出 123