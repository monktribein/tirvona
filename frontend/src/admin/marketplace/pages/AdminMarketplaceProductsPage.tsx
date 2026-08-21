import React, { useState, useEffect } from "react";
import { formatCurrency } from "../../../utils/format";
import {
  ShoppingBag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Upload,
  Image as ImageIcon,
  Star,
  Tag,
  RefreshCw,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Link as LinkIcon,
  ShieldCheck,
} from "lucide-react";
import {
  marketplaceService,
  type MarketplaceProductItem,
} from "../../../services/marketplace.service";
import { useNotifications } from "../../../contexts/NotificationContext";
import api, { getErrorMessage } from "../../../lib/api";
import { humanizeLabel } from "../../../utils/labels";
import {
  EnterpriseModal,
  EnterpriseButton,
  EnterpriseStatusBadge,
  EnterprisePageHeader,
} from "../../shared";

export const AdminMarketplaceProductsPage: React.FC = () => {
  const { addNotification, confirmAction } = useNotifications();

  const [products, setProducts] = useState<MarketplaceProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<MarketplaceProductItem | null>(null);

  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    category: string;
    description: string;
    price: number | "";
    salePrice: number | "";
    stock: number | "";
    templeSource: string;
    authenticityCertificate: string;
    weight: string;
    isFeatured: boolean;
    status: "active" | "out_of_stock" | "suspended";
    images: string[];
  }>({
    name: "",
    slug: "",
    category: "prasad",
    description: "",
    price: "",
    salePrice: "",
    stock: 50,
    templeSource: "Kashi Vishwanath Temple Trust",
    authenticityCertificate: "Govt Certified & Temple Sanctified",
    weight: "250g",
    isFeatured: false,
    status: "active",
    images: [],
  });

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [imageMeta, setImageMeta] = useState<
    Record<string, { name: string; size: string }>
  >({});

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "prasad", label: "Temple Prasad" },
    { id: "rudraksha", label: "Rudraksha Mala" },
    { id: "tulsi_mala", label: "Tulsi Mala" },
    { id: "puja_kits", label: "Puja Samagri Kits" },
    { id: "murti", label: "Brass & Copper Murti" },
    { id: "ayurveda", label: "Ayurveda & Organic" },
    { id: "books", label: "Sacred Books" },
    { id: "temple_clothes", label: "Temple Clothes" },
    { id: "handicrafts", label: "Handicrafts" },
    { id: "incense", label: "Incense" },
  ];

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, statusFilter, searchTerm]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.getProducts({
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : "all",
        search: searchTerm || undefined,
        limit: 100,
      });
      if (res.data?.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error("Fetch products error:", err);
      addNotification(
        "Load Error",
        getErrorMessage(err, "Failed to fetch products from MongoDB."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOpen = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      slug: "",
      category: "prasad",
      description: "",
      price: "",
      salePrice: "",
      stock: 50,
      templeSource: "Kashi Vishwanath Temple Trust",
      authenticityCertificate: "Govt Certified & Temple Sanctified",
      weight: "250g",
      isFeatured: false,
      status: "active",
      images: [],
    });
    setUrlInput("");
    setShowUrlInput(false);
    setIsModalOpen(true);
  };

  const handleEditOpen = (product: MarketplaceProductItem) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      slug: product.slug || "",
      category: product.category || "prasad",
      description: product.description || "",
      price: product.price || "",
      salePrice: product.salePrice || "",
      stock: product.stock ?? 50,
      templeSource: product.templeSource || "Kashi Vishwanath Temple Trust",
      authenticityCertificate:
        product.authenticityCertificate || "Govt Certified & Temple Sanctified",
      weight: product.weight || "250g",
      isFeatured: !!product.isFeatured,
      status:
        (product.status as "active" | "out_of_stock" | "suspended") || "active",
      images:
        Array.isArray(product.images) && product.images.length > 0
          ? [...product.images]
          : [],
    });
    setUrlInput("");
    setShowUrlInput(false);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirmAction({ title: "Delete marketplace product?", message: `Product “${name}” will be permanently removed.`, confirmLabel: "Delete Product", tone: "danger" }))) return;
    try {
      await marketplaceService.deleteProduct(id);
      addNotification("Deleted", `Product "${name}" deleted.`, "info");
      setProducts((prev) => prev.filter((p) => p._id !== id));
      window.dispatchEvent(new Event("marketplace_updated"));
    } catch (err) {
      addNotification(
        "Delete Error",
        getErrorMessage(err, "Failed to delete product."),
        "error",
      );
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    replaceIdx: number | null = null,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeStr = (file.size / 1024).toFixed(0) + " KB";
    const fileNameStr = file.name;

    setIsUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folder", "marketplace");

      const res = await api.post("/uploads", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success && res.data?.data?.url) {
        const newUrl = res.data.data.url;
        setImageMeta((prev) => ({
          ...prev,
          [newUrl]: { name: fileNameStr, size: fileSizeStr },
        }));

        setFormData((prev) => {
          const updatedImages = [...prev.images];
          if (
            replaceIdx !== null &&
            replaceIdx >= 0 &&
            replaceIdx < updatedImages.length
          ) {
            updatedImages[replaceIdx] = newUrl;
          } else {
            updatedImages.push(newUrl);
          }
          return { ...prev, images: updatedImages };
        });
        addNotification(
          "Image Uploaded",
          "Product image successfully uploaded!",
          "success",
        );
      }
    } catch (err) {
      console.warn("Backend upload fallback:", err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const fallbackUrl = reader.result;
          setImageMeta((prev) => ({
            ...prev,
            [fallbackUrl]: { name: fileNameStr, size: fileSizeStr },
          }));
          setFormData((prev) => {
            const updatedImages = [...prev.images];
            if (
              replaceIdx !== null &&
              replaceIdx >= 0 &&
              replaceIdx < updatedImages.length
            ) {
              updatedImages[replaceIdx] = fallbackUrl;
            } else {
              updatedImages.push(fallbackUrl);
            }
            return { ...prev, images: updatedImages };
          });
          addNotification(
            "Image Added",
            "Image loaded into product gallery.",
            "info",
          );
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    const urlName = url.split("/").pop()?.substring(0, 18) || "web_image.jpg";
    setImageMeta((prev) => ({
      ...prev,
      [url]: { name: urlName, size: "CDN Web" },
    }));

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, url],
    }));
    setUrlInput("");
    setShowUrlInput(false);
    addNotification("URL Added", "Image URL added to gallery.", "info");
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    addNotification("Image Removed", "Image removed from product.", "info");
  };

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    setFormData((prev) => {
      const updated = [...prev.images];
      const [selected] = updated.splice(index, 1);
      updated.unshift(selected);
      return { ...prev, images: updated };
    });
    addNotification(
      "Cover Updated",
      "Primary product cover image set to position #1.",
      "success",
    );
  };

  const handleMoveImage = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.images.length) return;

    setFormData((prev) => {
      const updated = [...prev.images];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return { ...prev, images: updated };
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      addNotification(
        "Validation Error",
        "Product Name and Price are required.",
        "error",
      );
      return;
    }

    try {
      const payload = {
        name: formData.name,
        slug:
          formData.slug ||
          formData.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
        category: formData.category,
        description: formData.description,
        price: Number(formData.price),
        salePrice:
          formData.salePrice !== "" ? Number(formData.salePrice) : null,
        stock: Number(formData.stock),
        templeSource: formData.templeSource,
        authenticityCertificate: formData.authenticityCertificate,
        weight: formData.weight,
        isFeatured: formData.isFeatured,
        status: formData.status,
        images: formData.images,
      };

      if (editingProduct) {
        let res;
        try {
          res = await marketplaceService.updateProduct(
            editingProduct._id,
            payload,
          );
        } catch {
          res = await marketplaceService.createProduct({
            ...payload,
            slug: editingProduct.slug || payload.slug,
          });
        }
        if (res.data?.success) {
          addNotification(
            "Saved",
            `Product "${formData.name}" updated successfully!`,
            "success",
          );
        }
      } else {
        const res = await marketplaceService.createProduct(payload);
        if (res.data?.success) {
          addNotification(
            "Created",
            `Product "${formData.name}" created successfully!`,
            "success",
          );
        }
      }

      window.dispatchEvent(new Event("marketplace_updated"));

      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error("Save product error:", err);
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Failed to save product."),
        "error",
      );
    }
  };

  const handleToggleStock = async (product: MarketplaceProductItem) => {
    const isOut =
      product.status === "out_of_stock" ||
      (product.stock !== undefined && Number(product.stock) <= 0);
    const nextStatus = isOut ? "active" : "out_of_stock";
    const nextStock = isOut ? (product.stock > 0 ? product.stock : 50) : 0;

    try {
      let res;
      try {
        res = await marketplaceService.updateProduct(product._id, {
          status: nextStatus,
          stock: nextStock,
        });
      } catch {
        res = await marketplaceService.createProduct({
          ...product,
          status: nextStatus,
          stock: nextStock,
        });
      }
      if (res.data?.success) {
        addNotification(
          "Stock Updated",
          `Product "${product.name}" marked as ${isOut ? "In Stock" : "Out of Stock"}.`,
          "success",
        );
        window.dispatchEvent(new Event("marketplace_updated"));
        fetchProducts();
      }
    } catch (err) {
      addNotification(
        "Stock Update Failed",
        getErrorMessage(err, "Could not update stock status."),
        "error",
      );
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.templeSource &&
        p.templeSource.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory =
      categoryFilter === "all" || !categoryFilter || p.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      !statusFilter ||
      p.status === statusFilter ||
      (!p.status && statusFilter === "active");
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getCleanFileName = (url: string) => {
    if (imageMeta[url]?.name) return imageMeta[url].name;
    const parts = url.split("/");
    const last = parts[parts.length - 1] || "image.jpg";
    return last.split("?")[0].substring(0, 16);
  };

  const getCleanFileSize = (url: string) => {
    if (imageMeta[url]?.size) return imageMeta[url].size;
    return "250 KB";
  };

  return (
    <div className="space-y-6 text-left w-full">
      <EnterprisePageHeader
        title="Marketplace Product Catalog"
        subtitle="Manage live products, pricing, inventory & multi-image gallery."
        icon={<ShoppingBag size={22} />}
        badgeText="Catalog Live"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateOpen}
              className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/20 cursor-pointer"
            >
              <Plus size={16} /> Add New Product
            </button>
            <button
              onClick={fetchProducts}
              className="p-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-full text-gray-500 cursor-pointer transition-colors"
              title="Refresh List"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-[#0A4DA6]" : ""} />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-[#0B192C] p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by title or temple source..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-800 dark:text-white focus:outline-none"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-800 dark:text-white focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full p-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-800 dark:text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active / In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0B192C] rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw
              className="animate-spin mx-auto text-[#0A4DA6]"
              size={28}
            />
            <p className="text-xs font-bold text-gray-400">
              Loading marketplace products from MongoDB...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <ShoppingBag
              className="mx-auto text-gray-300 dark:text-gray-600"
              size={40}
            />
            <p className="text-sm font-bold text-gray-500">
              No products found matching filters.
            </p>
            <button
              onClick={handleCreateOpen}
              className="px-4 py-2 bg-[#0A4DA6] text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              Create Product
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 dark:bg-slate-900/80 border-b border-gray-100 dark:border-slate-800 font-extrabold text-gray-500 tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Product Image</th>
                  <th className="py-3.5 px-4">Title & Source</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Price / Sale</th>
                  <th className="py-3.5 px-4">Stock</th>
                  <th className="py-3.5 px-4">Gallery</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 font-medium">
                {filteredProducts.map((p) => {
                  const coverImg =
                    p.images?.[0] ||
                    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                  const imgCount = p.images?.length || 0;

                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div
                          onClick={() => setPreviewImageUrl(coverImg)}
                          className="relative w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 overflow-hidden border border-gray-200 dark:border-slate-700 cursor-pointer group shrink-0"
                          title="Click to Preview Image"
                        >
                          <img
                            src={coverImg}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye size={14} className="text-white" />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <div
                          className="font-extrabold text-[#0B192C] dark:text-white truncate"
                          title={p.name}
                        >
                          {p.name}
                        </div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <ShieldCheck size={12} className="text-[#0A4DA6]" />
                          <span className="truncate">
                            {p.templeSource || "Sanctified Vendor"}
                          </span>
                        </div>
                        {p.isFeatured && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 mt-1">
                            <Star size={10} className="fill-amber-500" />{" "}
                            Featured
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A4DA6] dark:text-blue-300 font-extrabold text-[11px] tracking-wide">
                          {humanizeLabel(p.category)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {p.salePrice ? (
                          <div>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(p.salePrice)}
                            </span>
                            <span className="text-[10px] text-gray-400 line-through block">
                              {formatCurrency(p.price)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-black text-gray-800 dark:text-gray-200 text-sm">
                            {formatCurrency(p.price)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {p.status === "out_of_stock" || p.stock <= 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-extrabold text-[10px] border border-red-200 dark:border-red-900 inline-block">
                            Out of Stock ({p.stock || 0})
                          </span>
                        ) : (
                          <span
                            className={`font-bold ${p.stock < 10 ? "text-amber-600" : "text-gray-700 dark:text-gray-300"}`}
                          >
                            {p.stock} units
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleEditOpen(p)}
                          className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <ImageIcon size={12} />
                          <span>
                            {imgCount} {imgCount === 1 ? "Image" : "Images"}
                          </span>
                        </button>
                      </td>

                      <td className="py-3 px-4">
                        <EnterpriseStatusBadge status={p.status || "active"} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStock(p)}
                            className={`px-2 py-1 rounded-xl text-[10px] font-black transition-colors cursor-pointer ${p.status === "out_of_stock" || p.stock <= 0
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : "bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                              }`}
                            title={
                              p.status === "out_of_stock" || p.stock <= 0
                                ? "Mark product as In Stock"
                                : "Mark product as Out of Stock"
                            }
                          >
                            {p.status === "out_of_stock" || p.stock <= 0
                              ? "Mark In Stock"
                              : "Mark Out of Stock"}
                          </button>
                          <button
                            onClick={() => handleEditOpen(p)}
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-[#0A4DA6] rounded-xl transition-colors cursor-pointer"
                            title="Edit Product & Manage Images"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p._id, p.name)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EnterpriseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="5xl"
        title={
          editingProduct
            ? `Edit Product: ${editingProduct.name}`
            : "Add New Spiritual Product"
        }
        subtitle="Manage product metadata, stock, pricing, and live multi-image gallery"
      >
        <form
          onSubmit={handleSaveProduct}
          className="space-y-5 text-xs font-bold"
        >
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-200/60 dark:border-slate-800">
            <h3 className="text-xs font-black text-[#0A4DA6] tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={14} /> Product Overview
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="space-y-1 lg:col-span-2">
                <label className="text-gray-700 dark:text-gray-300">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Varanasi Kashi Vishwanath Mahaprasad Box"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-gray-700 dark:text-gray-300">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                >
                  {categories
                    .filter((c) => c.id !== "all")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-gray-700 dark:text-gray-300">
                  Temple Source / Vendor
                </label>
                <input
                  type="text"
                  value={formData.templeSource}
                  onChange={(e) =>
                    setFormData({ ...formData, templeSource: e.target.value })
                  }
                  placeholder="e.g. Kashi Vishwanath Temple Trust"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div className="space-y-1 lg:col-span-2">
                <label className="text-gray-700 dark:text-gray-300">
                  Authenticity Guarantee
                </label>
                <input
                  type="text"
                  value={formData.authenticityCertificate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      authenticityCertificate: e.target.value,
                    })
                  }
                  placeholder="e.g. Govt Certified & Temple Sanctified"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div className="space-y-1 col-span-full">
                <label className="text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Write detailed product description..."
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-gray-50 dark:bg-slate-900/60 rounded-2xl border border-gray-200/60 dark:border-slate-800">
            <h3 className="text-xs font-black text-[#0A4DA6] tracking-wider flex items-center gap-1.5">
              <Tag size={14} /> Pricing, Stock & Weight
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-gray-700 dark:text-gray-300 block mb-1">
                  Regular Price (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="499"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 block mb-1">
                  Sale Price (₹)
                </label>
                <input
                  type="number"
                  value={formData.salePrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      salePrice:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="399"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 block mb-1">
                  Stock Count
                </label>
                <input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  placeholder="50"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-gray-700 dark:text-gray-300 block mb-1">
                  Weight / Unit
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData({ ...formData, weight: e.target.value })
                  }
                  placeholder="250g"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-gray-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) =>
                    setFormData({ ...formData, isFeatured: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-[#0A4DA6]"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 font-extrabold flex items-center gap-1">
                  <Star size={12} className="text-amber-500 fill-amber-500" />{" "}
                  Feature product on Marketplace home
                </span>
              </label>

              <div className="flex items-center gap-2">
                <label className="text-gray-700 dark:text-gray-300">
                  Status:
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as any })
                  }
                  className="p-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-bold"
                >
                  <option value="active">Active</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 bg-blue-50/40 dark:bg-slate-900/80 rounded-2xl border border-blue-100 dark:border-blue-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-[#0A4DA6]" />
                <h3 className="text-xs font-black text-[#0A4DA6] tracking-wider">
                  Product Image Management
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors shrink-0">
                  <Upload size={13} />
                  <span>{isUploading ? "Uploading..." : "Upload Image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, null)}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-[#0A4DA6] dark:text-blue-300 hover:bg-blue-50 font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                >
                  <LinkIcon size={13} />
                  <span>Add by URL</span>
                </button>
              </div>
            </div>

            {showUrlInput && (
              <div className="flex gap-2 p-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl transition-all">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste image URL (e.g. https://domain.com/photo.jpg)"
                  className="flex-1 p-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-mono text-gray-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-2 bg-[#0A4DA6] hover:bg-blue-900 text-white font-extrabold text-xs rounded-lg cursor-pointer shrink-0"
                >
                  Confirm URL
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {formData.images.length === 0 ? (
              <div className="py-6 text-center space-y-1 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-blue-100 dark:border-blue-950">
                <ImageIcon
                  className="mx-auto text-blue-300 dark:text-blue-700"
                  size={24}
                />
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  No images attached to product.
                </p>
                <p className="text-[10px] text-gray-400">
                  Click "Upload Image" or "Add by URL" above to add product
                  photos.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {formData.images.map((imgUrl, idx) => {
                  const isCover = idx === 0;
                  const filename = getCleanFileName(imgUrl);
                  const filesize = getCleanFileSize(imgUrl);

                  return (
                    <div
                      key={idx}
                      className={`relative bg-white dark:bg-slate-900 rounded-2xl border ${isCover
                        ? "border-2 border-[#0A4DA6] shadow-md shadow-[#0A4DA6]/15"
                        : "border-gray-200 dark:border-slate-800"
                        } overflow-hidden flex flex-col justify-between group transition-all`}
                    >
                      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        <img
                          src={imgUrl}
                          alt={`Product photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5'%3E%3Crect width='100%25' height='100%25' fill='%23f1f5f9'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='m21 15-5-5-11 11'/%3E%3C/svg%3E";
                          }}
                        />

                        {isCover ? (
                          <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-[#0A4DA6] text-white text-[9px] font-black rounded-full shadow-md">
                            ★ Primary Cover
                          </span>
                        ) : (
                          <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-bold rounded-full">
                            #{idx + 1}
                          </span>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity p-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl(imgUrl)}
                            className="p-1.5 bg-white text-gray-800 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                            title="Preview Image"
                          >
                            <Eye size={13} />
                          </button>

                          <label
                            className="p-1.5 bg-[#0A4DA6] text-white rounded-lg hover:scale-110 transition-transform cursor-pointer"
                            title="Replace File"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, idx)}
                            />
                            <RefreshCw size={13} />
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1.5 bg-red-600 text-white rounded-lg hover:scale-110 transition-transform cursor-pointer"
                            title="Delete Image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 space-y-1.5 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className="font-extrabold text-gray-800 dark:text-gray-200 truncate max-w-[110px]"
                            title={filename}
                          >
                            {filename}
                          </span>
                          <span className="text-gray-400 font-bold shrink-0">
                            {filesize}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-800 text-[10px]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveImage(idx, "left")}
                              className="p-1 text-gray-500 hover:text-[#0A4DA6] disabled:opacity-30 cursor-pointer"
                              title="Reorder Left"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === formData.images.length - 1}
                              onClick={() => handleMoveImage(idx, "right")}
                              className="p-1 text-gray-500 hover:text-[#0A4DA6] disabled:opacity-30 cursor-pointer"
                              title="Reorder Right"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>

                          {!isCover ? (
                            <button
                              type="button"
                              onClick={() => handleSetCover(idx)}
                              className="text-[#0A4DA6] dark:text-blue-400 font-extrabold hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <ArrowUp size={10} /> Set Cover
                            </button>
                          ) : (
                            <span className="text-[#0A4DA6] font-extrabold">
                              Cover Photo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2">
            <EnterpriseButton
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </EnterpriseButton>
            <EnterpriseButton type="submit" variant="primary">
              {editingProduct ? "Save Product Changes" : "Create Product"}
            </EnterpriseButton>
          </div>
        </form>
      </EnterpriseModal>

      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] bg-white dark:bg-[#0B192C] rounded-3xl p-3 shadow-2xl overflow-hidden border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-transform hover:scale-105 cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={previewImageUrl}
              alt="Full Preview"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl mx-auto"
            />
            <div className="pt-3 text-center text-xs font-mono text-gray-500 truncate max-w-xl mx-auto">
              {previewImageUrl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarketplaceProductsPage;
