"use client";
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import AdminNavbar from './AdminNavbar';
import RetailerNavbar from './RetailerNavbar';
import Fuse from 'fuse.js';
import type { FuseResult } from 'fuse.js';
import { motion } from "framer-motion";
import { Sparkles, Image as ImageIcon } from "lucide-react";
const apiurl = process.env.NEXT_PUBLIC_APIURL;

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return isMobile;
}

export default function ProductDashboardPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const itemsPerPage = 20;
  const [id, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [imageInputType, setImageInputType] = useState<'file' | 'url'>('file');
  const [imageUrlInputs, setImageUrlInputs] = useState<string[]>(['']);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterMinQty, setFilterMinQty] = useState('');
  const [filterMaxQty, setFilterMaxQty] = useState('');
  const [cart, setCart] = useState<any[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [cartModalProduct, setCartModalProduct] = useState<any>(null);
  const [cartModalQty, setCartModalQty] = useState(1);
  const [cartPopoverPos, setCartPopoverPos] = useState<{ top: number, left: number } | null>(null);
  const [filterHasOffer, setFilterHasOffer] = useState(false);

  // Banner state

  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const device = isMobile ? 'mobile' : 'desktop';
  const [bannerData, setBannerData] = useState<{ url: string | null; topText: string | null }>({ url: null, topText: null });
  const [bannerLoading, setBannerLoading] = useState(true);
  const backendUrl = apiurl;

  // Add click outside handler for profile menu
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Utility to get user-specific cart key
  const getCartKey = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded: any = jwtDecode(token);
        const userId = decoded?.sub || decoded?.userid || decoded?.id;
        if (userId) return `cart_${userId}`;
      }
    } catch { }
    return 'cart';
  };

  useEffect(() => {
    fetchProducts();
    const storedId = localStorage.getItem('userid');
    const storedToken = localStorage.getItem('token');
    if (storedId) setId(storedId);
    if (storedToken) setToken(storedToken);

    const cartKey = getCartKey();
    const storedCart = localStorage.getItem(cartKey);
    if (storedCart) setCart(JSON.parse(storedCart));

    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  const handleLogout = () => {
    router.push('/');
  };

  const handleExport = () => {
    const csvContent = [
      ['Name', 'SKU', 'Brand', 'Category', 'Price', 'Quantity', 'Created at'],
      ...products.map(product => [
        product.name,
        product.sku,
        product.brand,
        product.category,
        product.price,
        product.inventory?.quantity || 0,
        product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'
      ])
    ];
    const csv = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadSampleCSV = () => {
    const sampleData = [
      [
        'Product Name',
        'SKU',
        'Brand',
        'Category',
        'Subcategory',
        'Short Description',
        'Long Description',
        'Specification',
        'Price',
        'Initial Quantity',
        'Batch Number',
        'Expiry Date',
        'Length (cm)',
        'Width (cm)',
        'Height (cm)',
        'Weight (kg)',
        'Image URL'
      ]
    ];
    const csv = sampleData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-products-import.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      try {
        const text = await file.text();
        const rows = text.split('\n').map(row => row.split(','));
        const headers = rows[0];
        const dataRows = rows.slice(1).filter(row => row.length > 1);
        const products = dataRows.map(row => ({
          name: row[0]?.trim() || '',
          sku: row[1]?.trim() || '',
          brand: row[2]?.trim() || '',
          category: row[3]?.trim() || '',
          subcategory: row[4]?.trim() || '',
          short_description: row[5]?.trim() || '',
          long_description: row[6]?.trim() || '',
          specification: row[7]?.trim() || '',
          price: row[8]?.trim() || '0',
          initial_quantity: row[9]?.trim() || '0',
          batch_number: row[10]?.trim() || '',
          expiry_date: row[11]?.trim() || '',
          length: row[12]?.trim() || '0',
          width: row[13]?.trim() || '0',
          height: row[14]?.trim() || '0',
          weight: row[15]?.trim() || '0',
          images: row[16]?.split(';').map((url: string) => url.trim()).filter((url: string) => url) || [],
        }));
        const validProducts = products.filter(product =>
          product.name && product.sku && product.brand && product.category
        );
        if (validProducts.length === 0) {
          toast.error('No valid products found in CSV. Please check the format.');
          return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Authentication required');
          return;
        }
        const response = await axios.post(
          `${apiurl}/product/bulk-import`,
          { products },
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (response.data) {
          const { successful, failed, total } = response.data;
          toast.success(`Import completed! ${successful} products imported successfully, ${failed} failed.`);
          fetchProducts();
        }
      } catch (error: any) {
        console.error('Error importing CSV:', error);
        toast.error(error.response?.data?.message || 'Failed to import CSV');
      }
    }
  };

  const fetchProducts = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const endpoint =
      userType === "admin"
        ? "/product/all"
        : "/product/all-retailer";
    try {
      const res = await axios.get(`${apiurl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (userType === "admin") {
        setProducts(res.data);
      } else {
        // Flatten each retailer product entry and attach offers
        const offers = res.data.offers || [];
        const products = (res.data.retailerproducts || []).map((entry: any) => {
          const productOffers = offers.filter((offer: any) => offer.product_id === entry.product.product_id);
          return {
            ...entry.product,
            inventory: entry.inventory,
            offers: productOffers
          };
        });
        setProducts(products);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['name', 'sku', 'brand'],
    threshold: 0.4,
  }), [products]);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(products);
      setShowRecommendations(false);
      return;
    }
    const exact = products.filter(product =>
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product?.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (exact.length > 0) {
      setSearchResults(exact);
      setShowRecommendations(false);
    } else {
      const fuzzy = fuse.search(searchQuery).map((res: FuseResult<any>) => res.item);
      setSearchResults(fuzzy);
      setShowRecommendations(true);
    }
  }, [searchQuery, products, fuse]);

  const filteredProducts = useMemo(() => {
    let filtered = searchResults.filter(product => {
      let matchesTab = activeTab === 'All';
      if (activeTab === 'Filter') matchesTab = true;
      if (activeTab === 'Offer') matchesTab = product.offers && product.offers.length > 0;
      return matchesTab;
    });
    if (activeTab === 'Filter') {
      if (filterCategory) filtered = filtered.filter(p => p.category && p.category.toLowerCase().includes(filterCategory.toLowerCase()));
      if (filterMinPrice) filtered = filtered.filter(p => Number(p.price) >= Number(filterMinPrice));
      if (filterMaxPrice) filtered = filtered.filter(p => Number(p.price) <= Number(filterMaxPrice));
      if (filterMinQty) filtered = filtered.filter(p => (p.inventory?.quantity || 0) >= Number(filterMinQty));
      if (filterMaxQty) filtered = filtered.filter(p => (p.inventory?.quantity || 0) <= Number(filterMaxQty));
      if (filterHasOffer) filtered = filtered.filter(p => p.offers && p.offers.length > 0);
    }
    return filtered;
  }, [searchResults, activeTab, filterCategory, filterMinPrice, filterMaxPrice, filterMinQty, filterMaxQty, filterHasOffer]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleAddProduct = async (productData: any) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }
      let imageUrls: string[] = [];
      if (imageInputType === 'file' && selectedImageFiles.length > 0) {
        const formData = new FormData();
        selectedImageFiles.forEach((file) => formData.append('images', file));
        const uploadRes = await axios.post(
          `${apiurl}/product/upload-images`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        imageUrls = uploadRes.data.urls;
      } else if (imageInputType === 'url') {
        imageUrls = imageUrlInputs.filter((url) => url.trim() !== '');
      }
      const productPayload = {
        ...productData,
        created_by: id,
        sku: productData.sku || `${productData.category.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        images: imageUrls,
        imageFile: undefined,
        inventory: undefined
      };
      const productResponse = await axios.post(
        `${apiurl}/product/add-product`,
        productPayload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (productResponse.data) {
        const inventoryPayload = {
          product_id: productResponse.data.product_id,
          quantity: productData.inventory.quantity,
          batch_no: productData.inventory.batch_no,
          expiry_date: productData.inventory.expiry_date
        };
        const inventoryResponse = await axios.post(
          `${apiurl}/product/add-inventory`,
          inventoryPayload,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (inventoryResponse.data) {
          toast.success('Product added successfully');
          setShowAddProductModal(false);
        }
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      toast.error(error.response?.data?.message || 'Failed to add product');
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `${apiurl}${imagePath}`;
  };

  const resetFilters = () => {
    setFilterCategory('');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterMinQty('');
    setFilterMaxQty('');
    setFilterHasOffer(false);
  };

  const addToCart = (product: any) => {
    const updatedCart = [...cart, product];
    setCart(updatedCart);
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(updatedCart));
    toast.success('Product added to cart!');
  };

  const openCartPopover = (product: any, event: React.MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const popoverWidth = 260;
    const popoverHeight = 180;
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 8;
    if (left + popoverWidth > window.innerWidth) {
      left = window.innerWidth - popoverWidth - 16;
      if (left < 0) left = 8;
    }
    if (top + popoverHeight > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - popoverHeight - 8;
      if (top < 0) top = 8;
    }
    setCartModalProduct(product);
    setCartModalQty(1);
    setCartPopoverPos({ top, left });
    setShowCartModal(true);
  };

  const closeCartPopover = () => {
    setShowCartModal(false);
    setCartModalProduct(null);
    setCartModalQty(1);
    setCartPopoverPos(null);
  };

  const confirmAddToCart = () => {
    if (!cartModalProduct) return;
    const maxQty = cartModalProduct.inventory?.quantity || 1;
    const qty = Math.min(Number(cartModalQty), maxQty);
    let updatedCart = [...cart];
    const idx = updatedCart.findIndex(p => p.product_id === cartModalProduct.product_id);
    if (idx !== -1) {
      const prevQty = updatedCart[idx].cartQty || 1;
      const newQty = Math.min(prevQty + qty, maxQty);
      updatedCart[idx] = { ...updatedCart[idx], cartQty: newQty };
    } else {
      updatedCart.push({ ...cartModalProduct, cartQty: qty });
    }
    setCart(updatedCart);
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(updatedCart));
    toast.success('Product added to cart!');
    closeCartPopover();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '......' : text;
  };

  // const getFullBannerUrl = (url: string | null) => {
  //   if (!url) return null;
  //   if (url.startsWith('/uploads/')) {
  //     return backendUrl + url;
  //   }
  //   return url;
  // };

  useEffect(() => {
    const fetchBanner = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setBannerLoading(false);
        return;
      }

      try {
        setBannerLoading(true);
        const res = await axios.get(`${apiurl}/banner?device=${device}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('Banner API Response:', res.data);

        // Handle response based on backend structure
        if (res.data && typeof res.data === 'object') {
          if (res.data.url) {
            setBannerData({
              url: res.data.url,
              topText: res.data.topText || null
            });
          } else if (res.data.banner) {
            // If nested under banner property
            setBannerData({
              url: res.data.banner.url,
              topText: res.data.banner.topText || null
            });
          } else {
            // No banner found
            setBannerData({ url: null, topText: null });
          }
        } else {
          setBannerData({ url: null, topText: null });
        }
      } catch (err: any) {
        console.error('Banner fetch error:', err);
        setBannerData({ url: null, topText: null });
      } finally {
        setBannerLoading(false);
      }
    };

    fetchBanner();
  }, [device, apiurl]);

  const getFullBannerUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) {
      return backendUrl + url;
    }
    return url;
  };

  const bannerImage = getFullBannerUrl(bannerData.url) || (isMobile ? '/mobilebanner.png' : '/banner.png');

  // Compact time left calculator
  const calculateTimeLeft = (validTo: string): string => {
    if (!validTo) return 'N/A';

    const now = new Date();
    const end = new Date(validTo);

    if (isNaN(end.getTime())) return 'N/A';

    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return '<1h';
  };

  // Progress calculator
  const calculateOfferProgress = (validFrom: string, validTo: string): number => {
    if (!validFrom || !validTo) return 0;

    const now = new Date();
    const start = new Date(validFrom);
    const end = new Date(validTo);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    if (elapsed <= 0) return 0;
    if (elapsed >= total) return 100;

    return Math.round((elapsed / total) * 100);
  };
  return (
    <div className="min-h-screen bg-gray-50">
      {userType === 'admin' && <AdminNavbar active="products" />}
      {userType === 'retailer' && <RetailerNavbar active="products" />}


      {/* Banner Section */}
      {!bannerLoading && (
        <div className="relative w-full bg-gradient-to-br from-gray-50 via-white to-gray-100 border-b border-gray-200">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* Banner Image */}
              <div className="relative">
                {bannerImage ? (
                  <motion.img
                    key={bannerImage}
                    src={bannerImage}
                    alt="Dashboard Banner"
                    className="w-full h-52 sm:h-64 md:h-72 lg:h-80 object-cover rounded-2xl"
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = isMobile ? "/mobilebanner.png" : "/banner.png";
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-52 sm:h-64 md:h-72 lg:h-80 bg-gray-200 rounded-2xl">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                    <span className="ml-3 text-gray-500 font-medium">No Banner Available</span>
                  </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>

                {/* Optional Floating Sparkles */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                  className="absolute top-3 right-4 bg-white/10 backdrop-blur-md rounded-full p-2"
                >
                  <Sparkles className="text-white w-5 h-5" />
                </motion.div>

                {/* Top Text Overlay */}
                {bannerData?.topText && (
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                    className="absolute bottom-6 left-0 right-0 text-center px-4"
                  >
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]">
                      {bannerData.topText}
                    </h1>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}


      {/* Banner Loading State */}
      {bannerLoading && (
        <div className="w-full bg-gray-50 border-b border-gray-200 py-8">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="py-6">
        <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2 sm:gap-0">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
              <p className="mt-1 text-sm text-gray-600">Manage your products and view their inventory.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {userType === 'admin' && (
                <>
                  <div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                    >
                      Import CSV
                    </label>
                  </div>
                  <button
                    onClick={handleDownloadSampleCSV}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Sample CSV
                  </button>
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
                  >
                    Add Product
                  </button>
                </>
              )}
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {['All', 'Filter', 'Offer'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  {tab}
                </button>
              ))}
            </nav>
            {activeTab === 'Filter' && (
              <div className="flex flex-wrap gap-4 mt-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Category</label>
                  <input
                    type="text"
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="mt-1 block w-40 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder="Category"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Min Price</label>
                  <input
                    type="number"
                    value={filterMinPrice}
                    onChange={e => setFilterMinPrice(e.target.value)}
                    className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Max Price</label>
                  <input
                    type="number"
                    value={filterMaxPrice}
                    onChange={e => setFilterMaxPrice(e.target.value)}
                    className="mt-1 block w-24 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder=""
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Min Qty</label>
                  <input
                    type="number"
                    value={filterMinQty}
                    onChange={e => setFilterMinQty(e.target.value)}
                    className="mt-1 block w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Max Qty</label>
                  <input
                    type="number"
                    value={filterMaxQty}
                    onChange={e => setFilterMaxQty(e.target.value)}
                    className="mt-1 block w-20 border border-gray-300 rounded-md shadow-sm py-1 px-2 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    placeholder=""
                  />
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="filter-has-offer"
                    checked={filterHasOffer}
                    onChange={e => setFilterHasOffer(e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="filter-has-offer" className="text-xs font-medium text-gray-700">Only show products with offers</label>
                </div>
                <button
                  onClick={resetFilters}
                  className="ml-2 px-3 py-1 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, SKU, or brand..."
              className="px-4 py-2 border rounded-lg w-64"
            />
          </div>
          {showRecommendations && (
            <div className="mb-4 text-sm text-gray-500">No exact matches found. Showing close matches:</div>
          )}

          {/* Products Table */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 w-full max-w-screen-2xl mx-auto overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {userType === 'admin' ? (
                    <>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offers</th>
                      {activeTab === 'Offer' && (
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer Price</th>
                      )}
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cart</th>
                    </>
                  ) : (
                    <>
                      {/* Only show these fields if present in product data, in fixed order */}
                      {['product_id', 'images', 'name', 'short_description', 'sku', 'brand', 'category', 'price', 'inventory', 'offers'].map((field) => {
                        if (!products.some(p => p[field] !== undefined && p[field] !== null)) return null;
                        if (field === 'product_id')
                          return <th key="product_id" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product ID</th>;
                        if (field === 'images')
                          return <th key="images" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>;
                        if (field === 'name')
                          return <th key="name" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>;
                        if (field === 'short_description')
                          return <th key="short_description" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>;
                        if (field === 'sku')
                          return <th key="sku" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>;
                        if (field === 'brand')
                          return <th key="brand" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>;
                        if (field === 'category')
                          return <th key="category" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>;
                        if (field === 'price')
                          return <th key="price" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>;
                        if (field === 'inventory')
                          return <th key="inventory" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>;
                        if (field === 'offers') {
                          return (
                            <th key="offers" className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offers</th>
                          );
                        }
                        return null;
                      })}
                      {activeTab === 'Offer' && (
                        <th className="px-2 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Offer Price</th>
                      )}
                      <th className="px-2 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cart</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-xs sm:text-sm">
                {currentProducts.map((product) => (
                  <tr key={product.product_id || product._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {
                    const basePath = userType === 'admin' ? '/admin-dashboard/product' : '/retailer-dashboard/product';
                    router.push(`${basePath}/${product.product_id || product._id}`);
                  }}>
                    {userType === 'admin' ? (
                      <>
                        {/* Product ID */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.product_id}</td>
                        {/* Image */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                          <div className="h-20 w-20 sm:h-28 sm:w-28 flex-shrink-0 relative overflow-hidden rounded-lg bg-gray-100">
                            {product.images && product.images.length > 0 ? (
                              <>
                                <img
                                  className="h-full w-full object-contain max-w-full max-h-full"
                                  src={(() => {
                                    const img = product.images[product._imageIndex || 0];
                                    if (!img) return '';
                                    if (img.startsWith('http')) return img;
                                    return getImageUrl(img);
                                  })()}
                                  alt={product.name}
                                  onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }}
                                />
                                {product.images.length > 1 && (
                                  <div className="absolute bottom-1 right-1 flex space-x-1">
                                    <button
                                      className="bg-white bg-opacity-80 rounded-full p-1 text-xs border border-gray-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProducts((prev) => prev.map((p) => {
                                          if ((p.product_id || p._id) === (product.product_id || product._id)) {
                                            const idx = typeof p._imageIndex === 'number' ? p._imageIndex : 0;
                                            return { ...p, _imageIndex: (idx - 1 + p.images.length) % p.images.length };
                                          }
                                          return p;
                                        }));
                                      }}
                                    >
                                      {'<'}
                                    </button>
                                    <button
                                      className="bg-white bg-opacity-80 rounded-full p-1 text-xs border border-gray-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProducts((prev) => prev.map((p) => {
                                          if ((p.product_id || p._id) === (product.product_id || product._id)) {
                                            const idx = typeof p._imageIndex === 'number' ? p._imageIndex : 0;
                                            return { ...p, _imageIndex: (idx + 1) % p.images.length };
                                          }
                                          return p;
                                        }));
                                      }}
                                    >
                                      {'>'}
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Name */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.name}</td>
                        {/* Description */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-500">{truncateText(product.short_description, 80)}</td>
                        {/* SKU */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.sku}</td>
                        {/* Brand */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.brand}</td>
                        {/* Category */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.category}</td>
                        {/* Price */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">₹{product.price?.toFixed(2) || '0.00'}</td>
                        {/* Quantity */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">{product.inventory?.quantity || 0}</td>
                        {/* Professional Offers Section */}
                        <td className="px-4 sm:px-6 py-4 align-top min-w-[240px]">
                          {product.offers && product.offers.length > 0 ? (
                            <div className="space-y-3">
                              {product.offers.map((offer: any) => (
                                <div
                                  key={offer._id || offer.id}
                                  className=" rounded-lg p-4 hover:shadow-md transition-all duration-200 bg-white"
                                >
                                  {/* Offer Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-800 text-sm mb-2">
                                        {truncateText(offer.title, 30)}
                                      </h4>

                                      {/* Discount Value */}
                                      <div className="text-lg font-bold text-gray-900">
                                        {offer.offer_type === "percentage"
                                          ? `${offer.offer_value}% OFF`
                                          : offer.offer_type === "flat"
                                            ? `₹${offer.offer_value} OFF`
                                            : offer.offer_value}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Dates */}
                                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                    <span className="font-medium">{offer.valid_from?.slice(0, 10)}</span>
                                    <span className="text-gray-400">to</span>
                                    <span className="font-medium">{offer.valid_to?.slice(0, 10)}</span>
                                  </div>

                                  {/* Progress Bar */}
                                  {offer.valid_from && offer.valid_to && (
                                    <div className="mt-3">
                                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Progress</span>
                                        <span>{calculateOfferProgress(offer.valid_from, offer.valid_to)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                          className="bg-gray-600 h-1.5 rounded-full transition-all duration-500"
                                          style={{
                                            width: `${calculateOfferProgress(offer.valid_from, offer.valid_to)}%`
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-6 text-gray-400">
                              <div className="text-center">
                                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                </svg>
                                <span className="text-sm">No active offers</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Professional Offer Price Section */}
                        {activeTab === "Offer" && (
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            {product.offers && product.offers.length > 0 ? (
                              (() => {
                                const offer = product.offers[0];
                                let offerPrice = product.price;
                                let savings = 0;

                                if (offer.offer_type === "flat") {
                                  offerPrice = product.price - offer.offer_value;
                                  savings = offer.offer_value;
                                } else if (offer.offer_type === "percentage") {
                                  savings = product.price * (offer.offer_value / 100);
                                  offerPrice = product.price - savings;
                                }

                                if (offerPrice < 0) offerPrice = 0;

                                return (
                                  <div className="text-center">
                                    {/* Final Price */}
                                    <div className="text-xl font-bold text-gray-900 mb-1">
                                      ₹{offerPrice.toFixed(2)}
                                    </div>

                                    {/* Original Price */}
                                    <div className="text-sm text-gray-500 line-through mb-1">
                                      ₹{product.price?.toFixed(2)}
                                    </div>

                                    {/* Savings */}
                                    <div className="text-xs text-green-600 font-medium">
                                      Save ₹{savings.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-700">
                                  ₹{product.price?.toFixed(2) || "0.00"}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Standard
                                </div>
                              </div>
                            )}
                          </td>
                        )}
                        {/* Cart */}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm font-medium relative">
                          <div className="inline-block text-left">
                            <button
                              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add 1 to cart
                                let updatedCart = [...cart];
                                const idx = updatedCart.findIndex(p => (p.product_id || p._id) === (product.product_id || product._id));
                                const maxQty = product.inventory?.quantity || 1;
                                if (idx !== -1) {
                                  // Already in cart, update quantity
                                  const prevQty = updatedCart[idx].cartQty || 1;
                                  const newQty = Math.min(prevQty + 1, maxQty);
                                  updatedCart[idx] = { ...updatedCart[idx], cartQty: newQty };
                                } else {
                                  updatedCart.push({ ...product, cartQty: 1 });
                                }
                                setCart(updatedCart);
                                const cartKey = getCartKey();
                                localStorage.setItem(cartKey, JSON.stringify(updatedCart));
                                toast.success('Product added to cart!');
                                setProducts((prev) => prev.map((p) => ({ ...p, _showActions: false })));
                              }}
                            >
                              Add to Cart
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* Only show these fields if present in product data, in fixed order */}
                        {['product_id', 'images', 'name', 'short_description', 'sku', 'brand', 'category', 'price', 'inventory', 'offers'].map((field) => {
                          if (!products.some(p => p[field] !== undefined && p[field] !== null)) return null;
                          if (field === 'product_id')
                            return <td key="product_id" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.product_id}</td>;
                          if (field === 'images') {
                            return (
                              <td key="images" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                                <div className="h-20 w-20 sm:h-28 sm:w-28 flex-shrink-0 relative overflow-hidden rounded-lg bg-gray-100">
                                  {Array.isArray(product.images) && product.images.length > 0 ? (
                                    <img
                                      className="h-full w-full object-contain max-w-full max-h-full"
                                      src={product.images[product._imageIndex || 0] || '/no-image.png'}
                                      alt={product.name}
                                      onError={e => { (e.target as HTMLImageElement).src = '/no-image.png'; }}
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          if (field === 'name')
                            return <td key="name" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.name}</td>;
                          if (field === 'short_description')
                            return <td key="short_description" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-500">{truncateText(product.short_description, 80)}</td>;
                          if (field === 'sku')
                            return <td key="sku" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.sku}</td>;
                          if (field === 'brand')
                            return <td key="brand" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.brand}</td>;
                          if (field === 'category')
                            return <td key="category" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">{product.category}</td>;
                          if (field === 'price')
                            return <td key="price" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">₹{product.price?.toFixed ? product.price.toFixed(2) : product.price || '0.00'}</td>;
                          if (field === 'inventory')
                            return <td key="inventory" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-900">{product.inventory?.quantity ?? ''}</td>;
                          if (field === 'offers') {
                            return (
                              <td key="offers" className="px-2 sm:px-6 py-2 sm:py-4 whitespace-pre-line break-words max-w-xs text-sm text-gray-900">
                                {product.offers && product.offers.length > 0 ? (
                                  <ul>
                                    {product.offers.map((offer: any) => (
                                      <li key={offer._id || offer.id}>
                                        <span className="font-semibold">{truncateText(offer.title, 30)}</span>
                                        {': '}
                                        <span className="text-green-600 font-semibold">
                                          {offer.offer_type === 'percentage'
                                            ? `${offer.offer_value}% off`
                                            : offer.offer_type === 'flat'
                                              ? `₹${offer.offer_value} off`
                                              : offer.offer_value}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500">
                                          ({offer.valid_from?.slice(0, 10)} to {offer.valid_to?.slice(0, 10)})
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="text-gray-400">No active offers</span>
                                )}
                              </td>
                            );
                          }
                          return null;
                        })}
                        {activeTab === 'Offer' && (
                          <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm">
                            {product.offers && product.offers.length > 0 ? (() => {
                              const offer = product.offers[0];
                              let offerPrice = product.price;
                              if (offer.offer_type === 'flat') {
                                offerPrice = product.price - offer.offer_value;
                              } else if (offer.offer_type === 'percentage') {
                                offerPrice = product.price * (1 - offer.offer_value / 100);
                              }
                              if (offerPrice < 0) offerPrice = 0;
                              return <span className="text-green-600 font-bold">₹{offerPrice.toFixed(2)}</span>;
                            })() : <span className="text-gray-900">₹{product.price?.toFixed(2) || '0.00'}</span>}
                          </td>
                        )}
                        <td className="px-2 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm font-medium relative">
                          <div className="inline-block text-left">
                            <button
                              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Add 1 to cart
                                let updatedCart = [...cart];
                                const idx = updatedCart.findIndex(p => (p.product_id || p._id) === (product.product_id || product._id));
                                const maxQty = product.inventory?.quantity || 1;
                                if (idx !== -1) {
                                  // Already in cart, update quantity
                                  const prevQty = updatedCart[idx].cartQty || 1;
                                  const newQty = Math.min(prevQty + 1, maxQty);
                                  updatedCart[idx] = { ...updatedCart[idx], cartQty: newQty };
                                } else {
                                  updatedCart.push({ ...product, cartQty: 1 });
                                }
                                setCart(updatedCart);
                                const cartKey = getCartKey();
                                localStorage.setItem(cartKey, JSON.stringify(updatedCart));
                                toast.success('Product added to cart!');
                                setProducts((prev) => prev.map((p) => ({ ...p, _showActions: false })));
                              }}
                            >
                              Add to Cart
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  Prev
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(endIndex, filteredProducts.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredProducts.length}</span> products
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-[600px] shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Product</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const productData = {
                  name: formData.get('name'),
                  sku: formData.get('sku'),
                  brand: formData.get('brand'),
                  category: formData.get('category'),
                  subcategory: formData.get('subcategory'),
                  short_description: formData.get('short_description'),
                  long_description: formData.get('long_description'),
                  specification: formData.get('specification'),
                  price: Number(formData.get('price')),
                  dimensions: {
                    length: Number(formData.get('length')),
                    width: Number(formData.get('width')),
                    height: Number(formData.get('height')),
                    weight: Number(formData.get('weight'))
                  },
                  images: [], // will be set in handleAddProduct
                  imageFile: undefined, // only used if file upload
                  created_at: new Date().toISOString(),
                  inventory: {
                    quantity: Number(formData.get('quantity')),
                    batch_no: formData.get('batch_no')?.toString(),
                    expiry_date: formData.get('expiry_date') ? new Date(formData.get('expiry_date') as string) : undefined
                  }
                };
                handleAddProduct(productData);
              }}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Product Name*</label>
                      <input
                        type="text"
                        name="name"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">SKU*</label>
                      <input
                        type="text"
                        name="sku"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Brand*</label>
                      <input
                        type="text"
                        name="brand"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category*</label>
                      <input
                        type="text"
                        name="category"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subcategory</label>
                    <input
                      type="text"
                      name="subcategory"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Short Description</label>
                    <textarea
                      name="short_description"
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Long Description</label>
                    <textarea
                      name="long_description"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Specifications</label>
                    <textarea
                      name="specification"
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Price*</label>
                    <input
                      type="number"
                      name="price"
                      required
                      step="0.01"
                      min="0"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Initial Quantity*</label>
                      <input
                        type="number"
                        name="quantity"
                        required
                        min="0"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Batch Number</label>
                      <input
                        type="text"
                        name="batch_no"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                    <input
                      type="date"
                      name="expiry_date"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Length (cm)</label>
                      <input
                        type="number"
                        name="length"
                        step="0.01"
                        min="0"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Width (cm)</label>
                      <input
                        type="number"
                        name="width"
                        step="0.01"
                        min="0"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                      <input
                        type="number"
                        name="height"
                        step="0.01"
                        min="0"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                      <input
                        type="number"
                        name="weight"
                        step="0.01"
                        min="0"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                    <div className="flex space-x-4 mb-2">
                      <label>
                        <input
                          type="radio"
                          name="imageInputType"
                          value="file"
                          checked={imageInputType === 'file'}
                          onChange={() => setImageInputType('file')}
                        /> Upload File
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="imageInputType"
                          value="url"
                          checked={imageInputType === 'url'}
                          onChange={() => setImageInputType('url')}
                        /> Paste Image URL
                      </label>
                    </div>
                    {imageInputType === 'file' ? (
                      <div className="mb-2">
                        <label htmlFor="product-image-upload" className="inline-block px-4 py-2 bg-gray-900 text-white rounded-md cursor-pointer hover:bg-gray-800 transition-colors">
                          Choose Files
                        </label>
                        <input
                          id="product-image-upload"
                          type="file"
                          name="images"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            setSelectedImageFiles(files);
                          }}
                          className="hidden"
                        />
                        {selectedImageFiles.length > 0 && (
                          <div className="mt-2 text-sm text-gray-700">
                            {selectedImageFiles.length} file(s) selected
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {imageUrlInputs.map((url, idx) => (
                          <div key={idx} className="flex mb-2">
                            <input
                              type="text"
                              name={`imageUrl${idx}`}
                              placeholder="Paste image URL here"
                              value={url}
                              onChange={(e) => {
                                const newInputs = [...imageUrlInputs];
                                newInputs[idx] = e.target.value;
                                setImageUrlInputs(newInputs);
                              }}
                              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3"
                            />
                            <button type="button" onClick={() => setImageUrlInputs(imageUrlInputs.filter((_, i) => i !== idx))} className="ml-2 text-red-500">Remove</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setImageUrlInputs([...imageUrlInputs, ''])} className="text-blue-500">Add another URL</button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-5 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-gray-900 hover:bg-gray-800"
                  >
                    Add Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCartModal && cartModalProduct && cartPopoverPos && (
        <div
          style={{ position: 'absolute', top: cartPopoverPos.top, left: cartPopoverPos.left, zIndex: 50 }}
          className="bg-white rounded-lg shadow-lg p-4 w-64 border border-gray-200 max-h-[90vh] overflow-y-auto"
        >
          <h2 className="text-base font-semibold mb-2">Add to Cart</h2>
          <div className="mb-2">
            <div className="font-medium">{cartModalProduct.name}</div>
            <div className="text-sm text-gray-500">Available: {cartModalProduct.inventory?.quantity || 1}</div>
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={cartModalProduct.inventory?.quantity || 1}
              value={cartModalQty}
              onChange={e => {
                let val = Number(e.target.value);
                if (val < 1) val = 1;
                if (val > (cartModalProduct.inventory?.quantity || 1)) val = cartModalProduct.inventory?.quantity || 1;
                setCartModalQty(val);
              }}
              className="w-20 border border-gray-300 rounded-md py-1 px-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={closeCartPopover}
              className="px-3 py-1 border border-gray-300 rounded-md text-xs text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmAddToCart}
              className="px-3 py-1 border border-transparent rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 