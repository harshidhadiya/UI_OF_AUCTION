'use client';
import { useState, useEffect } from 'react';
import { api, ApiResponse } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import AdminNavbar from '@/components/AdminNavbar';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [editedProfile, setEditedProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      let user = auth.getUser();

      // If user is missing (e.g. page refresh), try refreshing
      if (!user) {
        // Try user refresh first, fallback to admin refresh
        const refreshed = await auth.tryRefresh(auth.getIsAdmin());
        if (!refreshed) {
          router.push('/login');
          return;
        }
        user = auth.getUser();
      }

      if (!user) {
        router.push('/login');
        return;
      }
      fetchProfile();
    };
    init();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = auth.getUser();
      let res: ApiResponse;

      if (user.role === 'ADMIN') {
        res = await api.get(`/api/admin/profile/?userid=${user.id}`);
      } else {
        res = await api.get(`/api/user/profile`);
      }

      if (res.success) {
        setProfile(res.data);
        setEditedProfile(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldUpdate = (field: string, value: string) => {
    setEditedProfile({ ...editedProfile, [field]: value });
  };

  const isDirty = () => {
    if (!profile || !editedProfile) return false;
    return (
      profile.name !== editedProfile.name ||
      profile.email !== editedProfile.email ||
      profile.phone !== editedProfile.phone ||
      profile.address !== editedProfile.address ||
      profile.Address !== editedProfile.Address // Handle the user's manual change
    );
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      // We map the local field names to the PascalCase keys the backend expects
      const fieldMapping: Record<string, string> = {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        Address: 'Address' // Handle consistent mapping
      };

      let hasChanges = false;
      Object.keys(fieldMapping).forEach(field => {
        if (editedProfile && profile && editedProfile[field] !== profile[field]) {
          const capitalizedKey = fieldMapping[field];
          formData.append(capitalizedKey, editedProfile[field]);
          hasChanges = true;
        }
      });

      if (!hasChanges) {
        setEditingField(null);
        return;
      }

      // Third argument true = use multipart/form-data
      const res = await api.patch('/api/user/profile', formData, true);
      if (res.success) {
        // Refresh token and update global user state
        await auth.tryRefresh(auth.getIsAdmin());
        const updatedUser = auth.getUser();
        if (updatedUser) {
          setProfile(updatedUser);
          setEditedProfile(updatedUser);
        }
        setEditingField(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.patch('/api/user/profile', formData, true);
      if (res.success) {
        // Full refresh and state sync after image upload
        await auth.tryRefresh(auth.getIsAdmin());
        const updatedUser = auth.getUser();
        if (updatedUser) {
          setProfile(updatedUser);
          setEditedProfile(updatedUser);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#FAF7F0]"><div className="w-10 h-10 border-4 border-[#E5DFD3] border-t-[#FFD000] rounded-full animate-spin" /></div>;

  const user = auth.getUser();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-brand-light relative overflow-x-hidden pb-12">
      {/* Decorative background Elements */}
      <div className="yellow-blob" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-slate-900/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />

      {isAdmin ? <AdminNavbar /> : <Navbar />}
      
      <div className="px-4 md:px-8 pt-32 lg:pt-36 relative z-10 w-full max-w-5xl mx-auto">
        <div className="bg-white/90 backdrop-blur-md overflow-hidden rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white">
          {/* Header/Cover aspect */}
          <div className="h-48 bg-gradient-to-r from-brand-accent to-brand-dark relative overflow-hidden">
            <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 translate-x-1/4" />
          </div>

          <div className="px-8 pb-10 pt-0 -mt-16 relative">
            <div className="flex flex-col md:flex-row items-end gap-6 mb-10">
              <div className="relative group z-10">
                <img
                  src={profile?.imageUrl || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="w-32 h-32 md:w-40 md:h-40 rounded-[2rem] border-[6px] border-white shadow-xl object-cover bg-white"
                />
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-black text-xs uppercase tracking-widest rounded-[2rem] opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer backdrop-blur-sm m-1.5">
                  <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                  {uploading ? 'Wait...' : 'Update'}
                </label>
              </div>
              <div className="flex-1 pb-3 flex flex-col items-start md:items-start w-full">
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-none mb-2">{profile?.name}</h1>
                <span className="px-3 py-1 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-lg border border-slate-200">
                  {profile?.role}
                </span>
              </div>
              <button onClick={() => auth.logout()} className="w-full md:w-auto px-8 py-3.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 mb-1">
                Log Out
              </button>
            </div>

            <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-inner">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-8">
                  <EditableField
                    label="Full Name"
                    field="name"
                    value={editedProfile?.name}
                    isEditing={editingField === 'name'}
                    onEdit={() => setEditingField('name')}
                    onChange={(val: string) => handleFieldUpdate('name', val)}
                    onDone={() => setEditingField(null)}
                  />
                  <EditableField
                    label="Email Address"
                    field="email"
                    value={editedProfile?.email}
                    isEditing={editingField === 'email'}
                    onEdit={() => setEditingField('email')}
                    onChange={(val: string) => handleFieldUpdate('email', val)}
                    onDone={() => setEditingField(null)}
                  />
                </div>
                <div className="space-y-8">
                  <EditableField
                    label="Phone Number"
                    field="phone"
                    value={editedProfile?.phone}
                    isEditing={editingField === 'phone'}
                    onEdit={() => setEditingField('phone')}
                    onChange={(val: string) => handleFieldUpdate('phone', val)}
                    onDone={() => setEditingField(null)}
                  />
                  <EditableField
                    label="Address"
                    field="address"
                    value={editedProfile?.address || editedProfile?.Address}
                    isEditing={editingField === 'address'}
                    onEdit={() => setEditingField('address')}
                    onChange={(val: string) => handleFieldUpdate('address', val)}
                    onDone={() => setEditingField(null)}
                  />
                </div>
              </div>

              {isDirty() && (
                <div className="mt-10 pt-6 border-t border-slate-200/60 flex justify-end">
                  <button
                    onClick={saveAllChanges}
                    disabled={isSaving}
                    className="px-10 py-4 bg-brand-accent text-white font-black text-[10px] uppercase tracking-widest rounded-[1.5rem] hover:bg-brand-dark transition-all shadow-xl shadow-brand-accent/20 active:scale-95 disabled:opacity-60 disabled:scale-100 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    )}
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {profile?.obj && (
              <div className="mt-8">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 mx-2">Verification Details</h2>
                <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] p-6 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Verified Status</span>
                    <div className="flex items-center gap-2">
                      {profile.obj.verifiedByAdmin ? (
                         <span className="text-emerald-500 font-black text-sm flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> Verified</span>
                      ) : (
                         <span className="text-orange-500 font-black text-sm flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg> Pending</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 border-l border-slate-100 pl-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Added Rights</span>
                    <div className="flex items-center gap-2">
                      {profile.obj.hasRightToAdd ? (
                         <span className="text-emerald-500 font-black text-sm flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> Granted</span>
                      ) : (
                         <span className="text-slate-400 font-black text-sm flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg> None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableField({ label, field, value, isEditing, onEdit, onChange, onDone }: any) {
  return (
    <div className="group">
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">{label}</label>
      {isEditing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            className="flex-1 px-5 py-3.5 bg-white border border-brand-accent/30 rounded-[1.25rem] focus:outline-none focus:ring-4 focus:ring-brand-accent/10 focus:border-brand-accent shadow-sm font-medium text-slate-800 text-sm transition-all"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onDone();
              if (e.key === 'Escape') onDone();
            }}
          />
          <button onClick={onDone} className="px-5 py-3.5 bg-brand-accent text-white rounded-[1.25rem] hover:bg-brand-dark transition-all shadow-md active:scale-95 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between group-hover:bg-white group-hover:shadow-sm border border-transparent group-hover:border-slate-200 p-4 -mx-4 rounded-[1.25rem] transition-all cursor-pointer" onClick={() => onEdit(field, value)}>
          <span className="text-slate-700 font-bold text-lg">{value || 'Not set'}</span>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-slate-400 group-hover:text-brand-accent scale-95 group-hover:scale-100">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      )}
    </div>
  );
}
