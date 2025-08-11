export interface InteractOptions {
    getState: () => { x: number; y: number; scale: number };
    setState: (state: { x: number; y: number; scale: number }) => void;
    minZoom?: number;
    maxZoom?: number;
    zoomSpeed?: number;
}

export function createInteractionHandlers(
    svg: SVGSVGElement,
    options: InteractOptions
) {
    const minZoom = options.minZoom ?? 0.5;
    const maxZoom = options.maxZoom ?? 4;
    const zoomSpeed = options.zoomSpeed ?? 0.2;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startX = 0;
    let startY = 0;

    let lastTouchDistance = 0;

    function getTouchDistance(touches: TouchList): number {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.hypot(dx, dy);
    }

    function applyZoom(clientX: number, clientY: number, zoomIn: boolean) {
        const { x, y, scale } = options.getState();
        const factor = zoomIn ? 1 - zoomSpeed : 1 + zoomSpeed;
        const newScale = Math.min(Math.max(scale * factor, minZoom), maxZoom);

        const rect = svg.getBoundingClientRect();

        const offsetX = (clientX - rect.left - x) / scale;
        const offsetY = (clientY - rect.top - y) / scale;

        const nextX = clientX - rect.left - offsetX * newScale;
        const nextY = clientY - rect.top - offsetY * newScale;

        options.setState({ x: nextX, y: nextY, scale: newScale });
    }

    function handleEvent(e: Event) {
        const state = options.getState();

        switch (e.type) {
            case "mousedown": {
                const event = e as MouseEvent;
                if (event.button !== 0) return; // 仅左键拖拽
                isDragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                startX = state.x;
                startY = state.y;
                break;
            }

            case "mousemove": {
                if (!isDragging) return;
                const event = e as MouseEvent;
                const dx = event.clientX - dragStartX;
                const dy = event.clientY - dragStartY;
                options.setState({
                    x: startX + dx,
                    y: startY + dy,
                    scale: state.scale,
                });
                break;
            }

            case "mouseup":
            case "mouseleave":
                isDragging = false;
                break;

            case "wheel": {
                const event = e as WheelEvent;
                event.preventDefault();
                applyZoom(event.clientX, event.clientY, event.deltaY > 0);
                break;
            }

            case "touchstart": {
                const event = e as TouchEvent;
                if (event.touches.length === 1) {
                    isDragging = true;
                    dragStartX = event.touches[0].clientX;
                    dragStartY = event.touches[0].clientY;
                    startX = state.x;
                    startY = state.y;
                } else if (event.touches.length === 2) {
                    isDragging = false;
                    lastTouchDistance = getTouchDistance(event.touches);
                }
                break;
            }

            case "touchmove": {
                const event = e as TouchEvent;
                event.preventDefault();

                if (event.touches.length === 1 && isDragging) {
                    const dx = event.touches[0].clientX - dragStartX;
                    const dy = event.touches[0].clientY - dragStartY;
                    options.setState({
                        x: startX + dx,
                        y: startY + dy,
                        scale: state.scale,
                    });
                } else if (event.touches.length === 2) {
                    const newDistance = getTouchDistance(event.touches);
                    const delta = newDistance - lastTouchDistance;
                    if (Math.abs(delta) > 1) {
                        const centerX =
                            (event.touches[0].clientX + event.touches[1].clientX) / 2;
                        const centerY =
                            (event.touches[0].clientY + event.touches[1].clientY) / 2;

                        applyZoom(centerX, centerY, delta < 0);
                        lastTouchDistance = newDistance;
                    }
                }

                break;
            }

            case "touchend":
                isDragging = false;
                break;
        }
    }

    return { handleEvent };
}
