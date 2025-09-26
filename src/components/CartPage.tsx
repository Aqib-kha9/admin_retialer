"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

// ...other necessary imports from the original cart page...

export default function CartPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const [cart, setCart] = useState<any[]>([]);
  const router = useRouter();

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
    const cartKey = getCartKey();
    const storedCart = localStorage.getItem(cartKey);
    if (storedCart) setCart(JSON.parse(storedCart));
  }, []);

  const handleResetCart = () => {
    setCart([]);
    const cartKey = getCartKey();
    localStorage.removeItem(cartKey);
  };

  const handleQtyChange = (idx: number, value: number) => {
    let newCart = [...cart];
    const maxQty = newCart[idx].inventory?.quantity || 1;
    let qty = Math.max(1, Math.min(value, maxQty));
    newCart[idx].cartQty = qty;
    setCart(newCart);
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(newCart));
  };

  const handleRemove = (idx: number) => {
    let newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(newCart));
  };

  const getOfferPrice = (product: any) => {
    if (product && product.offers && product.offers.length > 0) {
      const offer = product.offers[0];
      let offerPrice = product.price;
      if (offer.offer_type === 'flat') {
        offerPrice = product.price - offer.offer_value;
      } else if (offer.offer_type === 'percentage') {
        offerPrice = product.price * (1 - offer.offer_value / 100);
      }
      if (offerPrice < 0) offerPrice = 0;
      return offerPrice;
    }
    return product && product.price ? product.price : 0;
  };

  const totalAmount = cart.reduce((sum, p) => sum + (getOfferPrice(p) * (p.cartQty || 1)), 0);

  const handleGoToInvoiceb2c = () => {
    localStorage.setItem('invoiceCart', JSON.stringify(cart));
    router.push(userType === 'admin' ? '/admin-dashboard/invoiceb2c' : '/retailer-dashboard/invoiceb2c');
  };

  const handleGoToInvoiceb2b = () => {
    localStorage.setItem('invoiceCart', JSON.stringify(cart));
    router.push(userType === 'admin' ? '/admin-dashboard/invoiceb2b' : '/retailer-dashboard/invoiceb2b');
  }

  // Dynamically determine which columns to show based on cart contents
  const possibleFields = [
    { key: 'images', label: 'Image' },
    { key: 'name', label: 'Name' },
    { key: 'product_id', label: 'Product ID' },
    { key: 'sku', label: 'SKU' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'cartQty', label: 'Quantity' },
  ];
  const shownFields = possibleFields.filter(f => cart.some(p => p[f.key] !== undefined && p[f.key] !== null && (f.key !== 'images' || (Array.isArray(p.images) && p.images.length > 0))));

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 relative">
      
      <button
        onClick={() => router.push(userType === 'admin' ? '/admin-dashboard' : '/retailer-dashboard')}
        className="fixed top-8 left-8 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 z-50"
      >
        Back
      </button>
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-6">Your Cart</h1>
        {cart.length === 0 ? (
          <div className="text-gray-500 mb-6">Your cart is empty.</div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead>
                <tr>
                  {shownFields.map(f => (
                    <th key={f.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{f.label}</th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remove</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {shownFields.map(f => {
                      if (f.key === 'images') {
                        return (
                          <td key="images" className="px-4 py-2">
                            {product.images && product.images.length > 0 ? (
                              <img src={product.images[0]} alt={product.name} className="w-14 h-14 object-cover rounded" />
                            ) : (
                              <div className="w-14 h-14 bg-gray-200 rounded flex items-center justify-center text-gray-400">No Image</div>
                            )}
                          </td>
                        );
                      }
                      if (f.key === 'cartQty') {
                        return (
                          <td key="cartQty" className="px-4 py-2">
                            <input
                              type="number"
                              min={1}
                              max={product.inventory?.quantity || 1}
                              value={product.cartQty || 1}
                              onChange={e => handleQtyChange(idx, Number(e.target.value))}
                              className="w-16 border border-gray-300 rounded-md py-1 px-2"
                            />
                            <span className="ml-2 text-xs text-gray-500">/ {product.inventory?.quantity || 1}</span>
                          </td>
                        );
                      }
                      if (f.key === 'price') {
                        return (
                          <td key="price" className="px-4 py-2">
                            {product.offers && product.offers.length > 0 ? (
                              <>
                                <span className="line-through text-gray-400 mr-2">₹{product.price?.toFixed(2)}</span>
                                <span className="text-green-600 font-semibold">₹{getOfferPrice(product).toFixed(2)}</span>
                              </>
                            ) : (
                              <>₹{product.price?.toFixed(2)}</>
                            )}
                          </td>
                        );
                      }
                      return (
                        <td key={f.key} className="px-4 py-2">{product[f.key]}</td>
                      );
                    })}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleRemove(idx)}
                        className="text-red-500 hover:text-red-700 text-xs px-2 py-1 border border-red-200 rounded"
                        aria-label="Remove"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end mb-6">
              <span className="font-bold text-lg">Total: ₹{totalAmount.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
      <div className="fixed bottom-8 right-8 flex gap-4 z-50">
        <button
          onClick={handleGoToInvoiceb2c}
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          Generate Invoice B2C
        </button>
        <button
          onClick={handleGoToInvoiceb2b}
          className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          Generate Invoice B2B
        </button>
        <button
          onClick={handleResetCart}
          className="px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-md hover:bg-gray-100"
        >
          Reset Cart
        </button>
      </div>
    </div>
  );
} 