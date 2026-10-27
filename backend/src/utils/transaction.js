import mongoose from 'mongoose';
export const inTransaction = (callback) =>
  mongoose.connection.transaction(callback, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    readPreference: 'primary',
  });
