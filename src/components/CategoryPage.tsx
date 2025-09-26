"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

export default function CategoryPage({ userType }: { userType: 'admin' | 'retailer' }) {
  const params = useParams();
  const router = useRouter();
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryAndProducts = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        // Fetch all categories
        const catEndpoint = userType === 'admin'
          ? 'http://localhost:4000/admin/custom-categories'
          : 'http://localhost:4000/retailer/custom-categories';
        const catRes = await axios.get(catEndpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const allCategories = catRes.data || [];
        // Find category by slugified name and index
        const catId = params.category_id as string;
        const match = allCategories.find((cat: any, idx: number) =>
          `${cat.name.replace(/\s+/g, '-').toLowerCase()}-${idx}` === catId
        );
        setCategory(match);
        if (match && match.productIds && match.productIds.length > 0) {
          // Fetch all products, then filter
          const prodEndpoint = userType === 'admin'
            ? 'http://localhost:4000/product/all'
            : 'http://localhost:4000/product/all-retailer';
          const prodRes = await axios.get(prodEndpoint, {
            headers: { Authorization: `Bearer ${token}` },
          });
          let allProducts = prodRes.data || [];
          if (userType === 'retailer') {
            // Flatten retailerproducts and attach offers
            const offers = prodRes.data.offers || [];
            allProducts = (prodRes.data.retailerproducts || []).map((entry: any) => {
              const productOffers = offers.filter((offer: any) => offer.product_id === entry.product.product_id);
              return {
                ...entry.product,
                inventory: entry.inventory,
                offers: productOffers
              };
            });
          }
          setProducts(allProducts.filter((p: any) => match.productIds.includes(p.product_id)));
        } else {
          setProducts([]);
        }
      } catch (err) {
        setCategory(null);
        setProducts([]);
      }
      setLoading(false);
    };
    fetchCategoryAndProducts();
  }, [params.category_id, userType]);

  if (loading) return <div className="p-8 text-lg">Loading...</div>;
  if (!category) return <div className="p-8 text-red-500">Category not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-0 flex flex-col items-center">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl shadow-gray-100/60 p-0 flex flex-col gap-8">
        <h1 className="text-3xl font-bold text-center py-8 border-b border-gray-100 mb-0 tracking-tight text-gray-900 bg-gradient-to-r from-white/80 to-gray-50/80 rounded-t-2xl">
          {category.name}
        </h1>
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
                <div className="text-gray-900 font-bold text-base mb-1">{product.price?.toFixed(2)}</div>
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
    </div>
  );
} 