import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../sidepanel/i18n';
import '../sidepanel/styles.css';
import { OnboardingApp } from './OnboardingApp';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <I18nProvider>
        <OnboardingApp />
      </I18nProvider>
    </StrictMode>,
  );
}
