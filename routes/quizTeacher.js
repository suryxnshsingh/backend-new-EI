import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library.js';  // Fixed import path
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
    const { title, description, timeLimit, courseIds, maxMarks } = req.body;
    
    // Get user ID directly from the token payload as it was working before
    const userId = req.user.userId || req.user.id; // Support both formats
    console.log('Creating quiz for user:', userId);

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find teacher with userId
    const teacher = await prisma.teacher.findFirst({
      where: {
        userId: parseInt(userId)
      }
    });

    console.log('Found teacher:', teacher);

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher record not found' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description: description || '',
        timeLimit: Number(timeLimit),
        isActive: false,
        userId: parseInt(userId), // Use userId directly as before
        maxMarks: maxMarks ? parseFloat(maxMarks) : null,
        Course: {
          connect: courseIds.map(id => ({ id: Number(id) }))
        },
        Teacher: {
          connect: [{ id: teacher.id }]
        }
      },
      include: {
        Course: true,
        Teacher: true
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
router.delete('/:quizId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    // Verify the quiz belongs to the teacher
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        Teacher: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Delete the quiz and all related data (cascading delete will handle related records)
    await prisma.quiz.delete({
      where: {
        id: req.params.quizId
      }
    });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// Update quiz details
router.put('/:quizId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const { title, description, timeLimit, courseIds, maxMarks } = req.body;
    
    // Verify the quiz belongs to the teacher
    const existingQuiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        Teacher: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!existingQuiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Update quiz details
    const updatedQuiz = await prisma.quiz.update({
      where: {
        id: req.params.quizId
      },
      data: {
        title,
        description,
        timeLimit,
        maxMarks: maxMarks ? parseFloat(maxMarks) : null,
        Course: {
          set: [], // Remove existing connections
          connect: courseIds.map(id => ({ id: parseInt(id) })) // Add new connections
        }
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

    // Parse options if it exists
    let parsedOptions = [];
    if (options) {
      try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
      } catch (error) {
        console.error('Error parsing options:', error);
      }
    }

    // Parse keywords if it exists
    let parsedKeywords = [];
    if (keywords) {
      try {
        parsedKeywords = typeof keywords === 'string' ? JSON.parse(keywords) : keywords;
      } catch (error) {
        console.error('Error parsing keywords:', error);
      }
    }

    // Create question data object with correct types
    const questionData = {
      quizId,
      type,
      text,
      marks: parseFloat(marks),
      imageUrl,
      correctAnswer: type === 'NUMERICAL' ? new Decimal(correctAnswer || 0) : null,
      tolerance: tolerance ? parseFloat(tolerance) : null,
      threshold: threshold ? parseFloat(threshold) : null,
      keywords: parsedKeywords,
      order: parseInt(order || 0),
      metadata: {},
      options: type.includes('MCQ') && parsedOptions.length > 0 ? {
        create: parsedOptions.map(opt => ({
          text: opt.text,
          isCorrect: opt.isCorrect
        }))
      } : undefined
    };

    const question = await prisma.question.create({
      data: questionData,
      include: {
        options: true
      }
    });

    res.status(201).json(question);
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ 
      error: 'Failed to add question',
      details: error.message
    });
  }
});

// Delete a question from a quiz
router.delete('/:quizId/questions/:questionId', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    // Verify the quiz belongs to the teacher
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.quizId,
        Teacher: {
          some: {
            userId: req.user.id
          }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    // Delete options first, then the question using a transaction
    await prisma.$transaction(async (tx) => {
      // Delete associated options
      await tx.option.deleteMany({
        where: {
          questionId: req.params.questionId
        }
      });

      // Delete associated answers if any
      await tx.answer.deleteMany({
        where: {
          questionId: req.params.questionId
        }
      });

      // Delete the question
      await tx.question.delete({
        where: {
          id: req.params.questionId,
          quizId: req.params.quizId
        }
      });
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
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
        Teacher: {
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
            isCorrect: opt.isCorrect
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
        Teacher: {
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
        Course: true, // This ensures courses are included
        Teacher: true
      }
    });
    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get a specific quiz by ID
router.get('/quiz/:id', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: {
        id: req.params.id,
        Teacher: {
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
        Course: true,
        Teacher: true
      }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
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
        Teacher: {
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

// Update quiz details with proper Course handling
router.put('/api/quiz/teacher/:id', async (req, res) => {
  try {
    const { title, description, timeLimit, courseIds } = req.body;
    const quiz = await Quiz.findByPk(req.params.id);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    quiz.title = title;
    quiz.description = description;
    quiz.timeLimit = timeLimit;

    if (courseIds && Array.isArray(courseIds)) {
      const courses = await Course.findAll({ where: { id: courseIds } });
      await quiz.setCourses(courses);
    }

    await quiz.save();
    const updatedQuiz = await Quiz.findByPk(req.params.id, { include: [Course] });
    res.json(updatedQuiz);
  } catch (error) {
    console.error('Failed to update quiz:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

export default router;