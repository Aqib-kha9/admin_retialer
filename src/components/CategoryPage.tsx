"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";

export default function CategoryPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const params = useParams();
  const router = useRouter();
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryProducts, setEditCategoryProducts] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const apiurl = process.env.NEXT_PUBLIC_APIURL;

  const fetchCategoryAndProducts = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      // Fetch all categories
      const catEndpoint = userType === 'admin'
        ? `${apiurl}/admin/custom-categories`
        : `${apiurl}/retailer/custom-categories`;
      const catRes = await axios.get(catEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const categoriesData = catRes.data || [];
      setAllCategories(categoriesData);

      // Find category by slugified name and index
      const catId = params.category_id as string;
      const match = categoriesData.find((cat: any, idx: number) =>
        cat && cat.name && `${cat.name.replace(/\s+/g, '-').toLowerCase()}-${idx}` === catId
      );
      setCategory(match);

      // Fetch all products
      const prodEndpoint = userType === 'admin'
        ? `${apiurl}/product/all`
        : `${apiurl}/product/all-retailer`;
      const prodRes = await axios.get(prodEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let fetchedProducts = prodRes.data || [];
      if (userType === 'retailer') {
        // Flatten retailerproducts and attach offers
        const offers = prodRes.data.offers || [];
        fetchedProducts = (prodRes.data.retailerproducts || []).map((entry: any) => {
          const productOffers = offers.filter((offer: any) => offer.product_id === entry.product.product_id);
          return {
            ...entry.product,
            inventory: entry.inventory,
            offers: productOffers
          };
        });
      }
      setAllProducts(fetchedProducts);

      if (match && match.productIds && match.productIds.length > 0) {
        setProducts(fetchedProducts.filter((p: any) => match.productIds.includes(p.product_id)));
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
      setCategory(null);
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategoryAndProducts();
  }, [params.category_id, userType]);

  const handleSaveEdit = async () => {
    if (!editCategoryName.trim()) {
      alert("Category name cannot be empty");
      return;
    }
    setSaving(true);
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const updatedCategories = allCategories.map((cat: any) => {
        if (cat.name === category.name) {
          return { name: editCategoryName, productIds: editCategoryProducts };
        }
        return cat;
      });

      const catEndpoint = userType === 'admin'
        ? `${apiurl}/admin/custom-categories`
        : `${apiurl}/retailer/custom-categories`;

      await axios.post(catEndpoint, { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAllCategories(updatedCategories);
      const match = updatedCategories.find((cat: any) => cat.name === editCategoryName);
      setCategory(match);
      setProducts(allProducts.filter((p: any) => match.productIds.includes(p.product_id)));
      setShowEditModal(false);

      if (editCategoryName !== category.name) {
        const newCatId = `${editCategoryName.replace(/\s+/g, '-').toLowerCase()}-${updatedCategories.indexOf(match)}`;
        router.replace(`/${userType}-dashboard/category/${newCatId}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update category");
    }
    setSaving(false);
  };

  const handleDeleteCategory = async () => {
    if (!window.confirm(`Are you sure you want to delete the category "${category.name}"?`)) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const catEndpoint = userType === 'admin'
        ? `${apiurl}/admin/custom-categories`
        : `${apiurl}/retailer/custom-categories`;

      await axios.delete(catEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: category.name },
      });

      router.push(userType === 'admin' ? '/post-login/admin' : '/post-login/retailer');
    } catch (err) {
      console.error(err);
      alert("Failed to delete category");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="text-gray-500 font-medium text-base">Loading category...</span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 mt-4 mb-2">Category Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">The category you are looking for does not exist or has been deleted.</p>
          <button
            onClick={() => router.push(userType === 'admin' ? '/post-login/admin' : '/post-login/retailer')}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Back to Categories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-0 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 mb-4 flex justify-start">
        <button
          onClick={() => router.push(userType === 'admin' ? '/post-login/admin' : '/post-login/retailer')}
          className="inline-flex items-center space-x-2 text-gray-500 hover:text-gray-950 transition-colors group cursor-pointer"
        >
          <FaArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="font-medium text-sm">Back to Categories</span>
        </button>
      </div>
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl shadow-gray-100/60 p-0 flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-white/80 to-gray-50/80 rounded-t-2xl gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-0">
            {category.name}
          </h1>
          {userType === 'admin' && (
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setEditCategoryName(category.name);
                  setEditCategoryProducts(category.productIds || []);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition cursor-pointer shadow-sm"
              >
                Edit Category
              </button>
              <button
                onClick={handleDeleteCategory}
                className="px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition cursor-pointer border border-red-100"
              >
                Delete Category
              </button>
            </div>
          )}
        </div>
        {products.length === 0 ? (
          <div className="text-gray-400 text-center py-12">No products in this category.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-2 pb-6">
            {products.map((product: any) => (
              <div
                key={product.product_id}
                className="bg-white/90 rounded-lg shadow-md shadow-gray-200/30 border border-gray-100 p-2 flex flex-col items-center hover:shadow-lg hover:shadow-blue-100/30 hover:-translate-y-0.5 transition-all duration-200 group"
                style={{ backdropFilter: 'blur(1.5px)' }}
              >
                <div className="h-20 w-20 mb-2 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white rounded-md overflow-hidden border border-gray-100 shadow-sm group-hover:shadow-md transition-all duration-200">
                  {product.images && product.images.length > 0 ? (
                    <img src={product.images[0]} alt={product.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-gray-200 text-3xl">🛒</div>
                  )}
                </div>
                <div className="font-semibold text-sm mb-1 text-center text-gray-900 group-hover:text-blue-700 transition-colors duration-200 line-clamp-2">{product.name}</div>
                <div className="text-gray-400 text-[11px] mb-1 text-center">{product.sku} | {product.brand}</div>
                <div className="text-gray-900 font-bold text-base mb-1">₹{product.price?.toFixed(2)}</div>
                <button
                  className="mt-auto px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold transition text-xs"
                  onClick={() => router.push(`/${userType}-dashboard/product/${product.product_id}`)}
                >
                  View Product
                </button>
                <button
                  className="w-full mt-1 px-2 py-1 bg-black text-white rounded hover:bg-gray-900 font-semibold transition text-xs"
                  onClick={() => alert('Add to cart functionality coming soon!')}
                >
                  Add to Cart
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Category Modal */}
      {showEditModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            boxSizing: 'border-box'
          }}>
            <h2 style={{ fontWeight: 600, fontSize: 20, marginBottom: 16, color: '#111' }}>Edit Category Products</h2>
            
            <label style={{ fontWeight: 500, fontSize: 14, color: '#374151', display: 'block', marginBottom: 6 }}>Category Name</label>
            <input
              type="text"
              placeholder="Category Name"
              value={editCategoryName}
              onChange={e => setEditCategoryName(e.target.value)}
              style={{ width: '100%', marginBottom: 16, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }}
            />

            <label style={{ fontWeight: 500, fontSize: 14, color: '#374151', display: 'block', marginBottom: 6 }}>Search Products</label>
            <input
              type="text"
              placeholder="Search by name, SKU, brand..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 16, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, boxSizing: 'border-box' }}
            />

            <label style={{ fontWeight: 500, fontSize: 14, color: '#374151', display: 'block', marginBottom: 6 }}>Select Products</label>
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px', marginBottom: 20 }}>
              {allProducts.filter((p: any) =>
                (p?.name && p.name.toLowerCase().includes(modalSearch.toLowerCase())) ||
                (p?.product_id && p.product_id.toLowerCase().includes(modalSearch.toLowerCase())) ||
                (p?.sku && p.sku.toLowerCase().includes(modalSearch.toLowerCase())) ||
                (p?.brand && p.brand.toLowerCase().includes(modalSearch.toLowerCase()))
              ).map((p: any) => (
                <label key={p.product_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={editCategoryProducts.includes(p.product_id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setEditCategoryProducts(prev => [...prev, p.product_id]);
                      } else {
                        setEditCategoryProducts(prev => prev.filter(id => id !== p.product_id));
                      }
                    }}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>ID: {p.product_id} | SKU: {p.sku} | Brand: {p.brand}</span>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 