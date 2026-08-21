declare module "*.css" {
  const content: string;
  export default content;
}

declare module "*.scss" {
  const content: string;
  export default content;
}

declare module "*.txt?raw" {
  const content: string;
  export default content;
}

interface HTMLElementEventMap {
  "chess-zoom-changed": CustomEvent<number>;
  "chess-layout-change": Event;
}
