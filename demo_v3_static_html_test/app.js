const navItems = document.querySelectorAll('.nav-item[data-view]');
const views = document.querySelectorAll('.view[id]');

const showView = (viewId) => {
  views.forEach((view) => {
    view.classList.toggle('is-visible', view.id === viewId);
  });

  navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.view === viewId);
  });
};

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    const nextView = item.dataset.view;
    if (!nextView) return;
    showView(nextView);
    window.history.replaceState(null, '', `#${nextView}`);
  });
});

const initialView = window.location.hash.replace('#', '');
if (initialView && document.getElementById(initialView)) {
  showView(initialView);
}
