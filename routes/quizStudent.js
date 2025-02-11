import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Add new route for quiz statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // First get student record
    const student = await prisma.student.findFirst({
      where: {
        userId: parseInt(userId)
      },
      include: {
        enrollments: {
          where: {
            status: 'ACCEPTED'
          },
          include: {
            course: {
              include: {
                quizzes: {
                  include: {
                    attempts: {
                      where: {
                        userId: parseInt(userId),
                        status: 'SUBMITTED'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!student) {
      return res.status(401).json({ error: 'User is not a student' });
    }

    const now = new Date();
    
    // Flatten the quizzes from all enrolled courses
    const enrolledQuizzes = student.enrollments.flatMap(
      enrollment => enrollment.course.quizzes
    );

    const stats = enrolledQuizzes.reduce((acc, quiz) => {
      if (quiz.attempts && quiz.attempts.length > 0) {
        acc.completed++;
      } else {
        const scheduledTime = quiz.scheduledFor ? new Date(quiz.scheduledFor) : null;
        
        if (scheduledTime) {
          const endTime = new Date(scheduledTime.getTime() + (quiz.timeLimit * 60 * 1000));
          if (now > endTime) {
            acc.missed++;
          } else {
            acc.upcoming++;
          }
        } else if (!quiz.isActive) {
          acc.missed++;
        } else {
          acc.upcoming++;
        }
      }
      return acc;
    }, { upcoming: 0, completed: 0, missed: 0 });

    res.json(stats);
  } catch (error) {
    console.error('Error fetching quiz stats:', error);
    res.status(500).json({ error: 'Failed to fetch quiz statistics' });
  }
});

// Add history route right after stats route
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const now = new Date();

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [attempts, allQuizzes] = await Promise.all([
      // Get completed attempts
      prisma.quizAttempt.findMany({
        where: {
          userId: parseInt(userId),
          status: 'SUBMITTED'
        },
        include: {
          quiz: {
            select: {
              title: true,
              maxMarks: true,
              scheduledFor: true,
              Course: true
            }
          }
        },
        orderBy: {
          submittedAt: 'desc'
        }
      }),
      // Get all quizzes for missed ones
      prisma.quiz.findMany({
        where: {
          Course: {
            some: {
              enrollments: {
                some: {
                  student: { userId: parseInt(userId) },
                  status: 'ACCEPTED'
                }
              }
            }
          },
          scheduledFor: { lt: now }
        },
        include: {
          Course: true,
          attempts: {
            where: {
              userId: parseInt(userId)
            }
          }
        }
      })
    ]);

    // Filter for missed quizzes (scheduled in past, no attempts)
    const missedQuizzes = allQuizzes.filter(quiz => {
      const endTime = new Date(quiz.scheduledFor.getTime() + (quiz.timeLimit * 60 * 1000));
      return now > endTime && quiz.attempts.length === 0;
    });

    res.json({
      attempts,
      missedQuizzes
    });
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
});

// Get available quizzes for student
router.get('/available', authenticateUser, async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: {
        isActive: true,
        Course: {
          some: {
            enrollments: {
              some: {
                studentId: req.user.studentId,
                status: 'ACCEPTED'
              }
            }
          }
        }
      },
      include: {
        Course: true,
        Teacher: {
          include: {
            user: true
          }
        }
      }
    });
    
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get a specific quiz with questions
router.get('/:quizId', authenticateUser, async (req, res) => {
  try {
    // Check if student has already attempted this quiz
    const existingAttempt = await prisma.quizAttempt.findFirst({
      where: {
        quizId: req.params.quizId, // Remove parseInt since it's a UUID string
        userId: req.user.id,
        status: 'SUBMITTED'
      }
    });

    if (existingAttempt) {
      return res.status(400).json({ error: 'Quiz already attempted' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { 
        id: req.params.quizId // Remove parseInt since it's a UUID string
      },
      include: {
        questions: {
          include: {
            options: true  // Make sure to include options
          }
        },
        Course: true
      }
    });

    // Check if quiz exists and is active
    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ error: 'Quiz not found or not active' });
    }

    console.log('Quiz data:', JSON.stringify(quiz, null, 2)); // Debug log
    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
});

// Start a quiz attempt
router.post('/:quizId/start', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const attempt = await prisma.quizAttempt.create({
      data: {
        quiz: {
          connect: { id: req.params.quizId }
        },
        user: {
          connect: { id: parseInt(userId) }
        },
        status: 'IN_PROGRESS'
      }
    });
    
    res.status(201).json(attempt);
  } catch (error) {
    console.error('Error starting quiz:', error);
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
            // Fix: Calculate matchCount inside the case
            const matchedKeywords = question.keywords.filter(keyword => 
              answer.textAnswer.toLowerCase().includes(keyword.toLowerCase())
            );
            const matchCount = matchedKeywords.length;
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

// Get attempt details with answers
router.get('/attempt/:attemptId', authenticateUser, async (req, res) => {
  try {
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        id: req.params.attemptId,
        userId: req.user.id
      },
      include: {
        quiz: true,
        answers: {
          include: {
            question: true
          }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    res.json(attempt);
  } catch (error) {
    console.error('Error fetching attempt:', error);
    res.status(500).json({ error: 'Failed to fetch attempt details' });
  }
});

// Helper function to compare arrays
function areArraysEqual(a, b) {
  return a.size === b.size && [...a].every(value => b.has(value));
}

export default router;