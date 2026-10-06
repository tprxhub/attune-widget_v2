export const NAVIGATION_TOUR_EVENT = "playhub:start-navigation-tour";
export const NAVIGATION_TOUR_CHILD_MENU_EVENT = "playhub:navigation-tour-child-menu";

export function startNavigationTour() {
  window.dispatchEvent(new Event(NAVIGATION_TOUR_EVENT));
}

export function setNavigationTourChildMenu(open: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(NAVIGATION_TOUR_CHILD_MENU_EVENT, { detail: open }));
}
