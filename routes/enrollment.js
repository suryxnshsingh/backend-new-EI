import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateUser, authorizeTeacher } from '../middlewares/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Student applies for course enrollment
router.post('/enrollments', authenticateUser, async (req, res) => {
    try {
      const { courseId } = req.body;
      const { id } = req.user;
  
      const student = await prisma.student.findUnique({
        where: { userId: id }
      });
  
      if (!student) {
        return res.status(404).json({ message: 'Student profile not found' });
      }
  
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          courseId: parseInt(courseId),
          status: 'PENDING'
        },
        include: {
          course: {
            select: {
              name: true,
              courseCode: true
            }
          }
        }
      });
  
      res.status(201).json(enrollment);
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: 'Already enrolled or applied for this course' });
      }
      res.status(500).json({ message: 'Error applying for enrollment', error });
    }
  });

// Teacher updates enrollment status (accept/reject)
router.put('/enrollments/:id/status', authenticateUser, authorizeTeacher, async (req, res) => {
    try {
      const enrollmentId = parseInt(req.params.id);
      const { status } = req.body;
      const { id } = req.user;
  
      const validStatuses = Object.values(EnrollmentStatus);
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
  
      const teacher = await prisma.teacher.findUnique({
        where: { userId: id }
      });
  
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          id: enrollmentId,
          course: {
            teacherId: teacher.id
          }
        },
        include: {
          course: true,
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
  
      if (!enrollment) {
        return res.status(404).json({ message: 'Enrollment not found or unauthorized' });
      }
  
      const updatedEnrollment = await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { status },
        include: {
          course: {
            select: {
              name: true,
              courseCode: true
            }
          },
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      });
  
      res.json(updatedEnrollment);
    } catch (error) {
      res.status(500).json({ message: 'Error updating enrollment status', error });
    }
  });

// Get pending enrollments for teacher's courses
router.get('/enrollments/pending', authenticateUser, authorizeTeacher, async (req, res) => {
  try {
    const { id } = req.user;

    const teacher = await prisma.teacher.findUnique({
      where: { userId: id }
    });

    const pendingEnrollments = await prisma.enrollment.findMany({
      where: {
        status: 'PENDING',
        course: {
          teacherId: teacher.id
        }
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            enrollmentNumber: true
          }
        },
        course: {
          select: {
            name: true,
            courseCode: true
          }
        }
      }
    });

    res.json(pendingEnrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending enrollments', error });
  }
});

// Get student's enrolled courses
router.get('/enrollments/my-courses', authenticateUser, async (req, res) => {
  try {
    const { id } = req.user;

    const student = await prisma.student.findUnique({
      where: { userId: id }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: student.id
      },
      include: {
        course: {
          select: {
            name: true,
            courseCode: true,
            session: true,
            semester: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching enrolled courses', error });
  }
});

export default router;