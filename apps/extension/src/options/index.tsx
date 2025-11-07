import { createRoot } from 'react-dom/client';

import '../styles.css';
import OptionsApp from './OptionsApp';

const container = document.getElementById('options-root');

if (!container) {
  throw new Error('Options root container not found');
}

const root = createRoot(container);
root.render(<OptionsApp />);
