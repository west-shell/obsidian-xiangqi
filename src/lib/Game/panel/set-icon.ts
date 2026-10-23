import { setIcon } from "obsidian";

export function useSetIcon(el: HTMLElement, icon: string) {
  setIcon(el, icon);
  return {
    update(newIcon: string) {
      setIcon(el, newIcon);
    },
  };
}
