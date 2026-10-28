import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { ArchiveAPI } from '../shared/model';
declare global { interface Window { archive: ArchiveAPI } }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
