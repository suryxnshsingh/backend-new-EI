import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();
const router = express.Router();

// Set up upload directory
const uploadDir = 'uploads/assignment';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up submissions upload directory
const submissionUploadDir = 'uploads/submissions';
if (!fs.existsSync(submissionUploadDir)) {
  fs.mkdirSync(submissionUploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Configure multer for submission files
const submissionStorage = multer.diskStorage({
  destination: submissionUploadDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const uploadSubmission = multer({ storage: submissionStorage });

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

// New: Endpoint for downloading submission files
router.get('/download/submission/:filename', (req, res) => {
  try {
    const filePath = path.join(process.cwd(), submissionUploadDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    res.download(filePath);
  } catch (error) {
    console.error('Download submission error:', error);
    res.status(500).send('Error downloading submission file');
  }
});

// Create a new assignment
router.post('/create', upload.single('file'), async (req, res) => {
  const { courseId, title, description, dueDate, maxMarks } = req.body;
  const fileUrl = req.file ? `uploads/assignment/${req.file.filename}` : null;

  try {
    const assignment = await prisma.assignment.create({
      data: {
        courseId: parseInt(courseId),
        title,
        description,
        dueDate: new Date(dueDate),
        maxMarks: parseFloat(maxMarks),
        fileUrl,
      }
    });
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Prisma Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get assignments for a specific course including the current student's submission (if any)
router.get('/course/:courseId', async (req, res) => {
  const { courseId } = req.params;
  const { studentId } = req.query; // now expecting studentId as the logged-in User's id
  if (!studentId) {
    return res.status(400).json({ error: 'Student ID query parameter is required.' });
  }
  const parsedUserId = parseInt(studentId, 10);
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ error: 'Invalid Student ID.' });
  }
  try {
    const assignments = await prisma.assignment.findMany({
      where: { courseId: parseInt(courseId, 10) },
      include: {
        submissions: {
          // Use nested where filter to check the submission's student's userId.
          where: { student: { userId: parsedUserId } }
        }
      }
    });
    console.log('Assignments returned:', assignments.map(a => a.submissions.length));
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// View all assignments for a course
router.get('/course/:courseId/all', async (req, res) => {
  const { courseId } = req.params;

  try {
    const assignments = await prisma.assignment.findMany({
      where: { courseId: parseInt(courseId) }
    });
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// View all assignments
router.get('/all', async (req, res) => {
  try {
    const assignments = await prisma.assignment.findMany();
    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// View a specific assignment by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(id) }
    });
    if (assignment) {
      res.status(200).json(assignment);
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Update an existing assignment
router.put('/update/:id', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate, maxMarks } = req.body;
  const fileUrl = req.file ? `uploads/assignment/${req.file.filename}` : null;

  try {
    const assignment = await prisma.assignment.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        maxMarks: parseFloat(maxMarks),
        fileUrl,
      }
    });
    res.status(200).json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Delete an assignment
router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.assignmentSubmission.deleteMany({
      where: { assignmentId: parseInt(id) }
    });
    await prisma.assignment.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Assignment and related submissions deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment and related submissions' });
  }
});

// Toggle accepting submissions for an assignment
router.put('/toggle-submissions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(id) }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id: parseInt(id) },
      data: {
        acceptingSubmissions: !assignment.acceptingSubmissions
      }
    });

    res.status(200).json(updatedAssignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle accepting submissions' });
  }
});

// Student submits an assignment
router.post('/submit', uploadSubmission.single('file'), async (req, res) => {
  const { assignmentId, studentId, note } = req.body;
  if (!req.file) { 
    return res.status(400).json({ error: 'Submission file is required.' });
  }
  if (!studentId) { 
    return res.status(400).json({ error: 'Student ID is required.' });
  }
  console.log('Received studentId (User ID):', studentId, typeof studentId);
  const parsedUserId = parseInt(studentId, 10);
  if (isNaN(parsedUserId)) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }
  // Look up the student record based on the User id
  const studentRecord = await prisma.student.findUnique({
    where: { userId: parsedUserId }
  });
  if (!studentRecord) {
    return res.status(400).json({ error: 'Invalid student ID.' });
  }
  const fileUrl = `uploads/submissions/${req.file.filename}`;
  try {
    const assignmentRecord = await prisma.assignment.findUnique({
      where: { id: parseInt(assignmentId) }
    });
    if (!assignmentRecord) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    // Upsert submission so duplicates update instead of failing the unique constraint
    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: parseInt(assignmentId), studentId: studentRecord.id } },
      update: {
        fileUrl,
        note,
        submissionDate: new Date(),
        isLate: new Date() > new Date(assignmentRecord.dueDate)
      },
      create: {
        assignmentId: parseInt(assignmentId),
        studentId: studentRecord.id,
        fileUrl,
        note,
        isLate: new Date() > new Date(assignmentRecord.dueDate)
      }
    });
    res.status(201).json({ message: 'Submission successful', submission });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Student views their submissions
router.get('/submissions/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { studentId: parseInt(studentId) },
      include: { assignment: true }
    });
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Teacher views all submissions for a specific assignment
router.get('/submissions/assignment/:assignmentId', async (req, res) => {
  const { assignmentId } = req.params;

  try {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId: parseInt(assignmentId) },
      include: { student: true }
    });
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// View all submissions for a specific student
router.get('/submissions/student/:studentId', async (req, res) => {
  const { studentId } = req.params;

  try {
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { studentId: parseInt(studentId) },
      include: { assignment: true }
    });
    res.status(200).json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// View a specific submission by ID
router.get('/submission/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: parseInt(id) },
      include: { assignment: true, student: true }
    });
    if (submission) {
      res.status(200).json(submission);
    } else {
      res.status(404).json({ error: 'Submission not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

export default router;
