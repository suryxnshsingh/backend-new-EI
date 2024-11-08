import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Create a new course (Teachers only)
router.post('/courses', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const { name, courseCode, session, semester } = req.body;
      const { id, firstName, lastName } = req.user;
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: id }
      });
  
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }
  
      const course = await prisma.course.create({
        data: {
          name,
          courseCode,
          session,
          semester,
          teacherId: teacher.id
        },
        include: {
          teacher: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
  
      res.status(201).json(course);
    } catch (error) {
      console.error('Error creating course:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Course code already exists' });
      } else if (error.code === 'P2003') {
        return res.status(400).json({ message: 'Invalid teacher ID' });
      } else {
        res.status(500).json({ message: 'Error creating course', error });
      }
    }
  });

// Get all courses with enrollment counts
router.get('/courses', authenticateUser, async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { enrollments: true }
        }
      }
    });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching courses', error });
  }
});

// Get course details with enrolled students
router.get('/courses/:id', authenticateUser, async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        enrollments: {
          include: {
            student: {
              select: {
                firstName: true,
                lastName: true,
                enrollmentNumber: true
              }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching course details', error });
  }
});

// Update course details (Teachers only)
router.put('/courses/:id', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const { name, courseCode, session, semester } = req.body;
    const { id } = req.user;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: id }
    });

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId: teacher.id
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        name,
        courseCode,
        session,
        semester
      }
    });

    res.json(updatedCourse);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Course code already exists' });
    }
    res.status(500).json({ message: 'Error updating course', error });
  }
});

// Delete course (Teachers only)
router.delete('/courses/:id', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const { id } = req.user;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: id }
    });

    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        teacherId: teacher.id
      }
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found or unauthorized' });
    }

    await prisma.course.delete({
      where: { id: courseId }
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting course', error });
  }
});

export default router;