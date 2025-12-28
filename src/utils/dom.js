export function closest(target, selector) {
  return target && typeof target.closest === 'function' ? target.closest(selector) : null;
}

export function getText(el) {
  return el ? (el.textContent || '').trim() : '';
}
