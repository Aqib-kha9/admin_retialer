"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import AdminNavbar from "../../../components/AdminNavbar";
import UniversalLoader from "../../../components/UniversalLoader";
import { motion } from "framer-motion";

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
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Fetch saved companies and token
  useEffect(() => {
    const fetchCompanies = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        setAuthToken(token);
        const res = await axios.get(`${apiurl}/admin/get-companies`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.companies?.length > 0) {
          setSavedCompanies(res.data.companies);
          // ✅ Restore last selected company from sessionStorage on navigation return
          const lastCompany = sessionStorage.getItem("tallysync_selectedCompany");
          if (lastCompany && res.data.companies.includes(lastCompany)) {
            setSelectedCompany(lastCompany);
          } else {
            setSelectedCompany(res.data.companies[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching companies", err);
      } finally {
        setLoading(false);
      }
    };
    // ✅ Clear stale syncResponse on mount (component re-mounted after tab navigation)
    setSyncResponse(null);
    fetchCompanies();
    checkAgentStatus();
  }, [apiurl]);

  // ✅ Check agent status 
  const checkAgentStatus = async () => {
    setAgentStatus("checking");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${apiurl}/agent/sync/agent-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.online) {
        setAgentStatus("online");
      } else {
        setAgentStatus("offline");
      }
    } catch (err) {
      setAgentStatus("offline");
    }
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
        const requestId = res.data.requestId;

        // Bug 1 fix: Poll for real task result instead of showing "success" immediately
        setNotification({
          message: `⏳ Task created. Waiting for agent to process...`,
          type: "info",
        });

        // Poll for task status every 2 seconds, up to 180 attempts (360 seconds / 6 minutes)
        // Agent needs time to: fetch companies (15s) + fetch stock items (300s / 5 min)
        let taskCompleted = false;
        for (let attempt = 0; attempt < 180; attempt++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const statusRes = await axios.get(
              `${apiurl}/agent/sync/task-status/${requestId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const task = statusRes.data;
            if (task.status === 'COMPLETED') {
              setNotification({
                message: `✅ ${task.result || 'Sync completed successfully!'}`,
                type: "success",
              });
              setLastSync({ time: new Date(), type: "success" });
              setAgentStatus("online");
              taskCompleted = true;
              break;
            } else if (task.status === 'FAILED') {
              setNotification({
                message: `❌ Sync failed: ${task.error || 'Unknown error'}`,
                type: "error",
              });
              setLastSync({ time: new Date(), type: "error" });
              taskCompleted = true;
              break;
            }
            // Still PENDING or IN_PROGRESS — continue polling
          } catch (_pollErr) {
            // Ignore polling errors, continue loop
          }
        }

        if (!taskCompleted) {
          setNotification({
            message: `⏳ Sync is taking longer than expected. The agent is still processing. Check back later.`,
            type: "info",
          });
          setLastSync({ time: new Date(), type: "success" });
        }
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
    sessionStorage.setItem("tallysync_autoSyncing", "true");
    setNotification({ message: "🔄 Auto-sync started (every 5 minutes)", type: "info" });
  };

  const handleStopAutoSync = () => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsAutoSyncing(false);
    sessionStorage.removeItem("tallysync_autoSyncing");
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

  // ✅ Persist selected company to sessionStorage on change
  const handleCompanyChange = (company: string) => {
    setSelectedCompany(company);
    if (company) {
      sessionStorage.setItem("tallysync_selectedCompany", company);
    } else {
      sessionStorage.removeItem("tallysync_selectedCompany");
    }
  };

  // ✅ Restore auto-sync state on mount (from previous navigation)
  useEffect(() => {
    const wasAutoSyncing = sessionStorage.getItem("tallysync_autoSyncing") === "true";
    if (wasAutoSyncing && !isAutoSyncing && !intervalRef.current) {
      // Restore auto-sync but don't run immediately (avoid double-sync on mount)
      intervalRef.current = setInterval(runAgentSync, 5 * 60 * 1000);
      setIsAutoSyncing(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="min-h-screen bg-white">
      <AdminNavbar active="tallysync" />

      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-sm font-semibold flex items-center gap-2 ${notification.type === 'success' ? 'bg-green-600' :
            notification.type === 'error' ? 'bg-red-600' : 'bg-gray-900'
            } text-white`}
        >
          {notification.type === 'success' && '✅'}
          {notification.type === 'error' && '❌'}
          {notification.type === 'info' && 'ℹ️'}
          {notification.message}
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">TallySync Agent</h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full space-y-6"
        >
          {loading && (
            <div className="fixed inset-0 bg-white/50 backdrop-blur-[1px] z-40 flex items-center justify-center">
              <UniversalLoader text="Initializing sync agent..." />
            </div>
          )}
          {/* Header Section with 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Main Controls */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="mb-6">
                <h2 className="text-xl font-medium text-gray-900 mb-1">Agent Connection</h2>
                <p className="text-sm text-gray-600">
                  Manage your connection with the Tally Agent desktop application.
                </p>
              </div>

              {/* Agent Status & Token */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <div className="text-gray-600 font-medium mb-1">Agent Status</div>
                      <StatusIndicator status={agentStatus} />
                    </div>
                  </div>
                  <button
                    onClick={checkAgentStatus}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Refresh Status
                  </button>
                </div>

                {/* Auth Token Section */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Authentication Token</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowToken(!showToken)}
                        className="text-xs text-gray-600 hover:text-gray-900 font-medium underline"
                      >
                        {showToken ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={copyTokenToClipboard}
                        className="text-xs font-medium text-gray-700 hover:text-gray-900"
                      >
                        Copy Token
                      </button>
                    </div>
                  </div>
                  <div className="text-xs font-mono bg-white p-3 rounded border border-gray-200 break-all text-gray-800">
                    {showToken ? authToken : '••••••••••••••••••••••••••••••'}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Copy this token and paste it in your Tally Agent desktop application to authorize synchronization.
                  </div>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Tally Port</label>
                    <input
                      value={port}
                      onChange={e => setPort(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none text-sm"
                      placeholder="9000"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <select
                      value={selectedCompany}
                      onChange={e => handleCompanyChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none text-sm bg-white"
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
                  className="w-full px-6 py-2.5 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
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
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="mb-4">
                  <h2 className="text-xl font-medium text-gray-900 mb-1">Background Sync</h2>
                  <p className="text-sm text-gray-600">
                    Enable automatic synchronization to keep your data up to date.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    {!isAutoSyncing ? (
                      <button
                        onClick={handleStartAutoSync}
                        disabled={agentStatus === "offline"}
                        className="w-full px-6 py-2.5 border border-transparent rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Start Auto-Sync
                      </button>
                    ) : (
                      <button
                        onClick={handleStopAutoSync}
                        className="w-full px-6 py-2.5 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
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
                    <div className={`p-3 rounded-lg border ${lastSync.type === "success" ? "bg-green-50 border-green-100 text-green-800" : "bg-red-50 border-red-100 text-red-800"
                      }`}>
                      <div className="text-sm font-medium flex items-center justify-between">
                        <span>Last Sync Attempt</span>
                        <span>{lastSync.time.toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs mt-1 opacity-80">
                        Status: {lastSync.type === "success" ? "✅ Successfully completed" : "❌ Sync request failed"}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 text-center italic">
                    Note: Auto-sync runs every 5 minutes. Please keep this browser tab open for continuous synchronization.
                  </p>
                </div>
              </div>

              {/* Add Company Form */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="mb-4">
                  <h2 className="text-xl font-medium text-gray-900 mb-1">Register Company</h2>
                  <p className="text-sm text-gray-600">
                    Add a company to your authorized list for synchronization.
                  </p>
                </div>

                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="As it appears in Tally"
                      value={companyToSave}
                      onChange={(e) => setCompanyToSave(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#A8E0D8] focus:border-transparent outline-none text-sm"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-md hover:bg-gray-800 transition-colors text-sm font-medium flex items-center justify-center gap-2"
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
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-medium text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sync Command Sent
                </h2>
                <button
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
                >
                  <svg className={`w-3 h-3 transition-transform ${showTechDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showTechDetails ? 'Hide Technical Details' : 'View Technical Details'}
                </button>
              </div>

              <div className="space-y-8">
                {/* Visible Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Sync Company</div>
                      <div className="text-lg font-semibold text-gray-900">{syncResponse.command.payload.companyName}</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Communication Port</div>
                      <div className="text-lg font-semibold text-gray-900">{syncResponse.command.payload.port}</div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Tech Details */}
                {showTechDetails && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-gray-50/50 rounded-xl border border-gray-100">
                      {/* Basic Info */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2">Request Metadata</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-xs text-gray-500">Internal UUID:</span>
                            <span className="text-xs font-mono text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-100">{syncResponse.requestId}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-xs text-gray-500">Command Type:</span>
                            <span className="text-xs font-medium text-gray-700">{syncResponse.command.action}</span>
                          </div>
                        </div>
                      </div>

                      {/* Security Detail */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200 pb-2">Digital Signature</h3>
                        <div className="p-3 bg-white rounded border border-gray-100">
                          <div className="text-[10px] font-mono text-gray-400 break-all leading-relaxed">{syncResponse.command.signature}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Troubleshooting Connection Issues
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-3">
                <p className="font-semibold text-gray-700">If the Agent appears Offline:</p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
                    Ensure the TallySync Agent desktop app is running on the computer where Tally is installed.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
                    Verify that the Authentication Token in the Agent app matches the one shown above.
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="font-semibold text-gray-700">If Synchronization fails:</p>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
                    Check if Tally Prime/ERP 9 is open and the specific company is loaded.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0"></div>
                    Confirm the "Tally Port" matches the port set in Tally connectivity settings (default is 9000).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>

  );
}