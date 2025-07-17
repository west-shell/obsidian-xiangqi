export type ChessModule = {
    init(host: object): void;
    destroy?(): void;
};

export type ModuleRegistry = Map<string, ChessModule>;

// 工厂函数：创建模块系统
function createModuleSystem() {
    const moduleMap = new Map<string, ChessModule>();
    const registryMap = new WeakMap<object, ModuleRegistry>();

    function register(name: string, module: ChessModule) {
        if (!moduleMap.has(name)) {
            moduleMap.set(name, module);
        }
    }


    function createRegistry(host: object) {
        if (registryMap.has(host)) return registryMap.get(host);
        const registry = new Map<string, ChessModule>();
        for (const [name, module] of moduleMap) {
            const instance = module.init(host);
            registry.set(name, instance ?? module);
        }
        registryMap.set(host, registry);
        return registry;
    }

    function destroyRegistry(host: object) {
        const registry = registryMap.get(host);
        if (!registry) return;
        for (const module of registry.values()) {
            if (typeof (module as any).destroy === "function") {
                (module as any).destroy();
            }
        }
        registry.clear();
        registryMap.delete(host);
    }

    return {
        register,
        createRegistry,
        destroyRegistry,
    };
}

// 实例化 XQ 模块系统
const XQModules = createModuleSystem();

// 导出 XQ 模块相关函数
export function registerXQModule(name: string, module: ChessModule) {
    XQModules.register(name, module);
}

export function createXQModuleRegistry(host: object) {
    return XQModules.createRegistry(host);
}

export function destroyXQModuleRegistry(host: object) {
    XQModules.destroyRegistry(host);
}

// 实例化 GenFEN 模块系统
const GenFENModules = createModuleSystem();

// 导出 GenFEN 模块相关函数
export function registerGenFENModule(name: string, module: ChessModule) {
    GenFENModules.register(name, module);
}

export function createGenFENModuleRegistry(host: object) {
    return GenFENModules.createRegistry(host);
}

export function destroyGenFENModuleRegistry(host: object) {
    GenFENModules.destroyRegistry(host);
}
