import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LanguageProvider} from './context/LanguageContext.tsx';
import {ReadAloudProvider} from './context/ReadAloudContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <ReadAloudProvider>
      <App />
    </ReadAloudProvider>
  </LanguageProvider>
);

