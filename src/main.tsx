import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// StrictMode double-monte chaque composant en dev (pour détecter les effets
// mal nettoyés) — ça rejoue les animations d'entrée deux fois d'affilée et
// ça se voit comme un clignotement. Aucun effet en production (StrictMode
// y est de toute façon un no-op), donc on le désactive ici uniquement pour
// que l'aperçu en dev corresponde à ce que verront les vrais utilisateurs.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
