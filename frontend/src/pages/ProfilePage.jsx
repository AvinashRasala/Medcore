import { useState, useRef } from "react";
import { Camera, Loader2, X, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../api/endpoints";
import PageHeader from "../components/PageHeader";
import PhoneInput from "../components/PhoneInput";
import { getInitials } from "../utils/format";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2MB original file size cap

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [photoPreview, setPhotoPreview] = useState(user?.profilePhoto || null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const fileInputRef = useRef(null);

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image is too large. Please choose a photo under 2MB.");
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result); // data:image/...;base64,...
      setUploadingPhoto(false);
    };
    reader.onerror = () => {
      toast.error("Could not read that image. Please try another file.");
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleDeletePhoto() {
    if (!window.confirm("Remove your profile photo?")) return;
    setPhotoPreview(null);
    try {
      await authApi.updateProfile({ profilePhoto: null });
      await refreshUser();
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not remove photo.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ name, phone, profilePhoto: photoPreview });
      await refreshUser();
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Update your personal details and photo." />

      <form onSubmit={handleSave} className="card p-6 max-w-lg space-y-6">
        {/* Photo */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <button
              type="button"
              onClick={() => photoPreview && setZoomOpen(true)}
              disabled={!photoPreview}
              className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden shrink-0 disabled:cursor-default"
              aria-label={photoPreview ? "View full size photo" : undefined}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-semibold text-teal-900">{getInitials(name)}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-teal-900 text-white flex items-center justify-center hover:bg-teal-800 transition-colors"
              aria-label="Change profile photo"
            >
              {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-800">Profile photo</p>
            <p className="text-xs text-ink-500 mt-0.5">JPG or PNG, under 2MB.</p>
            {photoPreview && (
              <button
                type="button"
                onClick={handleDeletePhoto}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-coral-600 hover:text-coral-600/80 mt-1.5"
              >
                <Trash2 size={13} />
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Zoom modal */}
        {zoomOpen && photoPreview && (
          <div
            className="fixed inset-0 bg-ink-900/80 flex items-center justify-center z-50 p-6"
            onClick={() => setZoomOpen(false)}
          >
            <button
              onClick={() => setZoomOpen(false)}
              className="absolute top-5 right-5 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <img
              src={photoPreview}
              alt=""
              className="max-h-[80vh] max-w-[80vw] rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div>
          <label className="label-text">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
        </div>

        <div>
          <label className="label-text">Phone</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>

        <div>
          <label className="label-text">Email</label>
          <input value={user?.email || ""} disabled className="input-field bg-ink-50 text-ink-500" />
          <p className="text-xs text-ink-500 mt-1.5">
            Email can't be changed here. Contact an administrator if this needs to be updated.
          </p>
        </div>

        <div>
          <label className="label-text">Role</label>
          <input value={user?.role || ""} disabled className="input-field bg-ink-50 text-ink-500 capitalize" />
        </div>

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
