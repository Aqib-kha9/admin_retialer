"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { FaPen, FaArrowLeft, FaTrash, FaPlus, FaTimes, FaSave, FaShoppingCart, FaBox, FaTag, FaBarcode, FaCalendarAlt, FaHistory, FaCheckCircle, FaMinus, FaPercentage, FaDatabase, FaExchangeAlt, FaSearch } from 'react-icons/fa';
import { toast } from "react-hot-toast";
import { jwtDecode } from 'jwt-decode';
import AdminNavbar from "./AdminNavbar";
import RetailerNavbar from "./RetailerNavbar";
import UniversalLoader from "./UniversalLoader";
import { motion, AnimatePresence } from "framer-motion";

// Helper component for technical data rows
const TechInfoRow = ({ label, value, icon: Icon }: { label: string; value: any; icon: any }) => {
  if (!value || value === "0" || value === "No" || value === "Not Applicable") return null;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 group">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-gray-900 transition-colors">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-700">{value}</span>
    </div>
  );
};

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
  const [uploadingImages, setUploadingImages] = useState(false);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
        console.error('Error fetching product:', err);
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

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    setNewImages(prev => [...prev, ...fileArray]);

    const previewPromises = fileArray.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(previewPromises).then(previews => {
      setImagePreviews(prev => [...prev, ...previews]);
    });

    e.target.value = '';
  };

  // Remove new image before upload
  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Remove existing image
  const removeExistingImage = async (imageUrl: string, index: number) => {
    if (!product || !editing || userType !== 'admin') return;

    try {
      const token = localStorage.getItem('token');
      
      const updatedImages = product.images.filter((_: any, i: number) => i !== index);
      setProduct({ ...product, images: updatedImages });
      setEditFields({ ...editFields, images: updatedImages });

      await axios.post(
        `${apiurl}/product/update/${product.product_id}`,
        { images: updatedImages },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Image removed successfully!');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove image');
    }
  };

  // Upload new images
  const uploadAndUpdateProduct = async () => {
    if (newImages.length === 0) return;

    setUploadingImages(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      newImages.forEach((file, index) => {
        formData.append('images', file);
      });
      
      formData.append('product_id', product.product_id);

      const response = await axios.post(
        `${apiurl}/product/upload-images`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success && response.data.images) {
        const updatedImages = [...(product.images || []), ...response.data.images];
        
        setProduct({ ...product, images: updatedImages });
        setEditFields({ ...editFields, images: updatedImages });
        
        setNewImages([]);
        setImagePreviews([]);
        toast.success(`Successfully uploaded ${response.data.images.length} images!`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async () => {
    if (!product) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${apiurl}/product/delete/${product.product_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      toast.success('Product deleted successfully!');
      router.push(getDashboardPath());
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    const maxQty = product.inventory?.quantity || 1;
    const qty = Math.min(Number(cartQty), maxQty);
    let updatedCart = [...cart];
    const idx = updatedCart.findIndex((p) => p.product_id === product.product_id);
    if (idx !== -1) {
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

  const handleSave = async () => {
    if (newImages.length > 0) {
      await uploadAndUpdateProduct();
    }

    const changed: any = {};
    Object.keys(editFields).forEach((key) => {
      if (key !== 'images' && editFields[key] !== product[key]) {
        changed[key] = editFields[key];
      }
    });

    if (Object.keys(changed).length > 0) {
      setPendingFields(changed);
      setShowConfirm(true);
    } else if (newImages.length === 0) {
      toast('No changes to save');
      setEditing(false);
    } else {
      setEditing(false);
    }
  };

  const confirmSave = async () => {
    setShowConfirm(false);
    if (!pendingFields || Object.keys(pendingFields).length === 0) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiurl}/product/update/${product.product_id}`, pendingFields, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Product updated successfully!');
      setEditing(false);
      setPendingFields(null);
      
      // Refresh product data
      const endpoint = userType === "admin" ? "/product/all" : "/product/all-retailer";
      const res = await axios.get(`${apiurl}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const found = res.data.find((p: any) => p.product_id === productId);
      setProduct(found);
    } catch (err) {
      toast.error('Failed to update product');
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setNewImages([]);
    setImagePreviews([]);
  };

  if (loading) return <UniversalLoader />;
  
  if (!product) return (
    <div className="min-h-screen bg-white">
      {userType === 'admin' ? <AdminNavbar active="product" /> : <RetailerNavbar active="product" />}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4">
        <div className="text-center group">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 transition-transform group-hover:scale-110 duration-500">
            <FaBox className="text-gray-300 text-3xl" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto text-sm sm:text-base">The product you are looking for might have been moved or deleted.</p>
          <button
            onClick={handleBackToDashboard}
            className="inline-flex items-center space-x-2 px-8 py-3 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all active:scale-95 font-medium text-sm sm:text-base"
          >
            <FaArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {userType === 'admin' ? <AdminNavbar active="product" /> : <RetailerNavbar active="product" />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
        >
          {/* Left Column: Image Gallery */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            <div className="relative group rounded-2xl sm:rounded-[32px] overflow-hidden bg-gray-50 border border-gray-100 aspect-square flex items-center justify-center p-4 sm:p-8 transition-all hover:bg-gray-100/50">
              <AnimatePresence mode="wait">
                {(product.images && product.images.length > 0) || imagePreviews.length > 0 ? (
                  <motion.img
                    key={imgIdx + (imagePreviews.length > 0 ? 'preview' : 'existing')}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    src={getImageUrl((imagePreviews.length > 0 ? imagePreviews[imgIdx] : product.images[imgIdx]))}
                    alt={product.name}
                    className="w-full h-full object-contain drop-shadow-xl"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-300">
                    <FaBox className="text-4xl sm:text-6xl mb-4" />
                    <span className="font-medium text-sm sm:text-base">No Image Available</span>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Thumbnails */}
            <div className="flex space-x-3 overflow-x-auto pb-4 px-1 custom-scrollbar scroll-smooth">
              {(product.images || []).map((img: string, idx: number) => (
                <button 
                  key={idx}
                  onClick={() => setImgIdx(idx)}
                  className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden border-2 transition-all duration-300 ${imgIdx === idx ? "border-gray-900 scale-105 shadow-md" : "border-gray-100 hover:border-gray-300"}`}
                >
                  <img src={getImageUrl(img)} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                  {editing && userType === 'admin' && (
                    <div onClick={(e) => { e.stopPropagation(); removeExistingImage(img, idx); }} className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FaTimes className="w-2 h-2" />
                    </div>
                  )}
                </button>
              ))}
              {imagePreviews.map((preview, idx) => (
                <button 
                  key={`new-${idx}`}
                  className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-dashed border-blue-400 p-1 bg-blue-50/30"
                >
                  <img src={preview} alt="New" className="w-full h-full object-cover rounded-lg sm:rounded-xl" />
                </button>
              ))}
              {editing && userType === 'admin' && (
                <label className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <FaPlus className="text-gray-300" />
                  <input type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Right Column: Information */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-10">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center flex-wrap gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold rounded-full">
                  {editing ? (
                    <input value={editFields.brand} onChange={e => handleFieldChange('brand', e.target.value)} className="bg-transparent border-none focus:ring-0 p-0 w-20" />
                  ) : product.brand}
                </span>
                <span className={`px-3 py-1 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold rounded-full ${product.inventory?.quantity > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                  {product.inventory?.quantity > 0 ? "In Stock" : "Out of Stock"}
                </span>
              </div>
              
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  {editing ? (
                    <input 
                      value={editFields.name} 
                      onChange={e => handleFieldChange('name', e.target.value)}
                      className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 border-b-2 border-gray-100 focus:border-gray-900 outline-none w-full bg-transparent transition-all"
                    />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                      {product.name}
                    </h1>
                  )}
                </div>
                {userType === 'admin' && !editing && (
                  <div className="flex space-x-2 flex-shrink-0">
                    <button onClick={handleEditClick} className="p-2.5 sm:p-3 bg-gray-50 text-gray-500 rounded-xl sm:rounded-2xl hover:text-gray-900 hover:bg-gray-100 transition-all active:scale-90">
                      <FaPen className="w-3.5 h-3.5 sm:w-4 h-4" />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2.5 sm:p-3 bg-red-50 text-red-400 rounded-xl sm:rounded-2xl hover:text-red-500 hover:bg-red-100 transition-all active:scale-90">
                      <FaTrash className="w-3.5 h-3.5 sm:w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-gray-500 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl italic">
                {product.short_description || "No description provided."}
              </p>
            </div>

            {/* Pricing Section */}
            <div className="flex items-center space-x-6">
              <div className="space-y-1">
                <span className="text-gray-400 text-xs sm:text-sm font-medium">Retail Price</span>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                  ₹{editing ? (
                    <input type="number" value={editFields.price} onChange={e => handleFieldChange('price', Number(e.target.value))} className="bg-transparent border-none focus:ring-0 w-32 inline-block p-0 font-bold" />
                  ) : product.price?.toFixed(2)}
                </div>
              </div>
              {product.offers?.length > 0 && (
                <div className="bg-orange-50 text-orange-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl flex items-center space-x-2">
                  <FaTag className="w-3 h-3" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Offer Active</span>
                </div>
              )}
            </div>

            {/* Specification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 space-y-1.5 sm:space-y-2">
                <div className="flex items-center space-x-2 text-gray-400">
                  <FaBarcode className="w-2.5 h-2.5 sm:w-3 h-3" />
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider">SKU Code</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate">{product.sku}</div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 space-y-1.5 sm:space-y-2">
                <div className="flex items-center space-x-2 text-gray-400">
                  <FaTag className="w-2.5 h-2.5 sm:w-3 h-3" />
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider">Category</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                   {editing ? (
                    <input value={editFields.category} onChange={e => handleFieldChange('category', e.target.value)} className="bg-transparent border-none focus:ring-0 w-full p-0 font-bold text-xs sm:text-sm" />
                   ) : product.category}
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 space-y-1.5 sm:space-y-2">
                <div className="flex items-center space-x-2 text-gray-400">
                  <FaHistory className="w-2.5 h-2.5 sm:w-3 h-3" />
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider">Stock</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-800">
                  {editing ? (
                    <input type="number" value={editFields.quantity} onChange={e => handleFieldChange('quantity', Number(e.target.value))} className="bg-transparent border-none focus:ring-0 w-full p-0 font-bold text-xs sm:text-sm" />
                  ) : `${product.inventory?.quantity || 0} Units`}
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 space-y-1.5 sm:space-y-2">
                <div className="flex items-center space-x-2 text-gray-400">
                  <FaBarcode className="w-2.5 h-2.5 sm:w-3 h-3" />
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider">Batch No</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                   {editing ? (
                    <input value={editFields.batch_no} onChange={e => handleFieldChange('batch_no', e.target.value)} className="bg-transparent border-none focus:ring-0 w-full p-0 font-bold text-xs sm:text-sm" />
                   ) : product.inventory?.batch_no || "N/A"}
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl border border-gray-100 space-y-1.5 sm:space-y-2 col-span-2">
                <div className="flex items-center space-x-2 text-gray-400">
                  <FaCalendarAlt className="w-2.5 h-2.5 sm:w-3 h-3" />
                  <span className="text-[8px] sm:text-[10px] uppercase font-bold tracking-wider">Expiry Date</span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-gray-800">
                   {editing ? (
                    <input type="date" value={editFields.expiry_date} onChange={e => handleFieldChange('expiry_date', e.target.value)} className="bg-transparent border-none focus:ring-0 w-full p-0 font-bold text-xs sm:text-sm" />
                   ) : product.inventory?.expiry_date ? new Date(product.inventory.expiry_date).toLocaleDateString() : "No Expiry"}
                </div>
              </div>
            </div>

            {/* Action Widget */}
            <div className="pt-4 sm:pt-6">
              {!editing ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <div className="flex items-center justify-between sm:justify-start bg-gray-100 rounded-2xl p-1.5 border border-gray-200">
                    <button 
                      onClick={() => setCartQty(Math.max(1, cartQty - 1))}
                      className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-all active:scale-90"
                    ><FaMinus className="w-3 h-3" /></button>
                    <input 
                      type="number"
                      value={cartQty}
                      onChange={e => setCartQty(Number(e.target.value))}
                      className="w-12 sm:w-16 bg-transparent text-center font-bold text-base sm:text-lg focus:ring-0 border-none p-0"
                    />
                    <button 
                      onClick={() => setCartQty(cartQty + 1)}
                      className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-all active:scale-90"
                    ><FaPlus className="w-3 h-3" /></button>
                  </div>
                  <button 
                    onClick={handleAddToCart}
                    disabled={product.inventory?.quantity === 0}
                    className="flex-1 flex items-center justify-center space-x-3 bg-gray-900 text-white py-4 px-6 sm:px-8 rounded-2xl font-bold hover:bg-black transition-all active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 disabled:scale-100 shadow-xl shadow-gray-200/20 text-sm sm:text-base"
                  >
                    <FaShoppingCart className="w-4 h-4 sm:w-5 h-5" />
                    <span>{product.inventory?.quantity === 0 ? "Out of Stock" : "Add to Order"}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                   <button 
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center space-x-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all active:scale-95 shadow-xl shadow-gray-200/20 text-sm sm:text-base"
                  >
                    <FaCheckCircle className="w-4 h-4 sm:w-5 h-5" />
                    <span>Save Changes</span>
                  </button>
                  <button 
                    onClick={cancelEdit}
                    className="px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95 text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Technical Intelligence Section (Expanded with Tally Data) */}
            <div className="pt-8 sm:pt-10 border-t border-gray-100">
              <h3 className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-6 flex items-center">
                <FaDatabase className="mr-2 w-3 h-3" />
                Technical Intelligence
              </h3>
              
              <div className="bg-gray-50/50 rounded-[24px] p-6 border border-gray-100/50">
                <div className="space-y-0 text-gray-900">
                  {/* Tax & Units */}
                  <TechInfoRow label="HSN Code" value={product.attributes?.hsn || product.attributes?.HL_HSN_CODE} icon={FaBarcode} />
                  <TechInfoRow label="GST Status" value={product.attributes?.gst || product.attributes?.GSTAPPLICABLE} icon={FaPercentage} />
                  <TechInfoRow label="Base Unit" value={product.attributes?.base_unit || product.attributes?.BASEUNITS} icon={FaBox} />
                  <TechInfoRow label="Conversion" value={product.attributes?.CONVERSION} icon={FaExchangeAlt} />

                  {/* Financials / Opening Stock */}
                  <TechInfoRow label="Opening Bal" value={product.attributes?.OPENINGBALANCE || product.opening_balance} icon={FaHistory} />
                  <TechInfoRow label="Opening Value" value={product.attributes?.OPENINGVALUE || product.opening_value} icon={FaDatabase} />
                  <TechInfoRow label="Opening Rate" value={product.attributes?.OPENINGRATE} icon={FaTag} />

                  {/* Classification */}
                  <TechInfoRow label="Parent Group" value={product.attributes?.PARENT || product.parent} icon={FaBox} />
                  <TechInfoRow label="Category" value={product.attributes?.CATEGORY} icon={FaTag} />
                  <TechInfoRow label="Description" value={product.attributes?.DESCRIPTION} icon={FaBarcode} />
                  
                  {/* Metadata */}
                  <TechInfoRow label="Tally GUID" value={product.attributes?.GUID} icon={FaSearch} />
                  <TechInfoRow label="Alter ID" value={product.attributes?.ALTERID} icon={FaHistory} />
                </div>
              </div>
            </div>

            {/* Insight / Intelligence Summary */}
            <div className="pt-8">
               <h3 className="text-[10px] uppercase tracking-widest font-black text-gray-400 mb-4">Strategic Description</h3>
               <p className="text-gray-600 leading-relaxed text-sm sm:text-base italic">
                "{product.long_description || "Detailed intelligence logs for this SKU are currently synchronized with the Tally ERP system."}"
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center mx-auto border border-gray-100">
                <FaCheckCircle className="text-xl sm:text-2xl" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Sync Updates?</h3>
                <p className="text-gray-500 text-xs sm:text-sm">This will synchronize product data across all retailer portals.</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button onClick={confirmSave} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all active:scale-95 text-sm sm:text-base">Push Updates</button>
                <button onClick={() => setShowConfirm(false)} className="w-full text-gray-400 font-bold hover:text-gray-600 transition-colors py-2 text-xs sm:text-sm uppercase tracking-widest leading-none">Keep Editing</button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
                <FaTrash className="text-xl sm:text-2xl" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Purge Data?</h3>
                <p className="text-gray-500 text-xs sm:text-sm">This action will erase the product and all associated inventory history.</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button onClick={handleDeleteProduct} className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all active:scale-95 text-sm sm:text-base">Confirm Purge</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="w-full text-gray-400 font-bold hover:text-gray-600 transition-colors py-2 text-xs sm:text-sm uppercase tracking-widest leading-none">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}