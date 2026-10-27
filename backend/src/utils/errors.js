export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const requireValue = (value, status, code, message) => {
  if (!value) throw new AppError(status, code, message);
  return value;
};
export const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
