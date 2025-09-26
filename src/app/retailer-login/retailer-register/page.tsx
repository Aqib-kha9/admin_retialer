'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../../constants/backend';

// List of Indian states and their major cities
const statesAndCities: { [key: string]: string[] } = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur'],
  'Arunachal Pradesh': ['Itanagar', 'Tawang', 'Ziro'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara'],
  'Haryana': ['Chandigarh', 'Faridabad', 'Gurgaon'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
  'Manipur': ['Imphal'],
  'Meghalaya': ['Shillong'],
  'Mizoram': ['Aizawl'],
  'Nagaland': ['Kohima', 'Dimapur'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela'],
  'Punjab': ['Amritsar', 'Ludhiana', 'Jalandhar'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur'],
  'Sikkim': ['Gangtok'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
  'Telangana': ['Hyderabad', 'Warangal'],
  'Tripura': ['Agartala'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Nainital'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Silvassa'],
  'Delhi': ['New Delhi', 'Dwarka', 'Rohini'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu'],
  'Ladakh': ['Leh'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Puducherry'],
};
const stateList = Object.keys(statesAndCities);

export default function RetailerRegister() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmpassword: '',
    phonenumber: '',
    city: '',
    state: '',
    zip: '',
    store: '',
  });
  const [cities, setCities] = useState<string[]>([]);
  const [zipLoading, setZipLoading] = useState(false);
  const [customCity, setCustomCity] = useState('');

  useEffect(() => {
    // Update cities when state changes
    if (formData.state && statesAndCities[formData.state]) {
      setCities(statesAndCities[formData.state]);
      // If current city is not in the new list, reset it
      if (!statesAndCities[formData.state].includes(formData.city)) {
        setFormData(prev => ({ ...prev, city: '' }));
      }
    } else {
      setCities([]);
      setFormData(prev => ({ ...prev, city: '' }));
    }
  }, [formData.state]);

  // Auto-fill state and city from zip code
  useEffect(() => {
    const fetchStateCityFromZip = async () => {
      if (formData.zip.length === 6 && /^\d{6}$/.test(formData.zip)) {
        setZipLoading(true);
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${formData.zip}`);
          const data = await res.json();
          if (data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
            const postOffice = data[0].PostOffice[0];
            const state = postOffice.State;
            const city = postOffice.District;
            // Try to match state with our list
            const matchedState = stateList.find(s => s.toLowerCase() === state.toLowerCase());
            setFormData(prev => ({
              ...prev,
              state: matchedState || state,
              city: city
            }));
          }
        } catch (err) {
          // ignore errors
        } finally {
          setZipLoading(false);
        }
      }
    };
    fetchStateCityFromZip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.zip]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'city' && value === '__other__') {
      setFormData(prev => ({ ...prev, city: '' }));
      setCustomCity('');
    } else if (name === 'city') {
      setFormData(prev => ({ ...prev, city: value }));
      setCustomCity('');
    } else {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    }
  };

  // When customCity changes, update formData.city
  useEffect(() => {
    if (customCity) {
      setFormData(prev => ({ ...prev, city: customCity }));
    }
  }, [customCity]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${BACKEND_URL}/auth/register`, formData);
      console.log('Retailer registration attempt:', formData);
      toast.success('Retailer registration successful');
      router.push('/retailer-login');
    } catch (error: any) {
      let message = error.response?.data?.message;
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
      toast.error(message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <main className="flex-1 w-full max-w-3xl xl:max-w-5xl mx-auto px-2 sm:px-4 py-6 sm:py-10 md:py-14 flex flex-col md:flex-row items-center md:items-center min-h-[70vh] gap-4 md:gap-10 xl:gap-16">
        {/* Back Button */}
        <div className="w-full mb-4 md:mb-0 md:absolute md:left-8 md:top-8">
          <button
            onClick={() => router.push('/retailer-login')}
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
            Back to login
          </button>
        </div>
        {/* SVG Illustration */}
        <div className="w-full md:w-1/2 flex justify-center mb-8 md:mb-0">
          <img
            src="/regsiter.svg"
            alt="Register Illustration"
            className="w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 drop-shadow-xl max-w-full"
            draggable={false}
          />
        </div>
        {/* Register Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          <div className="bg-white py-8 px-6 shadow-sm rounded-lg border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Create Retailer Account</h1>
              <p className="text-gray-600 mt-2">Fill in the details to register as a Retailer</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label 
                  htmlFor="name" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                   Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="phonenumber" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Phone Number
                </label>
                <input
                  id="phonenumber"
                  name="phonenumber"
                  type="text"
                  value={formData.phonenumber}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your phone number"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="state" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  required
                >
                  <option value="">Select State</option>
                  {stateList.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label 
                  htmlFor="city" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  City
                </label>
                <select
                  id="city"
                  name="city"
                  value={cities.includes(formData.city) ? formData.city : formData.city ? '__other__' : ''}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  required
                  disabled={!formData.state}
                >
                  <option value="">{formData.state ? 'Select City' : 'Select State First'}</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                  <option value="__other__">Other (Enter manually)</option>
                </select>
                {((!cities.includes(formData.city) && formData.state) || (formData.city === '' && customCity !== '')) && (
                  <input
                    type="text"
                    className="mt-2 block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                    placeholder="Enter your city or village name"
                    value={customCity}
                    onChange={e => setCustomCity(e.target.value)}
                  required
                />
                )}
                {zipLoading && <div className="text-xs text-gray-500 mt-1">Looking up city/state from zip...</div>}
              </div>

              <div>
                <label 
                  htmlFor="zip" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Zip Code
                </label>
                <input
                  id="zip"
                  name="zip"
                  type="text"
                  value={formData.zip}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your zip code"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="store" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Store Name
                </label>
                <input
                  id="store"
                  name="store"
                  type="text"
                  value={formData.store}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Enter your store name"
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Create a password"
                  required
                />
              </div>

              <div>
                <label 
                  htmlFor="confirmPassword" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmpassword"
                  name="confirmpassword"
                  type="password"
                  value={formData.confirmpassword}
                  onChange={handleChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  placeholder="Confirm your password"
                  required
                />
              </div>


              <button
                type="submit"
                onClick={handleSubmit}
                className="w-full py-2 px-4 border border-transparent rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Create Account
              </button>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => router.push('/retailer-login')}
                    className="text-gray-900 hover:underline font-medium"
                  >
                    Sign in here
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