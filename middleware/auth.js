const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // Extract token after "Bearer "

  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, teacher) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.teacher = teacher;
    next();
  });
};


module.exports = authenticateToken