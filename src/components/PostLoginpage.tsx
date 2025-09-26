'use client';
import AdminNavbar from './AdminNavbar';
import RetailerNavbar from './RetailerNavbar';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../constants/backend';
import { toast } from 'react-toastify';

const WALLPAPER_URL = '/wallpaper.png';

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

export default function PostLoginPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ name: string; productIds: string[] }[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryProducts, setNewCategoryProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [catBarOpen, setCatBarOpen] = useState(false);
  const catBarTimeout = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();
  const device = isMobile ? 'mobile' : 'desktop';
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  const backendUrl = BACKEND_URL;

  const getFullWallpaperUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('/uploads/')) {
      return backendUrl + url;
    }
    return url; // already absolute (e.g., external URL)
  };

  useEffect(() => {
    const fetchWallpaper = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const endpoint = userType === 'admin'
          ? `/admin/wallpaper?device=${isMobile ? 'mobile' : 'desktop'}`
          : `/retailer/wallpaper?device=${isMobile ? 'mobile' : 'desktop'}`;
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setWallpaperUrl(res.data.url || null);
      } catch {
        setWallpaperUrl(null);
      }
    };
    fetchWallpaper();
  }, [isMobile, userType]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  useEffect(() => {
    // Fetch products for selection
    const fetchProducts = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const endpoint = userType === 'admin' ? '/product/all' : '/product/all-retailer';
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userType === 'admin') {
          setProducts(res.data);
        } else {
          // Flatten retailerproducts and attach offers
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
      } catch (err) {}
    };
    // Fetch categories from backend
    const fetchCategories = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const endpoint = userType === 'admin' ? '/admin/custom-categories' : '/retailer/custom-categories';
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(res.data || []);
      } catch (err) {}
    };
    if (showModal) {
      fetchProducts();
      fetchCategories();
    }
  }, [showModal, userType]);

  // Fetch categories on page load and when modal closes
  useEffect(() => {
    const fetchCategories = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const endpoint = userType === 'admin' ? '/admin/custom-categories' : '/retailer/custom-categories';
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(res.data || []);
      } catch (err) {}
    };
    fetchCategories();
  }, [showModal, userType]);

  const handleAddCategory = () => {
    if (!newCategoryName || newCategoryProducts.length === 0) return;
    setCategories(prev => [...prev, { name: newCategoryName, productIds: newCategoryProducts }]);
    setNewCategoryName('');
    setNewCategoryProducts([]);
  };

  const handleSaveCategories = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const endpoint = userType === 'admin' ? '/admin/custom-categories' : '/retailer/custom-categories';
      await axios.post(`${BACKEND_URL}${endpoint}`, { categories }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowModal(false);
      setMessage('Categories saved successfully!');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save categories');
    }
  };

  // Filter products for search
  const filteredProducts = products.filter((p: any) =>
    (p?.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p?.product_id && p.product_id.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p?.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p?.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const handleCatBarEnter = () => {
    if (catBarTimeout.current) clearTimeout(catBarTimeout.current);
    setCatBarOpen(true);
  };
  const handleCatBarLeave = () => {
    catBarTimeout.current = setTimeout(() => setCatBarOpen(false), 180);
  };

  const bgImage = getFullWallpaperUrl(wallpaperUrl) || (isMobile ? '/mobilewallpaper.png' : '/wallpaper.png');

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {userType === 'admin' ? <AdminNavbar /> : <RetailerNavbar />}
      <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 md:px-8">
        <div
          style={{
            minHeight: 'calc(100vh - 64px)',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '24px',
              padding: '48px 32px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            {userType === 'admin' ? <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Welcome to The Admin Portal
            </h1> : <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              Welcome to The Retailer Portal
            </h1>}
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 32px',
                fontSize: '1.1rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'background 0.2s',
              }}
            >
              Create Categories
            </button>
            {(message || error) && (
              <div style={{
                position: 'absolute', top: 24, left: 0, right: 0, margin: '0 auto', maxWidth: 400, zIndex: 2000,
                background: message ? '#22c55e' : '#ef4444', color: '#fff', padding: '12px 24px', borderRadius: 8, textAlign: 'center', fontWeight: 600, fontSize: 16,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {message || error}
              </div>
            )}
            {showModal && (
              <CategoryModal
                products={products}
                newCategoryName={newCategoryName}
                setNewCategoryName={setNewCategoryName}
                newCategoryProducts={newCategoryProducts}
                setNewCategoryProducts={setNewCategoryProducts}
                productSearch={productSearch}
                setProductSearch={setProductSearch}
                handleAddCategory={handleAddCategory}
                handleSaveCategories={handleSaveCategories}
                setShowModal={setShowModal}
                userType={userType}
              />
            )}
          </div>
        </div>
      </div>
      {categories.length > 0 && !showModal && (
        <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2000, width: '100vw', pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '100%', height: 36, background: '#fff', borderTop: '1.5px solid #bbb', borderBottom: '1.5px solid #bbb', boxShadow: '0 -2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', position: 'relative',
            }}
            onMouseEnter={handleCatBarEnter}
            onMouseLeave={handleCatBarLeave}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 100,
              position: 'fixed',
              left: '50%',
              bottom: 6,
              transform: 'translateX(-50%)',
              maxWidth: '98vw',
              minWidth: 240,
              overflow: 'auto',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}>
              <span style={{ display: 'inline-block', transition: 'transform 0.6s', transform: catBarOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 22, marginBottom: 2 }}>
                ▼
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontWeight: 600, fontSize: 18, color: '#444', letterSpacing: 1 }}>
                Categories
              </div>
            </div>
            {catBarOpen && (
              <div
                style={{
                  position: 'fixed',
                  left: '50%',
                  bottom: 72,
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  borderRadius: 18,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                  padding: '18px 18px',
                  minWidth: 240,
                  maxWidth: '98vw',
                  maxHeight: 120,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  display: 'flex',
                  gap: 18,
                  alignItems: 'center',
                  zIndex: 10,
                }}
                onMouseEnter={handleCatBarEnter}
                onMouseLeave={handleCatBarLeave}
              >
                {categories.map((cat, idx) => (
                  <button
                    key={idx}
                    style={{
                      minWidth: 160,  maxWidth: 260, fontSize: 18, fontWeight: 600, background: '#f3f4f6', color: '#222', border: 'none', borderRadius: 12, padding: '18px 28px', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                    title={cat.name}
                    onClick={() => router.push(`/${userType === 'admin' ? 'admin-dashboard' : 'retailer-dashboard'}/category/${encodeURIComponent(cat.name.replace(/\s+/g, '-').toLowerCase())}-${idx}`)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryModal({
  products,
  newCategoryName,
  setNewCategoryName,
  newCategoryProducts,
  setNewCategoryProducts,
  productSearch,
  setProductSearch,
  handleAddCategory,
  handleSaveCategories,
  setShowModal,
  userType
}: any) {
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Always fetch latest categories from DB when modal opens
    const fetchCategories = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const endpoint = userType === 'admin' ? '/admin/custom-categories' : '/retailer/custom-categories';
        const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDbCategories(res.data || []);
      } catch {}
      setLoading(false);
    };
    fetchCategories();
  }, [userType]);

  const handleDeleteCategory = async (catName: string) => {
    if (!window.confirm(`Are you sure you want to delete the category "${catName}"?`)) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const endpoint = userType === 'admin' ? '/admin/custom-categories' : '/retailer/custom-categories';
      await axios.delete(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: catName },
      });
      toast.success('Category deleted');
      // Refresh categories
      const res = await axios.get(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDbCategories(res.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete category');
    }
  };

  // In CategoryModal, prevent duplicate category names
  const handleAddCategoryWithCheck = () => {
    if (!newCategoryName.trim()) return;
    if (dbCategories.some((cat: any) => cat.name.trim().toLowerCase() === newCategoryName.trim().toLowerCase())) {
      toast.error('A category with this name already exists.');
      return;
    }
    handleAddCategory();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        padding: '4vw 2vw',
        minWidth: 320,
        maxWidth: '98vw',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxSizing: 'border-box',
        width: '100%',
      }}>
        <h2 style={{ fontWeight: 600, fontSize: 24, marginBottom: 24 }}>Add Custom Category</h2>
        <input
          type="text"
          placeholder="Category Name"
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          style={{ width: '100%', marginBottom: 16, padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontWeight: 500, marginBottom: 6, display: 'block' }}>Search Products:</label>
          <input
            type="text"
            placeholder="Search by name, id, sku, brand..."
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 15 }}
          />
          <label style={{ fontWeight: 500 }}>Select Products:</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginTop: 6 }}>
            <table style={{ width: '100%', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 6 }}>Select</th>
                  <th style={{ padding: 6 }}>ID</th>
                  <th style={{ padding: 6 }}>Name</th>
                  <th style={{ padding: 6 }}>SKU</th>
                  <th style={{ padding: 6 }}>Brand</th>
                </tr>
              </thead>
              <tbody>
                {products.filter((p: any) =>
                  (p?.name && p.name.toLowerCase().includes(productSearch.toLowerCase())) ||
                  (p?.product_id && p.product_id.toLowerCase().includes(productSearch.toLowerCase())) ||
                  (p?.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
                  (p?.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()))
                ).map((p: any) => (
                  <tr key={p.product_id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={newCategoryProducts.includes(p.product_id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewCategoryProducts((prev: any) => [...prev, p.product_id]);
                          } else {
                            setNewCategoryProducts((prev: any) => prev.filter((id: string) => id !== p.product_id));
                          }
                        }}
                      />
                    </td>
                    <td style={{ padding: 6 }}>{p.product_id}</td>
                    <td style={{ padding: 6 }}>{p.name}</td>
                    <td style={{ padding: 6 }}>{p.sku}</td>
                    <td style={{ padding: 6 }}>{p.brand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <button
          onClick={handleAddCategoryWithCheck}
          style={{ background: '#0070f3',cursor:'pointer', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 600, marginBottom: 16, marginRight: 8, fontSize: 16 }}
        >
          Add Category
        </button>
        <button
          onClick={() => setShowModal(false)}
          style={{ background: '#eee', cursor:'pointer', color: '#333', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 600, fontSize: 16 }}
        >
          Cancel
        </button>
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontWeight: 500, marginBottom: 8, fontSize: 17 }}>Categories in Database:</h3>
          {loading ? <div style={{ color: '#888' }}>Loading...</div> : dbCategories.length === 0 ? <div style={{ color: '#888' }}>No categories found.</div> : (
            <ul style={{ textAlign: 'left', paddingLeft: 18, fontSize: 15 }}>
              {dbCategories.map((cat, idx) => (
                <li key={idx} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{cat.name}</b>: {cat.productIds?.length ? cat.productIds.length + ' products' : 'No products'}
                  <button
                    onClick={() => handleDeleteCategory(cat.name)}
                    style={{ marginLeft: 8, color: '#ef4444', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                    title="Delete category"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={handleSaveCategories}
          style={{ background: '#22c55e', cursor:'pointer', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontWeight: 600, marginTop: 24, width: '100%', fontSize: 17 }}
          // disabled={dbCategories.length === 0}
        >
          Save Categories
        </button>
      </div>
    </div>
  );
} 