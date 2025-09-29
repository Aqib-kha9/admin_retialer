"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { FaPen, FaArrowLeft } from 'react-icons/fa';
import { toast } from "react-hot-toast";

import { jwtDecode } from 'jwt-decode';

export default function ProductDetailsPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const router = useRouter();
  const params = useParams();
  const productId = params?.product_id;
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [cartQty, setCartQty] = useState(1);
  const [cart, setCart] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<any>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFields, setPendingFields] = useState<any>(null);
const apiurl = process.env.NEXT_PUBLIC_APIURL;
  // Get the correct dashboard path based on user type
  const getDashboardPath = () => {
    return userType === 'admin' ? '/admin-dashboard' : '/retailer-dashboard';
  };

  const handleBackToDashboard = () => {
    router.push(getDashboardPath());
  };

  // Utility to get user-specific cart key
  const getCartKey = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded: any = jwtDecode(token);
        const userId = decoded?.sub || decoded?.userid || decoded?.id;
        if (userId) return `cart_${userId}`;
      }
    } catch {}
    return 'cart';
  };

  useEffect(() => {
    if (!productId) return;
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const endpoint = userType === "admin" ? "/product/all" : "/product/all-retailer";
        const res = await axios.get(`${apiurl}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let found;
        if (userType === "admin") {
          found = res.data.find((p: any) => p.product_id === productId);
        } else if (userType === "retailer") {
          // Retailer: find and flatten
          const offers = res.data.offers || [];
          const entry = (res.data.retailerproducts || []).find((entry: any) => entry.product.product_id === productId);
          if (entry) {
            const productOffers = offers.filter((offer: any) => offer.product_id === entry.product.product_id);
            found = { ...entry.product, inventory: entry.inventory, offers: productOffers };
          } else {
            found = null;
          }
        } else {
          found = null;
        }
        setProduct(found);
      } catch (err) {
        setProduct(null);
      }
      setLoading(false);
    };
    fetchProduct();
    const cartKey = getCartKey();
    const storedCart = localStorage.getItem(cartKey);
    if (storedCart) setCart(JSON.parse(storedCart));
  }, [productId]);

  const getImageUrl = (img: string) => {
    if (!img) return '';
    if (img.startsWith('http')) return img;
    return `${apiurl}${img}`;
  };

  const handleAddToCart = () => {
    if (!product) return;
    const maxQty = product.inventory?.quantity || 1;
    const qty = Math.min(Number(cartQty), maxQty);
    let updatedCart = [...cart];
    const idx = updatedCart.findIndex((p) => p.product_id === product.product_id);
    if (idx !== -1) {
      // Already in cart, update quantity
      const prevQty = updatedCart[idx].cartQty || 1;
      const newQty = Math.min(prevQty + qty, maxQty);
      updatedCart[idx] = { ...updatedCart[idx], cartQty: newQty };
    } else {
      updatedCart.push({ ...product, cartQty: qty });
    }
    setCart(updatedCart);
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(updatedCart));
    toast.success("Product added to cart!");
  };

  const handleEditClick = () => {
    setEditing(true);
    setEditFields({
      ...product,
      quantity: product.inventory?.quantity ?? '',
      batch_no: product.inventory?.batch_no ?? '',
      expiry_date: product.inventory?.expiry_date ? new Date(product.inventory.expiry_date).toISOString().slice(0, 10) : '',
    });
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditFields((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Only send changed fields
    const changed: any = {};
    Object.keys(editFields).forEach((key) => {
      if (editFields[key] !== product[key]) changed[key] = editFields[key];
    });
    setPendingFields(changed);
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    setShowConfirm(false);
    if (!pendingFields || Object.keys(pendingFields).length === 0) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiurl}/product/update/${product.product_id}`, pendingFields, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Product updated!');
      setEditing(false);
      setPendingFields(null);
      // Refresh product
      const res = await axios.get(`${apiurl}/product/all`, { headers: { Authorization: `Bearer ${token}` } });
      const found = res.data.find((p: any) => p.product_id === productId);
      setProduct(found);
    } catch (err) {
      toast.error('Failed to update product');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!product) return <div className="p-8 text-red-500">Product not found.</div>;

  return (
    <div className="min-h-screen relative z-0 py-4 px-1 sm:px-4 flex flex-col items-center">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-white via-gray-50 to-gray-100" />
      <div className="w-full max-w-5xl mb-4">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to {userType === 'admin' ? 'Admin' : 'Retailer'} Dashboard</span>
          </button>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Details</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          {userType === 'admin' ? 'Use the edit button to update product details.' : 'View product information and add to cart.'}
        </p>
      </div>
      <div className="w-full max-w-5xl bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-0 flex flex-col md:flex-row gap-6 md:gap-10">
        {/* Images */}
        <div className="flex flex-col items-center md:w-1/2 w-full p-4 sm:p-6 bg-white">
          {product.images && product.images.length > 0 ? (
            <>
              <a
                href={getImageUrl(product.images[imgIdx])}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={getImageUrl(product.images[imgIdx])}
                  alt={product.name}
                  className="w-full max-w-xs sm:max-w-md h-56 sm:h-80 object-contain rounded-xl mb-4 border bg-white cursor-pointer transition-shadow hover:shadow-xl"
                />
              </a>
              {product.images.length > 1 && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {product.images.map((img: string, idx: number) => (
                    <img
                      key={idx}
                      src={getImageUrl(img)}
                      alt={product.name}
                      className={`w-12 h-12 sm:w-16 sm:h-16 object-cover rounded cursor-pointer border ${imgIdx === idx ? "border-gray-900" : "border-gray-200"} transition-shadow hover:shadow-md`}
                      onClick={() => setImgIdx(idx)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full max-w-xs sm:max-w-md h-56 sm:h-80 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400">No Image</div>
          )}
        </div>
        {/* Details */}
        <div className="md:w-1/2 w-full flex flex-col gap-4 p-4 sm:p-6 bg-gradient-to-br from-white to-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            {editing ? (
              <input value={editFields.name} onChange={e => handleFieldChange('name', e.target.value)} className="text-2xl sm:text-4xl font-bold mb-2 border px-2 py-1 rounded text-gray-900" />
            ) : (
              <h2 className="text-2xl sm:text-4xl font-bold mb-2 text-gray-900">{product.name}</h2>
            )}
            {!editing && userType === 'admin' && (
              <button
                onClick={handleEditClick}
                className="p-3 rounded-full bg-gray-600 hover:bg-blue-700 shadow-lg transition flex items-center justify-center group"
                title="Edit Product"
              >
                <FaPen className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                <span className="sr-only">Edit</span>
              </button>
            )}
          </div>
          <div className="text-lg sm:text-xl text-blue-700 mb-2">{product.short_description}</div>
          <div className="text-gray-600 mb-2 text-base sm:text-lg">{product.long_description}</div>
          <div className="flex flex-wrap gap-4 sm:gap-6 mb-2 text-base sm:text-lg">
            {/* For retailers, only show fields that exist in the product object. For admin, show all as before. */}
            {(userType === 'admin' || product.sku !== undefined) && (
              <div>
                <span className="font-semibold text-gray-700">SKU:</span>
                {editing && userType === 'admin' ? (
                  <input
                    type="text"
                    value={editFields.sku}
                    disabled
                    className="border rounded px-2 py-1 ml-2 w-24 sm:w-32 bg-gray-100 text-gray-500 cursor-not-allowed"
                  />
                ) : (
                  <span className="text-gray-800">{product.sku}</span>
                )}
              </div>
            )}
            {(userType === 'admin' || product.brand !== undefined) && (
              <div><span className="font-semibold text-gray-700">Brand:</span> {editing && userType === 'admin' ? (
                <input type="text" value={editFields.brand} onChange={e => handleFieldChange('brand', e.target.value)} className="border rounded px-2 py-1 ml-2 w-24 sm:w-32" />
              ) : <span className="text-gray-800">{product.brand}</span>}</div>
            )}
            {(userType === 'admin' || product.category !== undefined) && (
              <div><span className="font-semibold text-gray-700">Category:</span> {editing && userType === 'admin' ? (
                <input type="text" value={editFields.category} onChange={e => handleFieldChange('category', e.target.value)} className="border rounded px-2 py-1 ml-2 w-24 sm:w-32" />
              ) : <span className="text-gray-800">{product.category}</span>}</div>
            )}
            {(userType === 'admin' || product.subcategory !== undefined) && (
              <div><span className="font-semibold text-gray-700">Subcategory:</span> {editing && userType === 'admin' ? (
                <input type="text" value={editFields.subcategory} onChange={e => handleFieldChange('subcategory', e.target.value)} className="border rounded px-2 py-1 ml-2 w-24 sm:w-32" />
              ) : <span className="text-gray-800">{product.subcategory}</span>}</div>
            )}
          </div>
          {(userType === 'admin' || product.specification !== undefined) && (
            <div className="mb-2 text-base sm:text-lg"><span className="font-semibold text-gray-700">Specification:</span> <span className="text-gray-800">{product.specification}</span></div>
          )}
          <div className="mb-2 text-base sm:text-lg">
            <span className="font-semibold text-gray-700">Price:</span>
            {editing && userType === 'admin' ? (
              <input
                type="number"
                min={0}
                step={0.01}
                value={editFields.price}
                onChange={e => handleFieldChange('price', Number(e.target.value))}
                className="border rounded px-2 py-1 ml-2 w-24 sm:w-32"
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">₹{product.price?.toFixed(2) || '0.00'}</span>
            )}
          </div>
          
          {/* Offer Section */}
          {product.offers && product.offers.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-lg font-semibold text-green-800 mb-2">Available Offers</div>
              <ul className="space-y-2">
                {product.offers.map((offer: any) => (
                  <li key={offer._id || offer.id} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="font-semibold text-gray-800">{offer.title}</span>
                    <span className="text-green-600 font-semibold">
                      {offer.offer_type === 'percentage'
                        ? `${offer.offer_value}% off`
                        : offer.offer_type === 'flat'
                        ? `₹${offer.offer_value} off`
                        : offer.offer_value}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({offer.valid_from?.slice(0,10)} to {offer.valid_to?.slice(0,10)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Single Offer Price Section (if only one offer, show offer price breakdown) */}
          {product.offers && product.offers.length === 1 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-semibold text-green-800">Special Offer!</span>
                <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                  {product.offers[0].offer_type === 'percentage' ? `${product.offers[0].offer_value}% OFF` : `₹${product.offers[0].offer_value} OFF`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-gray-600 line-through">Original Price: ₹{product.price?.toFixed(2) || '0.00'}</span>
                  <div className="text-xl font-bold text-green-700">
                    Offer Price: ₹{(() => {
                      const offer = product.offers[0];
                      if (offer.offer_type === 'percentage') {
                        const discount = (product.price * offer.offer_value) / 100;
                        return (product.price - discount).toFixed(2);
                      } else {
                        return Math.max(0, product.price - offer.offer_value).toFixed(2);
                      }
                    })()}
                  </div>
                </div>
                <div className="text-sm text-green-600">
                  <div>You Save: ₹{(() => {
                    const offer = product.offers[0];
                    if (offer.offer_type === 'percentage') {
                      return ((product.price * offer.offer_value) / 100).toFixed(2);
                    } else {
                      return offer.offer_value.toFixed(2);
                    }
                  })()}</div>
                </div>
              </div>
              {product.offers[0].valid_to && (
                <div className="mt-2 text-xs text-green-600">
                  Valid until: {new Date(product.offers[0].valid_to).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
          
          <div className="mb-2 text-base sm:text-lg">
            <span className="font-semibold text-gray-700">Available Quantity:</span>
            {editing && userType === 'admin' ? (
              <input
                type="number"
                min={0}
                value={editFields.quantity}
                onChange={e => handleFieldChange('quantity', Number(e.target.value))}
                className="border rounded px-2 py-1 ml-2 w-24 sm:w-32"
              />
            ) : (
              <span className="text-gray-800">{product.inventory?.quantity || 0}</span>
            )}
          </div>
          <div className="mb-2 text-base sm:text-lg">
            <span className="font-semibold text-gray-700">Batch No:</span>
            {editing && userType === 'admin' ? (
              <input
                type="text"
                value={editFields.batch_no}
                onChange={e => handleFieldChange('batch_no', e.target.value)}
                className="border rounded px-2 py-1 ml-2 w-24 sm:w-32"
              />
            ) : (
              <span className="text-gray-800">{product.inventory?.batch_no || '-'}</span>
            )}
          </div>
          <div className="mb-2 text-base sm:text-lg">
            <span className="font-semibold text-gray-700">Expiry Date:</span>
            {editing && userType === 'admin' ? (
              <input
                type="date"
                value={editFields.expiry_date}
                onChange={e => handleFieldChange('expiry_date', e.target.value)}
                className="border rounded px-2 py-1 ml-2 w-40 sm:w-48"
              />
            ) : (
              <span className="text-gray-800">{product.inventory?.expiry_date ? new Date(product.inventory.expiry_date).toLocaleDateString() : '-'}</span>
            )}
          </div>
          {product.dimensions && (
            <div className="mb-2 text-base sm:text-lg">
              <span className="font-semibold text-gray-700">Dimensions:</span>
              <span className="ml-2 text-gray-800">L: {product.dimensions.length || '-'} cm</span>
              <span className="ml-2 text-gray-800">W: {product.dimensions.width || '-'} cm</span>
              <span className="ml-2 text-gray-800">H: {product.dimensions.height || '-'} cm</span>
              <span className="ml-2 text-gray-800">Wt: {product.dimensions.weight || '-'} kg</span>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            {!editing && (
              <>
            <input
              type="number"
              min={1}
              max={product.inventory?.quantity || 1}
              value={cartQty}
                  onChange={e => setCartQty(Number(e.target.value))}
                  className="border rounded px-2 py-1 w-24 sm:w-32"
                />
          <button
            onClick={handleAddToCart}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
          >
            Add to Cart
          </button>
              </>
            )}
          {editing && userType === 'admin' && (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
            </div>
      {/* Confirm Modal */}
          {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Changes</h3>
            <p className="mb-4">Are you sure you want to save these changes?</p>
                <div className="flex gap-4 justify-end">
              <button
                onClick={confirmSave}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
              >
                Yes, Save
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-300 text-gray-800 font-semibold hover:bg-gray-400 transition"
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