'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AdminNavbar from '../../../components/AdminNavbar';

// Define the Retailer interface at the top of the file
interface Retailer {
  userid: string;
  name: string;
  email: string;
  phonenumber: string;
  city: string;
  status: string;
  created_stamp?: string;
  created_at?: string;
  subscription?: number;
  subscription_update?: string;
}

export default function Retailers() {
  const router = useRouter();
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [retailers, setRetailers] = useState<Retailer[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [newRetailer, setNewRetailer] = useState<{
    email: string;
    id: string;
    subscription: number | null;
  }>({
    email: '',
    id: '',
    subscription: null
  });
  
  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; retailer: Retailer | null }>({ visible: false, x: 0, y: 0, retailer: null });
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionValue, setSubscriptionValue] = useState<number>(0);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState<'StartNew' | 'HandleDays'>('StartNew');
  const [handleDaysType, setHandleDaysType] = useState<'increase' | 'decrease'>('increase');
  const apiurl = process.env.NEXT_PUBLIC_APIURL;
  useEffect(() => {
    
    const storedId = localStorage.getItem('userid');
    const storedToken = localStorage.getItem('token');
    if (storedId) setId(storedId);
    if (storedToken) setToken(storedToken);
    // Fetch retailers from backend
    const fetchRetailers = async () => {
      setLoading(true);
      try {
        console.log(storedId);
        const res = await axios.get<Retailer[]>(`${apiurl}/admin/retailers`, {
          headers: { id: storedId, Authorization: `Bearer ${storedToken}` },
        });
        console.log(res);
        setRetailers(res.data);
      } catch (err) {
        toast.error('Failed to fetch retailers');
      }
      setLoading(false);
    };
    if (storedToken) fetchRetailers();
    
  }, []);

  // Add utility functions for access status
  const hasAccess = (status: string) => {
    const statusLower = status.toLowerCase();
    return statusLower === 'active' || statusLower === 'preapproved';
  };

  const getButtonText = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'inactive') {
      return 'Grant Access';
    }
    return 'Remove Access';
  };

  const toggleRetailerStatus = async (retailerUserId: string, currentStatus: string) => {
    try {
      // If they currently have access (active/preapproved), we're setting to inactive
      // If they're inactive, we're setting back to active
      const newStatus = hasAccess(currentStatus) ? 'inactive' : 'active';
      let Status = newStatus;
      const response = await axios.put(
        `${apiurl}/admin/toggle-retailer-status`,
        {
          userid: retailerUserId,
          AdminId: id,
          newStatus: newStatus
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (response.data) {
        if(response.data.message === 'Status updated to preapproved'){
          Status = 'preapproved';
        }
        setRetailers(retailers.map(retailer => {
          if (retailer.userid === retailerUserId  ) {
            if(Status === 'preapproved'){
              return {
                ...retailer,
                status: 'preapproved'
              };
            }else{
              return {
                ...retailer,
                status: newStatus
              };
            }
          }
          return retailer;
        }));
        toast.success(`Retailer access ${newStatus === 'inactive' ? 'removed' : 'granted'} successfully`);
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to update Retailer status';
      toast.error(message);
      console.error('Error updating retailer status:', error);
    }
  };

  const handleStatusToggle = (retailerUserId: string, currentStatus: string) => {
    if (hasAccess(currentStatus)) {
      // Show confirmation before removing access
      if (window.confirm('Are you sure you want to remove access for this retailer?')) {
        toggleRetailerStatus(retailerUserId, currentStatus);
      }
    } else {
      // No confirmation needed for granting access
      toggleRetailerStatus(retailerUserId, currentStatus);
    }
  };

  const handleAddRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {

      const response = await axios.post(`${apiurl}/auth/registeraccessretailer`, {
        email: newRetailer.email,
        id: id,
        subscription: newRetailer.subscription,
      });
      toast.success("Added Retailer successfully!");
      router.push('/admin-dashboard/retailers');
    } catch (error: any) {
      const message = error.response?.data?.message;
      toast.error(message || "An unexpected error occurred.");
    }
  };

  const handleProfileClick = () => setShowProfileMenu((v) => !v);
  const handleLogout = () => router.push("/");

  // Close context menu on click outside or scroll
  useEffect(() => {
    const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, retailer: null });
    const handleScroll = () => setContextMenu({ visible: false, x: 0, y: 0, retailer: null });
    if (contextMenu.visible) {
      window.addEventListener('click', handleClick);
      window.addEventListener('scroll', handleScroll);
    }
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [contextMenu.visible]);

  const handleRowContextMenu = (e: React.MouseEvent, retailer: Retailer) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      retailer,
    });
  };

  const handleSubscriptionClick = () => {
    setShowSubscriptionModal(true);
    setContextMenu({ ...contextMenu, visible: false });
    setSubscriptionValue(0); // Default to 0 for new input
    setSubscriptionAction('StartNew'); // Default action
    setHandleDaysType('increase');
  };

  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextMenu.retailer) return;
    setSubscriptionLoading(true);
    try {
      const payload: any = {
        userid: contextMenu.retailer.userid,
        days: subscriptionValue,
        action: subscriptionAction,
        adminId: id,
      };
      if (subscriptionAction === 'HandleDays') {
        payload.handleDaysType = handleDaysType;
      }
      await axios.put(
        `${apiurl}/admin/subscription`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      toast.success('Subscription updated successfully!');
      setShowSubscriptionModal(false);
      router.refresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  // Filtered retailers based on search query
  const filteredRetailers = retailers.filter((retailer) => {
    const q = searchQuery.toLowerCase();
    return (
      (retailer.name || '').toLowerCase().includes(q) ||
      (retailer.userid || '').toLowerCase().includes(q) ||
      (retailer.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-white">
      <AdminNavbar active="retailers" />
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Retailers</h1>
        {/* Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-96 px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none text-base"
            placeholder="Search by name, user ID, or email..."
          />
        </div>
          <div className="flex justify-between items-center mb-6">
            <div>
            <p className="mt-1 text-sm text-black-600">Right click on Retailers for options.</p>
            </div>
            <button
              onClick={() => setShowAddRetailerModal(true)}
              className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800"
            >
              Add Retailer
            </button>
          </div>

          {/* Retailers Table */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-8">Loading...</td></tr>
              ) : filteredRetailers.map((retailer) => (
                <tr key={retailer.userid} className="hover:bg-gray-50" onContextMenu={(e) => handleRowContextMenu(e, retailer)}>
                    <td className="px-6 py-4 whitespace-nowrap">{retailer.userid || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{retailer.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{retailer.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{retailer.phonenumber || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{retailer.city || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${retailer.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {retailer.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{
                      retailer.created_stamp
                        ? new Date(retailer.created_stamp).toLocaleDateString()
                        : '-'
                    }</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasAccess(retailer.status || '')}
                          onChange={() => handleStatusToggle(retailer.userid, retailer.status || '')}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:bg-green-500 transition-colors duration-300"></div>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white border border-gray-300 rounded-full shadow transform transition-transform duration-300 peer-checked:translate-x-5"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          {/* Custom Context Menu */}
          {contextMenu.visible && (
            <div
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 50 }}
              className="bg-white border rounded shadow-lg min-w-[150px]"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                onClick={handleSubscriptionClick}
              >
                Subscription
              </button>
            </div>
          )}
          {/* Subscription Modal */}
          {showSubscriptionModal && contextMenu.retailer && (
            <div className="fixed inset-0 bg-blue bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white border border-gray-300 shadow-2xl rounded-2xl p-6 w-full max-w-md relative z-10">
                <div className="flex items-center mb-4">
                  <div className="bg-gray-200 rounded-full p-2 mr-3">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Retailer Subscription</h2>
                </div>
                <div className="text-sm text-gray-900 mb-4">
                  <div className="mb-2"><b>StartNew</b>: Start a whole new subscription which will start from today and how many days left from today.</div>
                  <div className="mb-2"><b>HandleDays</b>: Add or remove days from existing subscription, it will count how many days left from the day when subscription started.</div>
                  <div className="mb-2">(If Starting new subscription previous subscription days will be lost, if you just want to add days in existing subscription use <b>"HandleDays"</b>.)</div>
                </div>
                <hr className="mb-4 border-gray-200" />
                <form onSubmit={handleSubscriptionSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Action</label>
                      <select
                        value={subscriptionAction}
                        onChange={e => setSubscriptionAction(e.target.value as 'StartNew' | 'HandleDays')}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none bg-white"
                      >
                        <option value="StartNew">StartNew</option>
                        <option value="HandleDays">HandleDays</option>
                      </select>
                    </div>
                    {subscriptionAction === 'HandleDays' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-900 mb-1">Type</label>
                        <select
                          value={handleDaysType}
                          onChange={e => setHandleDaysType(e.target.value as 'increase' | 'decrease')}
                          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none bg-white"
                        >
                          <option value="increase">Increase</option>
                          <option value="decrease">Decrease</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Number of Days</label>
                      <input
                        type="number"
                        value={subscriptionValue}
                        onChange={e => setSubscriptionValue(Number(e.target.value))}
                        min={0}
                        className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSubscriptionModal(false)}
                      className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-xl bg-white hover:bg-gray-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-900 transition-colors font-semibold"
                      disabled={subscriptionLoading}
                    >
                      {subscriptionLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>

          {/* Add Retailer Modal */}
          {showAddRetailerModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Retailer</h3>
                  <form onSubmit={handleAddRetailer}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          value={newRetailer.email}
                          onChange={(e) => setNewRetailer({ ...newRetailer, email: e.target.value })}
                          placeholder="Enter Retailer's email"
                          required
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Subscription</label>
                        <select
                            value={newRetailer.subscription ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val !== '') {
                                setNewRetailer({ ...newRetailer, subscription: parseInt(val) });
                              }
                            }}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                          >
                            <option value="" disabled hidden>
                              -- Select duration --
                            </option>
                            {[7, 14, 30, 60, 90, 120, 180, 360].map((day) => (
                              <option key={day} value={day}>
                                {day} Days
                              </option>
                            ))}
                          </select>
                      </div>
                      
                    </div>
                    <div className="mt-5 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowAddRetailerModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800"
                      >
                        Add Retailer
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
} 