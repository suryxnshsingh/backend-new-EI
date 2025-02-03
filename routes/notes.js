import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();
const router = express.Router();

// Set up upload directory
const uploadDir = 'uploads/notes';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Simple file download endpoint
router.get('/download/:filename', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), uploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    res.download(filePath);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Error downloading file');
  }
});

// Create a new note
router.post('/notes', authenticateUser, authorizeTeacher, upload.single('file'), async (req, res) => {
  const { courseId, title, description } = req.body;
  const fileUrl = req.file ? req.file.path : null;
  try {
    console.log('Received form data:', req.body);
    console.log('Creating note with data:', { courseId, title, description, fileUrl });
    const note = await prisma.notes.create({
      data: {
        courseId: parseInt(courseId),
        title,
        description,
        fileUrl,
        createdAt: new Date(),
      },
    });
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// View all notes
router.get('/notes', async (req, res) => {
  try {
    const notes = await prisma.notes.findMany();
    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

// View notes for a specific course
router.get('/notes/course/:courseId', async (req, res) => {
  const { courseId } = req.params;
  try {
    const notes = await prisma.notes.findMany({
      where: { courseId: parseInt(courseId) },
    });
    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve notes for the course' });
  }
});

// Update an existing note
router.put('/notes/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { title, description, fileUrl } = req.body;
  try {
    const note = await prisma.notes.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        fileUrl,
      },
    });
    res.status(200).json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete a note
router.delete('/notes/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notes.delete({
      where: { id: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
