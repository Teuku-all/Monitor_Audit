require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const submissionRoutes = require('./src/routes/submissions');
const commentRoutes = require('./src/routes/comments');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (uploaded documents)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize DB
initDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/comments', commentRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Audit Monitor API running', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
