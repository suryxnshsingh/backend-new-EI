import express from 'express';
import multer from 'multer';
import path from 'path';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/assignment/'); // Specify the destination directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Specify the file name
  }
});
const upload = multer({ storage: storage });

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', 'assignment', filename);
  res.sendFile(filePath);
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

// Get assignments for a specific course
router.get('/course/:courseId', async (req, res) => {
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
router.post('/submit', upload.single('file'), async (req, res) => {
  const { assignmentId, studentId, note } = req.body;
  const fileUrl = req.file ? `uploads/assignment/${req.file.filename}` : null;

  try {
    const submission = await prisma.assignmentSubmission.create({
      data: {
        assignmentId: parseInt(assignmentId),
        studentId: parseInt(studentId),
        fileUrl,
        note,
        isLate: new Date() > new Date((await prisma.assignment.findUnique({ where: { id: parseInt(assignmentId) } })).dueDate)
      }
    });
    res.status(201).json(submission);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit assignment' });
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
