'use client';
import AdminNavbar from '../../../components/AdminNavbar';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

export default function CustomizationPage() {
  const apiurl = process.env.NEXT_PUBLIC_APIURL;
  
  // Wallpaper state
  const [wallpaperDesktopFile, setWallpaperDesktopFile] = useState<File | null>(null);
  const [wallpaperDesktopUrl, setWallpaperDesktopUrl] = useState('');
  const [wallpaperMobileFile, setWallpaperMobileFile] = useState<File | null>(null);
  const [wallpaperMobileUrl, setWallpaperMobileUrl] = useState('');

  // Banner state
  const [bannerDesktopFile, setBannerDesktopFile] = useState<File | null>(null);
  const [bannerDesktopUrl, setBannerDesktopUrl] = useState('');
  const [bannerDesktopTopText, setBannerDesktopTopText] = useState('');
  const [bannerMobileFile, setBannerMobileFile] = useState<File | null>(null);
  const [bannerMobileUrl, setBannerMobileUrl] = useState('');
  const [bannerMobileTopText, setBannerMobileTopText] = useState('');

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
  const [uploadedWallpapers, setUploadedWallpapers] = useState<any[]>([]);
  const [uploadedBanners, setUploadedBanners] = useState<any[]>([]);

  // Loading states
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [fieldVisibilityLoading, setFieldVisibilityLoading] = useState(false);
  const [offerLoading, setOfferLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Handler to save field visibility
  const [fieldSaveMessage, setFieldSaveMessage] = useState<string | null>(null);
  const [fieldSaveError, setFieldSaveError] = useState<string | null>(null);
  const [changedRetailers, setChangedRetailers] = useState<Set<string>>(new Set());
  const [focusedRetailer, setFocusedRetailer] = useState<string | null>(null);

  // Helper functions
  function getTallyAccountValue(val: unknown): string {
    if (Array.isArray(val) && val.every(v => typeof v === 'string')) {
      return val.join(',');
    }
    if (typeof val === 'string') {
      return val;
    }
    return '';
  }

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

  // Fetch all data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) return;

        // Fetch product fields
        const schemaRes = await axios.get(`${apiurl}/product/schema`);
        const productFieldsArr = Object.keys(schemaRes.data?.product || {});
        const inventoryFieldsArr = Object.keys(schemaRes.data?.inventory || {});
        const allFields = Array.from(new Set([...productFieldsArr, ...inventoryFieldsArr]));
        const excludeFields = ['created_at', 'updated_at', 'image_blob', 'party_id'];
        let fields = allFields.filter(f => !excludeFields.includes(f));
        if (!fields.includes('tally_account')) fields.push('tally_account');
        setProductFields(fields);

        // Fetch retailers
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
        
        // Fetch offers
        const offersRes = await axios.get(`${apiurl}/offer/admin`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        setOffers((offersRes.data || []).map((o: any) => ({ ...o, id: o._id })));

        // Fetch saved field visibility
        const retailerFieldsRes = await axios.get(`${apiurl}/admin/retailer-fields/all`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const retailerFieldsData = retailerFieldsRes.data || [];
        const initialFieldVisibility: { [retailerId: string]: { [field: string]: string | number | boolean } } = {};
        retailerList.forEach((retailer: any) => {
          const found = retailerFieldsData.find((rf: any) => rf.userid === retailer.id);
          if (found && Array.isArray(found.fields)) {
            initialFieldVisibility[retailer.id] = Object.fromEntries(
              fields.map(f => [f, found.fields.includes(f)])
            );
            if (found.tally_account) {
              initialFieldVisibility[retailer.id]['tally_account'] = found.tally_account;
            } else {
              initialFieldVisibility[retailer.id]['tally_account'] = 'all';
            }
          } else {
            initialFieldVisibility[retailer.id] = Object.fromEntries(fields.map(f => [f, f === 'tally_account' ? 'all' : true]));
          }
        });
        setFieldVisibility(initialFieldVisibility);

        // Fetch uploaded wallpapers and banners
        await Promise.all([
          fetchWallpapers(storedToken),
          fetchBanners(storedToken)
        ]);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, []);

  // Separate fetch functions for better reusability
  const fetchWallpapers = async (token: string) => {
    try {
      const wallpapersRes = await axios.get(`${apiurl}/admin/wallpaper/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedWallpapers(wallpapersRes.data || []);
    } catch (err) {
      console.log('No wallpapers found');
    }
  };

  const fetchBanners = async (token: string) => {
    try {
      const bannersRes = await axios.get(`${apiurl}/banner/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedBanners(bannersRes.data || []);
    } catch (err) {
      console.log('No banners found');
    }
  };

  // Filtered retailers and products
  const filteredRetailers = retailers.filter(r =>
    r.name.toLowerCase().includes(retailerSearch.toLowerCase()) ||
    (r.id && r.id.toLowerCase().includes(retailerSearch.toLowerCase()))
  );
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.id && p.id.toLowerCase().includes(productSearch.toLowerCase()))
  );

  // Handlers for wallpaper
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

  // Handlers for banner
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

  // Handlers for offer
  const handleProductSelect = (productId: string) => {
    setSelectedProducts(prev => prev.includes(productId)
      ? prev.filter(id => id !== productId)
      : [...prev, productId]);
  };

  // Handler to apply offer
  const handleApplyOffer = async () => {
    if (!offerValue || selectedProducts.length === 0 || !validFrom || !validTo || !offerTitle) {
      setUploadError('Please fill all required fields for the offer');
      return;
    }

    setOfferLoading(true);
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    
    try {
      const decoded: any = jwtDecode(storedToken);
      const partyid = decoded.partyid;
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
      setUploadMessage('Offer applied successfully to selected products!');
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Failed to apply offer. Please try again.');
    } finally {
      setOfferLoading(false);
    }
  };

  // Handler to remove offer
  const handleRemoveOffer = async (offerId: string) => {
    setDeleteLoading(offerId);
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;
    
    try {
      await axios.delete(`${apiurl}/offer/${offerId}`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      setOffers(prev => prev.filter(o => o.id !== offerId));
      setUploadMessage('Offer removed successfully');
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Failed to remove offer');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Handler to upload wallpapers
  const handleWallpaperUpload = async () => {
    setWallpaperLoading(true);
    setUploadMessage(null);
    setUploadError(null);
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const results: string[] = [];
    const errors: string[] = [];

    const uploadOneWallpaper = async (device: 'desktop' | 'mobile', file: File | null, url: string) => {
      if (!file && !url) return;
      const formData = new FormData();
      formData.append('type', 'wallpaper');
      formData.append('device', device);
      if (file) formData.append('file', file);
      else if (url) formData.append('url', url);
      
      try {
        await axios.post(`${apiurl}/admin/wallpaper/upload-wallpaper`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        results.push(`Wallpaper (${device}) uploaded successfully`);
      } catch (err: any) {
        errors.push(`Wallpaper (${device}): ${err?.response?.data?.message || 'Upload failed'}`);
      }
    };

    try {
      await Promise.all([
        uploadOneWallpaper('desktop', wallpaperDesktopFile, wallpaperDesktopUrl),
        uploadOneWallpaper('mobile', wallpaperMobileFile, wallpaperMobileUrl),
      ]);

      await fetchWallpapers(token);

      // Clear form on success
      if (errors.length === 0) {
        setWallpaperDesktopFile(null);
        setWallpaperDesktopUrl('');
        setWallpaperMobileFile(null);
        setWallpaperMobileUrl('');
      }

      if (results.length > 0) setUploadMessage(results.join(' | '));
      if (errors.length > 0) setUploadError(errors.join(' | '));
    } catch (err) {
      setUploadError('Failed to upload wallpapers. Please try again.');
    } finally {
      setWallpaperLoading(false);
    }
  };

  // Handler to upload banners
  const handleBannerUpload = async () => {
    setBannerLoading(true);
    setUploadMessage(null);
    setUploadError(null);
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const results: string[] = [];
    const errors: string[] = [];

    const uploadOneBanner = async (device: 'desktop' | 'mobile', file: File | null, url: string, topText: string) => {
      if (!file && !url) return;
      
      const formData = new FormData();
      formData.append('device', device);
      formData.append('topText', topText);
      
      if (file) {
        formData.append('file', file);
      } else if (url) {
        formData.append('url', url);
      }
      
      try {
        const response = await axios.post(`${apiurl}/banner/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.data.success) {
          results.push(`Banner (${device}) uploaded successfully`);
        } else {
          throw new Error(response.data.message || 'Upload failed');
        }
      } catch (err: any) {
        errors.push(`Banner (${device}): ${err?.response?.data?.message || 'Upload failed'}`);
      }
    };

    try {
      if (bannerDesktopFile || bannerDesktopUrl) {
        await uploadOneBanner('desktop', bannerDesktopFile, bannerDesktopUrl, bannerDesktopTopText);
      }
      
      if (bannerMobileFile || bannerMobileUrl) {
        await uploadOneBanner('mobile', bannerMobileFile, bannerMobileUrl, bannerMobileTopText);
      }

      await fetchBanners(token);

      // Clear form on success
      if (errors.length === 0) {
        setBannerDesktopFile(null);
        setBannerDesktopUrl('');
        setBannerDesktopTopText('');
        setBannerMobileFile(null);
        setBannerMobileUrl('');
        setBannerMobileTopText('');
      }

      if (results.length > 0) setUploadMessage(results.join(' | '));
      if (errors.length > 0) setUploadError(errors.join(' | '));
    } catch (err) {
      setUploadError('Failed to upload banners. Please try again.');
    } finally {
      setBannerLoading(false);
    }
  };

  // Handler to remove wallpaper
  const handleRemoveWallpaper = async (id: string) => {
    setDeleteLoading(`wallpaper-${id}`);
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      await axios.delete(`${apiurl}/admin/wallpaper/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedWallpapers(prev => prev.filter(item => item._id !== id));
      setUploadMessage('Wallpaper deleted successfully');
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Failed to delete wallpaper');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Handler to remove banner
  const handleRemoveBanner = async (id: string) => {
    setDeleteLoading(`banner-${id}`);
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      await axios.delete(`${apiurl}/banner/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedBanners(prev => prev.filter(item => item._id !== id));
      setUploadMessage('Banner deleted successfully');
    } catch (err: any) {
      setUploadError(err?.response?.data?.message || 'Failed to delete banner');
    } finally {
      setDeleteLoading(null);
    }
  };

  // Utility for black file input
  const BlackFileInput = ({ id, onChange, disabled, label }: { id: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, disabled: boolean, label: string }) => (
    <label htmlFor={id} className={`inline-block px-4 py-2 bg-black text-white rounded cursor-pointer font-semibold text-sm transition hover:bg-gray-900 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {label}
      <input
        id={id}
        type="file"
        accept="image/*"
        onChange={onChange}
        disabled={disabled}
        className="hidden"
      />
    </label>
  );

  // Handler to save field visibility
  const handleSaveFieldVisibility = async () => {
    setFieldVisibilityLoading(true);
    setFieldSaveMessage(null);
    setFieldSaveError(null);
    
    const token = localStorage.getItem('token');
    if (!token) return;

    const changedFieldVisibility: { [retailerId: string]: { [field: string]: string | number | boolean } } = {};
    changedRetailers.forEach(retailerId => {
      changedFieldVisibility[retailerId] = fieldVisibility[retailerId];
    });

    if (Object.keys(changedFieldVisibility).length === 0) {
      setFieldSaveMessage('No changes to save');
      setFieldVisibilityLoading(false);
      return;
    }

    try {
      await axios.post(
        `${apiurl}/admin/retailer-fields`,
        { fieldVisibility: changedFieldVisibility },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFieldSaveMessage('Field visibility settings saved successfully!');
      setChangedRetailers(new Set());
    } catch (err: any) {
      setFieldSaveError(err?.response?.data?.message || 'Failed to save field visibility');
    } finally {
      setFieldVisibilityLoading(false);
    }
  };

  // Loading spinner component
  const LoadingSpinner = () => (
    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar active="customization" />
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customization Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">Manage wallpapers, banners, field visibility, and product offers</p>
        </div>

        {/* Messages */}
        {uploadMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{uploadMessage}</p>
              </div>
            </div>
          </div>
        )}

        {uploadError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{uploadError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Wallpaper Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Wallpaper Settings</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {uploadedWallpapers.length} Uploaded
              </span>
            </div>

            <div className="space-y-6">
              {/* Desktop Wallpaper */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Desktop Wallpaper</label>
                <div className="flex gap-3">
                  <BlackFileInput 
                    id="wallpaper-desktop" 
                    onChange={handleWallpaperDesktopFile} 
                    disabled={!!wallpaperDesktopUrl} 
                    label="Choose File" 
                  />
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Or enter image URL..." 
                      value={wallpaperDesktopUrl} 
                      onChange={handleWallpaperDesktopUrl} 
                      disabled={!!wallpaperDesktopFile} 
                    />
                  </div>
                </div>
                {wallpaperDesktopFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Selected: {wallpaperDesktopFile.name}</span>
                    <button
                      onClick={() => setWallpaperDesktopFile(null)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Wallpaper */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Mobile Wallpaper</label>
                <div className="flex gap-3">
                  <BlackFileInput 
                    id="wallpaper-mobile" 
                    onChange={handleWallpaperMobileFile} 
                    disabled={!!wallpaperMobileUrl} 
                    label="Choose File" 
                  />
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="Or enter image URL..." 
                      value={wallpaperMobileUrl} 
                      onChange={handleWallpaperMobileUrl} 
                      disabled={!!wallpaperMobileFile} 
                    />
                  </div>
                </div>
                {wallpaperMobileFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Selected: {wallpaperMobileFile.name}</span>
                    <button
                      onClick={() => setWallpaperMobileFile(null)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleWallpaperUpload}
                disabled={wallpaperLoading || (!wallpaperDesktopFile && !wallpaperDesktopUrl && !wallpaperMobileFile && !wallpaperMobileUrl)}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {wallpaperLoading ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner />
                    <span className="ml-2">Uploading Wallpapers...</span>
                  </span>
                ) : (
                  'Save Wallpapers'
                )}
              </button>
            </div>

            {/* Uploaded Wallpapers */}
            {uploadedWallpapers.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Wallpapers</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {uploadedWallpapers.map(item => (
                    <div key={item._id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <img
                        src={item.url?.startsWith('/') ? `${apiurl}${item.url}` : item.url}
                        alt={`${item.type} ${item.device}`}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 capitalize">{item.device} Wallpaper</div>
                          <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveWallpaper(item._id)}
                          disabled={deleteLoading === `wallpaper-${item._id}`}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                          {deleteLoading === `wallpaper-${item._id}` ? <LoadingSpinner /> : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Banner Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Banner Settings</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                {uploadedBanners.length} Uploaded
              </span>
            </div>

            <div className="space-y-6">
              {/* Desktop Banner */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Desktop Banner</label>
                <div className="flex gap-3">
                  <BlackFileInput 
                    id="banner-desktop" 
                    onChange={handleBannerDesktopFile} 
                    disabled={!!bannerDesktopUrl} 
                    label="Choose File" 
                  />
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      placeholder="Or enter image URL..." 
                      value={bannerDesktopUrl} 
                      onChange={handleBannerDesktopUrl} 
                      disabled={!!bannerDesktopFile} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Top Text</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    placeholder="e.g., Diwali Sale - 50% Off!" 
                    value={bannerDesktopTopText} 
                    onChange={e => setBannerDesktopTopText(e.target.value)} 
                  />
                  <p className="mt-1 text-xs text-gray-500">This text will appear on top of the banner</p>
                </div>
                {bannerDesktopFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Selected: {bannerDesktopFile.name}</span>
                    <button
                      onClick={() => setBannerDesktopFile(null)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Banner */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Mobile Banner</label>
                <div className="flex gap-3">
                  <BlackFileInput 
                    id="banner-mobile" 
                    onChange={handleBannerMobileFile} 
                    disabled={!!bannerMobileUrl} 
                    label="Choose File" 
                  />
                  <div className="flex-1">
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                      placeholder="Or enter image URL..." 
                      value={bannerMobileUrl} 
                      onChange={handleBannerMobileUrl} 
                      disabled={!!bannerMobileFile} 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Top Text</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                    placeholder="e.g., Diwali Sale - 50% Off!" 
                    value={bannerMobileTopText} 
                    onChange={e => setBannerMobileTopText(e.target.value)} 
                  />
                  <p className="mt-1 text-xs text-gray-500">This text will appear on top of the banner</p>
                </div>
                {bannerMobileFile && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm text-green-700">Selected: {bannerMobileFile.name}</span>
                    <button
                      onClick={() => setBannerMobileFile(null)}
                      className="text-red-500 hover:text-red-700 text-lg font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleBannerUpload}
                disabled={bannerLoading || (!bannerDesktopFile && !bannerDesktopUrl && !bannerMobileFile && !bannerMobileUrl)}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bannerLoading ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner />
                    <span className="ml-2">Uploading Banners...</span>
                  </span>
                ) : (
                  'Save Banners with Text'
                )}
              </button>
            </div>

            {/* Uploaded Banners */}
            {uploadedBanners.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Banners</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {uploadedBanners.map(item => (
                    <div key={item._id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="relative w-full h-32 mb-3">
                        <img
                          src={item.url}
                          alt={`Banner ${item.device}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        {item.topText && (
                          <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-70 text-white text-center py-1 px-2 text-sm font-semibold">
                            {item.topText}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 capitalize">{item.device} Banner</div>
                          {item.topText && (
                            <div className="text-xs text-gray-600">Text: "{item.topText}"</div>
                          )}
                          <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveBanner(item._id)}
                          disabled={deleteLoading === `banner-${item._id}`}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                          {deleteLoading === `banner-${item._id}` ? <LoadingSpinner /> : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Field Visibility Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Product Field Visibility</h2>
              <p className="mt-1 text-sm text-gray-600">Control which product fields are visible to each retailer</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {retailers.length} Retailers
            </span>
          </div>

          <div className="mb-4">
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Search retailers by name or ID..."
              value={retailerSearch}
              onChange={e => setRetailerSearch(e.target.value)}
            />
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retailer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                    {productFields.map(field => (
                      <th key={field} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="transform -rotate-45 origin-center whitespace-nowrap">
                          {field.replace(/_/g, ' ')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRetailers.map(retailer => (
                    <tr key={retailer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {retailer.name || retailer.email || 'Retailer'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {retailer.id}
                      </td>
                      {productFields.map(field => (
                        <td key={field} className="px-2 py-3 whitespace-nowrap text-center">
                          {field === 'tally_account' ? (
                            <div className="flex justify-center">
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
                                className="w-32 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                placeholder="all or 2,3,4"
                              />
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
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
          </div>

          {filteredRetailers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No retailers found matching your search
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSaveFieldVisibility}
                disabled={fieldVisibilityLoading || changedRetailers.size === 0}
                className="bg-green-600 text-white py-2 px-6 rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {fieldVisibilityLoading ? (
                  <span className="flex items-center">
                    <LoadingSpinner />
                    <span className="ml-2">Saving Changes...</span>
                  </span>
                ) : (
                  `Save Changes (${changedRetailers.size})`
                )}
              </button>
              
              {fieldSaveMessage && (
                <span className="text-sm text-green-600 font-medium">{fieldSaveMessage}</span>
              )}
              {fieldSaveError && (
                <span className="text-sm text-red-600 font-medium">{fieldSaveError}</span>
              )}
            </div>
            
            <div className="text-sm text-gray-500">
              {changedRetailers.size > 0 && `${changedRetailers.size} retailer(s) have unsaved changes`}
            </div>
          </div>
        </div>

        {/* Product Offers Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Product Offers</h2>
              <p className="mt-1 text-sm text-gray-600">Create and manage special offers for your products</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              {offers.length} Active Offers
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Offer Creation Form */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Create New Offer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Products</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredProducts.map(product => (
                      <label key={product.id} className="flex items-center px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleProductSelect(product.id)}
                        />
                        <span className="ml-3 text-sm text-gray-900">{product.name}</span>
                        <span className="ml-auto text-xs text-gray-500 font-mono">{product.id}</span>
                      </label>
                    ))}
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="mt-2 text-sm text-green-600">
                      {selectedProducts.length} product(s) selected
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Offer Title *</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={offerTitle}
                      onChange={e => setOfferTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Offer Type</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={offerType}
                      onChange={e => setOfferType(e.target.value as 'percentage' | 'flat' | 'manual')}
                    >
                      <option value="percentage">Percentage Off (%)</option>
                      <option value="flat">Flat Off (₹)</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Offer Description</label>
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    rows={3}
                    value={offerDescription}
                    onChange={e => setOfferDescription(e.target.value)}
                    placeholder="Describe the offer details..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Offer Value *</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={offerValue}
                      onChange={e => setOfferValue(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valid From *</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={validFrom}
                      onChange={e => setValidFrom(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valid To *</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      value={validTo}
                      onChange={e => setValidTo(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Apply To</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    value={applyTo}
                    onChange={e => setApplyTo(e.target.value as 'all' | 'custom')}
                  >
                    <option value="all">All Retailers</option>
                    <option value="custom">Specific Retailers Only</option>
                  </select>
                </div>

                {applyTo === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Retailers</label>
                    <select
                      multiple
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 h-32"
                      value={targetRetailers}
                      onChange={e => setTargetRetailers(Array.from(e.target.selectedOptions, option => option.value))}
                    >
                      {retailers.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.id})
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Hold Ctrl/Cmd to select multiple retailers</p>
                  </div>
                )}

                <button
                  onClick={handleApplyOffer}
                  disabled={offerLoading || selectedProducts.length === 0 || !offerValue || !validFrom || !validTo || !offerTitle}
                  className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {offerLoading ? (
                    <span className="flex items-center justify-center">
                      <LoadingSpinner />
                      <span className="ml-2">Applying Offer...</span>
                    </span>
                  ) : (
                    `Apply Offer to ${selectedProducts.length} Product(s)`
                  )}
                </button>
              </div>
            </div>

            {/* Current Offers */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Offers</h3>
              {offers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">
                    <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">No active offers. Create your first offer to get started.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {offers.map(offer => {
                    const product = products.find(p => p.id === offer.product_id);
                    return (
                      <div key={offer.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{offer.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{product?.name || 'Unknown Product'}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            offer.offer_type === 'percentage' ? 'bg-blue-100 text-blue-800' :
                            offer.offer_type === 'flat' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {offer.offer_type === 'percentage' ? 'Percentage' : 
                             offer.offer_type === 'flat' ? 'Flat' : 'Manual'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-gray-500">Value:</span>
                            <span className="ml-2 font-medium">
                              {offer.offer_type === 'percentage' ? `${offer.offer_value}%` :
                               offer.offer_type === 'flat' ? `₹${offer.offer_value}` :
                               offer.offer_value}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Valid Until:</span>
                            <span className="ml-2 font-medium">
                              {offer.valid_to ? new Date(offer.valid_to).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            Applied to: {offer.apply_to === 'all' ? 'All Retailers' : 
                            `${offer.target_retailers?.length || 0} retailer(s)`}
                          </span>
                          <button
                            onClick={() => handleRemoveOffer(offer.id)}
                            disabled={deleteLoading === offer.id}
                            className="text-red-600 hover:text-red-800 disabled:opacity-50 font-medium"
                          >
                            {deleteLoading === offer.id ? <LoadingSpinner /> : 'Remove'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}