const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const stringSimilarity = require('string-similarity');
require('dotenv').config();

// Konfiguration av OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Detaljerad systemprompt
const systemPrompt = `
Introduktion
Du är en redaktionell AI-assistent designad för att hjälpa journalister med innehållsförbättring och skapande. Du har samma kapaciteter som Chat GPT och bör använda markdown för att förbättra läsbarhet i text. Mentions and capitalization rules apply to headlines and text. Correct errors in spelling and provide feedback strictly on incorrect parts only. Fetch articles through getArticles() when provided a URL, and request reading access to Google Docs when lacking access. Use content.searchEmbeddedArticles for further research and provide feedback for iterative improvements.
`;

// Middleware för autentisering
const authCheck = (req, res, next) => {
  if (!req.isAuthenticated()) {
    res.redirect('/auth/login');
  } else {
    next();
  }
};

// Inkludera express-session i app.js
const session = require('express-session');

// Lägg till session middleware
router.use(session({
  secret: 'your_secret_key', // Uppdatera detta till en säker hemlighet
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Sätt till true om du använder HTTPS
}));

// Route för att visa prompt-formuläret med systemPrompt och eventuell befintlig data
router.get('/compare', authCheck, (req, res) => {
  const compareData = req.session.compareData || null;
  res.render('compare', { user: req.user, systemPrompt, compareData });
});

// Route för att hantera prompt-inmatning och API-anrop
router.post('/compare', authCheck, async (req, res) => {
  const { prompts, expectedResult } = req.body;
  const iterations = parseInt(req.body.iterations, 10);

  // Validera indata
  if (!prompts || !iterations) {
    return res.status(400).send('Promptar och antal iterationer är obligatoriska fält.');
  }

  // Spara användarens indata i sessionen
  req.session.compareData = {
    prompts,
    expectedResult,
    iterations
  };

  const results = [];

  for (const promptObj of prompts) {
    const { prompt, context } = promptObj;

    const fullPrompt = `${prompt}\n\n${context}`;

    const promptResults = [];
    for (let i = 0; i < iterations; i++) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt },
          ],
          max_tokens: 2000,
          n: 1,
          temperature: 0.7,
        });

        const generatedText = response.choices[0].message.content.trim();

        // Utvärdera svaret mot den förväntade beskrivningen
        let evaluation = null;
        if (expectedResult && expectedResult.trim() !== '') {
          const evaluationSystemPrompt = `
Du är en noggrann och objektiv utvärderare av AI-svar.
Din uppgift är att analysera hur väl ett AI-genererat
svar uppfyller förväntningarna, baserat på användarens
indata.
`;

          const evaluationPrompt = `
Du ska utvärdera ett svar baserat på användarens indata och
förväntningar. Analysera svaret i förhållande till
användarens prompt och kontext, och avgör hur väl det
uppfyller förväntningen. Ge en poäng mellan 1 och 10 och
förklara ditt resonemang kortfattat.

**Användarens prompt:**
${prompt}

**Användarens kontext:**
${context}

**Förväntning:**
${expectedResult}

**Genererat svar:**
${generatedText}

**Din bedömning:**
Poäng: [ange poäng mellan 1 och 10]
Motivering: [ange kort motivering]
`;

          const evalResponse = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: evaluationSystemPrompt },
              { role: 'user', content: evaluationPrompt },
            ],
            max_tokens: 1000,
            n: 1,
            temperature: 0,
          });

          const evaluationText = evalResponse.choices[0].message.content.trim();

          const evaluationMatch = evaluationText.match(
            /Poäng:\s*(\d+)\s*Motivering:\s*(.*)/s
          );
          let score = null;
          let reasoning = null;
          if (evaluationMatch) {
            score = evaluationMatch[1];
            reasoning = evaluationMatch[2].trim();
          } else {
            reasoning = evaluationText;
          }

          evaluation = {
            score: score,
            reasoning: reasoning,
          };
        }

        promptResults.push({
          output: generatedText,
          evaluation: evaluation,
        });
      } catch (error) {
        console.error('Error calling OpenAI API:', error.message);
        return res.status(500).send('Fel vid anrop till OpenAI API.');
      }
    }

    let consistency = null;
    if (promptResults.length > 1) {
      let totalSimilarity = 0;
      let comparisons = 0;

      for (let i = 0; i < promptResults.length; i++) {
        for (let j = i + 1; j < promptResults.length; j++) {
          const sim = stringSimilarity.compareTwoStrings(
            promptResults[i].output,
            promptResults[j].output
          );
          totalSimilarity += sim;
          comparisons++;
        }
      }

      consistency = (totalSimilarity / comparisons) * 100; // Procent
      consistency = consistency.toFixed(2);
    }

    let consistencyAnalysis = null;
    if (promptResults.length > 1) {
      const outputsList = promptResults
        .map((result, idx) => `Svar ${idx + 1}:\n${result.output}`)
        .join('\n\n');

      const comparisonPrompt = `
Du är en AI-assistent som ska analysera hur likartade
följande svar är.

**Svar att jämföra:**
${outputsList}

**Din analys:**
- Beskriv hur lika svaren är i innehåll, ton och stil.
- Notera eventuella skillnader och variationer mellan svaren.
- Bedöm om svaren är konsekventa eller om det finns
  betydande avvikelser.
- Ge en sammanfattande kommentar om modellens konsekvens
  över iterationerna.
`;

      try {
        const analysisResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: comparisonPrompt }],
          max_tokens: 500,
          temperature: 0,
        });

        consistencyAnalysis = analysisResponse.choices[0].message.content.trim();
      } catch (error) {
        console.error('Error getting consistency analysis:', error.message);
        consistencyAnalysis = 'Kunde inte genomföra konsistensanalys.';
      }
    } else {
      consistencyAnalysis = 'Endast en iteration, ingen konsistensanalys tillgänglig.';
    }

    results.push({
      prompt: promptObj.prompt,
      context: promptObj.context,
      outputs: promptResults,
      consistency: consistency,
      consistencyAnalysis: consistencyAnalysis,
      expectedResult: expectedResult // Lägg till så att den kan användas i vyn för varje prompt
    });
  }

  res.render('results', {
    results,
    user: req.user,
    systemPrompt,
  });

  // Töm sessionens compareData om du vill rensa det efter att ha visat resultaten
  // req.session.compareData = null;
});

module.exports = router;