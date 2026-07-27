// Shared Admin Utilities
export const formatAdminResponse = (data, message = 'Success', success = true) => {
  return {
    success,
    message,
    data,
  };
};
