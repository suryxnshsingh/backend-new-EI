import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/quiz-images/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Create a new quiz
router.post('/', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const { title, description, timeLimit, courseIds, maxMarks, scheduledFor } = req.body;
    const userId = req.user.userId || req.user.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const teacher = await prisma.teacher.findFirst({
      where: {
        userId: parseInt(userId)
      }
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher record not found' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || '',
        timeLimit: Number(timeLimit),
        maxMarks: Number(maxMarks),
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        isActive: false,
        createdBy: {
          connect: { id: parseInt(userId) }
        },
        course: {
          connect: courseIds.map(id => ({ id: Number(id) }))[0] // Connect to single course
        },
        teachers: {
          connect: [{ id: teacher.id }]
        }
      },
      include: {
        course: true,
        teachers: true,
        createdBy: true
      }
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    res.status(500).json({ 
      error: 'Failed to create quiz',
      details: error.message
    });
  }
});

// Delete a quiz
router.delete('/:quizId', async (req, res) => {
  try {
    const quizId = req.params.quizId; // Use quizId as a UUID string
    // Delete all dependent questions first
    await prisma.question.deleteMany({
      where: { quizId }
    });
    // Delete the quiz
    const deletedQuiz = await prisma.quiz.delete({
      where: { id: quizId }
    });
    res.json({ message: 'Quiz and associated questions deleted successfully', quiz: deletedQuiz });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// Update quiz details
router.put('/:quizId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const { title, description, timeLimit, courseIds, maxMarks, scheduledFor } = req.body;
    
    // Verify the quiz belongs to the teacher
    const existingQuiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        teachers: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!existingQuiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    const updatedQuiz = await prisma.quiz.update({
      where: { id: req.params.quizId },
      data: {
        title,
        description,
        timeLimit: Number(timeLimit),
        maxMarks: maxMarks !== undefined ? Number(maxMarks) : undefined,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        courseId: courseIds[0] ? parseInt(courseIds[0]) : existingQuiz.courseId // Use first courseId or keep existing
      },
      include: {
        course: true,
        teachers: true
      }
    });

    res.json(updatedQuiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Add a question to a quiz
router.post('/:quizId/questions', authenticateUser, authorizeTeacher, upload.single('image'), async (req, res) => {
  try {
    const { type, text, marks, options, correctAnswer, tolerance, keywords, threshold, order } = req.body;
    const quizId = req.params.quizId;
    const imageUrl = req.file ? `/uploads/quiz-images/${req.file.filename}` : null;

    const question = await prisma.question.create({
      data: {
        quizId,
        type,
        text,
        marks: parseFloat(marks),
        imageUrl,
        correctAnswer: type === 'NUMERICAL' ? parseFloat(correctAnswer) : null,
        tolerance: tolerance ? parseFloat(tolerance) : null,
        keywords: keywords ? JSON.parse(keywords) : [],
        threshold: threshold ? parseFloat(threshold) : null,
        order: parseInt(order),
        options: type.includes('MCQ') ? {
          create: JSON.parse(options).map(opt => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            imageUrl: opt.imageUrl
          }))
        } : undefined
      },
      include: {
        options: true
      }
    });

    res.status(201).json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Delete a question from a quiz
router.delete('/:quizId/questions/:questionId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    // Verify the quiz belongs to the teacher
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        teachers: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Delete the question
    await prisma.question.delete({
      where: {
        id: req.params.questionId,
        quizId: req.params.quizId
      }
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Update question details
router.put('/:quizId/questions/:questionId', authenticateUser, authorizeTeacher, upload.single('image'), async (req, res) => {
  try {
    const { type, text, marks, options, correctAnswer, tolerance, keywords, threshold, order } = req.body;
    const imageUrl = req.file ? `/uploads/quiz-images/${req.file.filename}` : undefined;

    // Verify the quiz belongs to the teacher
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        teachers: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Update the question
    const updatedQuestion = await prisma.question.update({
      where: {
        id: req.params.questionId,
        quizId: req.params.quizId
      },
      data: {
        type,
        text,
        marks: parseFloat(marks),
        ...(imageUrl && { imageUrl }),
        correctAnswer: type === 'NUMERICAL' ? parseFloat(correctAnswer) : null,
        tolerance: tolerance ? parseFloat(tolerance) : null,
        keywords: keywords ? JSON.parse(keywords) : [],
        threshold: threshold ? parseFloat(threshold) : null,
        order: parseInt(order),
        options: type.includes('MCQ') ? {
          deleteMany: {}, // Delete existing options
          create: JSON.parse(options).map(opt => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
            imageUrl: opt.imageUrl
          }))
        } : undefined
      },
      include: {
        options: true
      }
    });

    res.json(updatedQuestion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Get all quizzes created by the teacher
router.get('/my-quizzes', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        teachers: {
          some: {
            userId: req.user.userId || req.user.id
          }
        }
      },
      include: {
        questions: {
          include: {
            options: true
          }
        },
        course: true, // This ensures courses are included
        teachers: true
      }
    });
    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get a single quiz created by the teacher, including questions and course details
router.get('/my-quizzes/:quizId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: true  // Include options
          },
          orderBy: {
            order: 'asc'  // Sort questions by order
          }
        },
        course: true,
        teachers: {
          include: {
            user: true
          }
        },
        createdBy: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }
    res.json(quiz);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get teacher's quizzes
router.get('/', authenticateUser, async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        teachers: {  // Changed from Teacher to teachers
          some: {
            userId: parseInt(req.user.id)
          }
        }
      },
      include: {
        questions: {
          include: {
            options: true
          }
        },
        course: true,    // Changed from Course to course
        teachers: true   // Changed from Teacher to teachers
      }
    });

    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get quiz attempts and responses
router.get('/:quizId/attempts', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId: req.params.quizId
      },
      include: {
        user: true,
        answers: {
          include: {
            question: true
          }
        }
      }
    });
    res.json(attempts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// Toggle quiz status (active/inactive)
router.patch('/:quizId/toggle-status', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    // Verify the quiz belongs to the teacher
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        teachers: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Toggle the status
    const updatedQuiz = await prisma.quiz.update({
      where: {
        id: req.params.quizId
      },
      data: {
        isActive: !quiz.isActive
      }
    });

    res.json(updatedQuiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle quiz status' });
  }
});

export default router;