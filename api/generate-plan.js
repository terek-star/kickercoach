/**
 * api/generate-plan.js
 * Vercel Serverless Function für KickerCoach
 * 
 * Sichert den Google Gemini API-Key serverseitig ab und schützt
 * das Kontingent über einen konfigurierbaren Trainer-Zugangscode.
 */

export default async function handler(req, res) {
  // CORS-Header für Vercel, GitHub Pages und Localhost
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Trainer-Code'
  );

  // Preflight-Check für CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health- & Status-Check via GET
  if (req.method === 'GET') {
    const isKeySet = Boolean(process.env.GEMINI_API_KEY);
    return res.status(200).json({
      status: 'online',
      service: 'KickerCoach Gemini Proxy',
      version: '1.0',
      backendConfigured: isKeySet
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Bitte POST verwenden.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const trainerCode = (body.trainerCode || req.headers['x-trainer-code'] || '').toString().trim();
    const expectedCode = (process.env.TRAINER_ACCESS_CODE || 'kicker2026').toString().trim();
    const apiKey = process.env.GEMINI_API_KEY;

    // 1. Spezielle Aktion: Zugangscode testen / validieren
    if (body.action === 'verify-code') {
      if (!trainerCode || trainerCode !== expectedCode) {
        return res.status(401).json({
          success: false,
          error: 'Ungültiger Zugangscode. Bitte prüfe die Schreibweise.'
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Zugangscode gültig! Vereins-KI ist aktiv.',
        backendConfigured: Boolean(apiKey)
      });
    }

    // 2. Zugangscode-Prüfung für Generierungen
    if (!trainerCode || trainerCode !== expectedCode) {
      return res.status(401).json({
        error: 'Ungültiger Trainer-Zugangscode. Bitte gib den korrekten Code ein.'
      });
    }

    // 3. API-Key-Prüfung
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY ist in Vercel noch nicht als Environment Variable hinterlegt.'
      });
    }

    const prompt = body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Kein Prompt übermittelt.' });
    }

    const generationConfig = body.generationConfig || {};
    let preferredModel = (body.model || 'gemini-3.6-flash').toString().trim();

    // Veraltete Modelle automatisch auf das neueste Modell migrieren
    if (preferredModel === 'gemini-2.0-flash' || preferredModel.includes('2.0') || preferredModel.includes('1.5')) {
      preferredModel = 'gemini-3.6-flash';
    }

    // 4. Google Gemini API serverseitig mit Modell-Ausfallsicherheit aufrufen
    const modelCandidates = [...new Set([preferredModel, 'gemini-3.6-flash', 'gemini-2.5-flash'])];
    let lastError = null;
    let successfulData = null;
    let modelUsed = preferredModel;

    for (const model of modelCandidates) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const geminiPayload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: generationConfig.temperature !== undefined ? generationConfig.temperature : 0.7,
          maxOutputTokens: generationConfig.maxOutputTokens || 8192,
          ...(generationConfig.responseMimeType ? { responseMimeType: generationConfig.responseMimeType } : {})
        }
      };

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          successfulData = data;
          modelUsed = model;
          break;
        } else {
          const errData = await geminiRes.json().catch(() => ({}));
          lastError = errData.error?.message || `Gemini API Fehler (HTTP ${geminiRes.status})`;
          continue;
        }
      } catch (fetchErr) {
        lastError = fetchErr.message;
      }
    }

    if (!successfulData) {
      return res.status(502).json({ error: lastError || 'Keines der Gemini-Modelle konnte erreicht werden.' });
    }

    const candidateText = successfulData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      success: true,
      text: candidateText,
      modelUsed
    });

  } catch (err) {
    console.error('KickerCoach Proxy Error:', err);
    return res.status(500).json({
      error: `Server-Fehler: ${err.message || 'Unbekannter Fehler'}`
    });
  }
}
