/**
 * 在指定容器内，如果有垂直滚动条，则平滑滚动让目标元素垂直居中。
 * 没有滚动条时不滚动。
 * @param element 目标元素
 * @param container 可滚动容器
 */
export function scrollToBTN(
    element: HTMLElement | null,
    container: HTMLElement | null,
): void {
    if (!element || !container) return;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // 检查垂直滚动条
    const hasVerticalScrollbar = container.scrollHeight > container.clientHeight;
    if (hasVerticalScrollbar) {
        const offsetTop = elementRect.top - containerRect.top;
        const targetScrollTop =
            container.scrollTop +
            offsetTop -
            container.clientHeight / 2 +
            element.offsetHeight / 2;
        container.scrollTo({
            top: targetScrollTop,
            behavior: "smooth",
        });
    }

    // 检查水平滚动条
    const hasHorizontalScrollbar = container.scrollWidth > container.clientWidth;
    if (hasHorizontalScrollbar) {
        const offsetLeft = elementRect.left - containerRect.left;
        const targetScrollLeft =
            container.scrollLeft +
            offsetLeft -
            container.clientWidth / 2 +
            element.offsetWidth / 2;
        container.scrollTo({
            left: targetScrollLeft,
            behavior: "smooth",
        });
    }
}
