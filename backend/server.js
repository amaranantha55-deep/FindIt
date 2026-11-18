require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. MONGOOSE SCHEMAS & MODELS
// ==========================================
const itemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ['lost', 'found'] },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    date: { type: Date, required: true },
    description: { type: String, required: true, trim: true },
    reporterName: { type: String, required: true, trim: true },
    reporterEmail: { type: String, required: true, trim: true },
    reporterPhone: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
  },
  { timestamps: true }
);

const claimSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    claimantName: { type: String, required: true, trim: true },
    claimantStudentId: { type: String, required: true, trim: true },
    claimantEmail: { type: String, required: true, trim: true },
    proofOfOwnership: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

const Item = mongoose.model('Item', itemSchema);
const Claim = mongoose.model('Claim', claimSchema);

// ==========================================
// 2. MATCHING LOGIC
// ==========================================
const calculateMatchScore = (sourceItem, candidateItem) => {
  let score = 0;
  const reasons = [];

  if (sourceItem.category === candidateItem.category) {
    score += 50;
    reasons.push(`Same Category (${sourceItem.category})`);
  }
  if (sourceItem.location === candidateItem.location) {
    score += 30;
    reasons.push(`Same Campus Location (${sourceItem.location})`);
  }

  const diffDays = Math.abs(new Date(sourceItem.date).getTime() - new Date(candidateItem.date).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) {
    score += 20;
    reasons.push('Within 24 hours');
  } else if (diffDays <= 3) {
    score += 15;
    reasons.push(`Within ${Math.ceil(diffDays)} days`);
  } else if (diffDays <= 7) {
    score += 10;
    reasons.push('Within 1 week');
  }

  return { score, reasons };
};

// ==========================================
// 3. API ENDPOINTS (Matches Frontend App.jsx)
// ==========================================

// GET all items
app.get('/api/items', async (req, res) => {
  try {
    const { search, type, category, location, status } = req.query;
    const query = {};

    if (type && ['lost', 'found'].includes(type)) query.type = type;
    if (category && category !== 'All') query.category = category;
    if (location && location !== 'All') query.location = location;
    if (status && ['open', 'resolved'].includes(status)) query.status = status;

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ title: regex }, { description: regex }, { reporterName: regex }];
    }

    const items = await Item.find(query).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST new item
app.post('/api/items', async (req, res) => {
  try {
    const newItem = await Item.create(req.body);
    res.status(201).json({ success: true, message: 'Report posted successfully!', data: newItem });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET smart matches
app.get('/api/items/:id/matches', async (req, res) => {
  try {
    const sourceItem = await Item.findById(req.params.id);
    if (!sourceItem) return res.status(404).json({ success: false, message: 'Item not found' });

    const oppositeType = sourceItem.type === 'lost' ? 'found' : 'lost';
    const candidates = await Item.find({ type: oppositeType, status: 'open' });

    const scoredMatches = candidates
      .map((candidate) => {
        const { score, reasons } = calculateMatchScore(sourceItem, candidate);
        return { item: candidate, matchScore: score, matchReasons: reasons };
      })
      .filter((m) => m.matchScore >= 40)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({ success: true, sourceItem, count: scoredMatches.length, matches: scoredMatches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST claim
app.post('/api/items/:id/claims', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const claim = await Claim.create({ itemId: item._id, ...req.body });
    res.status(201).json({ success: true, message: 'Claim submitted successfully!', data: claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET claims for item
app.get('/api/items/:id/claims', async (req, res) => {
  try {
    const claims = await Claim.find({ itemId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, count: claims.length, data: claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH claim status (Approve / Reject)
app.patch('/api/items/claims/:claimId', async (req, res) => {
  try {
    const { status } = req.body;
    const claim = await Claim.findByIdAndUpdate(req.params.claimId, { status }, { new: true });
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    if (status === 'approved') {
      await Item.findByIdAndUpdate(claim.itemId, { status: 'resolved' });
    }

    res.json({ success: true, message: `Claim ${status} successfully`, data: claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// SEED demo data
app.post('/api/items/seed', async (req, res) => {
  try {
    await Item.deleteMany({});
    await Claim.deleteMany({});

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const sampleItems = [
      {
        type: 'lost',
        title: 'Black Sony Wireless Headphones',
        category: 'Electronics',
        location: 'CSE Lab Block',
        date: yesterday,
        description: 'Left on Desk 14 in Lab 3 after coding session.',
        reporterName: 'Amardeep',
        reporterEmail: 'amardeep.2102508511@campus.edu',
        reporterPhone: '9876543210',
      },
      {
        type: 'found',
        title: 'Sony Black Over-Ear Headphones',
        category: 'Electronics',
        location: 'CSE Lab Block',
        date: today,
        description: 'Found near workstation rows in CSE Lab Block.',
        reporterName: 'Vijay Sai',
        reporterEmail: 'vijaysai@campus.edu',
        reporterPhone: '9876501234',
      }
    ];

    const created = await Item.insertMany(sampleItems);
    res.status(201).json({ success: true, count: created.length, data: created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. DATABASE & SERVER STARTUP
// ==========================================
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://amardeep16746_db_user:FindIt2026@findit.tzxhyuj.mongodb.net/findit_campus_db?retryWrites=true&w=majority';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas successfully');
    app.listen(PORT, () => {
      console.log(`🚀 FindIt Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });