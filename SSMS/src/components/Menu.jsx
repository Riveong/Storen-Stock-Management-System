import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Menu = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: 'home' },
    { path: '/inventory', label: 'Inventory', icon: 'box' },
    { path: '/transactions', label: 'Transactions', icon: 'exchange' }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Function to render icons (using simple text for now, can be replaced with actual icons)
  const renderIcon = (iconName) => {
    switch (iconName) {
      case 'home': return '🏠';
      case 'box': return '📦';
      case 'exchange': return '🔄';
      default: return '•';
    }
  };

  return (
    <nav className="bg-gray-800 text-white">
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center justify-between px-6 py-3">
        <div className="flex items-center">
          <span className="font-bold text-lg mr-8">SMS</span>
          <div className="flex space-x-4">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  location.pathname === item.path
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="mr-2">{renderIcon(item.icon)}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        
        {/* User menu can be added here */}
        <div className="flex items-center">
          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium">
            User
          </button>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden p-4 flex justify-between items-center">
        <span className="font-bold text-lg">SMS</span>
        <button 
          onClick={toggleMobileMenu}
          className="text-gray-300 hover:text-white focus:outline-none"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden px-2 pb-3 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                location.pathname === item.path
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span className="mr-2">{renderIcon(item.icon)}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Menu;