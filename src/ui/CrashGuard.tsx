import { Component, type ReactNode } from 'react';

/** If the app ever throws while drawing, show a way back instead of a blank page. */
export class CrashGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error('Esau crashed while drawing:', err);
  }

  async reset() {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('esau-')) localStorage.removeItem(k);
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch {
      /* best effort */
    }
    location.reload();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: 24, color: '#eee', background: '#0b0f0b', minHeight: '100dvh', font: '16px system-ui' }}>
        <h1 style={{ fontSize: 22 }}>Esau tripped on something.</h1>
        <p>Something in the app broke while drawing the screen. Your waypoints and photos are safe.</p>
        <button onClick={() => location.reload()} style={{ padding: '12px 18px', marginRight: 12 }}>Try again</button>
        <button onClick={() => void this.reset()} style={{ padding: '12px 18px' }}>Reset app settings</button>
      </div>
    );
  }
}
