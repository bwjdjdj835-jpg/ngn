import React from 'react'
import ReactDOM from 'react-dom/client'
import Site from './Site.jsx'
import dados from './dados.json'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(<Site dados={dados} />)
