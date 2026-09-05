import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EnterprisePageHeader from "../../shared/components/EnterprisePageHeader";
import EnterpriseDataTable from "../../shared/components/EnterpriseDataTable";
import EnterpriseStatusBadge from "../../shared/components/EnterpriseStatusBadge";
import { Building2, Plus, Edit, Eye, Trash2, Search, Filter, Globe, EyeOff } from "lucide-react";
import api, { getErrorMessage } from "../../../lib/api";
import { templeService } from "../../../services";
import { toast } from "../../../lib/toast";

export default function TempleManagementPage() {
  const navigate = useNavigate();
  const [temples, setTemples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverPages, setServerPages] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const handle = setTimeout(fetchTemples, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, cityFilter, stateFilter, verifiedFilter, featuredFilter, page]);

  const fetchTemples = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit: pageSize };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (cityFilter !== "all") params.city = cityFilter;
      if (stateFilter !== "all") params.state = stateFilter;
      if (verifiedFilter !== "all") params.isVerified = verifiedFilter;
      if (featuredFilter !== "all") params.isFeatured = featuredFilter;
      const res = await templeService.adminList(params);
      if (res.data?.success) {
        setTemples(res.data.data?.data || []);
        setServerTotal(res.data.data?.total || 0);
        setServerPages(res.data.data?.totalPages || 1);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load temples"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this temple?")) return;
    try {
      await api.delete(`/temples/admin/${id}`);
      toast.success("Temple deleted successfully");
      fetchTemples();
    } catch {
      toast.error("Failed to delete temple");
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    try {
      await api.patch(`/temples/admin/${id}`, { status: newStatus });
      toast.success(`Temple ${newStatus === "published" ? "published" : "unpublished"} successfully`);
      fetchTemples();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Filtering, search and pagination are all resolved server-side so the admin
  // sees every matching temple, not just the first page's worth.
  const cities = Array.from(new Set(temples.map((temple) => temple.address?.city).filter(Boolean))).sort();
  const states = Array.from(new Set(temples.map((temple) => temple.address?.state).filter(Boolean))).sort();
  const totalPages = Math.max(1, serverPages);
  const visibleTemples = temples;

  const columns = [
    {
      label: "Temple",
      key: "name",
      render: (_: any, row: any) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
            {row.media?.coverImage ? (
              <img src={row.media.coverImage} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <Building2 className="w-5 h-5 text-[#E58C28]" />
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900 group-hover:text-[#0A4DA6] transition-colors">{row.name}</p>
            <p className="text-sm text-gray-500">{row.address?.city}, {row.address?.state}</p>
          </div>
        </div>
      ),
    },
    {
      label: "Deity",
      key: "deity",
      render: (_: any, row: any) => row.deity || <span className="text-gray-400 italic">Not set</span>,
    },
    {
      label: "Status",
      key: "status",
      render: (val: string) => (
        <EnterpriseStatusBadge
          status={val === "published" ? "approved" : val === "archived" ? "rejected" : "pending"}
          label={val.toUpperCase()}
        />
      ),
    },
    {
      label: "Visibility",
      key: "visibility",
      render: (_: any, row: any) => (
        <div className="flex flex-col gap-1">
          {row.isVerified && <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-max">Verified</span>}
          {row.isFeatured && <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full w-max">Featured</span>}
          {!row.isVerified && !row.isFeatured && <span className="text-xs text-gray-400">-</span>}
        </div>
      )
    },
    {
      label: "Actions",
      key: "actions",
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/temples/${row.slug}`)}
            className="p-1.5 text-gray-400 hover:text-[#E58C28] hover:bg-orange-50 rounded-lg transition-colors"
            title="View Public Page"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(`/admin/temples/${row._id}/edit`)}
            className="p-1.5 text-gray-400 hover:text-[#0A4DA6] hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Temple"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleTogglePublish(row._id, row.status)}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title={row.status === "published" ? "Unpublish" : "Publish"}
          >
            {row.status === "published" ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleDelete(row._id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Temple"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto pb-24">
      <EnterprisePageHeader
        title="Temple Management"
        subtitle="Manage temples, timings, aartis, festivals, images and SEO information."
        actions={
          <button
            onClick={() => navigate("/admin/temples/new")}
            className="bg-[#E58C28] text-white px-5 py-2.5 rounded-full font-medium hover:bg-[#d67d1d] transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" /> Add Temple
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row items-center gap-4 mt-6 mb-2">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search temples by name or city..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-11 pr-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-[#E58C28] focus:border-transparent text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-transparent border-none text-sm font-medium focus:ring-0 text-gray-700 py-0 pr-6"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
            <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className="rounded-full bg-white border border-gray-200 px-4 py-2 text-sm text-gray-700 font-medium focus:outline-none"><option value="all">All Cities</option>{cities.map((city) => <option key={city}>{city}</option>)}</select>
            <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }} className="rounded-full bg-white border border-gray-200 px-4 py-2 text-sm text-gray-700 font-medium focus:outline-none"><option value="all">All States</option>{states.map((state) => <option key={state}>{state}</option>)}</select>
            <select value={verifiedFilter} onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1); }} className="rounded-full bg-white border border-gray-200 px-4 py-2 text-sm text-gray-700 font-medium focus:outline-none"><option value="all">Verified</option><option value="true">Verified only</option><option value="false">Unverified only</option></select>
            <select value={featuredFilter} onChange={(e) => { setFeaturedFilter(e.target.value); setPage(1); }} className="rounded-full bg-white border border-gray-200 px-4 py-2 text-sm text-gray-700 font-medium focus:outline-none"><option value="all">Featured</option><option value="true">Featured only</option><option value="false">Not featured</option></select>
        </div>
      </div>

      <EnterpriseDataTable
        title="Temples Directory"
        columns={columns}
        data={visibleTemples}
        isLoading={loading}
      />
      <div className="flex items-center justify-between bg-white px-4 py-3 text-sm text-gray-500"><span>{serverTotal} temples · Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </div>
  );
}
