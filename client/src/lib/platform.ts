export const isLikelyMobile = (() => {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Silk/.test(ua) || ('ontouchstart' in window);
})();

export const isMobileLike =
  window.matchMedia?.('(pointer: coarse)').matches ||
  /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);