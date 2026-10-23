export interface ChessModule {
  init(host: object): unknown;
}

export interface ModuleInstance {
  destroy?(): void;
}

/**
 * Initializes an ordered list of modules against a host. The first module
 * must be the EventBus (every other module reads `host.eventBus` in its
 * init). Modules whose init returns a destroy-bearing instance are
 * collected for teardown.
 */
export function initModules(
  host: object,
  modules: ChessModule[],
): ModuleInstance[] {
  const instances: ModuleInstance[] = [];
  for (const module of modules) {
    const instance = module.init(host);
    if (instance) instances.push(instance);
  }
  return instances;
}

/** Tears down module instances created by initModules, in init order. */
export function destroyModules(instances: ModuleInstance[]): void {
  for (const instance of instances) {
    instance.destroy?.();
  }
}
