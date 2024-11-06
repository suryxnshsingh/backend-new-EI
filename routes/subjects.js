const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('../middleware/auth');
const prisma = new PrismaClient();
const router = express.Router();


// Create a new subject
router.post('/newsubject', authenticateToken, async (req, res) => {
  const { name, code } = req.body;
  const teacherId = req.teacher.teacherId;

  try {
    const subject = await prisma.subject.create({
      data: { name, code, teacherId },
    });
    res.status(201).json(subject);
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Failed to create subject" });
  }
});
//get all subjects for a teacher

router.get('/subjects', authenticateToken, async (req, res) => {
  const teacherId = req.teacher.teacherId;

  try {
    const subjects = await prisma.subject.findMany({
      where: { teacherId },
    });
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});
//get all subjects irrespective of teacher
router.get('/allsubjects', async (req, res) => {
  try {
    const subjects = await prisma.subject.findMany();
    res.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});


// Add a student to a subject
// router.post('/subjects/:subjectId/students', authenticateToken, async (req, res) => {
//   const { subjectId } = req.params;
//   const { id, name, rollNumber } = req.body;

//   try {
//     const student = await prisma.student.create({
//       data: {
//         id,
//         name,
//         rollNumber,
//         subjectId
//       },
//     });
//     res.status(201).json(student);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to add student" });
//   }
// });

// // Get students for a specific subject
// router.get('/subjects/:subjectId/students', authenticateToken, async (req, res) => {
//   const { subjectId } = req.params;

//   try {
//     const students = await prisma.student.findMany({
//       where: { subjectId: parseInt(subjectId) },
//     });
//     res.json(students);
//   } catch (error) {
//     res.status(500).json({ error: "Failed to fetch students" });
//   }
// });

module.exports = router;