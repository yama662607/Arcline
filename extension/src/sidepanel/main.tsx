import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { verifyFramedAccess } from '../core/frame-auth';
import { App } from './App';
import { I18nProvider } from './i18n';
import './styles.css';

const root = document.getElementById('root');
if (root) {
  const mount = () => {
    createRoot(root).render(
      <StrictMode>
        <I18nProvider>
          <App />
        </I18nProvider>
      </StrictMode>,
    );
  };
  if (window.top === window) {
    mount();
  } else {
    void verifyFramedAccess('overlay').then((allowed) => {
      if (allowed) mount();
    });
  }
}
