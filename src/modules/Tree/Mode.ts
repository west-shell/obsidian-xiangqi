import { registerPGNViewModule } from "../../core/module-system";

const modeModule = {
    init(host: any) {
        const eventBus = host.eventBus;
        eventBus.on('updateUI', () => {
            const Container = host.containerEl;
            const statusBar = Container.querySelector('.status-bar');
            console.log('statusBar', Container);
        })
    }
}

registerPGNViewModule('mode', modeModule);