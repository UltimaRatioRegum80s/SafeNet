// Map panel visibility guard for hidden containers (tabs/modals)
export function onMapPanelShown() {
  const el = document.getElementById("nn-map");
  // small async to let layout settle
  setTimeout(() => {
    // @ts-ignore potential null guarded
    el && (el.dispatchEvent(new Event("resize")));
  }, 0);
}