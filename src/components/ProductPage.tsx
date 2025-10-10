"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { FaPen, FaArrowLeft, FaTrash, FaPlus, FaTimes, FaSave, FaShoppingCart } from 'react-icons/fa';
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
  
  if (!product) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-900 mb-2">Product Not Found</div>
        <button
          onClick={handleBackToDashboard}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToDashboard}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition"
              >
                <FaArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900">Product Details</h1>
            </div>
            
            {userType === 'admin' && !editing && (
              <div className="flex space-x-3">
                <button
                  onClick={handleEditClick}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <FaPen className="w-4 h-4" />
                  <span>Edit Product</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  <FaTrash className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {userType === 'admin' ? 'Manage product details and inventory' : 'View product information'}
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
            {/* Images Section */}
            <div className="space-y-6">
              {/* Main Image */}
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                {(product.images && product.images.length > 0) || imagePreviews.length > 0 ? (
                  <img
                    src={getImageUrl((imagePreviews.length > 0 ? imagePreviews[0] : product.images[imgIdx]))}
                    alt={product.name}
                    className="w-full h-80 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-full h-80 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FaTimes className="w-8 h-8" />
                      </div>
                      <p>No Image Available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Image Thumbnails */}
              {(product.images && product.images.length > 0) || imagePreviews.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {/* Existing Images */}
                  {product.images && product.images.map((img: string, idx: number) => (
                    <div key={idx} className="relative group">
                      <img
                        src={getImageUrl(img)}
                        alt={`${product.name} ${idx + 1}`}
                        className={`w-full h-20 object-cover rounded-lg cursor-pointer border-2 ${
                          imgIdx === idx ? "border-blue-500" : "border-transparent"
                        }`}
                        onClick={() => setImgIdx(idx)}
                      />
                      {editing && userType === 'admin' && (
                        <button
                          onClick={() => removeExistingImage(img, idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FaTimes className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {/* New Image Previews */}
                  {imagePreviews.map((preview, idx) => (
                    <div key={`new-${idx}`} className="relative group">
                      <img
                        src={preview}
                        alt={`New image ${idx + 1}`}
                        className="w-full h-20 object-cover rounded-lg border-2 border-blue-300"
                      />
                      {editing && userType === 'admin' && (
                        <button
                          onClick={() => removeNewImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FaTimes className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Image Upload Section */}
              {editing && userType === 'admin' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <FaPlus className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600">Add Images</span>
                    <span className="text-xs text-gray-500">Click or drag and drop</span>
                  </label>
                  
                  {newImages.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={uploadAndUpdateProduct}
                        disabled={uploadingImages}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {uploadingImages ? 'Uploading...' : `Upload ${newImages.length} Image(s)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              {/* Product Name */}
              <div>
                {editing ? (
                  <input
                    value={editFields.name}
                    onChange={e => handleFieldChange('name', e.target.value)}
                    className="w-full text-3xl font-bold text-gray-900 border-b-2 border-gray-300 pb-2 focus:outline-none focus:border-blue-500"
                    placeholder="Product Name"
                  />
                ) : (
                  <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="text-lg text-gray-700 mb-2">{product.short_description}</div>
                <div className="text-gray-600 leading-relaxed">{product.long_description}</div>
              </div>

              {/* Basic Information Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editFields.sku}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.sku}</div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editFields.brand}
                      onChange={e => handleFieldChange('brand', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.brand}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editFields.category}
                      onChange={e => handleFieldChange('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.category}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editFields.subcategory}
                      onChange={e => handleFieldChange('subcategory', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.subcategory}</div>
                  )}
                </div>
              </div>

              {/* Price Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                {editing ? (
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={editFields.price}
                    onChange={e => handleFieldChange('price', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                ) : (
                  <div className="text-3xl font-bold text-gray-900">₹{product.price?.toFixed(2) || '0.00'}</div>
                )}
              </div>

              {/* Inventory Information */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  {editing ? (
                    <input
                      type="number"
                      min={0}
                      value={editFields.quantity}
                      onChange={e => handleFieldChange('quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.inventory?.quantity || 0}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch No</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editFields.batch_no}
                      onChange={e => handleFieldChange('batch_no', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">{product.inventory?.batch_no || '-'}</div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  {editing ? (
                    <input
                      type="date"
                      value={editFields.expiry_date}
                      onChange={e => handleFieldChange('expiry_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  ) : (
                    <div className="text-gray-900 font-medium">
                      {product.inventory?.expiry_date ? new Date(product.inventory.expiry_date).toLocaleDateString() : '-'}
                    </div>
                  )}
                </div>
              </div>

              {/* Offers Section */}
              {product.offers && product.offers.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-800 mb-3">Active Offers</h3>
                  <div className="space-y-3">
                    {product.offers.map((offer: any) => (
                      <div key={offer._id || offer.id} className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-800">{offer.title}</div>
                          <div className="text-sm text-green-600 font-semibold">
                            {offer.offer_type === 'percentage' 
                              ? `${offer.offer_value}% OFF` 
                              : `₹${offer.offer_value} OFF`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {offer.valid_from?.slice(0,10)} to {offer.valid_to?.slice(0,10)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                {!editing ? (
                  <>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantity to Add</label>
                      <div className="flex space-x-3">
                        <input
                          type="number"
                          min={1}
                          max={product.inventory?.quantity || 1}
                          value={cartQty}
                          onChange={e => setCartQty(Number(e.target.value))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={handleAddToCart}
                          className="flex items-center space-x-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
                        >
                          <FaShoppingCart className="w-4 h-4" />
                          <span>Add to Cart</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex space-x-3 w-full">
                    <button
                      onClick={handleSave}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <FaSave className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Changes</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to save these changes to the product?</p>
            <div className="flex space-x-3">
              <button
                onClick={confirmSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Yes, Save
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Product</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{product.name}"? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteProduct}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
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