import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmptySpace } from './EmptySpace';
import '@/styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <EmptySpace />
    </React.StrictMode>
  );
}
