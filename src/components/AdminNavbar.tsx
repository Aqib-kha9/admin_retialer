"use client";
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export default function AdminNavbar({ active }: { active?: string }) {
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const handleProfileClick = () => setShowProfileMenu((v) => !v);
  const handleLogout = () => router.push("/");

  return (
    <nav className="bg-white border-b border-gray-200 w-full z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Left: Logo + Nav */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <div
              className="text-xl font-semibold cursor-pointer"
              onClick={() => router.push('/post-login/admin')}
            >
              Home
            </div>
            {/* Desktop Nav */}
            <div className="hidden md:flex space-x-4">
              <a
                href="/admin-dashboard"
                className={`${active === 'products' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Products
              </a>
              <a
                href="/admin-dashboard/analytics"
                className={`${active === 'analytics' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Analytics
              </a>
              <a
                href="/admin-dashboard/retailers"
                className={`${active === 'retailers' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Retailers
              </a>
              <a
                href="/admin-dashboard/tallysync"
                className={`${active === 'tallysync' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Tally Sync
              </a>
              <a
                href="/admin-dashboard/customization"
                className={`${active === 'customization' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-sm font-medium`}
              >
                Customization
              </a>
            </div>
            {/* Hamburger for mobile */}
            <button
              className="md:hidden p-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          {/* Right: Cart + Profile */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Cart Icon */}
            <button
              onClick={() => router.push('/admin-dashboard/cart')}
              className={`p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 ${active === 'cart' ? 'bg-gray-100' : ''}`}
              aria-label="Cart"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.35 2.7A1 1 0 007 17h10a1 1 0 00.95-.68L21 13M7 13V6a1 1 0 011-1h5a1 1 0 011 1v7" />
              </svg>
            </button>
            {/* Profile Icon and Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={handleProfileClick}
                className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
                aria-label="Profile"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
                    <a
                      href="/admin-dashboard/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Your Profile
                    </a>
                    <a
                      href="/admin-dashboard/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Settings
                    </a>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 pb-2">
            <div className="flex flex-col space-y-1 bg-white rounded shadow border border-gray-100 px-2 py-2">
              <a href="/admin-dashboard" className={`${active === 'products' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-base font-medium`}>Products</a>
              <a href="/admin-dashboard/analytics" className={`${active === 'analytics' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-base font-medium`}>Analytics</a>
              <a href="/admin-dashboard/retailers" className={`${active === 'retailers' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-base font-medium`}>Retailers</a>
              <a href="/admin-dashboard/tallysync" className={`${active === 'tallysync' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-base font-medium`}>Tally Sync</a>
              <a href="/admin-dashboard/customization" className={`${active === 'customization' ? 'text-gray-900 bg-gray-100' : 'text-gray-500 hover:text-gray-900'} px-3 py-2 rounded-md text-base font-medium`}>Customization</a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 