require('dotenv').config();
const express = require('express');
const path = require('path');
const { searchDrugs, buildEvidenceBundle } = require('./lib/ddi-engine');
const { runDDIAnalysis } = require('./lib/ai-analysis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/drugs', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter "q"' });
  }

  try {
    const results = searchDrugs(query);
    res.json({ data: results });
  } catch (error) {
    console.error('Error searching drugs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/analyze', async (req, res) => {
  const { drug1Id, drug2Id } = req.body;

  if (!drug1Id || !drug2Id) {
    return res.status(400).json({ error: 'Missing drug1Id or drug2Id' });
  }

  try {
    const bundle = buildEvidenceBundle(drug1Id, drug2Id);
    const result = await runDDIAnalysis(drug1Id, drug2Id, bundle);
    res.json({ data: result });
  } catch (error) {
    console.error('Error analyzing interaction:', error);
    res.status(500).json({ error: 'Failed to complete analysis: ' + error.message });
  }
});

app.post('/api/qa', async (req, res) => {
  const { question, drug1Id, drug2Id } = req.body;
  if (!question || !drug1Id || !drug2Id) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const bundle = buildEvidenceBundle(drug1Id, drug2Id);
    const { askQuestion } = require('./lib/ai-analysis');
    const answer = await askQuestion(question, bundle);
    res.json({ data: answer });
  } catch (error) {
    console.error('Error in Q&A:', error);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` FARMA DDI CHECKER — Node.js Server Running!`);
  console.log(` Access Application: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
