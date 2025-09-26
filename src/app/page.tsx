'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 w-full max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10 md:py-14 flex flex-col md:flex-row items-center md:items-center min-h-[70vh] gap-2 md:gap-6 xl:gap-10">
        {/* Illustration */}
        <div className="w-full md:w-[46%] flex justify-start md:justify-center mb-8 md:mb-0">
          <img
            src="/map-1-97.svg"
            alt="Modern digital illustration"
            className="w-72 h-56 sm:w-[28rem] sm:h-[22rem] xl:w-[32rem] xl:h-[26rem] drop-shadow-xl max-w-full"
            draggable={false}
          />
        </div>

        {/* Login Section */}
        <div className="w-full md:w-[54%] flex flex-col justify-center">
          {/* Header */}
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Welcome to Admin Retail Portal
            </h1>
            <p className="text-base sm:text-lg text-gray-500 font-light">
              Choose your login type to continue
            </p>
          </div>

          {/* Login Options */}
          <div className="space-y-6">
            {/* Admin Login Option */}
            <div 
              onClick={() => router.push('/admin-login')}
              className="group cursor-pointer"
            >
              <div className="flex items-start space-x-4 p-4 sm:p-6 bg-blue-50 rounded-2xl border border-blue-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-200">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-blue-100 shadow-sm">
                    <span className="text-xl sm:text-2xl" role="img" aria-label="admin">👤</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Admin Login</h2>
                  <p className="text-gray-500 text-sm sm:text-base font-light">
                    Access administrative controls and manage the retail system and inventory
                  </p>
                </div>
              </div>
            </div>

            {/* Retailer Login Option */}
            <div 
              onClick={() => router.push('/retailer-login')}
              className="group cursor-pointer"
            >
              <div className="flex items-start space-x-4 p-4 sm:p-6 bg-green-50 rounded-2xl border border-green-200 hover:shadow-lg hover:scale-[1.02] transition-all duration-200">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-green-100 shadow-sm">
                    <span className="text-xl sm:text-2xl" role="img" aria-label="retailer">🏪</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1">Retailer Login</h2>
                  <p className="text-gray-500 text-sm sm:text-base font-light">
                    Manage your retail account and connect with the distributors and suppliers
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-gray-200 mt-auto bg-white">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
          <p className="text-xs sm:text-sm text-gray-400 text-center font-light">
            © 2024 Admin Retail Portal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
