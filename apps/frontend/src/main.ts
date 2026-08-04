export function mountApp(rootElementId = 'root'): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.getElementById(rootElementId);
  if (!root) {
    throw new Error(`Root element "#${rootElementId}" was not found`);
  }
}
