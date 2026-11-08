import express from 'express';
import mongoose from 'mongoose';
import { Note } from './models/Note.js';

export const app = express();
app.use(express.json());

// Express returns a normal JSON response for invalid JSON request bodies.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON request body' });
  }
  next(err);
});

function validateNote(req, res, next) {
  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const allowed = ['title', 'body', 'tags'];
  const unexpected = Object.keys(data).filter(key => !allowed.includes(key));
  if (unexpected.length > 0) {
    return res.status(400).json({ error: `Unknown field(s): ${unexpected.join(', ')}` });
  }
  if (typeof data.title !== 'string' || !data.title.trim()) {
    return res.status(400).json({ error: 'title is required and must be a nonempty string' });
  }
  if (data.title.trim().length > 120) {
    return res.status(400).json({ error: 'title must be at most 120 characters' });
  }
  if (data.body !== undefined && typeof data.body !== 'string') {
    return res.status(400).json({ error: 'body must be a string' });
  }
  if (data.tags !== undefined &&
      (!Array.isArray(data.tags) || data.tags.some(tag => typeof tag !== 'string'))) {
    return res.status(400).json({ error: 'tags must be an array of strings' });
  }

  req.noteData = {
    title: data.title.trim(),
    body: data.body ?? '',
    tags: data.tags ?? []
  };
  next();
}

function validateId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).json({ error: 'Invalid note ID' });
  }
  next();
}

app.get('/api/notes', async (req, res) => {
  const { search } = req.query;
  if (search !== undefined && typeof search !== 'string') {
    return res.status(400).json({ error: 'search must be a single string' });
  }
  const filter = search ? { title: { $regex: escapeRegex(search), $options: 'i' } } : {};
  const notes = await Note.find(filter).sort({ createdAt: -1 });
  res.status(200).json(notes);
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.get('/api/notes/:id', validateId, async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.status(200).json(note);
});

app.post('/api/notes', validateNote, async (req, res) => {
  const note = await Note.create(req.noteData);
  res.status(201).json(note);
});

// PUT replaces editable fields. Omitted optional fields return to defaults.
app.put('/api/notes/:id', validateId, validateNote, async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { $set: req.noteData },
    { new: true, runValidators: true }
  );
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.status(200).json(note);
});

app.delete('/api/notes/:id', validateId, async (req, res) => {
  const note = await Note.findByIdAndDelete(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.sendStatus(204);
});

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unexpected API error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
