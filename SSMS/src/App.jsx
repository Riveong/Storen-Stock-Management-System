import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Menu from './components/Menu'
import InventoryPage from './pages/Inventory'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100">
        <header className="bg-blue-600 text-white p-4 shadow-md">
          <h1 className="text-2xl font-bold">Stock Management System</h1>
        </header>
        
        <Menu />
        
        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

// Simple placeholder components
const Home = () => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
    <p>Welcome to your Stock Management System</p>
  </div>
)

const Transactions = () => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold mb-4">Transactions</h2>
    <p>View and manage transactions here</p>
  </div>
)

const NotFound = () => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-xl font-semibold mb-4">Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
  </div>
)

export default App