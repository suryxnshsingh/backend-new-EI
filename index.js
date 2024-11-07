const express = require('express');
const app = express();
const cors = require('cors');
const authRoutes = require('./routes/auth');


app.use(express.json());
app.use(cors());


app.use('/api/auth', authRoutes);


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});