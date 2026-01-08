import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import './i18n';
import { AuthProvider } from './context/AuthContext';


const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Root element not found!");
  throw new Error("Could not find root element to mount to");
}


const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
