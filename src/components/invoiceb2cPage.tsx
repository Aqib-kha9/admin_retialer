"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Utility to convert number to words (simple version for INR)
function numberToWords(num: number): string {
  // You can use a library for more robust conversion
  const a = [ '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen' ];
  const b = [ '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety' ];
  if ((num = num || 0) === 0) return 'Zero';
  if (num > 999999999) return 'Overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{3})$/);
  if (!n) return '';
  let str = '';
  str += (+n[1] ? (a[+n[1]] || b[+n[1][0]] + ' ' + a[+n[1][1]]) + ' Crore ' : '');
  str += (+n[2] ? (a[+n[2]] || b[+n[2][0]] + ' ' + a[+n[2][1]]) + ' Lakh ' : '');
  str += (+n[3] ? (a[+n[3]] || b[+n[3][0]] + ' ' + a[+n[3][1]]) + ' Thousand ' : '');
  str += (+n[4] ? (a[+n[4]] || b[+n[4][0]] + ' ' + a[+n[4][1]]) + ' ' : '');
  return str.trim() + 'Only';
}

type ProductRow = { [key: string]: string | number };
type PartyInfo = { [key: string]: string };
type ExtraField = { key: string; value: string };

const defaultColumns = [
  "S. No.",
  "Product Name",
  "HSN Code",
  "Qty",
  "Price (₹)",
  "Offer Price (₹)",
  "Taxable Value (₹)",
  "GST %",
  "GST Amt (₹)",
  "Total (₹)"
];

type InvoiceB2CPageProps = { userType: 'admin' | 'retailer' };

export default function InvoicePage({ userType }: InvoiceB2CPageProps) {
  const [invoiceData, setInvoiceData] = useState<{
    invoiceNo: string;
    date: string;
    orderId: string;
    paymentMode: string;
    seller: PartyInfo;
    buyer: PartyInfo;
    shipping: PartyInfo;
    columns: string[];
    products: ProductRow[];
    summaryRow: any[];
    taxSummary: { [key: string]: any };
    grandTotal: string;
    amountWords: string;
    declaration: string;
    logo?: string;
    storeInfo?: PartyInfo;
    extraFields?: ExtraField[];
  }>({
    invoiceNo: "",
    date: "",
    orderId: "",
    paymentMode: "Prepaid",
    seller: { name: "", address: "", gstin: "", pan: "", contact: "" },
    buyer: { name: "", address: "", phone: "", gstin: "", email: "" },
    shipping: { name: "", address: "", courier: "", trackingNo: "" },
    columns: defaultColumns,
    products: [
      { "Product Name": "", "HSN Code": "", "Qty": 1, "Price (₹)": 0, "Offer Price (₹)": 0, "Taxable Value (₹)": 0, "GST %": 0, "GST Amt (₹)": 0, "Total (₹)": 0 }
    ],
    summaryRow: [],
    taxSummary: {},
    grandTotal: "",
    amountWords: "",
    declaration: "",
    logo: "",
    storeInfo: { name: "", address: "", gstin: "", pan: "", contact: "" },
    extraFields: []
  });
  const [logoPreview, setLogoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Prefill products from cart if present
  useEffect(() => {
    const storedCart = localStorage.getItem('invoiceCart');
    if (storedCart) {
      const cart = JSON.parse(storedCart);
      setInvoiceData(prev => ({
        ...prev,
        products: cart.map((product: any, idx: number) => {
          // Calculate offer price as in cart page
          let offerPrice = 0;
          if (product && product.offers && product.offers.length > 0) {
            const offer = product.offers[0];
            if (offer.offer_type === 'flat') {
              offerPrice = product.price - offer.offer_value;
            } else if (offer.offer_type === 'percentage') {
              offerPrice = product.price * (1 - offer.offer_value / 100);
            }
            if (offerPrice < 0) offerPrice = 0;
          }
          return {
          "Product Name": product.name || "",
          "HSN Code": product.hsn || "",
          "Qty": product.cartQty || 1,
            "Price (₹)": product.price || 0,
            "Offer Price (₹)": offerPrice,
          "Taxable Value (₹)": 0,
          "GST %": product.gst || 0,
          "GST Amt (₹)": 0,
          "Total (₹)": 0
          };
        })
      }));
    }
  }, []);

  // Logo upload handler (only set preview when file is uploaded)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string);
        setInvoiceData((prev) => ({ ...prev, logo: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Extra fields handlers
  const addExtraField = () => {
    setInvoiceData((prev) => ({
      ...prev,
      extraFields: [...(prev.extraFields || []), { key: '', value: '' }]
    }));
  };
  const removeExtraField = (idx: number) => {
    setInvoiceData((prev) => ({
      ...prev,
      extraFields: (prev.extraFields || []).filter((_, i) => i !== idx)
    }));
  };
  const handleExtraFieldChange = (idx: number, field: 'key' | 'value', value: string) => {
    setInvoiceData((prev) => {
      const extraFields = [...(prev.extraFields || [])];
      extraFields[idx] = { ...extraFields[idx], [field]: value };
      return { ...prev, extraFields };
    });
  };

  // Add/remove product rows
  const addProductRow = () => {
    setInvoiceData((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        Object.fromEntries(prev.columns.map((col) => [col, col === "Qty" ? 1 : ""])) as ProductRow
      ]
    }));
  };
  const removeProductRow = (idx: number) => {
    setInvoiceData((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== idx)
    }));
  };

  // Handle product field change
  const handleProductChange = (idx: number, field: string, value: any) => {
    setInvoiceData((prev) => {
      const products = [...prev.products];
      products[idx] = { ...products[idx], [field]: value };
      return { ...prev, products };
    });
  };

  // Handle other field changes
  const handleChange = (section: string, field: string, value: any) => {
    setInvoiceData((prev) => ({
      ...prev,
      [section]: { ...(prev as any)[section], [field]: value }
    }));
  };
  const handleRootChange = (field: string, value: any) => {
    setInvoiceData((prev) => ({ ...prev, [field]: value }));
  };

  // Download PDF
  const handleDownload = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch("http://localhost:4000/invoice/generate-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(invoiceData)
    });
    if (!response.ok) {
      // Try to parse error message if available
      let errorMsg = "Failed to generate PDF";
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorMsg;
      } catch (e) {}
      alert(`Error: ${errorMsg} (Status: ${response.status})`);
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoice.pdf";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate product values, GST summary, grand total, and amount in words on-the-fly
  const calculatedProducts = invoiceData.products.map((row) => {
    const qty = Number((row as any)["Qty"] || 1);
    const price = Number((row as any)["Offer Price (₹)"] || 0) > 0
      ? Number((row as any)["Offer Price (₹)"])
      : Number((row as any)["Price (₹)"] || 0);
    const gstPercent = Number((row as any)["GST %"] || 0);
    const taxable = qty * price;
    const gstAmt = (taxable * gstPercent) / 100;
    const total = taxable + gstAmt;
    return {
      ...row,
      "Taxable Value (₹)": taxable,
      "GST Amt (₹)": gstAmt,
      "Total (₹)": total,
      "GST %": gstPercent
    };
  });
  let grandTotal = 0;
  let gstSummary: { [key: string]: { taxable: number; gst: number } } = {};
  calculatedProducts.forEach((row) => {
    const gstPercent = Number((row as any)["GST %"] || 0);
    const taxable = Number((row as any)["Taxable Value (₹)"] || 0);
    const gstAmt = Number((row as any)["GST Amt (₹)"] || 0);
    const total = Number((row as any)["Total (₹)"] || 0);
    if (gstPercent) {
      if (!gstSummary[gstPercent]) gstSummary[gstPercent] = { taxable: 0, gst: 0 };
      gstSummary[gstPercent].taxable += taxable;
      gstSummary[gstPercent].gst += gstAmt;
    }
    grandTotal += total;
  });
  const amountWords = numberToWords(Math.round(grandTotal));

  // GST summary as array for display
  const gstSummaryArr = Object.entries(gstSummary).map(([gst, vals]) => ({
    gstPercent: gst,
    taxable: (vals as any).taxable.toFixed(2),
    gstAmt: (vals as any).gst.toFixed(2)
  }));

  // Render HTML preview
  const renderPreview = () => (
    <div className="overflow-x-auto w-full flex justify-center mt-8">
      <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-300 max-w-[800px] w-full min-w-[600px]">
        <h2 className="text-xl font-bold text-center mb-2">INVOICE</h2>
        {/* Store Info left, Logo right */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex-1">
            {invoiceData.storeInfo?.name && <div className="font-semibold text-lg">{invoiceData.storeInfo.name}</div>}
            {invoiceData.storeInfo?.address && <div className="text-sm">{invoiceData.storeInfo.address}</div>}
            {invoiceData.storeInfo?.gstin && <div className="text-xs">GSTIN: {invoiceData.storeInfo.gstin}</div>}
            {invoiceData.storeInfo?.pan && <div className="text-xs">PAN: {invoiceData.storeInfo.pan}</div>}
            {invoiceData.storeInfo?.contact && <div className="text-xs">Contact: {invoiceData.storeInfo.contact}</div>}
          </div>
          <div className="flex-shrink-0 ml-4">
            {(logoPreview || invoiceData.logo) ? (
              <img src={logoPreview || invoiceData.logo} alt="Logo" className="w-24 h-24 object-contain border rounded" />
            ) : null}
          </div>
        </div>
        <div className="flex justify-between mb-2">
          <div>
            <div>Invoice No: {invoiceData.invoiceNo}</div>
            <div>Order ID: {invoiceData.orderId}</div>
          </div>
          <div className="text-right">
            <div>Date: {invoiceData.date}</div>
            <div>Payment: {invoiceData.paymentMode}</div>
          </div>
        </div>
        <div className="mb-2">
          <b>Sold By:</b> <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.seller as any)["name"]}</span><br />
          <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.seller as any)["address"]}</span><br />
          GSTIN: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.seller as any)["gstin"]}</span> PAN: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.seller as any)["pan"]}</span><br />
          Contact: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.seller as any)["contact"]}</span>
        </div>
        <div className="mb-2">
          <b>Billed To:</b> <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.buyer as any)["name"]}</span><br />
          <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.buyer as any)["address"]}</span><br />
          Phone: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.buyer as any)["phone"]}</span><br />
          Email: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.buyer as any)["email"]}</span><br />
          GSTIN: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.buyer as any)["gstin"]}</span>
        </div>
        <div className="mb-2">
          <b>Shipped To:</b> {(invoiceData.shipping as any)["name"]}<br />
          {(invoiceData.shipping as any)["address"]}<br />
          Courier: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.shipping as any)["courier"]}</span><br />
          Tracking No: <span className="break-words whitespace-pre-line max-w-full">{(invoiceData.shipping as any)["trackingNo"]}</span>
        </div>
        <div className="overflow-x-auto">
          {invoiceData.products.length === 0 ? (
            <div className="text-gray-500 mb-6">No products to invoice. Please add products from the cart.</div>
          ) : (
            <table className="min-w-full border text-xs table-fixed">
              <thead>
                <tr>
                  {invoiceData.columns.map((col) => (
                    <th key={col} className="border px-2 py-1 truncate max-w-[120px]">{col}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calculatedProducts.map((row, idx) => (
                  <tr key={idx}>
                    {invoiceData.columns.map((col) => (
                      <td key={col} className="border px-2 py-1 text-center truncate break-words max-w-[120px]">
                        <input
                          className="w-20 border rounded px-1 py-0.5"
                          value={String((row as any)[col] ?? "")}
                          onChange={e => handleProductChange(
                            idx,
                            col,
                            col === 'Qty' || col.includes('₹') || col === 'GST %' ? Number(e.target.value) : e.target.value
                          )}
                          type={col === 'Qty' || col.includes('₹') || col === 'GST %' ? 'number' : 'text'}
                        />
                      </td>
                    ))}
                    <td>
                      <button onClick={() => removeProductRow(idx)} className="text-red-500">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button onClick={addProductRow} className="mt-2 px-2 py-1 bg-blue-600 text-white rounded">+ Add Row</button>
        </div>
        {/* Add summary, tax, and footer as needed */}
      </div>
    </div>
  );

  return (
    <div className="bg-white text-black min-h-screen custom-scrollbar relative">
      <button
        onClick={() => router.push(userType === 'admin' ? '/admin-dashboard/cart' : '/retailer-dashboard/cart')}
        className="absolute top-6 left-6 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 flex items-center z-50"
      >
        <span className="mr-2">&#8592;</span> Back to Cart
      </button>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 10px; background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #bdbdbd; border-radius: 8px; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #bdbdbd #f1f1f1; }
      `}</style>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Store/Company Info Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div className="flex-1">
            <h2 className="font-semibold mb-2">Store/Company Info</h2>
            {Object.keys(invoiceData.storeInfo || {}).map((field) => (
              <input
                key={field}
                className="w-full border rounded px-2 py-1 mb-2"
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(invoiceData.storeInfo as any)[field]}
                onChange={e => setInvoiceData(prev => ({
                  ...prev,
                  storeInfo: { ...(prev.storeInfo || {}), [field]: e.target.value }
                }))}
              />
            ))}
          </div>
          <div className="flex flex-col items-center">
            <label className="mb-2 font-semibold">Logo</label>
            {logoPreview || invoiceData.logo ? (
              <img src={logoPreview || invoiceData.logo} alt="Logo" className="w-24 h-24 object-contain border rounded mb-2" />
            ) : (
              <div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded mb-2">No Logo</div>
            )}
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              className="px-2 py-1 bg-blue-600 text-white rounded"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >Upload Logo</button>
          </div>
        </div>
        {/* Seller, Buyer, Shipping Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold mb-2">Seller Info</h2>
            {Object.keys(invoiceData.seller).map((field) => (
              <input
                key={field}
                className="w-full border rounded px-2 py-1 mb-2"
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(invoiceData.seller as any)[field]}
                onChange={e => handleChange("seller", field, e.target.value)}
              />
            ))}
            <h2 className="font-semibold mb-2 mt-4">Buyer Info</h2>
            {Object.keys(invoiceData.buyer).map((field) => (
              <input
                key={field}
                className="w-full border rounded px-2 py-1 mb-2"
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(invoiceData.buyer as any)[field]}
                onChange={e => handleChange("buyer", field, e.target.value)}
              />
            ))}
            <h2 className="font-semibold mb-2 mt-4">Shipping Info</h2>
            {Object.keys(invoiceData.shipping).map((field) => (
              <input
                key={field}
                className="w-full border rounded px-2 py-1 mb-2"
                placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                value={(invoiceData.shipping as any)[field]}
                onChange={e => handleChange("shipping", field, e.target.value)}
              />
            ))}
          </div>
          <div>
            <h2 className="font-semibold mb-2">Invoice Details</h2>
            <input className="w-full border rounded px-2 py-1 mb-2" placeholder="Invoice No" value={invoiceData.invoiceNo} onChange={e => handleRootChange("invoiceNo", e.target.value)} />
            <input className="w-full border rounded px-2 py-1 mb-2" placeholder="Order ID" value={invoiceData.orderId} onChange={e => handleRootChange("orderId", e.target.value)} />
            <input className="w-full border rounded px-2 py-1 mb-2" placeholder="Date" type="date" value={invoiceData.date} onChange={e => handleRootChange("date", e.target.value)} />
            <input className="w-full border rounded px-2 py-1 mb-2" placeholder="Payment Mode" value={invoiceData.paymentMode} onChange={e => handleRootChange("paymentMode", e.target.value)} />
            {/* Extra Fields */}
            <h2 className="font-semibold mb-2 mt-4">Extra Fields</h2>
            {(invoiceData.extraFields || []).map((field, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  className="flex-1 border rounded px-2 py-1"
                  placeholder="Field Name"
                  value={field.key}
                  onChange={e => handleExtraFieldChange(idx, 'key', e.target.value)}
                />
                <input
                  className="flex-1 border rounded px-2 py-1"
                  placeholder="Field Value"
                  value={field.value}
                  onChange={e => handleExtraFieldChange(idx, 'value', e.target.value)}
                />
                <button className="text-red-500" onClick={() => removeExtraField(idx)} type="button">🗑</button>
              </div>
            ))}
            <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={addExtraField} type="button">+ Add Field</button>
          </div>
        </div>
        {/* Products Table */}
        <div className="mt-8">
          <h2 className="font-semibold mb-2">Products</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border text-xs table-fixed">
              <thead>
                <tr>
                  {invoiceData.columns.map((col) => (
                    <th key={col} className="border px-2 py-1 truncate max-w-[120px]">{col}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calculatedProducts.map((row, idx) => (
                  <tr key={idx}>
                    {invoiceData.columns.map((col) => (
                      <td key={col} className="border px-2 py-1 text-center truncate break-words max-w-[120px]">
                        <input
                          className="w-20 border rounded px-1 py-0.5"
                          value={String((row as any)[col] ?? "")}
                          onChange={e => handleProductChange(
                            idx,
                            col,
                            col === 'Qty' || col.includes('₹') || col === 'GST %' ? Number(e.target.value) : e.target.value
                          )}
                          type={col === 'Qty' || col.includes('₹') || col === 'GST %' ? 'number' : 'text'}
                        />
                      </td>
                    ))}
                    <td>
                      <button onClick={() => removeProductRow(idx)} className="text-red-500">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addProductRow} className="mt-2 px-2 py-1 bg-blue-600 text-white rounded">+ Add Row</button>
          </div>
        </div>
        {/* GST Summary and Grand Total */}
        <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="font-semibold mb-2">GST Summary</h2>
            <table className="border text-xs">
              <thead>
                <tr>
                  <th className="border px-2 py-1">GST %</th>
                  <th className="border px-2 py-1">Taxable Value</th>
                  <th className="border px-2 py-1">GST Amount</th>
                </tr>
              </thead>
              <tbody>
                {gstSummaryArr.map((row) => (
                  <tr key={row.gstPercent}>
                    <td className="border px-2 py-1 text-center">{row.gstPercent}</td>
                    <td className="border px-2 py-1 text-right">{row.taxable}</td>
                    <td className="border px-2 py-1 text-right">{row.gstAmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end">
            <div className="font-bold text-lg">Grand Total: ₹{grandTotal.toFixed(2)}</div>
            <div className="italic text-sm text-gray-600">In Words: {amountWords}</div>
            {/* GST summary values beside grand total */}
            <div className="mt-2 text-xs text-right">
              {gstSummaryArr.map(row => (
                <div key={row.gstPercent}>
                  <span className="font-semibold">GST {row.gstPercent}%:</span> Taxable ₹{row.taxable}, GST ₹{row.gstAmt}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 flex gap-4">
          <button onClick={handleDownload} className="px-6 py-2 bg-black text-white rounded hover:bg-gray-900 font-semibold">Download PDF</button>
        </div>
        <div className="mt-8">
          <h2 className="font-semibold mb-2">Preview</h2>
          {renderPreview()}
        </div>
      </div>
    </div>
  );
} 