"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import AdminNavbar from '../../../components/AdminNavbar';
import { headers } from "next/headers";

type Notification = {
  message: string;
  type: "success" | "error" | "info";
};

export default function TallySyncPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<null | { success: boolean; message: string; details?: any }>(null);
  const [port, setPort] = useState("9000");
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [tallyProducts, setTallyProducts] = useState<any[]>([]);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncStatus, setLastSyncStatus] = useState<string>("");
  const [fieldMapping, setFieldMapping] = useState<{ [key: string]: string }>({});
  const [preFilledFields, setPreFilledFields] = useState<{ [key: string]: string }>({});
  const [mappingDirty, setMappingDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error" | "">("");
  const [fields, setFields] = useState<{ name: string; type: string; source: string; required: boolean }[]>([]);
  const [inputMapping, setInputMapping] = useState<{ [key: string]: string }>({});
  const [notification, setNotification] = useState<Notification | null>(null);

  // State for the sync process itself
  const [isSyncing, setIsSyncing] = useState(false); // For loading states
  const [isAutoSyncing, setIsAutoSyncing] = useState(false); // Tracks if the interval is active
  const [lastSync, setLastSync] = useState<{ time: Date; type: "success" | "error" } | null>(null);

  // State for form inputs and selections
  const [companyToSave, setCompanyToSave] = useState(""); // For the 'Save Company' input
  const [savedCompanies, setSavedCompanies] = useState<string[]>([]); // To populate the dropdown
  const [selectedCompany, setSelectedCompany] = useState<string>(""); // The company the user picks to sync

  // State for the field mapping table
  const [schemaFields, setSchemaFields] = useState<{ name: string; required: boolean }[]>([]);




  // Standard fields for placeholder
  const standardFields = ["Name", "SKU", "Price", "Category", "Brand", "Closing Balance"];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setNotification({ message: "You are not logged in.", type: "error" });
      return;
    }

    // Fetch the schema for the mapping table


    // Fetch the user's previously saved companies for the dropdown
    const fetchCompanies = async () => {
      try {
        const res = await axios.get("http://localhost:4000/admin/get-companies", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.companies && res.data.companies.length > 0) {
          setSavedCompanies(res.data.companies);
          setSelectedCompany(res.data.companies[0]); // Default to the first company
        }
      } catch (error) {
        console.error("Error fetching companies", error);
      }
    }

    fetchCompanies();
  }, []);

  // --- UNIFIED SYNC LOGIC ---
  // A single, robust function to handle sync requests
  const runSync = async () => {
    // Validation: Ensure a company is selected before syncing
    if (!selectedCompany) {
      setNotification({ message: "Please select a company to sync.", type: "error" });
      return;
    }

    setIsSyncing(true);
    setNotification(null); // Clear previous notifications

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:4000/admin/tallysync",
        {
          // ✅ Proper Request Payload
          port: port,
          companyName: selectedCompany, // Send the selected company for validation
          fieldMapping: inputMapping,   // Send the current user-defined mapping
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Handle Success
      setNotification({ message: res.data.message || "Sync completed successfully!", type: "success" });
      setLastSync({ time: new Date(), type: "success" });
    } catch (err: any) {
      // ✅ Improved Error Handling: Display specific error from backend
      const errorMessage = err.response?.data?.message || "An unknown sync error occurred. Check Tally and network.";
      setNotification({ message: errorMessage, type: "error" });
      setLastSync({ time: new Date(), type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  // --- USER CONTROL FUNCTIONS FOR SYNC ---
  const handleStartAutoSync = () => {
    if (isAutoSyncing) return;

    // Run the first sync immediately
    runSync();

    // Start the 5-minute interval
    intervalRef.current = setInterval(runSync, 5 * 60 * 1000);
    setIsAutoSyncing(true);
    setNotification({ message: "Automatic 5-minute sync started.", type: "info" });
  };

  const handleStopAutoSync = () => {
    if (!intervalRef.current) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsAutoSyncing(false);
    setNotification({ message: "Automatic sync stopped.", type: "info" });
  };

  // Cleanup interval when the user navigates away
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);




  // Extract Tally products and fields after sync
  useEffect(() => {
    if (syncResult && syncResult.success && syncResult.details) {
      let products: any[] = [];
      if (Array.isArray(syncResult.details.products)) {
        products = syncResult.details.products;
      } else if (Array.isArray(syncResult.details)) {
        products = syncResult.details;
      } else if (syncResult.details && typeof syncResult.details === 'object') {
        const firstArr = Object.values(syncResult.details).find(v => Array.isArray(v));
        if (Array.isArray(firstArr)) products = firstArr;
      }
      setTallyProducts(products);
      const fields = new Set<string>();
      products.forEach(prod => Object.keys(prod || {}).forEach(f => fields.add(f)));
      setAllFields(Array.from(fields));
      const stdMap: { [key: string]: string } = {};
      ["NAME", "SKU", "RATE", "PARENT", "CATEGORY", "PRICE", "CLOSINGBALANCE"].forEach(std => {
        const match = Array.from(fields).find(f => f.toLowerCase() === std.toLowerCase());
        if (match) stdMap[match] = std.toLowerCase();
      });
      setFieldMapping(stdMap);
    }
  }, [syncResult]);

  useEffect(() => {
    const excludedFields = [
      "created_at",
      "updated_at",
      "image_blob",
      "party_id",
      "product_id",
      "parent_product_id",
      "tally_account",
    ];

    const fetchSchema = async () => {
      try {
        const res = await axios.get("http://localhost:4000/product/schema");
        const extract = (obj: any, source: "product" | "inventory") => {
          return Object.entries(obj)
            .filter(([name]) => !excludedFields.includes(name))
            .map(([name, meta]: any) => ({
              name,
              type: meta.type,
              required: meta.required,
              source,
            }));
        };
        const productFields = extract(res.data.product, "product");
        const inventoryFields = extract(res.data.inventory, "inventory");
        setFields([...productFields, ...inventoryFields]);
        setAllFields(Object.keys(res.data.product).concat(Object.keys(res.data.inventory)));
      } catch (error) {
        console.error("Error fetching schema:", error);
      }
    };
    fetchSchema();
  }, []);


  const handleMappingChange = (platformField: string, tallyValue: string) => {
    setInputMapping(prev => ({
      ...prev,
      [platformField]: tallyValue,
    }));
    setMappingDirty(true);
  };


  // ✅ ONLY RUN ONCE
  useEffect(() => {
    const fetchMapping = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await axios.get("http://localhost:4000/admin/get-tally-mapping", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.fieldMapping) {
          setPreFilledFields(res.data.fieldMapping);
        }
      } catch (err) {
        console.error("Error fetching mapping", err);
      }
    };
    fetchMapping();
  }, []);


  // Save mapping to backend only when Save Mapping is clicked
  const handleSaveMapping = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      if (Object.keys(inputMapping).length === 0) {
        setStatusMessage("Please enter at least one mapping before saving.");
        setStatusType("error");
        return;
      }

      await axios.post(
        "http://localhost:4000/admin/save-tally-mapping",
        { fieldMapping: inputMapping }, // ✅ send user input!
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMappingDirty(false);
      setStatusMessage("Field mapping saved successfully.");
      setNotification({ message: "Mapping saved!", type: "success" });
      setStatusType("success");
    } catch (err: any) {
      console.error(err);
      setStatusType("error");
      if (err.response?.data?.message) {
        setStatusMessage(err.response.data.message);
      } else {
        setStatusMessage("Failed to save mapping. Please try again.");
      }
    }
  };



  // In TallySyncPage.tsx, replace the existing handleCompanySubmit with this:

  // In TallySyncPage.tsx, replace the entire handleCompanySubmit function

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null); // Clear previous notifications

    // Validate input to ensure it's not empty
    if (!companyToSave.trim()) {
      setNotification({ message: "Company name cannot be empty.", type: "error" });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setNotification({ message: "Authentication error. Please log in again.", type: "error" });
      return;
    }

    try {
      const res = await axios.post(
        "http://localhost:4000/admin/save-company",
        { companyName: companyToSave }, // Use the correct state variable
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // ✅ Use the single, unified notification system
      setNotification({ message: res.data.message || "Company saved!", type: "success" });

      // Update the UI instantly
      setSavedCompanies(prev => [...prev, companyToSave]);
      setSelectedCompany(companyToSave); // Set as the current selection
      setCompanyToSave(""); // Clear the input field

    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to save company.";
      // ✅ Use the single, unified notification system for errors
      setNotification({ message, type: "error" });
    }
  };


  // Function to trigger sync (reuse handleSync logic, but without needing a form event)
  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:4000/admin/tallysync",
        {
          port,
          fieldMapping,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      setSyncResult({ success: true, message: "Sync completed successfully!", details: res.data });
      setLastSyncTime(new Date());
      setLastSyncStatus("success");
    } catch (err: any) {
      setSyncResult({ success: false, message: err.response?.data?.message || "Sync failed. Please try again." });
      setLastSyncTime(new Date());
      setLastSyncStatus("error");
    } finally {
      setSyncing(false);
    }
  };

  // Set up the interval on mount, clean up on unmount
  useEffect(() => {
    // Trigger sync immediately on mount
    triggerSync();

    // Set up interval for every 5 minutes
    intervalRef.current = setInterval(triggerSync, 5 * 60 * 1000);

    // Clean up interval on unmount
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Only run on mount/unmount, not on every render
    // eslint-disable-next-line
  }, [port, JSON.stringify(fieldMapping)]);


  useEffect(() => {
    // Run this effect whenever 'notification' changes
    if (notification) {
      // Set a timer to clear the notification after 3 seconds (3000ms)
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);

      // Cleanup: clear the timer if a new notification arrives or the component unmounts
      return () => clearTimeout(timer);
    }
  }, [notification]);


  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white flex flex-col items-center py-0 px-0">
      <AdminNavbar active="tallysync" />
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-4">

        {/* --- Unified Notification Display --- */}
        {/* This single block replaces the old syncResult and status messages */}
        {/* This new version will float on top of the screen */}
        {notification && (
          <div
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg text-sm font-semibold 
              ${notification.type === 'success' ? 'bg-green-600 text-white' :
                notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
              }`}
          >
            {notification.message}
          </div>
        )}

        <h1 className="text-2xl font-bold mb-2 text-gray-900 text-center">Tally Product Sync</h1>
        <p className="text-gray-600 mb-6 text-center max-w-xl mx-auto">
          Configure your Tally connection and field mappings, then choose to sync manually or automatically.
        </p>

        {/* --- Updated Instructions --- */}
        <div className="mb-8 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <svg className="w-8 h-8 text-blue-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" /></svg>
          <div className="text-blue-900 text-sm">
            <span className="font-semibold">How to Use:</span>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Enter your Tally port and select your pre-saved company.</li>
              <li>Click <span className="font-semibold">Sync Now</span> for a single, immediate product sync.</li>
              <li>Click <span className="font-semibold">Start Auto-Sync</span> to begin syncing automatically every 5 minutes. You must keep this page open.</li>
            </ol>
          </div>
        </div>

        {/* --- New Sync Control Panel --- */}
        <div className="w-full flex flex-col sm:flex-row gap-4 mb-8 items-end justify-center p-6 bg-gray-50 rounded-xl border">
          {/* Port Input */}
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tally Port</label>
            <input
              type="text"
              value={port}
              onChange={e => setPort(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none"
              placeholder="9000"
              required
            />
          </div>

          {/* Company Selection Dropdown */}
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Company to Sync</label>
            <select
              value={selectedCompany}
              onChange={e => setSelectedCompany(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-gray-400 focus:border-transparent outline-none"
              required
            >
              <option value="" disabled>-- Select a Company --</option>
              {savedCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Manual Sync Button */}
          <button
            onClick={() => runSync()}
            disabled={isSyncing || isAutoSyncing}
            className="px-6 py-2 rounded-lg bg-gray-800 text-white font-semibold shadow hover:bg-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {/* --- Auto-Sync Controls & Status --- */}
        <div className="text-center border-t pt-8">
          <h2 className="text-xl font-semibold text-gray-800">Automatic Background Sync</h2>
          <p className="text-sm text-gray-600 mb-4">Keeps this page open to sync automatically every 5 minutes.</p>
          {!isAutoSyncing ? (
            <button onClick={handleStartAutoSync} disabled={isSyncing} className="px-8 py-3 rounded-lg bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition disabled:opacity-60 text-lg">
              Start Auto-Sync
            </button>
          ) : (
            <button onClick={handleStopAutoSync} className="px-8 py-3 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition text-lg">
              Stop Auto-Sync
            </button>
          )}
          {/* New Last Sync Status */}
          {lastSync && (
            <p className={`text-sm mt-4 font-medium ${lastSync.type === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
              Last sync attempt at {lastSync.time.toLocaleTimeString()} was a {lastSync.type}.
            </p>
          )}
        </div>
      </div>

      {/* --- KEPT YOUR EXISTING FORMS --- */}
      {/* Save Company Form */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-lg p-8 border border-gray-100 mt-8">
        <h2 className="text-2xl font-bold mb-4 text-center">Add a Tally Company</h2>
        <form onSubmit={handleCompanySubmit} className="max-w-md mx-auto">
          <input
            type="text"
            placeholder="Enter Company Name to Save"
            value={companyToSave}
            onChange={(e) => setCompanyToSave(e.target.value)}
            required
            className="w-full p-3 mb-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition"
          >
            Save Company
          </button>
        </form>
      </div>

      {/* <div className="p-4">
        <h2 className="text-xl font-semibold mb-4">Field Mapping Table</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="px-4 py-2 border">Field Name</th>
                <th className="px-4 py-2 border">Mapped To (Pre-filled)</th>
                <th className="px-4 py-2 border">Tally Field (Your Input)</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{field.name}</td>

                  {/* Mapped To: read-only from preFilledFields 
                  <td className="px-4 py-2 border text-gray-600">
                    {preFilledFields[field.name] || "—"}
                  </td>

                  {/* Editable input box 
                  <td className="px-4 py-2 border">
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded"
                      placeholder="Enter Tally field"
                      value={inputMapping[field.name] || ""}
                      onChange={(e) => handleMappingChange(field.name, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveMapping}
              disabled={!mappingDirty}
              className="px-4 py-2 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Save Mapping
            </button>
          </div>
          {statusMessage && (
            <p className={`mt-3 text-sm ${statusType === "success" ? "text-green-600" : "text-red-600"}`}>
              {statusMessage}
            </p>
          )}
        </div>
      </div> */}

    </div>
  );
}

