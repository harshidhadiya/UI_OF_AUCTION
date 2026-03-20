'use client';
import { useState, useEffect } from 'react';
import { api, ApiResponse } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [editedProfile, setEditedProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = auth.getUser();
    const token = auth.getToken();
    if (!user || !token) {
      router.push('/login');
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const user = auth.getUser();
      const token = auth.getToken();
      let res: ApiResponse;

      if (user.role === 'ADMIN') {
        res = await api.get(`/api/admin/profile/?userid=${user.id}`, token!);
      } else {
        res = await api.get(`/api/user/profile/0`, token!);
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
    const token = auth.getToken();
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
      const res = await api.patch('/api/user/profile', formData, true, token!);
      if (res.success && res.data) {
        const data = res.data as any;
        
        // Normalize keys for frontend: PascalCase -> camelCase
        const normalizedData: any = {};
        Object.keys(data).forEach(key => {
          const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
          normalizedData[lowerKey] = data[key];
        });

        const newProfile = { ...profile, ...normalizedData };
        setProfile(newProfile);
        setEditedProfile({ ...editedProfile, ...normalizedData });
        
        // Update global auth state to sync across the app (header, etc.)
        const currentUser = auth.getUser();
        auth.setUser({ ...currentUser, ...normalizedData });
        
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
    const token = auth.getToken();
    try {
      const formData = new FormData();
      formData.append('file', file);
      console.log("entered");
      const res = await api.patch('/api/user/profile', formData, true, token!);
      if (res.success && res.data) {
        const data = res.data as any;
        const normalizedData: any = {};
        Object.keys(data).forEach(key => {
          const lowerKey = key.charAt(0).toLowerCase() + key.slice(1);
          normalizedData[lowerKey] = data[key];
        });

        // res.data might contain the new image URL
        const newImageUrl = normalizedData.imageUrl || data.imageUrl; // check both
        setProfile({ ...profile, imageUrl: newImageUrl || profile?.imageUrl });
        setEditedProfile({ ...editedProfile, imageUrl: newImageUrl || editedProfile?.imageUrl });

        // Update global auth state
        const currentUser = auth.getUser();
        auth.setUser({ ...currentUser, imageUrl: newImageUrl });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading Profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="premium-card bg-white overflow-hidden">
          {/* Header/Cover aspect */}
          <div className="h-32 bg-gradient-to-r from-brand-accent to-brand-dark" />

          <div className="px-8 pb-8 pt-0 -mt-12 relative">
            <div className="flex flex-col md:flex-row items-end gap-6 mb-8">
              <div className="relative group">
                <img
                  src={profile?.imageUrl || 'https://via.placeholder.com/150'}
                  alt="Profile"
                  className="w-32 h-32 rounded-2xl border-4 border-white shadow-lg object-cover bg-white"
                />
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                  {uploading ? '...' : 'Change'}
                </label>
              </div>
              <div className="flex-1 pb-2">
                <h1 className="text-3xl font-bold text-slate-900">{profile?.name}</h1>
                <p className="text-slate-500 font-medium">{profile?.role}</p>
              </div>
              <button onClick={() => auth.logout()} className="premium-button bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                Log Out
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
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
              <div className="space-y-6">
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
              <div className="mt-8 flex justify-end">
                <button
                  onClick={saveAllChanges}
                  disabled={isSaving}
                  className="premium-button bg-brand-accent text-white hover:bg-brand-dark flex items-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  )}
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            )}

            {/* Admin specific detail object if it exists */}
            {profile?.obj && (
              <div className="mt-12 pt-8 border-t border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Verification Details</h2>
                <div className="bg-slate-50 rounded-xl p-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Verified by Admin</span>
                    <p className="font-semibold">{profile.obj.verifiedByAdmin ? '✅ Yes' : '❌ No'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Rights Granted</span>
                    <p className="font-semibold">{profile.obj.hasRightToAdd ? '✅ Yes' : '❌ No'}</p>
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
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</label>
      {isEditing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            className="premium-input flex-1"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onDone();
              if (e.key === 'Escape') onDone();
            }}
          />
          <button onClick={onDone} className="p-2 bg-brand-accent text-white rounded-md hover:bg-brand-dark">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between group-hover:bg-slate-100/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer" onClick={() => onEdit(field, value)}>
          <span className="text-slate-800 font-medium">{value || 'Not set'}</span>
          <svg className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  );
}
