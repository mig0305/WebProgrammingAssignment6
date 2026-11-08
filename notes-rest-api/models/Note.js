import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: '' },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const Note = mongoose.model('Note', noteSchema);
