window.addEventListener('error', event => { document.title = 'ERR: ' + (event.message || '') })
window.addEventListener('unhandledrejection', event => { document.title = 'REJ: ' + String(event.reason) })
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@xyflow/react/dist/style.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
