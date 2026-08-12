import React, { useCallback, useEffect, useState } from "react";
import {
  Car,
  CircleParking,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ImageGalleryManager from "../../admin/shared/components/ImageGalleryManager";
import { ashramService, userService } from "../../services";
import { parkingPartnerService } from "../../modules/parking/services/parking.service";
import { getErrorMessage } from "../../lib/api";
import { useNotifications } from "../../contexts/NotificationContext";

const emptyLocation = {
  name: "",
  description: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  contactPhone: "",
  totalCapacity: "",
  coverImage: "",
  images: [] as string[],
};

const getList = (response: any): any[] => {
  const value = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(value)) return value;
  return value?.items || value?.records || value?.staff || value?.users || [];
};

const getId = (value: any) => String(value?._id || value?.id || value || "");

export const OwnerParkingSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [partner, setPartner] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [ownerStaff, setOwnerStaff] = useState<any[]>([]);
  const [parkingStaff, setParkingStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [viewLocation, setViewLocation] = useState<any | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [application, setApplication] = useState({
    businessName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    city: "",
    state: "",
  });
  const [location, setLocation] = useState(emptyLocation);
  const [teamForm, setTeamForm] = useState({
    userId: "",
    parkingRole: "parking_manager",
    locationIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const setup = await ashramService.ownerParking();
      const nextPartner = setup.data?.data?.partner || null;
      setPartner(nextPartner);
      if (nextPartner) {
        const [locationRes, parkingStaffRes, ownerStaffRes] = await Promise.all([
          parkingPartnerService.listLocations(),
          parkingPartnerService.listStaff(),
          userService.listStaff(),
        ]);
        setLocations(getList(locationRes));
        setParkingStaff(getList(parkingStaffRes).filter((grant) => grant.status !== "inactive"));
        setOwnerStaff(getList(ownerStaffRes));
      } else {
        setLocations([]);
        setParkingStaff([]);
        setOwnerStaff([]);
      }
    } catch (error) {
      addNotification("Parking Unavailable", getErrorMessage(error, "Could not load parking setup."), "error");
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await ashramService.onboardOwnerParking({
        ...application,
        address: { city: application.city, state: application.state },
      });
      addNotification("Parking Access Ready", "You can add parking now. It will be published after Super Admin approval.", "success");
      await load();
      setShowLocation(true);
    } catch (error) {
      addNotification("Application Failed", getErrorMessage(error, "Could not create parking access."), "error");
    } finally {
      setSaving(false);
    }
  };

  const openLocationForm = (item?: any) => {
    if (item) {
      setEditingLocationId(getId(item));
      setLocation({
        name: item.name || "",
        description: item.description || "",
        city: item.address?.city || "",
        district: item.address?.district || "",
        state: item.address?.state || "",
        pincode: item.address?.pincode || "",
        contactPhone: item.contactPhone || "",
        totalCapacity: String(item.totalCapacity || ""),
        coverImage: item.coverImage || "",
        images: Array.isArray(item.images) ? item.images : [],
      });
    } else {
      setEditingLocationId(null);
      setLocation(emptyLocation);
    }
    setShowLocation(true);
  };

  const saveLocation = async (event: React.FormEvent) => {
    event.preventDefault();
    const photos = Array.from(new Set([location.coverImage, ...location.images].filter(Boolean)));
    if (photos.length < 3) {
      addNotification("More Photos Required", "Upload at least 3 different parking photos.", "warning");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: location.name,
        description: location.description,
        coverImage: location.coverImage || photos[0],
        images: photos,
        address: {
          city: location.city,
          district: location.district,
          state: location.state,
          pincode: location.pincode,
        },
        contactPhone: location.contactPhone,
        totalCapacity: Number(location.totalCapacity),
        supportedVehicleTypes: ["bike", "scooter", "car", "suv", "ev", "bus"],
        amenities: ["cctv", "security"],
        hasCctv: true,
        hasSecurity: true,
      };
      if (editingLocationId) {
        await parkingPartnerService.updateLocation(editingLocationId, payload);
      } else {
        await parkingPartnerService.createLocation(payload);
      }
      addNotification(
        editingLocationId ? "Parking Updated" : "Parking Submitted",
        editingLocationId ? "The facility details were updated." : "The facility is pending Super Admin review.",
        "success",
      );
      setLocation(emptyLocation);
      setEditingLocationId(null);
      setShowLocation(false);
      await load();
    } catch (error) {
      addNotification("Parking Not Saved", getErrorMessage(error, "Could not save this parking facility."), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleTeamLocation = (id: string) => {
    setTeamForm((current) => ({
      ...current,
      locationIds: current.locationIds.includes(id)
        ? current.locationIds.filter((value) => value !== id)
        : [...current.locationIds, id],
    }));
  };

  const assignParkingRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamForm.locationIds.length) {
      addNotification("Select Parking", "Select at least one parking facility for filtered access.", "warning");
      return;
    }
    setSaving(true);
    try {
      await parkingPartnerService.assignStaff({ ...teamForm, partnerId: getId(partner) });
      addNotification("Parking Role Added", "The staff member will see only the selected parking facilities after signing in again.", "success");
      setTeamForm({ userId: "", parkingRole: "parking_manager", locationIds: [] });
      await load();
    } catch (error) {
      addNotification("Role Not Added", getErrorMessage(error, "Could not assign this parking role."), "error");
    } finally {
      setSaving(false);
    }
  };

  const revokeParkingRole = async (id: string) => {
    setSaving(true);
    try {
      await parkingPartnerService.revokeStaff(id);
      addNotification("Parking Role Removed", "Parking dashboard access was removed.", "success");
      await load();
    } catch (error) {
      addNotification("Role Not Removed", getErrorMessage(error, "Could not remove this parking role."), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 rounded-[24px] bg-gray-100 dark:bg-slate-800 animate-pulse" />;

  return (
    <div className="space-y-5 text-left w-full">
      <section className="flex flex-wrap items-start justify-between gap-4 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-black text-[#0B192C] dark:text-white flex items-center gap-2"><CircleParking size={21} className="text-[#0A4DA6]" /> My Ashram Parking</h1>
          <p className="text-xs text-gray-400 font-semibold mt-1">View and edit facilities, assign parking staff, and manage bookings.</p>
        </div>
        {partner && <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowTeam(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[#0A4DA6] text-[#0A4DA6] text-xs font-extrabold"><Users size={14} /> Parking Team</button>
          <button onClick={() => openLocationForm()} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[#0A4DA6] text-[#0A4DA6] text-xs font-extrabold"><Plus size={14} /> Add Parking</button>
          <button onClick={() => navigate("/parking/dashboard")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold">Open Console <ExternalLink size={13} /></button>
        </div>}
      </section>

      {!partner ? (
        <form onSubmit={apply} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 sm:p-6 shadow-sm space-y-4">
          <div><h2 className="font-extrabold text-[#0B192C] dark:text-white">Activate Parking Management</h2><p className="text-xs text-gray-400 mt-1">Create your parking workspace. Each facility requires Super Admin approval before it appears publicly.</p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            {([['businessName','Parking business / ashram name'],['contactPerson','Contact person'],['contactEmail','Contact email'],['contactPhone','Contact phone'],['city','City'],['state','State']] as const).map(([key, placeholder]) => <input key={key} required={key === 'businessName'} type={key === 'contactEmail' ? 'email' : 'text'} value={application[key]} onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-[#0A4DA6]" />)}
          </div>
          <button disabled={saving} className="px-5 py-3 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60">{saving ? "Creating access..." : "Activate Parking Workspace"}</button>
        </form>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold"><span className={`px-3 py-1 rounded-full ${partner.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>Partner: {partner.status}</span><span className="text-gray-400">{partner.partnerCode}</span></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {locations.map((item) => <article key={getId(item)} className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[22px] overflow-hidden shadow-sm">
              <div className="h-36 bg-gray-100 dark:bg-slate-800">{item.coverImage && <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" />}</div>
              <div className="p-4 space-y-3"><div className="flex justify-between gap-2"><h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white">{item.name}</h3><span className="text-[9px] font-bold uppercase text-[#0A4DA6]">{item.status}</span></div><p className="text-xs text-gray-400">{item.address?.city || 'Location pending'} · {item.totalCapacity || 0} bays</p>
                <div className="border-t border-gray-100 dark:border-slate-800 pt-3"><button onClick={() => setViewLocation(item)} className="w-full rounded-full bg-[#0A4DA6] text-white py-2 text-[11px] font-extrabold inline-flex justify-center items-center gap-1.5"><Eye size={13} /> Edit / View</button></div>
              </div>
            </article>)}
            {locations.length === 0 && <button onClick={() => openLocationForm()} className="min-h-52 border-2 border-dashed border-[#0A4DA6]/30 rounded-[22px] text-[#0A4DA6] text-xs font-extrabold flex flex-col items-center justify-center gap-2"><Car size={28} /><Plus size={15} /> Add your first parking facility</button>}
          </div>
        </section>
      )}

      {viewLocation && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-5">
        <div className="flex justify-between items-start"><div><h2 className="font-black text-xl text-[#0B192C] dark:text-white">{viewLocation.name}</h2><p className="text-xs text-gray-400 mt-1">Complete parking facility details</p></div><button onClick={() => setViewLocation(null)} className="p-2 text-gray-400"><X size={18} /></button></div>
        {Array.from(new Set([viewLocation.coverImage, ...(viewLocation.images || [])].filter(Boolean))).length > 0 && <div className="grid grid-cols-3 gap-2">{Array.from(new Set([viewLocation.coverImage, ...(viewLocation.images || [])].filter(Boolean))).map((image: any, index) => <img key={image} src={image} alt={`${viewLocation.name} ${index + 1}`} className={`w-full object-cover rounded-xl ${index === 0 ? 'col-span-3 h-56' : 'h-28'}`} />)}</div>}
        <div className="grid sm:grid-cols-2 gap-3">{[
          ['Status', viewLocation.status], ['Capacity', `${viewLocation.totalCapacity || 0} bays`], ['Phone', viewLocation.contactPhone], ['City', viewLocation.address?.city], ['District', viewLocation.address?.district], ['State', viewLocation.address?.state], ['Pincode', viewLocation.address?.pincode], ['Description', viewLocation.description]
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 p-3"><p className="text-[10px] uppercase font-black text-gray-400">{label}</p><p className="text-xs font-bold mt-1 text-[#0B192C] dark:text-white">{value || '—'}</p></div>)}</div>
        <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-slate-800 pt-4"><button onClick={() => setViewLocation(null)} className="px-5 py-2.5 rounded-full bg-gray-100 text-xs font-bold">Close</button><button onClick={() => { const item = viewLocation; setViewLocation(null); openLocationForm(item); }} className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold inline-flex items-center gap-1.5"><Pencil size={13} /> Edit Facility</button></div>
      </div></div>}

      {showLocation && partner && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={saveLocation} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-4">
        <div className="flex justify-between"><div><h2 className="font-black text-lg text-[#0B192C] dark:text-white">{editingLocationId ? 'Edit Parking Facility' : 'Add Parking Facility'}</h2><p className="text-xs text-gray-400">Maintain complete and accurate facility details.</p></div><button type="button" onClick={() => setShowLocation(false)} className="text-gray-400"><X size={19} /></button></div>
        <div className="grid sm:grid-cols-2 gap-3">{([['name','Parking name'],['contactPhone','Contact phone'],['city','City'],['district','District'],['state','State'],['pincode','Pincode'],['totalCapacity','Total parking capacity']] as const).map(([key, placeholder]) => <input key={key} required={['name','city','state','totalCapacity'].includes(key)} type={key === 'totalCapacity' ? 'number' : 'text'} value={location[key]} onChange={(event) => setLocation((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} className="px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none" />)}</div>
        <textarea value={location.description} onChange={(event) => setLocation((current) => ({ ...current, description: event.target.value }))} placeholder="Parking description, landmark and entry instructions" rows={3} className="w-full px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none" />
        <ImageGalleryManager coverImage={location.coverImage} gallery={location.images} onCoverImageChange={(coverImage) => setLocation((current) => ({ ...current, coverImage }))} onGalleryChange={(images) => setLocation((current) => ({ ...current, images }))} label="Parking Photos" minimumImages={3} />
        <button disabled={saving} className="w-full py-3 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin mx-auto" /> : editingLocationId ? 'Save Facility Changes' : 'Submit Parking for Review'}</button>
      </form></div>}

      {showTeam && partner && <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0B192C] rounded-[28px] p-5 sm:p-7 space-y-5">
        <div className="flex justify-between"><div><h2 className="font-black text-lg text-[#0B192C] dark:text-white flex items-center gap-2"><ShieldCheck size={19} className="text-[#0A4DA6]" /> Parking Team & Access</h2><p className="text-xs text-gray-400 mt-1">Managers and guards receive dashboards filtered to their assigned facilities.</p></div><button onClick={() => setShowTeam(false)} className="text-gray-400"><X size={19} /></button></div>
        <form onSubmit={assignParkingRole} className="rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3"><select required value={teamForm.userId} onChange={(event) => setTeamForm((current) => ({ ...current, userId: event.target.value }))} className="px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs"><option value="">Select existing staff member</option>{ownerStaff.map((staff) => <option key={getId(staff)} value={getId(staff)}>{staff.name || staff.fullName || staff.email} ({staff.role || 'staff'})</option>)}</select><select value={teamForm.parkingRole} onChange={(event) => setTeamForm((current) => ({ ...current, parkingRole: event.target.value }))} className="px-3.5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs"><option value="parking_manager">Parking Manager</option><option value="security_guard">Parking Guard</option></select></div>
          <div><p className="text-[10px] uppercase font-black text-gray-400 mb-2">Allowed parking facilities</p><div className="grid sm:grid-cols-2 gap-2">{locations.map((item) => { const id = getId(item); return <label key={id} className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-slate-800 px-3 py-2.5 text-xs font-bold"><input type="checkbox" checked={teamForm.locationIds.includes(id)} onChange={() => toggleTeamLocation(id)} /> {item.name}</label>; })}</div></div>
          <button disabled={saving || !ownerStaff.length || !locations.length} className="px-5 py-2.5 rounded-full bg-[#0A4DA6] text-white text-xs font-extrabold disabled:opacity-50">Assign Filtered Parking Role</button>
        </form>
        <div className="space-y-2"><h3 className="text-xs font-black uppercase text-gray-400">Assigned parking team</h3>{parkingStaff.map((grant) => { const user = grant.userId || grant.user || {}; const assigned = grant.locationIds || grant.locations || []; return <div key={getId(grant)} className="flex flex-wrap justify-between items-center gap-3 rounded-xl border border-gray-100 dark:border-slate-800 p-3"><div><p className="text-sm font-extrabold text-[#0B192C] dark:text-white">{user.name || user.fullName || user.email || 'Staff member'}</p><p className="text-[11px] text-gray-400 mt-0.5">{String(grant.parkingRole || grant.role || '').replaceAll('_', ' ')} · {assigned.map((item: any) => item.name || locations.find((locationItem) => getId(locationItem) === getId(item))?.name).filter(Boolean).join(', ') || 'Assigned facilities'}</p></div><button disabled={saving} onClick={() => revokeParkingRole(getId(grant))} className="p-2.5 rounded-full bg-rose-50 text-rose-600" title="Remove parking role"><Trash2 size={14} /></button></div>; })}{parkingStaff.length === 0 && <p className="rounded-xl bg-gray-50 dark:bg-slate-900 p-4 text-xs text-gray-400">No parking manager or guard has been assigned.</p>}</div>
      </div></div>}
    </div>
  );
};

export default OwnerParkingSetupPage;
