import { mountFloatingUi } from '../../src/floating/mount';

declare global {
  interface Window {
    bootstrapFloatingUiForTest: () => Promise<void>;
    __arclineFloatingInstance?: Awaited<ReturnType<typeof mountFloatingUi>>;
  }
}

window.bootstrapFloatingUiForTest = async () => {
  const host = document.createElement('div');
  host.id = 'arcline-floating-host';
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '0';
  host.style.height = '100vh';
  host.style.width = '360px';
  host.style.zIndex = '2147483646';
  host.setAttribute('data-testid', 'arcline-floating-host');
  document.body.append(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const instance = await mountFloatingUi({
    host,
    shadowRoot: shadow,
    onBootstrapReady: () => {},
  });

  window.__arclineFloatingInstance = instance;
};
