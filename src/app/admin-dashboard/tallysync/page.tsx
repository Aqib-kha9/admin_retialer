"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import AdminNavbar from "../../../components/AdminNavbar";

type Notification = {
  message: string;
  type: "success" | "error" | "info";
};

type SyncResponse = {
  success: boolean;
  requestId: string;
  command: {
    requestId: string;
    action: string;
    payload: {
      companyName: string;
      port: number;
    };
    signature: string;
  };
};

export default function TallySyncPage() {
  const apiurl = process.env.NEXT_PUBLIC_APIURL;
  const [port, setPort] = useState("9000");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [savedCompanies, setSavedCompanies] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [lastSync, setLastSync] = useState<{ time: Date; type: "success" | "error" } | null>(null);
  const [companyToSave, setCompanyToSave] = useState("");
  const [syncResponse, setSyncResponse] = useState<SyncResponse | null>(null);
  const [agentStatus, setAgentStatus] = useState<"online" | "offline" | "checking">("checking");
  const [authToken, setAuthToken] = useState<string>("");
  const [showToken, setShowToken] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Fetch saved companies and token
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        setAuthToken(token);
        const res = await axios.get(`${apiurl}/admin/get-companies`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.companies?.length > 0) {
          setSavedCompanies(res.data.companies);
          setSelectedCompany(res.data.companies[0]);
        }
      } catch (err) {
        console.error("Error fetching companies", err);
      }
    };
    fetchCompanies();
    checkAgentStatus();
  }, [apiurl]);

  // ✅ Check agent status 
  const checkAgentStatus = async () => {
    // We skip sending a "TEST" task because it creates "Company Mismatch" errors in the agent logs.
    // TODO: Implement a proper read-only status check (e.g. checking lastSeen).
    // For now, we assume 'online' if we can load companies, or just leave it as 'checking' until first sync.
    setAgentStatus("online");

    /* 
    // Previous logic caused mismatch errors:
    try {
      const token = localStorage.getItem("token");
      await axios.get(`${apiurl}/agent/sync/fetch-tally`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { companyName: "TEST", port: 9000 },
        timeout: 5000
      });
      setAgentStatus("online");
    } catch (error) { ... }
    */
  };

  // ✅ Unified Sync Logic (Agent API)
  const runAgentSync = async () => {
    if (!selectedCompany) {
      setNotification({ message: "Please select a company to sync.", type: "error" });
      return;
    }

    setIsSyncing(true);
    setNotification({ message: "Sending request to Tally Agent...", type: "info" });
    setSyncResponse(null);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${apiurl}/agent/sync/fetch-tally`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { companyName: selectedCompany, port },
        }
      );

      if (res.data?.success) {
        setSyncResponse(res.data);
        setNotification({
          message: `✅ Sync command sent successfully!`,
          type: "success",
        });
        setLastSync({ time: new Date(), type: "success" });
        setAgentStatus("online");
      } else {
        setNotification({
          message: res.data?.message || "Unexpected response from agent.",
          type: "error",
        });
        setLastSync({ time: new Date(), type: "error" });
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to start sync. Check if Agent is running.";
      console.error("Agent Sync Error:", err);
      setNotification({ message: errorMsg, type: "error" });
      setLastSync({ time: new Date(), type: "error" });
      setAgentStatus("offline");
    } finally {
      setIsSyncing(false);
    }
  };

  // ✅ Auto-sync logic (every 5 minutes)
  const handleStartAutoSync = () => {
    if (isAutoSyncing) return;
    runAgentSync(); // Run immediately
    intervalRef.current = setInterval(runAgentSync, 5 * 60 * 1000);
    setIsAutoSyncing(true);
    setNotification({ message: "🔄 Auto-sync started (every 5 minutes)", type: "info" });
  };

  const handleStopAutoSync = () => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsAutoSyncing(false);
    setNotification({ message: "⏹️ Auto-sync stopped.", type: "info" });
  };

  // ✅ Add company handler
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyToSave.trim()) {
      setNotification({ message: "Company name cannot be empty.", type: "error" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${apiurl}/admin/save-company`,
        { companyName: companyToSave },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotification({ message: "✅ Company saved successfully!", type: "success" });
      setSavedCompanies(prev => [...prev, companyToSave]);
      setSelectedCompany(companyToSave);
      setCompanyToSave("");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error saving company.";
      setNotification({ message: msg, type: "error" });
    }
  };

  // ✅ Copy token to clipboard
  const copyTokenToClipboard = () => {
    navigator.clipboard.writeText(authToken).then(() => {
      setNotification({ message: "✅ Token copied to clipboard!", type: "success" });
    });
  };

  // ✅ Auto-clear notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ✅ Status indicator component
  const StatusIndicator = ({ status }: { status: "online" | "offline" | "checking" }) => {
    const getStatusColor = () => {
      switch (status) {
        case 'online': return 'bg-green-500';
        case 'offline': return 'bg-red-500';
        case 'checking': return 'bg-yellow-500 animate-pulse';
        default: return 'bg-gray-500';
      }
    };

    const getStatusText = () => {
      switch (status) {
        case 'online': return 'Online';
        case 'offline': return 'Offline';
        case 'checking': return 'Checking...';
        default: return 'Unknown';
      }
    };

    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center py-6">
      <AdminNavbar active="tallysync" />

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 ${notification.type === 'success' ? 'bg-green-600' :
              notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
            } text-white`}
        >
          {notification.type === 'success' && '✅'}
          {notification.type === 'error' && '❌'}
          {notification.type === 'info' && 'ℹ️'}
          {notification.message}
        </div>
      )}

      <div className="w-full max-w-6xl space-y-6">
        {/* Header Section with 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Main Controls */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">TallySync Agent</h1>
              <p className="text-gray-600">
                Connect with your Tally Agent to sync company and stock data
              </p>
            </div>

            {/* Agent Status & Token */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="text-gray-600">Agent Status</div>
                    <StatusIndicator status={agentStatus} />
                  </div>
                </div>
                <button
                  onClick={checkAgentStatus}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                >
                  Refresh
                </button>
              </div>

              {/* Auth Token Section */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-yellow-800">Authentication Token</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="text-xs text-yellow-700 hover:text-yellow-900"
                    >
                      {showToken ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={copyTokenToClipboard}
                      className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="text-xs font-mono bg-white p-2 rounded border break-all">
                  {showToken ? authToken : '••••••••••••••••••••••••••••••'}
                </div>
                <div className="text-xs text-yellow-700 mt-2">
                  Use this token to verify your Tally Agent
                </div>
              </div>
            </div>

            {/* Sync Controls */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Tally Port</label>
                  <input
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="9000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Company</label>
                  <select
                    value={selectedCompany}
                    onChange={e => setSelectedCompany(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                  >
                    <option value="">-- Select a Company --</option>
                    {savedCompanies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={runAgentSync}
                disabled={isSyncing || agentStatus === "offline"}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column - Auto Sync & Add Company */}
          <div className="space-y-6">
            {/* Auto Sync Controls */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-4 text-center">Automatic Background Sync</h2>
              <div className="space-y-4">
                <div className="text-center">
                  {!isAutoSyncing ? (
                    <button
                      onClick={handleStartAutoSync}
                      disabled={agentStatus === "offline"}
                      className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Start Auto-Sync
                    </button>
                  ) : (
                    <button
                      onClick={handleStopAutoSync}
                      className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop Auto-Sync
                    </button>
                  )}
                </div>

                {lastSync && (
                  <div className={`p-3 rounded-lg text-center ${lastSync.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                    <div className="text-sm font-medium">
                      Last sync: {lastSync.time.toLocaleTimeString()}
                    </div>
                    <div className="text-xs">
                      Status: {lastSync.type === "success" ? "✅ Success" : "❌ Failed"}
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600 text-center">
                  Auto-sync runs every 5 minutes. Keep this page open for continuous synchronization.
                </p>
              </div>
            </div>

            {/* Add Company Form */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-bold mb-4 text-center">Add New Company</h2>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter company name as it appears in Tally"
                    value={companyToSave}
                    onChange={(e) => setCompanyToSave(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Save Company
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Response Display */}
        {syncResponse && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sync Command Sent Successfully
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Request Information</h3>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Request ID:</span>
                    <span className="text-sm font-mono text-blue-600">{syncResponse.requestId}</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Status:</span>
                    <span className="text-sm font-semibold text-green-600">Command Sent</span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-600">Action:</span>
                    <span className="text-sm font-semibold text-purple-600">{syncResponse.command.action}</span>
                  </div>
                </div>
              </div>

              {/* Command Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Command Details</h3>

                <div className="space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Company</div>
                    <div className="text-lg font-semibold text-blue-900">{syncResponse.command.payload.companyName}</div>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Port</div>
                    <div className="text-lg font-semibold text-blue-900">{syncResponse.command.payload.port}</div>
                  </div>

                  <div className="p-3 bg-gray-100 rounded-lg">
                    <div className="text-sm font-medium text-gray-600 mb-1">Signature</div>
                    <div className="text-xs font-mono text-gray-700 break-all">{syncResponse.command.signature}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What happens next?
              </h4>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>Your Tally Agent has received the sync command</li>
                <li>The agent will now connect to Tally and fetch the data</li>
                <li>Data will be processed and synchronized automatically</li>
                <li>Check your Tally Agent logs for detailed progress</li>
              </ul>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Need Help?
          </h3>
          <div className="text-sm text-yellow-800 space-y-2">
            <p><strong>Agent Offline?</strong> Make sure:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>TallySync Agent desktop app is running</li>
              <li>Agent is properly registered with your backend</li>
              <li>Your authentication token is valid</li>
              <li>Backend server is accessible</li>
            </ul>
            <p className="mt-2">
              <strong>Note:</strong> Copy the authentication token above and use it to verify your Tally Agent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}