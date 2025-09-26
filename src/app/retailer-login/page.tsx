'use client';

import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constants/backend';

export default function RetailerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/loginRetailer`, { email, password });
      console.log('Retailer login attempt:', { email, password });
      const token = response.data.access_token;
      if (token) {
        const decoded = jwtDecode(token);
        const id = (decoded.sub);
        console.log(id);
        localStorage.setItem('token', token);
        localStorage.setItem('userid', id || '');
      }
      toast.success("Login successful!");
      router.push('post-login/retailer');
    } catch (error: any) {
      const message = error.response?.data?.message;
  
      if (message === "Invalid credentials") {
        toast.error("Incorrect email or password.");
      } else if (message === "Not authorized as Retailer") {
        toast.error("Access denied. Retailers only.");
      } else {
        toast.error(message || "An unexpected error occurred.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 w-full max-w-3xl xl:max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10 md:py-14 flex flex-col md:flex-row items-center md:items-center min-h-[70vh] gap-4 md:gap-10 xl:gap-16">
        {/* Back Button */}
        <div className="w-full mb-4 md:mb-0 md:absolute md:left-8 md:top-8">
          <button
            onClick={() => router.push('/')}
            className="group flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200"
          >
            <svg
              className="mr-2 w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </button>
        </div>
        {/* SVG Illustration */}
        <div className="w-full md:w-1/2 flex justify-center mb-8 md:mb-0">
          <img
            src="/authentication.svg"
            alt="Authentication Illustration"
            className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 drop-shadow-xl max-w-full"
            draggable={false}
          />
        </div>
        {/* Login Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Retailer Login</h1>
              <p className="text-gray-600 mt-2">Access your Retailer Account</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600">
                    Remember me
                  </label>
                </div>
                <a href="#" className="text-sm text-gray-600 hover:text-gray-900">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 border border-transparent rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Sign in
              </button>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => router.push('/retailer-login/retailer-register')}
                    className="text-gray-900 hover:underline font-medium"
                  >
                    Register here
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
} 