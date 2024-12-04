import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();


// Create a new CO (Teachers only)
router.post('/co', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const { MST1_Q1, MST1_Q2, MST1_Q3, MST2_Q1, MST2_Q2, MST2_Q3, QuizAssignment_Q1, QuizAssignment_Q2, QuizAssignment_Q3, QuizAssignment_Q4, QuizAssignment_Q5, courseId } = req.body;
      const { userId } = req.user;
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });
  
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
  
      const co = await prisma.co.create({
        data: {
          MST1_Q1,
          MST1_Q2,
          MST1_Q3,
          MST2_Q1,
          MST2_Q2,
          MST2_Q3,
          QuizAssignment_Q1,
          QuizAssignment_Q2,
          QuizAssignment_Q3,
          QuizAssignment_Q4,
          QuizAssignment_Q5,
          courseId,
          teacherId: teacher.id
        }
      });
  
      res.status(201).json(co);
    } catch (error) {
      res.status(500).json({ message: 'Error creating CO', error });
    }
  });
  
  // Get all COs
  router.get('/co', authenticateUser, async (req, res) => {
    try {
      const cos = await prisma.co.findMany({
        include: {
          course: true,
          teacher: true
        }
      });
      res.json(cos);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching COs', error });
    }
  });
  
  // Get CO by ID
  router.get('/co/:id', authenticateUser, async (req, res) => {
    try {
      const co = await prisma.co.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          course: true,
          teacher: true
        }
      });
  
      if (!co) {
        return res.status(404).json({ message: 'CO not found' });
      }
  
      res.json(co);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching CO', error });
    }
  });
  
  // Update CO (Teachers only)
  router.put('/co/:id', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const coId = parseInt(req.params.id);
      const { MST1_Q1, MST1_Q2, MST1_Q3, MST2_Q1, MST2_Q2, MST2_Q3, QuizAssignment_Q1, QuizAssignment_Q2, QuizAssignment_Q3, QuizAssignment_Q4, QuizAssignment_Q5 } = req.body;
      const { userId } = req.user;
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });
  
      const co = await prisma.co.findFirst({
        where: {
          id: coId,
          teacherId: teacher.id
        }
      });
  
      if (!co) {
        return res.status(404).json({ message: 'CO not found or unauthorized' });
      }
  
      const updatedCo = await prisma.co.update({
        where: { id: coId },
        data: {
          MST1_Q1,
          MST1_Q2,
          MST1_Q3,
          MST2_Q1,
          MST2_Q2,
          MST2_Q3,
          QuizAssignment_Q1,
          QuizAssignment_Q2,
          QuizAssignment_Q3,
          QuizAssignment_Q4,
          QuizAssignment_Q5
        }
      });
  
      res.json(updatedCo);
    } catch (error) {
      res.status(500).json({ message: 'Error updating CO', error });
    }
  });
  
  // Delete CO (Teachers only)
  router.delete('/co/:id', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const coId = parseInt(req.params.id);
      const { userId } = req.user;
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: userId }
      });
  
      const co = await prisma.co.findFirst({
        where: {
          id: coId,
          teacherId: teacher.id
        }
      });
  
      if (!co) {
        return res.status(404).json({ message: 'CO not found or unauthorized' });
      }
  
      await prisma.co.delete({
        where: { id: coId }
      });
  
      res.json({ message: 'CO deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting CO', error });
    }
  });

  export default router;