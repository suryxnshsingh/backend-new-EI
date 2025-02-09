import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all available quizzes for the student
router.get('/available', authenticateUser, async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user.id },
      include: { enrollments: true }
    });

    const courseIds = student.enrollments.map(e => e.courseId);

    const quizzes = await prisma.quiz.findMany({
      where: {
        isActive: true,
        Course: {
          some: {
            id: {
              in: courseIds
            }
          }
        }
      },
      include: {
        Course: true
      }
    });

    // Filter out quizzes that have been completed
    const attemptedQuizzes = await prisma.quizAttempt.findMany({
      where: {
        userId: req.user.id,
        status: 'SUBMITTED'
      }
    });

    const attemptedQuizIds = new Set(attemptedQuizzes.map(a => a.quizId));
    const availableQuizzes = quizzes.filter(q => !attemptedQuizIds.has(q.id));

    res.json(availableQuizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch available quizzes' });
  }
});

// Get a specific quiz with questions
router.get('/:quizId', authenticateUser, async (req, res) => {
  try {
    // Check if student has already attempted this quiz
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId: req.params.quizId,
        userId: req.user.id,
        status: 'SUBMITTED'
      }
    });

    if (existingAttempt) {
      return res.status(400).json({ error: 'Quiz already attempted' });
    }

    const quizId = parseInt(req.params.quizId);
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: true,
        Course: true
      }
    });

    // Check if quiz exists and is active
    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ error: 'Quiz not found or not active' });
    }

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
});

// Start a quiz attempt
router.post('/:quizId/start', authenticateUser, async (req, res) => {
  try {
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: req.params.quizId,
        userId: req.user.id,
        status: 'IN_PROGRESS'
      }
    });
    res.status(201).json(attempt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to start quiz attempt' });
  }
});

// Submit quiz answers
router.post('/:quizId/submit', authenticateUser, async (req, res) => {
  try {
    const { attemptId, answers } = req.body;

    // Validate attempt exists and belongs to user
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        userId: req.user.id,
        status: 'IN_PROGRESS'
      },
      include: {
        quiz: {
          include: {
            questions: true
          }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Quiz attempt not found' });
    }

    // Process each answer
    const processedAnswers = await Promise.all(
      answers.map(async answer => {
        const question = attempt.quiz.questions.find(q => q.id === answer.questionId);
        let isCorrect = false;
        let score = 0;

        switch (question.type) {
          case 'SINGLE_MCQ':
          case 'MULTI_MCQ':
            // Handle MCQ scoring
            const correctOptions = await prisma.option.findMany({
              where: {
                questionId: question.id,
                isCorrect: true
              }
            });
            const correctOptionIds = new Set(correctOptions.map(o => o.id));
            const selectedOptionIds = new Set(answer.selectedOptions);
            isCorrect = areArraysEqual(correctOptionIds, selectedOptionIds);
            score = isCorrect ? question.marks : 0;
            break;

          case 'NUMERICAL':
            // Handle numerical scoring with tolerance
            const numAnswer = parseFloat(answer.textAnswer);
            const correctAnswer = parseFloat(question.correctAnswer.toString());
            const tolerance = question.tolerance || 0;
            isCorrect = Math.abs(numAnswer - correctAnswer) <= tolerance;
            score = isCorrect ? question.marks : 0;
            break;

          case 'DESCRIPTIVE':
            // Handle descriptive scoring based on keywords
            const matchCount = question.keywords.filter(keyword => 
              answer.textAnswer.toLowerCase().includes(keyword.toLowerCase())
            ).length;
            const matchPercentage = (matchCount / question.keywords.length) * 100;
            score = (matchPercentage >= (question.threshold || 0)) ? 
              question.marks * (matchPercentage / 100) : 0;
            break;
        }

        return prisma.answer.create({
          data: {
            questionId: answer.questionId,
            attemptId,
            selectedOptions: answer.selectedOptions || [],
            textAnswer: answer.textAnswer,
            isCorrect,
            score,
            keywordMatchPercentage: question.type === 'DESCRIPTIVE' ? 
              (matchCount / question.keywords.length) * 100 : null
          }
        });
      })
    );

    // Calculate total score
    const totalScore = processedAnswers.reduce((sum, answer) => sum + (answer.score || 0), 0);

    // Update attempt status and score
    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        score: totalScore
      }
    });

    res.json(updatedAttempt);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// Helper function to compare arrays
function areArraysEqual(a, b) {
  return a.size === b.size && [...a].every(value => b.has(value));
}

export default router;