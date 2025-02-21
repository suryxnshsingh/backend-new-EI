import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/course.js';
import enrollmentRoutes from './routes/enrollment.js';
import coRoutes from './routes/co.js';
import attendanceRoutes from './routes/attendance.js';
import assignmentRoutes from './routes/assignment.js';
import notesRoutes from './routes/notes.js';
import quizStudentRoutes from './routes/quizStudent.js';
import quizTeacherRoutes from './routes/quizTeacher.js';


const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use((req, res, next) => {
  console.log('Incoming Request:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path
  }, '\n\n----------------------------------\n\n');
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/quiz/student', quizStudentRoutes);
app.use('/api/quiz/teacher', quizTeacherRoutes);
app.use('/api/co', coRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


