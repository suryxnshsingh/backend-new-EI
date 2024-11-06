const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();



router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const existingTeacher = await prisma.teacher.findUnique({ where: { email } });
    if (existingTeacher) {
      return res.status(400).json({ error: "Teacher already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await prisma.teacher.create({
      data: { firstName, lastName, email, password: hashedPassword },
    });

    res.status(201).json(teacher);
  } catch (error) {
    res.status(500).json({ error: "Something went wrong" });
  }
});


router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, teacher.password);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ teacherId: teacher.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;