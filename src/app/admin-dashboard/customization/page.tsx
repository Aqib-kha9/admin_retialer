'use client';
import AdminNavbar from '../../../components/AdminNavbar';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';


export default function CustomizationPage() {
  const apiurl = process.env.NEXT_PUBLIC_APIURL;
  // Wallpaper/banner state
  const [wallpaperDesktopFile, setWallpaperDesktopFile] = useState<File | null>(null);
  const [wallpaperDesktopUrl, setWallpaperDesktopUrl] = useState('');
  const [wallpaperMobileFile, setWallpaperMobileFile] = useState<File | null>(null);
  const [wallpaperMobileUrl, setWallpaperMobileUrl] = useState('');
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerDesktopUrl, setBannerDesktopUrl] = useState('');
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const [bannerMobileUrl, setBannerMobileUrl] = useState('');

  // Dynamic data
  const [productFields, setProductFields] = useState<string[]>([]);
  const [retailers, setRetailers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  // Field visibility state
  const [fieldVisibility, setFieldVisibility] = useState<{ [retailerId: string]: { [field: string]: string | number | boolean } }>({});

  // Offer state
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [offerType, setOfferType] = useState<'percentage' | 'flat' | 'manual'>('percentage');
  const [offerValue, setOfferValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [offers, setOffers] = useState<any[]>([]);

  // Search state
  const [retailerSearch, setRetailerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Offer additional state
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [applyTo, setApplyTo] = useState<'all' | 'custom'>('all');
  const [targetRetailers, setTargetRetailers] = useState<string[]>([]);

  // Upload message state
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Uploaded wallpapers and banners state
  const [uploadedWallpapersBanners, setUploadedWallpapersBanners] = useState<any[]>([]);

  // Handler to save field visibility
  const [fieldSaveMessage, setFieldSaveMessage] = useState<string | null>(null);
  const [fieldSaveError, setFieldSaveError] = useState<string | null>(null);
  const [changedRetailers, setChangedRetailers] = useState<Set<string>>(new Set());
  const [focusedRetailer, setFocusedRetailer] = useState<string | null>(null);

  // Helper
  function getTallyAccountValue(val: unknown): string {
    if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
      return val.join(',');
    }
    if (typeof val === 'string') {
      return val;
    }
    return '';
  }

  // Handler
  const handleTallyAccountInputChange = (retailerId: string, value: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [retailerId]: {
        ...prev[retailerId],
        tally_account: value
      }
    }));
    setChangedRetailers(prev => new Set(prev).add(retailerId));
  };

  // Fetch schema, products, retailers, offers, uploaded wallpapers/banners, and saved field visibility on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch product fields
        const schemaRes = await axios.get(`${apiurl}/product/schema`);
        const productFieldsArr = Object.keys(schemaRes.data?.product || {});
        const inventoryFieldsArr = Object.keys(schemaRes.data?.inventory || {});
        const allFields = Array.from(new Set([...productFieldsArr, ...inventoryFieldsArr]));
        const excludeFields = [
          'created_at',
          'updated_at',
          'image_blob',
          'party_id',
        ];
        let fields = allFields.filter(f => !excludeFields.includes(f));
        if (!fields.includes('tally_account')) fields.push('tally_account');
        setProductFields(fields);

        // Fetch retailers
        const storedToken = localStorage.getItem('token');
        if (!storedToken) return;
        const decoded: any = jwtDecode(storedToken);
        const retailersRes = await axios.get(`${apiurl}/admin/retailers`, {
          headers: {Authorization: `Bearer ${storedToken}` },
        });
        const retailerList = (retailersRes.data || []).map((r: any) => ({
          id: r.userid || r.retailer_id || r.id || r._id,
          name: r.name || r.retailername || '',
          email: r.email || '',
        }));
        setRetailers(retailerList);

        // Fetch products
        const productsRes = await axios.get(`${apiurl}/product/all`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const productList = (productsRes.data || []).map((p: any) => ({
          id: p.product_id || p.id || p._id,
          name: p.name,
        }));
        setProducts(productList);
        // Fetch offers (for this admin/party)
        const offersRes = await axios.get(`${apiurl}/offer/admin`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        // Map _id to id for frontend 
        setOffers((offersRes.data || []).map((o: any) => ({ ...o, id: o._id })));

        // Fetch saved field visibility for each retailer
        const retailerFieldsRes = await axios.get(`${apiurl}/admin/retailer-fields/all`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const retailerFieldsData = retailerFieldsRes.data || [];
        // Build initial fieldVisibility state
        const initialFieldVisibility: { [retailerId: string]: { [field: string]: string | number | boolean } } = {};
        retailerList.forEach((retailer: any) => {
          const found = retailerFieldsData.find((rf: any) => rf.userid === retailer.id);
          if (found && Array.isArray(found.fields)) {
            initialFieldVisibility[retailer.id] = Object.fromEntries(
              fields.map(f => [f, found.fields.includes(f)])
            );
              // Set tally_account from backend if present
            if (found.tally_account) {
              initialFieldVisibility[retailer.id]['tally_account'] = found.tally_account;
            } else {
              initialFieldVisibility[retailer.id]['tally_account'] = 'all';
            }
          } else {
            // Default: all checked, tally_account = 'all'
            initialFieldVisibility[retailer.id] = Object.fromEntries(fields.map(f => [f, f === 'tally_account' ? 'all' : true]));
          }
        });
        setFieldVisibility(initialFieldVisibility);

        // Fetch uploaded wallpapers and banners
        const uploadedRes = await axios.get(`${apiurl}/admin/wallpaper-banner/all`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setUploadedWallpapersBanners(uploadedRes.data || []);
      } catch (err) {
        // handle error
      }
    };
    fetchData();
  }, []);

  // Filtered retailers and products
  const filteredRetailers = retailers.filter(r =>
    r.name.toLowerCase().includes(retailerSearch.toLowerCase()) ||
    (r.id && r.id.toLowerCase().includes(retailerSearch.toLowerCase()))
  );
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.id && p.id.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Handlers for wallpaper/banner
  const handleWallpaperDesktopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWallpaperDesktopFile(e.target.files[0]);
      setWallpaperDesktopUrl('');
    }
  };
  const handleWallpaperDesktopUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWallpaperDesktopUrl(e.target.value);
    if (e.target.value) setWallpaperDesktopFile(null);
  };
  const handleWallpaperMobileFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWallpaperMobileFile(e.target.files[0]);
      setWallpaperMobileUrl('');
    }
  };
  const handleWallpaperMobileUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWallpaperMobileUrl(e.target.value);
    if (e.target.value) setWallpaperMobileFile(null);
  };
  const handleBannerDesktopFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBannerDesktopFile(e.target.files[0]);
      setBannerDesktopUrl('');
    }
  };
  const handleBannerDesktopUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBannerDesktopUrl(e.target.value);
    if (e.target.value) setBannerDesktopFile(null);
  };
  const handleBannerMobileFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBannerMobileFile(e.target.files[0]);
      setBannerMobileUrl('');
    }
  };
  const handleBannerMobileUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBannerMobileUrl(e.target.value);
    if (e.target.value) setBannerMobileFile(null);
  };

  // Handlers for field visibility
  const handleFieldToggle = (retailerId: string, field: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [retailerId]: {
        ...prev[retailerId],
        [field]: !prev[retailerId][field],
      },
    }));
    setChangedRetailers(prev => {
      const newSet = new Set(prev);
      newSet.add(retailerId);
      return newSet;
    });
  };

  // Handlers for tally_account
  const handleTallyAccountChange = (retailerId: string, value: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [retailerId]: {
        ...prev[retailerId],
        tally_account: value,
        tally_account_number: value === 'all' ? '' : prev[retailerId]?.tally_account_number ?? ''
      }
    }));
    setChangedRetailers(prev => new Set(prev).add(retailerId));
  };
  const handleTallyAccountNumberChange = (retailerId: string, value: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [retailerId]: {
        ...prev[retailerId],
        tally_account_number: value
      }
    }));
    setChangedRetailers(prev => new Set(prev).add(retailerId));
  };

  // Handlers for offer
  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => prev.includes(productId)
      ? prev.filter(id => id !== productId)
      : [...prev, productId]);
  };

  // Handler to apply offer
  const handleApplyOffer = async () => {
    if (!offerValue || selectedProducts.length === 0 || !validFrom || !validTo || !offerTitle) return;
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    const decoded: any = jwtDecode(storedToken);
    const partyid = decoded.partyid;
    try {
      const newOffers: any[] = [];
      for (const pid of selectedProducts) {
        const payload = {
          product_id: pid,
          party_id: partyid,
          title: offerTitle,
          description: offerDescription,
          offer_type: offerType,
          offer_value: Number(offerValue),
          apply_to: applyTo,
          target_retailers: applyTo === 'custom' ? targetRetailers : undefined,
          valid_from: validFrom,
          valid_to: validTo,
        };
        const res = await axios.post(`${apiurl}/offer`, payload, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        newOffers.push({ ...res.data, id: res.data._id });
      }
      setOffers(prev => [...prev, ...newOffers]);
      setSelectedProducts([]);
      setOfferValue('');
      setOfferTitle('');
      setOfferDescription('');
      setValidFrom('');
      setValidTo('');
      setApplyTo('all');
      setTargetRetailers([]);
    } catch (err) {
      // handle error
    }
  };

  // Handler to remove offer
  const handleRemoveOffer = async (offerId: string) => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    try {
      await axios.delete(`${apiurl}/offer/${offerId}`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      setOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (err) {
      // handle error
    }
  };

  // Handler to upload wallpapers and banners
  const handleWallpaperBannerUpload = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setUploadMessage(null);
    setUploadError(null);

    const results: string[] = [];
    const errors: string[] = [];

    // Helper to upload one field (file or url)
    const uploadOne = async (type: 'wallpaper' | 'banner', device: 'desktop' | 'mobile', file: File | null, url: string) => {
      if (!file && !url) return;
      const formData = new FormData();
      formData.append('type', type);
      formData.append('device', device);
      if (file) formData.append('file', file);
      else if (url) formData.append('url', url);
      try {
        await axios.post(`${apiurl}/admin/upload-wallpaper-banner`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        results.push(`${type} (${device}) uploaded successfully`);
      } catch (err: any) {
        errors.push(`${type} (${device}): ${err?.response?.data?.message || 'Failed to upload.'}`);
      }
    };

    await Promise.all([
      uploadOne('wallpaper', 'desktop', wallpaperDesktopFile, wallpaperDesktopUrl),
      uploadOne('wallpaper', 'mobile', wallpaperMobileFile, wallpaperMobileUrl),
      uploadOne('banner', 'desktop', bannerDesktopFile, bannerDesktopUrl),
      uploadOne('banner', 'mobile', bannerMobileFile, bannerMobileUrl),
    ]);

    // Refresh uploaded wallpapers/banners after upload
    const uploadedRes = await axios.get(`${apiurl}/admin/wallpaper-banner/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUploadedWallpapersBanners(uploadedRes.data || []);

    if (results.length > 0) setUploadMessage(results.join(' | '));
    if (errors.length > 0) setUploadError(errors.join(' | '));
  };

  // Handler to remove wallpaper/banner
  const handleRemoveWallpaperBanner = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setUploadMessage(null);
    setUploadError(null);
    try {
      await axios.delete(`${apiurl}/admin/wallpaper-banner/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedWallpapersBanners(prev => prev.filter(item => item._id !== id));
      setUploadMessage('Wallpaper or banner deleted successfully.');
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Failed to delete wallpaper or banner.');
    }
  };

  // Utility for black file input
  const BlackFileInput = ({ id, onChange, disabled, label }: { id: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, disabled: boolean, label: string }) => (
    <label htmlFor={id} className={`inline-block px-4 py-2 bg-black text-white rounded cursor-pointer font-semibold text-sm transition hover:bg-gray-900 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} style={{ marginBottom: 0 }}>
      {label}
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={onChange}
        disabled={disabled}
        style={{ display: 'none' }}
      />
    </label>
  );

  // Handler to save field visibility
  const handleSaveFieldVisibility = async () => {
    setFieldSaveMessage(null);
    setFieldSaveError(null);
    const token = localStorage.getItem('token');
    if (!token) return;

    // Only send changed retailers
    const changedFieldVisibility: { [retailerId: string]: { [field: string]: string | number | boolean } } = {};
    changedRetailers.forEach(retailerId => {
      changedFieldVisibility[retailerId] = fieldVisibility[retailerId];
    });

    if (Object.keys(changedFieldVisibility).length === 0) {
      setFieldSaveMessage('No changes to save.');
      return;
    }

    try {
      await axios.post(
        `${apiurl}/admin/retailer-fields`,
        { fieldVisibility: changedFieldVisibility },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFieldSaveMessage('Field visibility saved successfully!');
      setChangedRetailers(new Set()); // Reset after save
    } catch (err: any) {
      setFieldSaveError(err?.response?.data?.message || 'Failed to save field visibility.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar active="customization" />
      <div className="max-w-5xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-8">Customization</h1>
        {/* Wallpaper & Banner */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Wallpaper & Banner</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Wallpaper Desktop */}
            <div>
              <label className="block font-medium mb-2">Wallpaper (Desktop)</label>
              <BlackFileInput id="wallpaper-desktop" onChange={handleWallpaperDesktopFile} disabled={!!wallpaperDesktopUrl} label="Choose File" />
              <label className="block font-medium mt-2 mb-2">Or Wallpaper Image URL (Desktop)</label>
              <input type="text" className="w-full border rounded px-2 py-1" placeholder="https://..." value={wallpaperDesktopUrl} onChange={handleWallpaperDesktopUrl} disabled={!!wallpaperDesktopFile} />
              {wallpaperDesktopFile && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                  Selected file: {wallpaperDesktopFile.name}
                  <button
                    type="button"
                    className="ml-1 text-red-500 hover:text-red-700 text-lg font-bold focus:outline-none"
                    onClick={() => setWallpaperDesktopFile(null)}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              {wallpaperDesktopUrl && <div className="text-xs text-blue-600 mt-1">URL: {wallpaperDesktopUrl}</div>}
            </div>
            {/* Wallpaper Mobile */}
            <div>
              <label className="block font-medium mb-2">Wallpaper (Mobile)</label>
              <BlackFileInput id="wallpaper-mobile" onChange={handleWallpaperMobileFile} disabled={!!wallpaperMobileUrl} label="Choose File" />
              <label className="block font-medium mt-2 mb-2">Or Wallpaper Image URL (Mobile)</label>
              <input type="text" className="w-full border rounded px-2 py-1" placeholder="https://..." value={wallpaperMobileUrl} onChange={handleWallpaperMobileUrl} disabled={!!wallpaperMobileFile} />
              {wallpaperMobileFile && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                  Selected file: {wallpaperMobileFile.name}
                  <button
                    type="button"
                    className="ml-1 text-red-500 hover:text-red-700 text-lg font-bold focus:outline-none"
                    onClick={() => setWallpaperMobileFile(null)}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              {wallpaperMobileUrl && <div className="text-xs text-blue-600 mt-1">URL: {wallpaperMobileUrl}</div>}
            </div>
            {/* Banner Desktop */}
            <div>
              <label className="block font-medium mb-2">Banner (Desktop)</label>
              <BlackFileInput id="banner-desktop" onChange={handleBannerDesktopFile} disabled={!!bannerDesktopUrl} label="Choose File" />
              <label className="block font-medium mt-2 mb-2">Or Banner Image URL (Desktop)</label>
              <input type="text" className="w-full border rounded px-2 py-1" placeholder="https://..." value={bannerDesktopUrl} onChange={handleBannerDesktopUrl} disabled={!!bannerDesktopFile} />
              {bannerDesktopFile && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                  Selected file: {bannerDesktopFile.name}
                  <button
                    type="button"
                    className="ml-1 text-red-500 hover:text-red-700 text-lg font-bold focus:outline-none"
                    onClick={() => setBannerDesktopFile(null)}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              {bannerDesktopUrl && <div className="text-xs text-blue-600 mt-1">URL: {bannerDesktopUrl}</div>}
            </div>
            {/* Banner Mobile */}
            <div>
              <label className="block font-medium mb-2">Banner (Mobile)</label>
              <BlackFileInput id="banner-mobile" onChange={handleBannerMobileFile} disabled={!!bannerMobileUrl} label="Choose File" />
              <label className="block font-medium mt-2 mb-2">Or Banner Image URL (Mobile)</label>
              <input type="text" className="w-full border rounded px-2 py-1" placeholder="https://..." value={bannerMobileUrl} onChange={handleBannerMobileUrl} disabled={!!bannerMobileFile} />
              {bannerMobileFile && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                  Selected file: {bannerMobileFile.name}
                  <button
                    type="button"
                    className="ml-1 text-red-500 hover:text-red-700 text-lg font-bold focus:outline-none"
                    onClick={() => setBannerMobileFile(null)}
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                </div>
              )}
              {bannerMobileUrl && <div className="text-xs text-blue-600 mt-1">URL: {bannerMobileUrl}</div>}
            </div>
          </div>
          {uploadMessage && (
            <div className="mt-4 mb-2 px-4 py-2 bg-green-600 text-white rounded text-center font-semibold shadow">{uploadMessage}</div>
          )}
          {uploadError && (
            <div className="mt-4 mb-2 px-4 py-2 bg-red-600 text-white rounded text-center font-semibold shadow">{uploadError}</div>
          )}
          <button
            className="mt-4 px-6 py-2 bg-black text-white rounded hover:bg-gray-900 font-semibold"
            onClick={handleWallpaperBannerUpload}
          >
            Save Wallpapers & Banners
          </button>
          {/* Uploaded Wallpapers & Banners */}
          {uploadedWallpapersBanners.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-2">Uploaded Wallpapers & Banners</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {uploadedWallpapersBanners.map(item => (
                  <div key={item._id} className="bg-gray-100 rounded-lg p-4 flex flex-col items-center shadow">
                    <img
                      src={item.url?.startsWith('/uploads/') ? apiurl + item.url : item.url}
                      alt={`${item.type} ${item.device}`}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                    <div className="text-sm font-medium mb-1 capitalize">{item.type} ({item.device})</div>
                    <button
                      className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                      onClick={() => handleRemoveWallpaperBanner(item._id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Field Visibility */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Product Field Visibility per Retailer</h2>
          <div className="mb-4">
            <input
              type="text"
              className="w-full border rounded px-2 py-1"
              placeholder="Search retailers by name or ID..."
              value={retailerSearch}
              onChange={e => setRetailerSearch(e.target.value)}
            />
          </div>
          <div
            className="overflow-x-auto custom-scrollbar"
            style={{ maxHeight: 400 }}
          >
            <table className="min-w-full border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">Retailer Name</th>
                  <th className="border px-2 py-1">User ID</th>
                  {productFields.map(field => (
                    <th key={field} className="border px-2 py-1 text-xs">{field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRetailers.map(retailer => (
                  <tr key={retailer.id}>
                    <td className="border px-2 py-1 font-medium">{retailer.name || retailer.email || 'Retailer'}</td>
                    <td className="border px-2 py-1 text-xs text-gray-500">{retailer.id}</td>
                    {productFields.map(field => (
                      <td key={field} className="border px-2 py-1 text-center">
                        {field === 'tally_account' ? (
                          <>
                            {getTallyAccountValue(fieldVisibility[retailer.id]?.[field]) === 'all' && focusedRetailer !== retailer.id && (
                              <div className="text-xs text-gray-500 mb-1">Default: all</div>
                            )}
                            <input
                              type="text"
                              value={getTallyAccountValue(fieldVisibility[retailer.id]?.[field])}
                              onFocus={() => setFocusedRetailer(retailer.id)}
                              onBlur={e => {
                                setFocusedRetailer(null);
                                if (e.target.value.trim() === '') {
                                  handleTallyAccountInputChange(retailer.id, 'all');
                                }
                              }}
                              onChange={e => {
                                const filtered = e.target.value.replace(/[^0-9,]/g, '');
                                handleTallyAccountInputChange(retailer.id, filtered);
                              }}
                              className="border rounded px-2 py-1 w-40"
                              placeholder="all or 2,3,4"
                            />
                          </>
                        ) : (
                          <input
                            type="checkbox"
                            className="scale-125"
                            checked={Boolean(fieldVisibility[retailer.id]?.[field] ?? true)}
                            onChange={() => handleFieldToggle(retailer.id, field)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="mt-4 px-6 py-2 bg-black text-white rounded hover:bg-gray-900 font-semibold"
            onClick={handleSaveFieldVisibility}
          >
            Save Field Visibility
          </button>
          {fieldSaveMessage && (
            <div className="mt-2 px-4 py-2 bg-green-600 text-white rounded text-center font-semibold shadow">{fieldSaveMessage}</div>
          )}
          {fieldSaveError && (
            <div className="mt-2 px-4 py-2 bg-red-600 text-white rounded text-center font-semibold shadow">{fieldSaveError}</div>
          )}
        </div>
        {/* Product Offers */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Apply Offer to Products</h2>
          <div className="mb-4">
            <input
              type="text"
              className="w-full border rounded px-2 py-1 mb-2"
              placeholder="Search products by name or ID..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            <label className="block font-medium mb-2">Select Products</label>
            <div className="flex flex-col gap-2">
              {filteredProducts.map(product => (
                <label key={product.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="scale-125"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleProductSelect(product.id)}
                  />
                  {product.name} <span className="text-xs text-gray-500">({product.id})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block font-medium mb-2">Title</label>
              <input
                type="text"
                className="border rounded px-2 py-1 w-full"
                value={offerTitle}
                onChange={e => setOfferTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Description</label>
              <textarea
                className="border rounded px-2 py-1 w-full"
                value={offerDescription}
                onChange={e => setOfferDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Offer Type</label>
              <select
                className="border rounded px-2 py-1"
                value={offerType}
                onChange={e => setOfferType(e.target.value as 'percentage' | 'flat' | 'manual')}
              >
                <option value="percentage">Percentage Off (%)</option>
                <option value="flat">Flat Off (₹)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-2">Offer Value</label>
              <input
                type="number"
                className="border rounded px-2 py-1"
                value={offerValue}
                onChange={e => setOfferValue(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Apply To</label>
              <select
                className="border rounded px-2 py-1"
                value={applyTo}
                onChange={e => setApplyTo(e.target.value as 'all' | 'custom')}
              >
                <option value="all">All Retailers</option>
                <option value="custom">Custom Retailers</option>
              </select>
            </div>
            {applyTo === 'custom' && (
              <div>
                <label className="block font-medium mb-2">Target Retailers</label>
                <select
                  multiple
                  className="border rounded px-2 py-1 w-full"
                  value={targetRetailers}
                  onChange={e => setTargetRetailers(Array.from(e.target.selectedOptions, option => option.value))}
                >
                  {retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.id})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-medium mb-2">Valid From</label>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={validFrom}
                onChange={e => setValidFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Valid To</label>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={validTo}
                onChange={e => setValidTo(e.target.value)}
                required
              />
            </div>
            <button
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleApplyOffer}
            >
              Apply Offer
            </button>
          </div>
          {/* Show current offers */}
          <div className="mt-8">
            <h3 className="font-semibold mb-2">Current Offers</h3>
            {offers.length === 0 ? (
              <div className="text-gray-500">No offers applied.</div>
            ) : (
              <table className="min-w-full border text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1">Product</th>
                    <th className="border px-2 py-1">Type</th>
                    <th className="border px-2 py-1">Value</th>
                    <th className="border px-2 py-1">Valid From</th>
                    <th className="border px-2 py-1">Valid To</th>
                    <th className="border px-2 py-1">Retailers</th>
                    <th className="border px-2 py-1">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map(offer => (
                    <tr key={offer.id}>
                      <td className="border px-2 py-1">{products.find(p => p.id === offer.product_id)?.name || offer.product_id}</td>
                      <td className="border px-2 py-1">
                        {offer.offer_type === 'percentage'
                          ? 'Percentage'
                          : offer.offer_type === 'flat'
                          ? 'Flat'
                          : 'Manual'}
                      </td>
                      <td className="border px-2 py-1">
                        {offer.offer_type === 'percentage'
                          ? `${offer.offer_value}%`
                          : offer.offer_type === 'flat'
                          ? `₹${offer.offer_value}`
                          : offer.offer_value}
                      </td>
                      <td className="border px-2 py-1">{offer.valid_from ? offer.valid_from.slice(0, 10) : ''}</td>
                      <td className="border px-2 py-1">{offer.valid_to ? offer.valid_to.slice(0, 10) : ''}</td>
                      <td className="border px-2 py-1">
                        {offer.apply_to === 'all'
                          ? 'All Retailers'
                          : Array.isArray(offer.target_retailers) && offer.target_retailers.length > 0
                            ? offer.target_retailers.map((rid: string) => {
                                const retailer = retailers.find(r => r.id === rid);
                                return retailer
                                  ? (retailer.name ? retailer.name : retailer.email ? retailer.email : rid)
                                  : rid;
                              }).join(', ')
                            : 'None'}
                      </td>
                      <td className="border px-2 py-1">
                        <button
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          onClick={() => handleRemoveOffer(offer.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 