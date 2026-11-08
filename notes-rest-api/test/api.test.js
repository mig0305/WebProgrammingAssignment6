import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../app.js';
import { Note } from '../models/Note.js';

const id = '507f1f77bcf86cd799439011';
const missingId = '507f1f77bcf86cd799439012';
const sample = { _id: id, title: 'Exam notes', body: 'REST APIs', tags: [], createdAt: new Date(), updatedAt: new Date() };
const original = {
  find: Note.find, findById: Note.findById, create: Note.create,
  findByIdAndUpdate: Note.findByIdAndUpdate,
  findByIdAndDelete: Note.findByIdAndDelete
};

afterEach(() => Object.assign(Note, original));

test('GET list returns 200 with notes', async () => {
  Note.find = () => ({ sort: async () => [sample] });
  const res = await request(app).get('/api/notes');
  assert.equal(res.status, 200);
  assert.equal(res.body[0].title, 'Exam notes');
});

test('GET one returns 200; missing note returns 404', async () => {
  Note.findById = async key => key === id ? sample : null;
  assert.equal((await request(app).get(`/api/notes/${id}`)).status, 200);
  assert.equal((await request(app).get(`/api/notes/${missingId}`)).status, 404);
});

test('POST creates a valid note with status 201', async () => {
  Note.create = async data => ({ ...sample, ...data });
  const res = await request(app).post('/api/notes').send({ title: ' New ', body: 'Text' });
  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'New');
});

test('POST rejects missing title, empty title, wrong tags and unexpected fields', async () => {
  for (const body of [{ body: 'x' }, { title: '  ' }, { title: 'X', tags: [1] }, { title: 'X', admin: true }]) {
    const res = await request(app).post('/api/notes').send(body);
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  }
});

test('PUT updates with defaults and handles missing note', async () => {
  Note.findByIdAndUpdate = async (key, update, options) => {
    assert.equal(options.new, true);
    assert.equal(options.runValidators, true);
    assert.equal(update.$set.body, '');
    assert.deepEqual(update.$set.tags, []);
    return key === id ? { ...sample, ...update.$set } : null;
  };
  assert.equal((await request(app).put(`/api/notes/${id}`).send({ title: 'Updated' })).status, 200);
  assert.equal((await request(app).put(`/api/notes/${missingId}`).send({ title: 'Updated' })).status, 404);
});

test('DELETE returns 204 with no body, then 404 for missing note', async () => {
  Note.findByIdAndDelete = async key => key === id ? sample : null;
  const success = await request(app).delete(`/api/notes/${id}`);
  assert.equal(success.status, 204);
  assert.equal(success.text, '');
  assert.equal((await request(app).delete(`/api/notes/${missingId}`)).status, 404);
});

test('invalid ObjectId and malformed JSON return 400', async () => {
  const badId = await request(app).get('/api/notes/not-an-id');
  assert.equal(badId.status, 400);
  const badJson = await request(app).post('/api/notes').set('Content-Type', 'application/json').send('{invalid');
  assert.equal(badJson.status, 400);
  assert.ok(badJson.body.error);
});

test('unknown route returns JSON 404', async () => {
  const res = await request(app).get('/api/missing');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Route not found');
});

test('unexpected database error becomes JSON 500', async () => {
  const old = console.error;
  console.error = () => {};
  try {
    Note.findById = async () => { throw new Error('Database unavailable'); };
    const res = await request(app).get(`/api/notes/${id}`);
    assert.equal(res.status, 500);
    assert.equal(res.body.error, 'Internal server error');
  } finally {
    console.error = old;
  }
});
