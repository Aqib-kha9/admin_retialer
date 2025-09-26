'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import AdminNavbar from '../../../components/AdminNavbar';

export default function Analytics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Filters state
  const [filters, setFilters] = useState({
    minProducts: '',
    minRetailers: '',
    minSubscription: '',
    maxSubscription: '',
    minDaysLeft: '',
    maxDaysLeft: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    const storedId = localStorage.getItem('userid');
    const storedToken = localStorage.getItem('token');
    setId(storedId);
    setToken(storedToken);
    if (storedId && storedToken) {
      fetchAnalytics(storedId, storedToken);
    } else {
      setLoading(false);
      setError('Authentication required. Please log in again.');
    }
  }, []);

  const fetchAnalytics = async (adminId: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`http://localhost:4000/admin/analytics`, {
        headers: { adminId,Authorization: `Bearer ${token}` },
      });
      setAnalytics(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch analytics');
    }
    setLoading(false);
  };

  const handleProfileClick = () => setShowProfileMenu((v) => !v);
  const handleLogout = () => router.push("/");

  // Helper to calculate days left
  const getDaysLeft = (subscription_update: string, subscription: number) => {
    if (!subscription_update || !subscription) return '-';
    const subDate = new Date(subscription_update);
    const expiryDate = new Date(subDate.getTime() + subscription * 24 * 60 * 60 * 1000);
    const today = new Date();
    const diff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  };

  // Filtered retailers
  const filteredRetailers = analytics?.allretailer?.filter((retailer: any) => {
    // Products filter (if available)
    if (filters.minProducts && (retailer.products ?? 0) < Number(filters.minProducts)) return false;
    // Retailers filter (not used here, but placeholder)
    // Subscription days
    if (filters.minSubscription && (retailer.subscription ?? 0) < Number(filters.minSubscription)) return false;
    if (filters.maxSubscription && (retailer.subscription ?? 0) > Number(filters.maxSubscription)) return false;
    // Days left
    const daysLeft = getDaysLeft(retailer.subscription_update, retailer.subscription);
    if (filters.minDaysLeft && daysLeft !== '-' && Number(daysLeft) < Number(filters.minDaysLeft)) return false;
    if (filters.maxDaysLeft && daysLeft !== '-' && Number(daysLeft) > Number(filters.maxDaysLeft)) return false;
    // City/state
    if (filters.city && retailer.city && !retailer.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.state && retailer.state && !retailer.state.toLowerCase().includes(filters.state.toLowerCase())) return false;
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen bg-white">
      <AdminNavbar active="analytics" />
      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Analytics Overview</h1>
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading analytics...</div>
          ) : error ? (
            <div className="text-center py-10 text-red-500">{error}</div>
          ) : analytics ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
                <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                  <div className="p-5">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Retailers</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{analytics.allretailer?.length ?? 0}</dd>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                  <div className="p-5">
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Products</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{analytics.products ?? 0}</dd>
                  </div>
                </div>
                <div className="bg-white overflow-hidden shadow-sm rounded-lg">
                  <div className="p-5">
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Retailers</dt>
                    <dd className="mt-1 text-3xl font-semibold text-gray-900">{analytics.activereatailerCount ?? 0}</dd>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-3xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-8">
                <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-4">Filters</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Products</label>
                    <input
                      type="number"
                      value={filters.minProducts}
                      onChange={(e) => setFilters({...filters, minProducts: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Minimum products"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Retailers</label>
                    <input
                      type="number"
                      value={filters.minRetailers}
                      onChange={(e) => setFilters({...filters, minRetailers: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Minimum retailers"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Subscription (days)</label>
                    <input
                      type="number"
                      value={filters.minSubscription}
                      onChange={(e) => setFilters({...filters, minSubscription: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Min subscription"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Subscription (days)</label>
                    <input
                      type="number"
                      value={filters.maxSubscription}
                      onChange={(e) => setFilters({...filters, maxSubscription: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Max subscription"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Days Left</label>
                    <input
                      type="number"
                      value={filters.minDaysLeft}
                      onChange={(e) => setFilters({...filters, minDaysLeft: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Min days left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Max Days Left</label>
                    <input
                      type="number"
                      value={filters.maxDaysLeft}
                      onChange={(e) => setFilters({...filters, maxDaysLeft: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="Max days left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={filters.city}
                      onChange={(e) => setFilters({...filters, city: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={filters.state}
                      onChange={(e) => setFilters({...filters, state: e.target.value})}
                      className="w-full px-3 py-2 sm:px-4 sm:py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none"
                      placeholder="State"
                    />
                  </div>
                </div>
              </div>

              {/* Retailers Table */}
              <div className="bg-white shadow-sm rounded-lg mb-8">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">All Retailers</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zip</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription Update</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription (Days left)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredRetailers.map((retailer: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.userid}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.name}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.email}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.city}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.state}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.zip}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.status}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.created_stamp ? new Date(retailer.created_stamp).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">{retailer.lastlogin ? new Date(retailer.lastlogin).toLocaleString() : 'Never'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.subscription ?? '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{retailer.subscription_update ? new Date(retailer.subscription_update).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{getDaysLeft(retailer.subscription_update, retailer.subscription)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}
      </div>
    </div>
  );
} 