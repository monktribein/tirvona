import React, { useState } from "react";
import { ArrowLeft, Lock, Bell } from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";
import { EnterpriseButton } from "../../admin/shared";

export const ProfileSettingsPage: React.FC = () => {
  const { addNotification } = useNotifications();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      addNotification(
        "Password Mismatch",
        "New passwords do not match.",
        "error",
      );
      return;
    }
    addNotification(
      "Password Changed",
      "Your security password has been updated.",
      "success",
    );
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-gray-50/70 dark:bg-[#070F1B] pb-24 text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-3 space-y-6">
        {/* Security Password Box */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-6 shadow-lg space-y-4">
          <h3 className="font-extrabold text-sm text-[#0B192C] dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Lock size={16} className="text-[#0A4DA6]" /> Change Password
          </h3>

          <form
            onSubmit={handleChangePassword}
            className="space-y-3 text-xs font-bold"
          >
            <div className="space-y-1">
              <label className="text-gray-700 dark:text-gray-300">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <EnterpriseButton type="submit" variant="primary">
                Update Password
              </EnterpriseButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
