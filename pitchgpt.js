npx create-next-app@latest pitchgpt --typescript
// Next.js + OpenAI API starter for PitchGPT

// 1. Create a new Next.js app:
// npx create-next-app@latest pitchgpt --typescript
// cd pitchgpt

// 2. Install dependencies:
// npm install openai

// 3. Create .env.local in the root with your OpenAI key
// OPENAI_API_KEY=sk-...

// 4. pages/api/pitchgpt.ts - OpenAI proxy endpoint

import type { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, OpenAIApi } from 'openai';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are PitchGPT, an AI coach for startup founders writing applications for accelerators like YC. Help the user with suggestions, rewrites, or feedback on their pitch.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const reply = completion.data.choices[0].message?.content || '';
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
}

// 5. Add the PitchGPTChat.tsx component I shared earlier into `components/`
// 6. Use <PitchGPTChat /> in pages/index.tsx
// 7. Deploy to Vercel when ready

// Let me know if you want auth, Stripe, DB, or question auto-tagging next!
