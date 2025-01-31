import express from 'express';
const router = express.Router();
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();


// Create a new quiz
router.post('/quiz', async (req, res) => {
    try {
        const { title, description, timeLimit, isActive, courseId, userId } = req.body;
        const quiz = await prisma.quiz.create({
            data: { title, description, timeLimit, isActive, courseId, userId },
        });
        res.status(201).json(quiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

// Get all quizzes
router.get('/quiz', async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany();
        res.status(200).json(quizzes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch quizzes' });
    }
});

// Get a specific quiz by ID
router.get('/quiz/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
        res.status(200).json(quiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch quiz' });
    }
});

// Update a quiz
router.put('/quiz/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, timeLimit, isActive } = req.body;
        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: { title, description, timeLimit, isActive },
        });
        res.status(200).json(updatedQuiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update quiz' });
    }
});

// Delete a quiz
router.delete('/quiz/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.quiz.delete({ where: { id } });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete quiz' });
    }
});



// Question Routes --------------------------------------


// Add a question to a quiz
router.post('/quiz/:quizId/question', async (req, res) => {
    try {
        const { quizId } = req.params;
        const { type, text, marks, options, correctAnswer, tolerance, order } = req.body;

        const question = await prisma.question.create({
            data: {
                quizId,
                type,
                text,
                marks,
                correctAnswer,
                tolerance,
                order,
                options: { create: options }, // Bulk create options
            },
        });

        res.status(201).json(question);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add question' });
    }
});

// Get all questions for a quiz
router.get('/quiz/:quizId/question', async (req, res) => {
    try {
        const { quizId } = req.params;
        const questions = await prisma.question.findMany({
            where: { quizId },
            include: { options: true }, // Include options for each question
        });
        res.status(200).json(questions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

// Update a question
router.put('/question/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { text, marks, correctAnswer, tolerance, order } = req.body;
        const updatedQuestion = await prisma.question.update({
            where: { id },
            data: { text, marks, correctAnswer, tolerance, order },
        });
        res.status(200).json(updatedQuestion);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update question' });
    }
});

// Delete a question
router.delete('/question/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.question.delete({ where: { id } });
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});


// Attempts and Answer Routes--------------------------------------

// Start a quiz attempt
router.post('/quiz/:quizId/attempt', async (req, res) => {
    try {
        const { quizId } = req.params;
        const { userId } = req.body;

        const attempt = await prisma.quizAttempt.create({
            data: { quizId, userId },
        });

        res.status(201).json(attempt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to start quiz attempt' });
    }
});

// Submit an answer for a question
router.post('/attempt/:attemptId/answer', async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { questionId, selectedOptions, textAnswer } = req.body;

        const answer = await prisma.answer.create({
            data: {
                attemptId,
                questionId,
                selectedOptions,
                textAnswer,
            },
        });

        res.status(201).json(answer);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit answer' });
    }
});

// Submit a quiz attempt
router.put('/attempt/:id/submit', async (req, res) => {
    try {
        const { id } = req.params;
        const { score, status } = req.body;

        const attempt = await prisma.quizAttempt.update({
            where: { id },
            data: { score, status },
        });

        res.status(200).json(attempt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit attempt' });
    }
});

// Evaluate a quiz attempt
router.post('/attempt/:id/evaluate', async (req, res) => {
    try {
        const { id } = req.params;

        // Example evaluation logic (implement according to your needs)
        const attempt = await prisma.quizAttempt.findUnique({
            where: { id },
            include: { answers: { include: { question: true } } },
        });

        let score = 0;
        attempt.answers.forEach(answer => {
            if (answer.isCorrect) score += answer.question.marks;
        });

        const updatedAttempt = await prisma.quizAttempt.update({
            where: { id },
            data: { score, status: 'EVALUATED' },
        });

        res.status(200).json(updatedAttempt);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to evaluate attempt' });
    }
});

export default router;