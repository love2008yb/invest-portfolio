import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import { PasswordGate } from './components/PasswordGate'

export default function App() {
  return (
    <PasswordGate>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </PasswordGate>
  )
}
